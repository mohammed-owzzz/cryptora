import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { LogoMark } from './Logo';
import type { Role } from '../lib/types';

const HOME: Record<Role, string> = {
  ADMIN: '/admin/dashboard',
  VOTER: '/voter/dashboard',
  AUDITOR: '/auditor/dashboard',
};

const LOGIN: Record<Role, string> = {
  ADMIN: '/admin/login',
  VOTER: '/voter/login',
  AUDITOR: '/auditor/login',
};

/**
 * Client-side guard. It only improves UX — every API route independently
 * enforces the role on the server.
 */
export function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-canvas">
        <LogoMark size={40} />
        <div className="flex items-center gap-2 text-[13px] text-ink/50">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Verifying secure session…
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={LOGIN[role]} replace state={{ from: location.pathname }} />;
  }

  if (user.role !== role) {
    return <Navigate to={HOME[user.role]} replace />;
  }

  return <>{children}</>;
}
