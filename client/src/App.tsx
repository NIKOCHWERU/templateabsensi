import { Route, Switch, Redirect } from "wouter";
import { AuthProvider, useAuth } from "./hooks/use-auth.js";
import { Toaster } from "./components/ui/toaster.js";
import { TooltipProvider } from "./components/ui/tooltip.js";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

// Page imports
import LoginPage from "./pages/LoginPage.js";
import AdminLoginPage from "./pages/admin/AdminLoginPage.js";
import SignupPage from "./pages/employee/SignupPage.js";
import StatusPendingPage from "./pages/employee/StatusPendingPage.js";
import EmployeeDashboard from "./pages/employee/DashboardPage.js";
import LeavePage from "./pages/employee/LeavePage.js";
import RecapPage from "./pages/employee/RecapPage.js";
import ComplaintPage from "./pages/employee/ComplaintPage.js";
import ProfilePage from "./pages/employee/ProfilePage.js";
import InfoPage from "./pages/employee/InfoPage.js";
import RegistrationPage from "./pages/employee/RegistrationPage.js";

import AdminDashboard from "./pages/admin/DashboardPage.js";
import EmployeeListPage from "./pages/admin/EmployeeListPage.js";
import AttendanceHistoryPage from "./pages/admin/AttendanceHistoryPage.js";
import AdminRecapPage from "./pages/admin/RecapPage.js";
import AttendanceSummaryPage from "./pages/admin/AttendanceSummaryPage.js";
import AdminVerificationPage from "./pages/admin/AdminVerificationPage.js";
import AdminLeavePage from "./pages/admin/AdminLeavePage.js";
import AdminLeaveHistoryPage from "./pages/admin/AdminLeaveHistoryPage.js";
import MutationManagementPage from "./pages/admin/MutationManagementPage.js";
import MutationHistoryPage from "./pages/admin/MutationHistoryPage.js";
import WarningLetterManagementPage from "./pages/admin/WarningLetterManagementPage.js";
import AdminShiftPage from "./pages/admin/AdminShiftPage.js";
import AdminManageAdminsPage from "./pages/admin/AdminManageAdminsPage.js";
import AdminProfilePage from "./pages/admin/AdminProfilePage.js";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage.js";
import BackupPage from "./pages/admin/BackupPage.js";
import InfoBoardPage from "./pages/admin/InfoBoardPage.js";
import ActivityLogsPage from "./pages/admin/ActivityLogsPage.js";
import ComplaintsPage from "./pages/admin/ComplaintsPage.js";
import ResignManagementPage from "./pages/admin/ResignManagementPage.js";
import ResignHistoryPage from "./pages/admin/ResignHistoryPage.js";
import AdminLayout from "./components/layout/AdminLayout.js";

// Redirect components — harus berupa named component agar hooks valid di dalamnya
function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-xs text-slate-400">Memuat aplikasi...</div>;
  if (!user) return <Redirect to="/login" />;
  return <Redirect to={user.role === "employee" ? "/employee" : "/admin/dashboard"} />;
}

function AdminRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-xs text-slate-500">Memuat...</div>;
  if (!user) return <Redirect to="/admin/login" />;
  return <Redirect to={user.role === "employee" ? "/employee" : "/admin/dashboard"} />;
}

function ProtectedRoute({ component: Component, roles }: { component: React.ComponentType<any>, roles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-xs text-slate-400">
        Memuat aplikasi...
      </div>
    );
  }

  const path = window.location.pathname;

  if (!user) {
    if (path.startsWith("/admin")) {
      return <Redirect to="/admin/login" />;
    }
    return <Redirect to="/login" />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Redirect to={user.role === "employee" ? "/employee" : "/admin/dashboard"} />;
  }

  // Handle registration screen routing for employee
  if (user.role === "employee") {
    if (user.registrationStatus === "unregistered" && path !== "/employee/registration") {
      return <Redirect to="/employee/registration" />;
    }
    if (user.registrationStatus === "pending" && path !== "/employee/pending") {
      return <Redirect to="/employee/pending" />;
    }
    if (user.registrationStatus === "rejected" && path !== "/employee/registration") {
      return <Redirect to="/employee/registration" />;
    }
    if (user.registrationStatus === "approved" && (path === "/employee/pending" || path === "/employee/registration")) {
      return <Redirect to="/employee" />;
    }
  }

  return <Component />;
}

