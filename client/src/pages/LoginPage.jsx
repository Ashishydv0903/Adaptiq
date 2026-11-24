import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, getDashboardPathForRole } from '../context/AuthContext';
import { AdaptIQLogo } from '../components/common/AdaptIQLogo';
import { LogIn, Key, Mail, Sparkles, AlertCircle } from 'lucide-react';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const loggedInUser = await login(email, password);
      const destination = location.state?.from?.pathname || getDashboardPathForRole(loggedInUser.role);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoFill = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0B192C] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-[#0F2238] border border-[#1B3A60] p-8 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex p-3 rounded-2xl bg-[#52D68A]/10 text-[#52D68A] mb-4 border border-[#52D68A]/20">
            <AdaptIQLogo size={36} iconColor="#52D68A" eyeColor="#0F2238" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Welcome to AdaptIQ</h2>
          <p className="text-sm text-slate-300 mt-1">
            Sign in to start your mock interviews and view your study roadmap.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                name="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full bg-[#0B192C] border border-[#1B3A60] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#52D68A] focus:ring-1 focus:ring-[#52D68A] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                name="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#0B192C] border border-[#1B3A60] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#52D68A] focus:ring-1 focus:ring-[#52D68A] transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] font-bold rounded-xl shadow-lg shadow-[#52D68A]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-[#0B192C] border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn className="w-4 h-4" /> Sign In
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Logins (Visible only in development) */}
        {import.meta.env.DEV && (
          <div className="border-t border-[#1B3A60] pt-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#52D68A]" /> Quick Demo Logins
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoFill('candidate@adaptiq.ai', 'Candidate@123456')}
                className="py-1.5 px-2 bg-[#0B192C] hover:bg-[#1B3A60] border border-[#1B3A60] hover:border-[#52D68A] rounded-lg text-xs font-semibold text-[#52D68A] transition-all text-center"
              >
                Candidate
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('recruiter@adaptiq.ai', 'Recruiter@123456')}
                className="py-1.5 px-2 bg-[#0B192C] hover:bg-[#1B3A60] border border-[#1B3A60] hover:border-amber-400 rounded-lg text-xs font-semibold text-amber-300 transition-all text-center"
              >
                Recruiter
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('admin@adaptiq.ai', 'Admin@123456')}
                className="py-1.5 px-2 bg-[#0B192C] hover:bg-[#1B3A60] border border-[#1B3A60] hover:border-rose-400 rounded-lg text-xs font-semibold text-rose-300 transition-all text-center"
              >
                Admin
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-400">
          Don't have an account yet?{' '}
          <Link to="/register" className="text-[#52D68A] hover:underline font-semibold">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
