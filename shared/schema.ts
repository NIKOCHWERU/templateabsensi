import { mysqlTable, mysqlEnum, varchar, text, int, boolean, timestamp, date, index } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  email: varchar("email", { length: 255 }), // Nullable for employees
  username: varchar("username", { length: 255 }).unique(), // Can be NIK for employees
  password: varchar("password", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["admin", "employee", "superadmin"]).notNull().default("employee"),
  nik: varchar("nik", { length: 50 }).unique(), // Specific for employees
  branch: varchar("branch", { length: 100 }),
  position: varchar("position", { length: 100 }),
  shift: varchar("shift", { length: 50 }),
  photoUrl: varchar("photo_url", { length: 512 }),
  isAdmin: boolean("is_admin").default(false),
  phoneNumber: varchar("phone_number", { length: 20 }),
  // Registration data
  birthPlace: varchar("birth_place", { length: 100 }),
  birthDate: date("birth_date"),
  gender: mysqlEnum("gender", ["Laki-laki", "Perempuan"]),
  religion: varchar("religion", { length: 50 }),
  address: text("address"),
  npwp: varchar("npwp", { length: 50 }),
  bpjs: varchar("bpjs", { length: 50 }),
  npwpPhotoUrl: varchar("npwp_photo_url", { length: 512 }),
  bpjsPhotoUrl: varchar("bpjs_photo_url", { length: 512 }),
  bankAccount: varchar("bank_account", { length: 100 }),
  ktpPhotoUrl: varchar("ktp_photo_url", { length: 512 }),
  registrationStatus: mysqlEnum("registration_status", ["unregistered", "pending", "approved", "rejected"]).notNull().default("unregistered"),
  joinDate: varchar("join_date", { length: 50 }),
  employmentStatus: varchar("employment_status", { length: 50 }), // e.g., Kontrak, Tetap
});

export const shifts = mysqlTable("shifts", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 50 }).notNull(),
  checkInTime: varchar("check_in_time", { length: 10 }).notNull(), // HH:mm
  checkOutTime: varchar("check_out_time", { length: 10 }).notNull(), // HH:mm
  description: text("description"),
});

export const attendance = mysqlTable("attendance", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  date: date("date").notNull(), // YYYY-MM-DD

  checkIn: timestamp("check_in"),
  checkInPhoto: varchar("check_in_photo", { length: 255 }),
  checkInLocation: text("check_in_location"),

  breakStart: timestamp("break_start"),
  breakStartPhoto: varchar("break_start_photo", { length: 255 }),
  breakStartLocation: text("break_start_location"),

  breakEnd: timestamp("break_end"),
  breakEndPhoto: varchar("break_end_photo", { length: 255 }),
  breakEndLocation: text("break_end_location"),

  checkOut: timestamp("check_out"),
  checkOutPhoto: varchar("check_out_photo", { length: 255 }),
  checkOutLocation: text("check_out_location"),
  
  shiftId: int("shift_id"), // Linked to shifts table
  shift: varchar("shift", { length: 50 }), // Keep for legacy/description
  sessionNumber: int("session_number").default(1), // Track multiple sessions per day
  status: mysqlEnum("status", ["present", "late", "sick", "permission", "cuti", "absent", "off"]).default("absent"),
  notes: text("notes"), // For permission/sick details
  lateReason: text("late_reason"),
  lateReasonPhoto: varchar("late_reason_photo", { length: 255 }),
  permitExitAt: timestamp("permit_exit_at"), // When they left for permit mid-day
  permitResumeAt: timestamp("permit_resume_at"), // When they resumed work
  isFakeGps: boolean("is_fake_gps").default(false),
}, (table) => ({
  userIdIdx: index("idx_attendance_user_id").on(table.userId),
  dateIdx: index("idx_attendance_date").on(table.date),
  userDateIdx: index("idx_attendance_user_date").on(table.userId, table.date),
}));

export const announcements = mysqlTable("announcements", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  imageUrl: varchar("image_url", { length: 512 }),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  authorId: int("author_id"),
}, (table) => ({
  createdAtIdx: index("idx_announcements_created_at").on(table.createdAt),
}));

export const complaints = mysqlTable("complaints", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  status: mysqlEnum("status", ["pending", "reviewed", "resolved"]).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("idx_complaints_user_id").on(table.userId),
  createdAtIdx: index("idx_complaints_created_at").on(table.createdAt),
}));

export const leaveRequests = mysqlTable("leave_requests", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  selectedDates: text("selected_dates"), // Comma separated dates for non-contiguous selection
  reason: text("reason").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "cancelled"]).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("idx_leave_request_user_id").on(table.userId),
  statusIdx: index("idx_leave_request_status").on(table.status),
}));

