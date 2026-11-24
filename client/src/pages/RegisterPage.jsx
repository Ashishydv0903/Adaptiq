import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, getDashboardPathForRole } from '../context/AuthContext';
import { AdaptIQLogo } from '../components/common/AdaptIQLogo';
import { UserPlus, User, Mail, Key, AlertCircle } from 'lucide-react';

export const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    demographicGroup: 'unspecified'
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const newUser = await register(formData);
      navigate(getDashboardPathForRole(newUser.role), { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0B192C] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-[#0F2238] border border-[#1B3A60] p-8 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex p-3 rounded-2xl bg-[#52D68A]/10 text-[#52D68A] mb-3 border border-[#52D68A]/20">
            <AdaptIQLogo size={36} iconColor="#52D68A" eyeColor="#0F2238" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Create your Account</h2>
          <p className="text-sm text-slate-300 mt-1">
            Join AdaptIQ to practice mock interviews with plain-English feedback.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="Ada Lovelace"
                className="w-full bg-[#0B192C] border border-[#1B3A60] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#52D68A] focus:ring-1 focus:ring-[#52D68A] transition-all"
              />
            </div>
          </div>

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
                value={formData.email}
                onChange={handleChange}
                placeholder="ada@domain.com"
                className="w-full bg-[#0B192C] border border-[#1B3A60] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#52D68A] focus:ring-1 focus:ring-[#52D68A] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-1.5">
              Password (min 6 characters)
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                name="password"
                required
                minLength={6}
                value={formData.password}
                onChange={handleChange}
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
                <UserPlus className="w-4 h-4" /> Create Account
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="text-[#52D68A] hover:underline font-semibold">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
