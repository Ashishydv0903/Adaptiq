import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, getDashboardPathForRole } from '../context/AuthContext';
import { AdaptiveAILogo } from './common/AdaptiveAILogo';
import { LogOut, Compass, LayoutDashboard } from 'lucide-react';

export const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isLandingPage = location.pathname === '/';

  const handleInterviewsClick = () => {
    if (isAuthenticated) {
      navigate('/candidate/dashboard');
    } else if (isLandingPage) {
      const el = document.getElementById('interviews');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        navigate('/login');
      }
    } else {
      navigate('/#interviews');
    }
  };

  return (
    <header className="bg-[#52D68A] border-b border-[#42C378] text-[#0B192C] sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Name (Adaptive AI with Robot Icon) */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="transform group-hover:scale-110 transition-transform duration-200">
            <AdaptiveAILogo size={32} iconColor="#0B192C" eyeColor="#52D68A" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-[#0B192C] tracking-tight">
              Adaptive AI
            </span>
          </div>
        </Link>

        {/* Center Navigation Links (Matching Photo: Home, Interviews, About, Contact) */}
        <nav className="hidden md:flex items-center gap-8">
          <Link
            to="/"
            className="text-sm font-semibold text-[#0B192C] hover:opacity-75 transition-opacity"
          >
            Home
          </Link>

          <button
            onClick={handleInterviewsClick}
            className="text-sm font-semibold text-[#0B192C] hover:opacity-75 transition-opacity"
          >
            Interviews
          </button>

          {isLandingPage ? (
            <a
              href="#about"
              className="text-sm font-semibold text-[#0B192C] hover:opacity-75 transition-opacity"
            >
              About
            </a>
          ) : (
            <Link
              to="/#about"
              className="text-sm font-semibold text-[#0B192C] hover:opacity-75 transition-opacity"
            >
              About
            </Link>
          )}

          {isLandingPage ? (
            <a
              href="#contact"
              className="text-sm font-semibold text-[#0B192C] hover:opacity-75 transition-opacity"
            >
              Contact
            </a>
          ) : (
            <Link
              to="/#contact"
              className="text-sm font-semibold text-[#0B192C] hover:opacity-75 transition-opacity"
            >
              Contact
            </Link>
          )}
        </nav>

        {/* User Actions & Auth State */}
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Dashboard Shortcut */}
              <Link
                to={getDashboardPathForRole(user.role)}
                className="px-3 py-1.5 text-xs font-bold bg-[#0B192C] text-[#52D68A] hover:bg-[#07101B] rounded-full transition flex items-center gap-1.5 shadow-sm"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>

              <Link
                to="/skills/gap-analysis"
                className="hidden sm:flex px-3 py-1.5 text-xs font-semibold text-[#0B192C] hover:bg-[#0B192C]/10 rounded-full transition items-center gap-1.5 border border-[#0B192C]/20"
              >
                <Compass className="w-3.5 h-3.5 text-[#0B192C]" />
                <span>Study Plan</span>
              </Link>

              {/* User Name & Role Pill */}
              <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-[#0B192C]/20">
                <span className="text-xs font-semibold text-[#0B192C] max-w-[120px] truncate">
                  {user.name}
                </span>
                <span className="px-2 py-0.5 text-[11px] font-bold bg-[#0B192C]/10 text-[#0B192C] rounded-full border border-[#0B192C]/20 uppercase">
                  {user.role}
                </span>
              </div>

              {/* Log Out */}
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-full text-[#0B192C] hover:bg-[#0B192C]/15 transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#0B192C] hover:opacity-75 transition-colors"
              >
                Log In
              </Link>
              <Link
                to="/register"
                className="px-4 py-1.5 text-xs sm:text-sm font-semibold text-[#52D68A] bg-[#0B192C] hover:bg-[#07101B] rounded-full shadow-md transition-all duration-150"
              >
                Try it Free
              </Link>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};

export default Navbar;
