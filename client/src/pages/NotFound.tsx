import { Link } from 'react-router-dom';
import { LogoMark } from '../components/Logo';

export default function NotFound() {
  return (
    <div className="page-enter flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center">
      <LogoMark size={44} />
      <p className="mt-6 text-[12px] text-ink/45">404 — page not found</p>
      <h1 className="mt-3 text-[32px] font-bold">This page is not part of the ledger.</h1>
      <p className="mt-2 max-w-md text-[13.5px] text-ink/55">
        The route you requested does not exist. Return to the platform home or open the access portal to continue your
        demonstration.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          to="/"
          className="inline-flex h-10 items-center rounded-[10px] border border-line bg-white px-4 text-[13px] font-medium transition-colors hover:bg-surface"
        >
          Return home
        </Link>
        <Link
          to="/access"
          className="inline-flex h-10 items-center rounded-[10px] bg-ink px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#26281f]"
        >
          Access portal
        </Link>
      </div>
    </div>
  );
}