export const complaintPhotos = mysqlTable("complaint_photos", {
  id: int("id").primaryKey().autoincrement(),
  complaintId: int("complaint_id").notNull(),
  photoUrl: varchar("photo_url", { length: 512 }).notNull(),
  caption: text("caption"),
});

export const sessions = mysqlTable("sessions", {
  id: varchar("session_id", { length: 128 }).primaryKey(),
  expires: int("expires").notNull(),
  data: text("data"),
});

export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: varchar("p256dh", { length: 255 }).notNull(),
  auth: varchar("auth", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("idx_push_sub_user_id").on(table.userId),
}));

// Resignations Table
export const resignations = mysqlTable("resignations", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  resignDate: date("resign_date").notNull(),
  reason: text("reason").notNull(),
  documentUrl: varchar("document_url", { length: 512 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("idx_resignations_user_id").on(table.userId),
}));

// Mutations, Promotions, Demotions Table
export const mutations = mysqlTable("mutations", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  type: mysqlEnum("type", ["mutasi", "promosi", "demosi"]).notNull(),
  oldBranch: varchar("old_branch", { length: 100 }),
  newBranch: varchar("new_branch", { length: 100 }),
  oldPosition: varchar("old_position", { length: 100 }),
  newPosition: varchar("new_position", { length: 100 }),
  documentUrl: varchar("document_url", { length: 512 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("idx_mutations_user_id").on(table.userId),
}));

// Warning Letters Table (SP1, SP2, SP3)
export const warningLetters = mysqlTable("warning_letters", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  type: mysqlEnum("type", ["SP1", "SP2", "SP3"]).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  documentUrl: varchar("document_url", { length: 512 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("idx_warning_letters_user_id").on(table.userId),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  attendanceRecords: many(attendance),
  announcements: many(announcements),
  complaints: many(complaints),
  leaveRequests: many(leaveRequests),
  pushSubscriptions: many(pushSubscriptions),
  resignations: many(resignations),
  mutations: many(mutations),
  warningLetters: many(warningLetters),
}));

export const shiftsRelations = relations(shifts, ({ many }) => ({
  attendanceRecords: many(attendance),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  user: one(users, {
    fields: [attendance.userId],
    references: [users.id],
  }),
  shiftData: one(shifts, {
    fields: [attendance.shiftId],
    references: [shifts.id],
  }),
}));

export const announcementsRelations = relations(announcements, ({ one }) => ({
  author: one(users, {
    fields: [announcements.authorId],
    references: [users.id],
  }),
}));

export const complaintsRelations = relations(complaints, ({ one, many }) => ({
  user: one(users, {
    fields: [complaints.userId],
    references: [users.id],
  }),
  photos: many(complaintPhotos),
}));

export const complaintPhotosRelations = relations(complaintPhotos, ({ one }) => ({
  complaint: one(complaints, {
    fields: [complaintPhotos.complaintId],
    references: [complaints.id],
  }),
}));

export const resignationsRelations = relations(resignations, ({ one }) => ({
  user: one(users, {
    fields: [resignations.userId],
    references: [users.id],
  }),
}));

export const mutationsRelations = relations(mutations, ({ one }) => ({
  user: one(users, {
    fields: [mutations.userId],
    references: [users.id],
  }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertShiftSchema = createInsertSchema(shifts).omit({ id: true });
export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true });
export const insertAnnouncementSchema = createInsertSchema(announcements).omit({ id: true, createdAt: true });
export const insertComplaintSchema = createInsertSchema(complaints).omit({ id: true, createdAt: true });
export const insertComplaintPhotoSchema = createInsertSchema(complaintPhotos).omit({ id: true });
export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({ id: true, createdAt: true });
export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true });
export const insertResignationSchema = createInsertSchema(resignations).omit({ id: true, createdAt: true });
export const insertMutationSchema = createInsertSchema(mutations).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Shift = typeof shifts.$inferSelect;
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Complaint = typeof complaints.$inferSelect;
export type InsertComplaint = z.infer<typeof insertComplaintSchema>;
export type ComplaintPhoto = typeof complaintPhotos.$inferSelect;
export type InsertComplaintPhoto = z.infer<typeof insertComplaintPhotoSchema>;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type Resignation = typeof resignations.$inferSelect;
export type InsertResignation = z.infer<typeof insertResignationSchema>;
export type Mutation = typeof mutations.$inferSelect;
export type InsertMutation = z.infer<typeof insertMutationSchema>;
