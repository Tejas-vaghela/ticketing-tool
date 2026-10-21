import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { AppLayout } from './components/layout/AppLayout';

import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AdminPanelPage } from './pages/AdminPanelPage';
import { Dashboard } from './pages/Dashboard';
import { IssuesPage } from './pages/IssuesPage';
import { IssueDetailPage } from './pages/IssueDetailPage';
import { KanbanBoard } from './pages/KanbanBoard';
import { BacklogPage } from './pages/BacklogPage';
import { SupportCenterPage } from './pages/SupportCenterPage';
import { ReportsPage } from './pages/ReportsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { TeamPage } from './pages/TeamPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { DocumentationPage } from './pages/DocumentationPage';
import { AccessDeniedPage } from './pages/AccessDeniedPage';
import { AppPageId, hasRoleAccessToPage } from './services/rbac';

// Route guard requiring authenticated session
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isAuthLoading } = useApp();
  const location = useLocation();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 animate-pulse">
          Verifying session...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// Route guard for public-only screens like login
const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isAuthLoading } = useApp();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 animate-pulse">
          Verifying session...
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

// Role-based Access Control guard for specific pages
const RoleRoute: React.FC<{
  pageId: AppPageId;
  children: React.ReactNode;
}> = ({ pageId, children }) => {
  const { currentUser, settings } = useApp();
  const isAllowed = hasRoleAccessToPage(currentUser.role, pageId, settings?.rolePageAccess);

  if (!isAllowed) {
    return <AccessDeniedPage pageId={pageId} />;
  }

  return <>{children}</>;
};

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[RootErrorBoundary] Uncaught application error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetStorage = () => {
    try {
      localStorage.clear();
      window.location.href = '/login';
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Something went wrong
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleResetStorage}
                className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition"
              >
                Reset Local Cache
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <RootErrorBoundary>
      <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Route */}
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />

          {/* Forgot Password — public, redirects authenticated users home */}
          <Route
            path="/forgot-password"
            element={
              <PublicOnlyRoute>
                <ForgotPasswordPage />
              </PublicOnlyRoute>
            }
          />

          {/* Reset Password — public, token validated server-side */}
          <Route
            path="/reset-password"
            element={
              <PublicOnlyRoute>
                <ResetPasswordPage />
              </PublicOnlyRoute>
            }
          />

          {/* Protected Application Workspace */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<RoleRoute pageId="dashboard"><Dashboard /></RoleRoute>} />
                    <Route path="/issues" element={<RoleRoute pageId="issues"><IssuesPage /></RoleRoute>} />
                    <Route path="/issues/:id" element={<RoleRoute pageId="issues"><IssueDetailPage /></RoleRoute>} />
                    <Route path="/board" element={<RoleRoute pageId="board"><KanbanBoard /></RoleRoute>} />
                    <Route path="/backlog" element={<RoleRoute pageId="backlog"><BacklogPage /></RoleRoute>} />
                    <Route path="/epics" element={<RoleRoute pageId="backlog"><BacklogPage /></RoleRoute>} />
                    <Route path="/support" element={<RoleRoute pageId="support"><SupportCenterPage /></RoleRoute>} />
                    <Route path="/reports" element={<RoleRoute pageId="reports"><ReportsPage /></RoleRoute>} />
                    <Route path="/projects" element={<RoleRoute pageId="projects"><ProjectsPage /></RoleRoute>} />
                    <Route path="/projects/:id" element={<RoleRoute pageId="projects"><ProjectDetailPage /></RoleRoute>} />
                    <Route path="/team" element={<RoleRoute pageId="team"><TeamPage /></RoleRoute>} />
                    <Route path="/admin" element={<RoleRoute pageId="admin"><AdminPanelPage /></RoleRoute>} />
                    <Route path="/settings" element={<RoleRoute pageId="settings"><SettingsPage /></RoleRoute>} />
                    <Route path="/profile" element={<RoleRoute pageId="profile"><ProfilePage /></RoleRoute>} />
                    <Route path="/docs" element={<RoleRoute pageId="docs"><DocumentationPage /></RoleRoute>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </AppLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AppProvider>
    </RootErrorBoundary>
  );
}