export default function App() {
  const { data: config } = useQuery<any>({
    queryKey: ["/api/config"],
  });

  useEffect(() => {
    if (config) {
      // 1. Update Document Title
      document.title = `${config.singkatanPt || config.namaPt || "PT ABC"} - Sistem Absensi`;

      // 2. Inject Dynamic CSS Theme Variables
      const root = document.documentElement;
      if (config.themePrimary) root.style.setProperty("--primary", config.themePrimary);
      if (config.themeSecondary) root.style.setProperty("--secondary", config.themeSecondary);
      if (config.themeAccent) root.style.setProperty("--accent", config.themeAccent);
      if (config.themeBackground) root.style.setProperty("--background", config.themeBackground);
      if (config.themeSidebarAccent) root.style.setProperty("--sidebar-accent", config.themeSidebarAccent);
      if (config.themePrimary) root.style.setProperty("--ring", config.themePrimary);

      // 3. Generate and Inject Dynamic Favicon SVG
      const initial = config.logoInisial || (config.singkatanPt ? config.singkatanPt.charAt(0) : (config.namaPt ? config.namaPt.charAt(0) : "A"));
      const faviconSvg = `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
          <rect width='100' height='100' rx='22' fill='%23f97316'/>
          <text x='50' y='72' font-family='Outfit, Arial, sans-serif' font-size='65' font-weight='900' fill='white' text-anchor='middle'>${initial}</text>
        </svg>
      `.trim().replace(/\s+/g, ' ');

      let faviconLink = document.getElementById("dynamic-favicon") as HTMLLinkElement;
      if (!faviconLink) {
        faviconLink = document.createElement("link");
        faviconLink.id = "dynamic-favicon";
        faviconLink.rel = "icon";
        faviconLink.type = "image/svg+xml";
        document.head.appendChild(faviconLink);
      }
      faviconLink.href = `data:image/svg+xml,${encodeURIComponent(faviconSvg)}`;
    }
  }, [config]);

  return (
    <AuthProvider>
      <TooltipProvider>
        <div className="app-capslock min-h-screen flex flex-col">
          <Switch>
            {/* Auth routes (public) */}
            <Route path="/login" component={LoginPage} />
            <Route path="/admin/login" component={AdminLoginPage} />
            <Route path="/employee/signup" component={SignupPage} />

            {/* Root & admin redirects — gunakan component= agar hooks valid */}
            <Route path="/" component={RootRedirect} />
            <Route path="/admin" component={AdminRedirect} />

            {/* Employee Protected routes */}
            <Route path="/employee/pending">
              {() => <ProtectedRoute component={StatusPendingPage} roles={["employee"]} />}
            </Route>
            <Route path="/employee/leave">
              {() => <ProtectedRoute component={LeavePage} roles={["employee"]} />}
            </Route>
            <Route path="/employee/recap">
              {() => <ProtectedRoute component={RecapPage} roles={["employee"]} />}
            </Route>
            <Route path="/employee/complaint">
              {() => <ProtectedRoute component={ComplaintPage} roles={["employee"]} />}
            </Route>
            <Route path="/employee/profile">
              {() => <ProtectedRoute component={ProfilePage} roles={["employee"]} />}
            </Route>
            <Route path="/employee/info">
              {() => <ProtectedRoute component={InfoPage} roles={["employee"]} />}
            </Route>
            <Route path="/employee/registration">
              {() => <ProtectedRoute component={RegistrationPage} roles={["employee"]} />}
            </Route>
            <Route path="/employee">
              {() => <ProtectedRoute component={EmployeeDashboard} roles={["employee"]} />}
            </Route>

            {/* Admin Protected routes */}
            <Route path="/admin/dashboard">
              {() => <AdminLayout><ProtectedRoute component={AdminDashboard} roles={["admin", "superadmin"]} /></AdminLayout>}
            </Route>
            <Route path="/admin/employees">
              {() => <AdminLayout><ProtectedRoute component={EmployeeListPage} roles={["admin", "superadmin"]} /></AdminLayout>}
            </Route>
            <Route path="/admin/attendance">
              {() => <AdminLayout><ProtectedRoute component={AttendanceHistoryPage} roles={["admin", "superadmin"]} /></AdminLayout>}
            </Route>
            <Route path="/admin/recap">
              {() => <AdminLayout><ProtectedRoute component={AdminRecapPage} roles={["admin", "superadmin"]} /></AdminLayout>}
            </Route>
            <Route path="/admin/summary">
              {() => <AdminLayout><ProtectedRoute component={AttendanceSummaryPage} roles={["admin", "superadmin"]} /></AdminLayout>}
            </Route>
            <Route path="/admin/verification">
              {() => <AdminLayout><ProtectedRoute component={AdminVerificationPage} roles={["admin", "superadmin"]} /></AdminLayout>}
            </Route>
            <Route path="/admin/leaves">
              {() => <AdminLayout><ProtectedRoute component={AdminLeavePage} roles={["admin", "superadmin"]} /></AdminLayout>}
            </Route>
            <Route path="/admin/leaves-history">
              {() => <AdminLayout><ProtectedRoute component={AdminLeaveHistoryPage} roles={["admin", "superadmin"]} /></AdminLayout>}
            </Route>
            <Route path="/admin/mutations">
              {() => <AdminLayout><ProtectedRoute component={MutationManagementPage} roles={["admin", "superadmin"]} /></AdminLayout>}
            </Route>
            <Route path="/admin/mutations-history">
              {() => <AdminLayout><ProtectedRoute component={MutationHistoryPage} roles={["admin", "superadmin"]} /></AdminLayout>}
            </Route>
            <Route path="/admin/warning-letters">
              {() => <AdminLayout><ProtectedRoute component={WarningLetterManagementPage} roles={["admin", "superadmin"]} /></AdminLayout>}
            </Route>
            <Route path="/admin/shifts">
              {() => <AdminLayout><ProtectedRoute component={AdminShiftPage} roles={["admin", "superadmin"]} /></AdminLayout>}
            </Route>
            <Route path="/admin/manage-admins">
              {() => <AdminLayout><ProtectedRoute component={AdminManageAdminsPage} roles={["admin", "superadmin"]} /></AdminLayout>}
            </Route>
            <Route path="/admin/activity-logs">
              {() => <AdminLayout><ProtectedRoute component={ActivityLogsPage} roles={["superadmin"]} /></AdminLayout>}
            </Route>
            <Route path="/admin/profile">
              {() => <AdminLayout><ProtectedRoute component={AdminProfilePage} roles={["admin", "superadmin"]} /></AdminLayout>}
            </Route>
            <Route path="/admin/settings">
              {() => <AdminLayout><ProtectedRoute component={AdminSettingsPage} roles={["admin", "superadmin"]} /></AdminLayout>}
            </Route>
            <Route path="/admin/backup">
              {() => <AdminLayout><ProtectedRoute component={BackupPage} roles={["admin", "superadmin"]} /></AdminLayout>}
            </Route>
            <Route path="/admin/info-board">
              {() => <AdminLayout><ProtectedRoute component={InfoBoardPage} roles={["admin", "superadmin"]} /></AdminLayout>}
            </Route>
            <Route path="/admin/complaints">
              {() => <AdminLayout><ProtectedRoute component={ComplaintsPage} roles={["admin", "superadmin"]} /></AdminLayout>}
            </Route>
            <Route path="/admin/resign-management">
              {() => <AdminLayout><ProtectedRoute component={ResignManagementPage} roles={["admin", "superadmin"]} /></AdminLayout>}
            </Route>
            <Route path="/admin/resign-history">
              {() => <AdminLayout><ProtectedRoute component={ResignHistoryPage} roles={["admin", "superadmin"]} /></AdminLayout>}
            </Route>

            {/* 404 Fallback */}
            <Route>
              <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 text-xs font-semibold">
                Halaman Tidak Ditemukan (404)
              </div>
            </Route>
          </Switch>
        </div>
      </TooltipProvider>
      <Toaster />
    </AuthProvider>
  );
}
