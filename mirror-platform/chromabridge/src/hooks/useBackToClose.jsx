import { useEffect } from 'react';

/**
 * Intercepts hardware back gesture / button while an overlay is open,
 * calling onClose so drawers dismiss instead of quitting the application.
 */
export function useBackToClose(isOpen, onClose) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = () => onClose();
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [isOpen, onClose]);
}