import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, getDashboardPathForRole } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { CandidateDashboard } from './pages/CandidateDashboard';
import { RecruiterDashboard } from './pages/RecruiterDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminFairnessDashboard } from './pages/AdminFairnessDashboard';
import { InterviewScreen } from './pages/InterviewScreen';
import { PreInterviewSystemCheck } from './pages/PreInterviewSystemCheck';
import { SkillGapAnalysis } from './pages/SkillGapAnalysis';
import { PostSessionReview } from './pages/PostSessionReview';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-[#0B192C] text-slate-100 flex flex-col font-sans antialiased selection:bg-[#52D68A] selection:text-[#0B192C]">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public Landing Page based on reference design */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/home" element={<LandingPage />} />

              {/* Public Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              {/* Protected Candidate Routes */}
              <Route
                path="/candidate/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['candidate', 'admin']}>
                    <CandidateDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/interview/:sessionId/system-check"
                element={
                  <ProtectedRoute allowedRoles={['candidate', 'admin']}>
                    <PreInterviewSystemCheck />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/interview/:sessionId"
                element={
                  <ProtectedRoute allowedRoles={['candidate', 'admin']}>
                    <InterviewScreen />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/skills/gap-analysis"
                element={
                  <ProtectedRoute allowedRoles={['candidate', 'recruiter', 'admin']}>
                    <SkillGapAnalysis />
                  </ProtectedRoute>
                }
              />

              {/* Protected Recruiter Routes */}
              <Route
                path="/recruiter/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['recruiter', 'admin']}>
                    <RecruiterDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/recruiter/review/:sessionId"
                element={
                  <ProtectedRoute allowedRoles={['recruiter', 'admin']}>
                    <PostSessionReview />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/review/session/:sessionId"
                element={
                  <ProtectedRoute allowedRoles={['recruiter', 'admin']}>
                    <PostSessionReview />
                  </ProtectedRoute>
                }
              />

              {/* Protected Admin Routes */}
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/fairness"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'recruiter']}>
                    <AdminFairnessDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
