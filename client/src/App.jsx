import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';

// Lazy-loaded routes for code splitting and sub-300kB main chunk target
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const CandidateDashboard = lazy(() => import('./pages/CandidateDashboard'));
const RecruiterDashboard = lazy(() => import('./pages/RecruiterDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminFairnessDashboard = lazy(() => import('./pages/AdminFairnessDashboard'));
const InterviewScreen = lazy(() => import('./pages/InterviewScreen'));
const PreInterviewSystemCheck = lazy(() => import('./pages/PreInterviewSystemCheck'));
const SkillGapAnalysis = lazy(() => import('./pages/SkillGapAnalysis'));
const SkillGraphPage = lazy(() => import('./pages/SkillGraphPage'));
const PostSessionReview = lazy(() => import('./pages/PostSessionReview'));
const UnauthorizedPage = lazy(() => import('./pages/UnauthorizedPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const PageLoadingFallback = () => (
  <div
    role="status"
    aria-live="polite"
    className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 space-y-4"
  >
    <div className="w-10 h-10 rounded-full border-3 border-[#1B3A60] border-t-[#52D68A] animate-spin" />
    <span className="text-xs text-slate-400 font-medium">Loading AdaptIQ module...</span>
  </div>
);

export function App() {
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('demo=true')) {
      try {
        localStorage.setItem('adaptiq_demo_mode', 'true');
        sessionStorage.setItem('adaptiq_demo_mode', 'true');
      } catch {}
    }
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-[#0B192C] text-slate-100 flex flex-col font-sans antialiased selection:bg-[#52D68A] selection:text-[#0B192C]">
          <Navbar />
          <main className="flex-1">
            <Suspense fallback={<PageLoadingFallback />}>
              <Routes>
                {/* Public Landing Page */}
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
                <Route
                  path="/skills/graph"
                  element={
                    <ProtectedRoute allowedRoles={['candidate', 'recruiter', 'admin']}>
                      <SkillGraphPage />
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
            </Suspense>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
