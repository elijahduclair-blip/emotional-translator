import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import Mirror from '@/pages/Mirror';
import SyncSettings from '@/pages/SyncSettings';
import IntroProfile from '@/pages/IntroProfile';
import PersonaInterview from '@/pages/PersonaInterview';
import PersonaDashboard from '@/pages/PersonaDashboard';
import LibrarianChat from '@/pages/LibrarianChat';
import MaintenanceDashboard from '@/pages/MaintenanceDashboard';
import EpistemicLab from '@/pages/EpistemicLab';
import GrowthDashboard from '@/pages/GrowthDashboard';
import PageNotFound from '@/lib/PageNotFound';

const TAB_PAGES = [
  { path: '/', Page: Mirror },
  { path: '/sync-settings', Page: SyncSettings },
  { path: '/intro-profile', Page: IntroProfile },
  { path: '/persona-interview', Page: PersonaInterview },
  { path: '/persona-dashboard', Page: PersonaDashboard },
  { path: '/librarian', Page: LibrarianChat },
  { path: '/graph-health', Page: MaintenanceDashboard },
  { path: '/epistemic-lab', Page: EpistemicLab },
  { path: '/growth', Page: GrowthDashboard },
];

/**
 * Keep-alive tab pages: mounts each page lazily on first visit,
 * then preserves it in the DOM via CSS hidden/block so scroll positions,
 * input state, and search queries survive tab switches.
 */
export default function TabPages() {
  const { pathname } = useLocation();
  const [mounted, setMounted] = useState(new Set());

  useEffect(() => {
    setMounted(prev => {
      if (prev.has(pathname)) return prev;
      const next = new Set(prev);
      next.add(pathname);
      return next;
    });
  }, [pathname]);

  const isTab = TAB_PAGES.some(p => p.path === pathname);
  if (!isTab) return <PageNotFound />;

  return (
    <div className="relative">
      {TAB_PAGES.filter(p => mounted.has(p.path)).map(({ path, Page }) => {
        const isActive = pathname === path;
        return (
          <motion.div
            key={path}
            initial={false}
            animate={{
              opacity: isActive ? 1 : 0,
              x: isActive ? 0 : 16,
              scale: isActive ? 1 : 0.985,
              filter: isActive ? 'blur(0px)' : 'blur(3px)',
            }}
            transition={{
              opacity: { duration: 0.28, ease: [0.22, 0.14, 0.36, 1] },
              filter: { duration: 0.28, ease: [0.22, 0.14, 0.36, 1] },
              x: { type: 'spring', stiffness: 260, damping: 28, mass: 0.8 },
              scale: { type: 'spring', stiffness: 260, damping: 28, mass: 0.8 },
            }}
            style={{
              position: isActive ? 'relative' : 'absolute',
              top: 0,
              left: 0,
              right: 0,
              transformOrigin: 'center top',
              pointerEvents: isActive ? 'auto' : 'none',
            }}
          >
            <Page />
          </motion.div>
        );
      })}
    </div>
  );
}