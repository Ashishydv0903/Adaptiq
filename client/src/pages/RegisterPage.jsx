import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, getDashboardPathForRole } from '../context/AuthContext';
import { AdaptiveAILogo } from '../components/common/AdaptiveAILogo';
import { UserPlus, User, Mail, Key, Award, Briefcase, AlertCircle } from 'lucide-react';

export const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'candidate',
    demographicGroup: 'unspecified'
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRoleSelect = (role) => {
    setFormData({ ...formData, role });
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
            <AdaptiveAILogo size={36} iconColor="#52D68A" eyeColor="#0F2238" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Create your Account</h2>
          <p className="text-sm text-slate-300 mt-1">
            Join Adaptive AI to practice mock interviews with plain-English feedback.
          </p>
        </div>

        {/* Role Toggle */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">
            I am joining as a
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleRoleSelect('candidate')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                formData.role === 'candidate'
                  ? 'bg-[#52D68A]/15 border-[#52D68A] text-white ring-1 ring-[#52D68A]'
                  : 'bg-[#0B192C] border-[#1B3A60] text-slate-300 hover:border-slate-500'
              }`}
            >
              <Award className="w-5 h-5 text-[#52D68A]" />
              <span className="text-xs font-semibold">Candidate / Student</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSelect('recruiter')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                formData.role === 'recruiter'
                  ? 'bg-amber-500/15 border-amber-400 text-amber-200 ring-1 ring-amber-400'
                  : 'bg-[#0B192C] border-[#1B3A60] text-slate-300 hover:border-slate-500'
              }`}
            >
              <Briefcase className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-semibold">Recruiter / Team</span>
            </button>
          </div>
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
