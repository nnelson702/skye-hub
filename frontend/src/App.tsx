import { Routes, Route, Navigate } from "react-router-dom";

import AppShell from "./pages/AppShell";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

import AdminPage from "./pages/AdminPage";
import AdminStoresPage from "./pages/AdminStoresPage";
import AdminUsersPage from "./pages/AdminUsersPage";

import RequireAuth from "./routes/RequireAuth";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        } />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/stores"
          element={
            <RequireAuth>
              <AdminStoresPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAuth>
              <AdminUsersPage />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AppShell>
  );
}
