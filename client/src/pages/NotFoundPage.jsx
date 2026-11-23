import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HelpCircle, Home } from 'lucide-react';

export const NotFoundPage = () => {
  const { getDashboardPath } = useAuth();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0B192C] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-8 text-center space-y-4 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-[#52D68A]/10 border border-[#52D68A]/20 text-[#52D68A] flex items-center justify-center mx-auto">
          <HelpCircle className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold text-white">404 - Page Not Found</h1>
        <p className="text-sm text-slate-300">
          The page or assessment route you are looking for does not exist on this server.
        </p>

        <div className="pt-2">
          <Link
            to={getDashboardPath()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] text-sm font-bold rounded-xl shadow-lg shadow-[#52D68A]/20 transition-all"
          >
            <Home className="w-4 h-4" /> Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
