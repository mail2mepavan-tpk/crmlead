import { Link, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import {
  TrendingUp,
  User,
  Settings,
  LogOut,
  Users,
  ChevronDown,
} from 'lucide-react';
import SidebarToggle from './SidebarToggle';
import { useAuth } from '../context/AuthContext';

export default function Header({ toggleMenu, menuOpen }) {
  const navigate = useNavigate();
  const { currentUser, logout, isAdmin } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setShowProfile(false);
    navigate('/login');
  };

  const initials = currentUser?.fullName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  return (
    <header className="sticky top-0 z-50 border-b border-header-border bg-header shadow-lg shadow-slate-900/20">
      <div className="h-1 bg-linear-to-r from-brand via-accent to-accent-warm" />

      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <SidebarToggle open={menuOpen} onClick={toggleMenu} />

          <Link
            to="/"
            className="flex min-w-0 items-center gap-3 no-underline"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-brand to-accent shadow-md shadow-brand/30">
              <TrendingUp className="size-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-base font-bold tracking-tight text-white">
                SalesHub
              </p>
              <p className="truncate text-[11px] font-medium tracking-wider text-slate-400 uppercase">
                Sales & Marketing
              </p>
            </div>
          </Link>
        </div>

        <div className="hidden flex-[2] flex-col items-center justify-center md:flex">
          <p className="text-sm font-semibold text-white">
            Enquiry Management
          </p>
          <p className="text-xs text-slate-400">Enterprise CRM Workspace</p>
        </div>

        <div className="relative flex flex-1 justify-end" ref={profileRef}>
          {currentUser && (
            <button
              type="button"
              className="flex max-w-[240px] items-center gap-2.5 rounded-lg border border-slate-700 bg-slate-800/80 py-1.5 pr-2 pl-1.5 transition-colors hover:border-slate-600 hover:bg-slate-800"
              onClick={() => setShowProfile(!showProfile)}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-linear-to-br from-brand to-brand-light text-xs font-bold text-white">
                {initials}
              </span>
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block truncate text-sm font-semibold text-white">
                  {currentUser.fullName}
                </span>
                <span className="block truncate text-[11px] text-slate-400 capitalize">
                  {currentUser.role}
                </span>
              </span>
              <ChevronDown
                className={[
                  'size-4 shrink-0 text-slate-400 transition-transform',
                  showProfile ? 'rotate-180' : '',
                ].join(' ')}
              />
            </button>
          )}

          {showProfile && currentUser && (
            <div className="absolute top-full right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-nav-border bg-nav shadow-xl">
              <div className="border-b border-nav-border bg-linear-to-br from-slate-50 to-white px-4 py-4">
                <p className="text-sm font-bold text-slate-800">
                  {currentUser.fullName}
                </p>
                <p className="mt-0.5 truncate text-xs text-nav-muted">
                  {currentUser.email}
                </p>
                <span className="mt-2 inline-block rounded-full bg-brand/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-brand uppercase">
                  {currentUser.role}
                </span>
              </div>

              <div className="flex flex-col py-1.5">
                <Link
                  to="/profile"
                  className="mx-1.5 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-nav-hover"
                  onClick={() => setShowProfile(false)}
                >
                  <Settings className="size-4 shrink-0 text-nav-muted" />
                  Edit Profile
                </Link>
                {isAdmin && (
                  <Link
                    to="/users"
                    className="mx-1.5 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-nav-hover"
                    onClick={() => setShowProfile(false)}
                  >
                    <Users className="size-4 shrink-0 text-nav-muted" />
                    Manage Users
                  </Link>
                )}
                <hr className="my-1.5 border-nav-border" />
                <button
                  type="button"
                  className="mx-1.5 flex w-[calc(100%-12px)] items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                  onClick={handleLogout}
                >
                  <LogOut className="size-4 shrink-0" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
