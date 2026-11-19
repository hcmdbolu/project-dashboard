import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AuthGuard } from './components/layout/AuthGuard';
import { ToastContainer } from './components/ui/ToastContainer';
import { AuthProvider } from './context/AuthContext';
import { PortfolioProvider } from './context/PortfolioContext';
import { BudgetsPage } from './pages/BudgetsPage';
import { DepartmentManagementPage } from './pages/DepartmentManagementPage';
import { ExecutiveDashboardPage } from './pages/ExecutiveDashboardPage';
import { LoginPage } from './pages/LoginPage';
import { MasterPortfolioPage } from './pages/MasterPortfolioPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ReportsPage } from './pages/ReportsPage';
import { RisksAndActionsPage } from './pages/RisksAndActionsPage';
import { UserManagementPage } from './pages/UserManagementPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <PortfolioProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<AuthGuard />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<ExecutiveDashboardPage />} />
                <Route path="/projects" element={<MasterPortfolioPage />} />
                <Route path="/portfolio" element={<MasterPortfolioPage />} />
                <Route path="/projects/:id" element={<ProjectDetailPage />} />
                <Route path="/governance" element={<RisksAndActionsPage />} />

                <Route
                  element={
                    <AuthGuard
                      allowedRoles={['Super Admin', 'Executive', 'Department Admin']}
                    />
                  }
                >
                  <Route path="/budgets" element={<BudgetsPage />} />
                </Route>

                <Route
                  element={
                    <AuthGuard
                      allowedRoles={[
                        'Super Admin',
                        'Executive',
                        'Department Admin',
                        'Project Manager',
                      ]}
                    />
                  }
                >
                  <Route path="/reports" element={<ReportsPage />} />
                </Route>

                <Route
                  element={
                    <AuthGuard allowedRoles={['Super Admin', 'Department Admin']} />
                  }
                >
                  <Route path="/admin/users" element={<UserManagementPage />} />
                </Route>

                <Route element={<AuthGuard allowedRoles={['Super Admin']} />}>
                  <Route
                    path="/admin/departments"
                    element={<DepartmentManagementPage />}
                  />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <ToastContainer />
      </PortfolioProvider>
    </AuthProvider>
  );
};

export default App;
