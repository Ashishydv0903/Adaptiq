import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

export const UnauthorizedPage = () => {
  const { user, getDashboardPath } = useAuth();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0B192C] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-8 text-center space-y-5 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white tracking-tight">Access Restricted (403)</h1>
          <p className="text-sm text-slate-300">
            Your current role (<span className="text-rose-400 font-semibold uppercase">{user?.role || 'Guest'}</span>) does not have authorization to view this resource.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to={getDashboardPath()}
            className="px-5 py-2.5 bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] text-sm font-bold rounded-xl shadow-lg shadow-[#52D68A]/20 flex items-center justify-center gap-2 transition-all"
          >
            <Home className="w-4 h-4" /> Go to Your Dashboard
          </Link>
          <Link
            to="/login"
            className="px-4 py-2.5 bg-[#0B192C] hover:bg-[#132A46] border border-[#1B3A60] text-slate-200 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Sign In as Different User
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
