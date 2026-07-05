import React, { createContext, useContext } from "react";
import { useQuery, useMutation, useQueryClient, UseMutationResult } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface User {
  id: number;
  email: string | null;
  username: string;
  fullName: string;
  role: "admin" | "employee" | "superadmin";
  nik: string | null;
  branch: string | null;
  position: string | null;
  shift: string | null;
  photoUrl: string | null;
  isAdmin: boolean;
  registrationStatus: "unregistered" | "pending" | "approved" | "rejected";
  phoneNumber?: string | null;
  birthPlace?: string | null;
  birthDate?: string | null;
  gender?: "Laki-laki" | "Perempuan" | null;
  religion?: string | null;
  address?: string | null;
  npwp?: string | null;
  bpjs?: string | null;
  npwpPhotoUrl?: string | null;
  bpjsPhotoUrl?: string | null;
  bankAccount?: string | null;
  ktpPhotoUrl?: string | null;
  joinDate?: string | null;
  employmentStatus?: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginMutation: UseMutationResult<User, Error, any>;
  logoutMutation: UseMutationResult<any, Error, void>;
  registerMutation: UseMutationResult<any, Error, any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: user = null, isLoading } = useQuery<User | null>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/user", { credentials: "include" });
        if (res.status === 401) return null;
        if (!res.ok) throw new Error("Gagal mengambil data user");
        return await res.json();
      } catch (err) {
        return null;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginMutation = useMutation<User, Error, any>({
    mutationFn: async (credentials) => {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Login gagal");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/user"], data);
      if (data.role === "employee") {
        if (data.registrationStatus === "pending") {
          setLocation("/employee/pending");
        } else if (data.registrationStatus === "approved") {
          setLocation("/employee");
        } else {
          setLocation("/employee/registration");
        }
      } else {
        setLocation("/admin/dashboard");
      }
    },
  });

  const logoutMutation = useMutation<any, Error, void>({
    mutationFn: async () => {
      const res = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Logout gagal");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      if (window.location.pathname.startsWith("/admin")) {
        setLocation("/admin/login");
      } else {
        setLocation("/login");
      }
    },
  });

  const registerMutation = useMutation<any, Error, any>({
    mutationFn: async (userData) => {
      const isFormData = userData instanceof FormData;
      const res = await fetch("/api/register", {
        method: "POST",
        headers: isFormData ? undefined : { "Content-Type": "application/json" },
        body: isFormData ? userData : JSON.stringify(userData),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Registrasi gagal");
      }
      return await res.json();
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth harus digunakan di dalam AuthProvider");
  }
  return context;
}
