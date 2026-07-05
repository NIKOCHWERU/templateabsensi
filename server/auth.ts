import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
// @ts-ignore
import MySQLStore from "express-mysql-session";
import crypto from "crypto";
import { Express, Request, Response, NextFunction } from "express";
import { db, pool } from "./db.js";
import { users } from "../shared/schema.js";
import { eq } from "drizzle-orm";

const { scrypt, randomBytes } = crypto;

export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");
    scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

export async function comparePasswords(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const parts = hash.split(":");
    if (parts.length !== 2) return resolve(false);
    const [salt, key] = parts;
    scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey.toString("hex") === key);
    });
  });
}

export function setupAuth(app: Express) {
  // Use MySQL for session storage
  const SessionStore = (MySQLStore as any)(session);
  const sessionStore = new SessionStore({}, pool as any);

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "fallback-secret-key-abc",
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        secure: false, // Set to true if running behind HTTPS
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Query user from DB (check both username and nik)
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user) {
          return done(null, false, { message: "Username atau NIK tidak ditemukan" });
        }

        // Employee password check is bypassed (NIK-only login)
        if (user.role === "employee") {
          return done(null, user);
        }

        // Admins and Superadmins require password check
        const isValid = await comparePasswords(password, user.password);
        if (!isValid) {
          return done(null, false, { message: "Kata sandi salah" });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      done(null, user || null);
    } catch (err) {
      done(err);
    }
  });

  // API Endpoints for Auth
  app.post("/api/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Login gagal" });
      }
      req.logIn(user, (err) => {
        if (err) return next(err);
        return res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout gagal" });
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ message: "Logout berhasil" });
      });
    });
  });

  app.get("/api/user", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Belum masuk" });
    }
    res.json(req.user);
  });
}

// Middlewares
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: "Silakan login terlebih dahulu" });
}

export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && (req.user as any).role !== "employee") return next();
  res.status(403).json({ message: "Akses ditolak: Khusus Admin" });
}
