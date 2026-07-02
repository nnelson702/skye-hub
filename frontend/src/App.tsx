import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import AppShell from "./pages/AppShell";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import CommunicationsPage from "./pages/CommunicationsPage";
import DocumentsPage from "./pages/DocumentsPage";
import TasksPage from "./pages/TasksPage";
import DepartmentWalksPage from "./pages/DepartmentWalksPage";

import AdminPage from "./pages/AdminPage";
import AdminStoresPage from "./pages/AdminStoresPage";
import AdminUsersPage from "./pages/AdminUsersPage";

import RequireAuth from "./routes/RequireAuth";
import RequireAdmin from "./routes/RequireAdmin";

export default function App() {
  return (
    <>
      <Toaster />
      <AppShell>
        <Routes>
          <Route path="/" element={
            <RequireAuth>
              <HomePage />
            </RequireAuth>
          } />
          <Route path="/communications" element={
            <RequireAuth>
              <CommunicationsPage />
            </RequireAuth>
          } />
          <Route path="/documents" element={
            <RequireAuth>
              <DocumentsPage />
            </RequireAuth>
          } />
          <Route path="/tasks" element={
            <RequireAuth>
              <TasksPage />
            </RequireAuth>
          } />
          <Route path="/department-walks" element={
            <RequireAuth>
              <DepartmentWalksPage />
            </RequireAuth>
          } />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route
            path="/admin"
            element={
              <RequireAuth>
                <RequireAdmin>
                  <AdminPage />
                </RequireAdmin>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/stores"
            element={
              <RequireAuth>
                <RequireAdmin>
                  <AdminStoresPage />
                </RequireAdmin>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RequireAuth>
                <RequireAdmin>
                  <AdminUsersPage />
                </RequireAdmin>
              </RequireAuth>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AppShell>
    </>
  );
}
