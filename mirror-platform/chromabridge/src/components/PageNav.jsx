import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { Search, User, Library, Activity, Layers, RefreshCw, TrendingUp } from 'lucide-react';

const allLinks = [
  { to: '/', label: 'Mirror', icon: Search },
  { to: '/persona-dashboard', label: 'Persona', icon: User },
  { to: '/librarian', label: 'Librarian', icon: Library },
  { to: '/graph-health', label: 'Health', icon: Activity },
  { to: '/epistemic-lab', label: 'EOS', icon: Layers },
  { to: '/growth', label: 'Growth', icon: TrendingUp },
  { to: '/sync-settings', label: 'Sync', icon: RefreshCw },
];

export default function PageNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    sessionStorage.setItem(`last_path_${pathname}`, pathname + window.location.search);
  }, [pathname, searchParams]);

  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password'].includes(pathname);
  if (isAuthPage) return null;

  const handleTabClick = (e, to) => {
    if (pathname === to) {
      if ([...searchParams.keys()].length > 0) {
        e.preventDefault();
        setSearchParams({});
      }
    } else {
      const stored = sessionStorage.getItem(`last_path_${to}`);
      if (stored && stored !== to) {
        e.preventDefault();
        navigate(stored);
      }
    }
  };

  return (
    <>
      {/* Desktop vertical sidebar — text only */}
      <nav className="hidden md:flex fixed top-0 left-0 z-50 h-screen flex-col items-center justify-center py-6 gap-2 bg-[#232626] shadow-2xl" style={{ width: '64px' }}>
        {allLinks.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              onClick={(e) => handleTabClick(e, to)}
              className="group relative flex w-full items-center justify-center transition-all"
              style={{
                height: '52px',
                color: active ? '#FFB042' : '#A6927D',
                filter: active ? 'drop-shadow(0 0 6px rgba(255, 176, 66, 0.35))' : 'none',
              }}
            >
              {active && (
                <motion.span
                  layoutId="nav-indicator-desktop"
                  className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                  style={{ width: '3px', height: '28px', backgroundColor: '#FFB042' }}
                  transition={{ type: 'spring', stiffness: 350, damping: 30, mass: 0.6 }}
                />
              )}
              <Icon size={20} strokeWidth={1.5} />
            </Link>
          );
        })}
      </nav>

      {/* Mobile bottom tab bar — text only */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around bg-[#232626] shadow-2xl safe-bottom"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        {allLinks.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              onClick={(e) => handleTabClick(e, to)}
              className="relative flex flex-col items-center justify-center gap-0.5 px-1 flex-1 min-w-0 transition-colors"
              style={{
                minHeight: '48px',
                color: active ? '#FFB042' : '#A6927D',
                filter: active ? 'drop-shadow(0 0 5px rgba(255, 176, 66, 0.3))' : 'none',
              }}
            >
              {active && (
                <motion.span
                  layoutId="nav-indicator-mobile"
                  className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                  style={{ width: '24px', height: '3px', backgroundColor: '#FFB042' }}
                  transition={{ type: 'spring', stiffness: 350, damping: 30, mass: 0.6 }}
                />
              )}
              <Icon size={20} strokeWidth={1.5} />
            </Link>
          );
        })}
      </nav>
    </>
  );
}