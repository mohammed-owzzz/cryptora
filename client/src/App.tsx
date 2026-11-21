import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './components/ui';
import { RequireRole } from './components/ProtectedRoute';
import { AdminShell, AuditorShell, VoterShell } from './components/Layout';

import Home from './pages/Home';
import Access from './pages/Access';
import DocPage, { DocsHome } from './pages/Docs';
import Results from './pages/Results';
import NotFound from './pages/NotFound';
import { About, HowItWorks, Platform, Security } from './pages/Marketing';
import { AdminLogin, AuditorLogin, VoterLogin } from './pages/Login';

import AdminDashboard from './pages/admin/Dashboard';
import { AdminElectionCreate, AdminElectionDetail, AdminElections } from './pages/admin/Elections';
import AdminVoters from './pages/admin/Voters';
import AdminCandidates from './pages/admin/Candidates';
import AdminBallots from './pages/admin/Ballots';
import { AdminBlockchain, AdminLedger, AdminValidators, AdminZkp } from './pages/admin/Blockchain';
import { AdminAuditLogs, AdminReports, AdminResults, AdminSettings } from './pages/admin/Operations';

import VoterDashboard from './pages/voter/Dashboard';
import { VoterElectionDetail, VoterElections } from './pages/voter/Elections';
import VoterBallot from './pages/voter/Ballot';
import { VoterHelp, VoterHistory, VoterProfile, VoterResults, VoterSecurity } from './pages/voter/Account';

import AuditorDashboard from './pages/auditor/Dashboard';
import {
  AuditorBallotIntegrity,
  AuditorElections,
  AuditorHelp,
  AuditorLedger,
  AuditorProfile,
  AuditorReports,
  AuditorSecurity,
  AuditorValidators,
  AuditorZkp,
} from './pages/auditor/Workspace';

function Public({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          {/* ------------------------------ Public ----------------------------- */}
          <Route path="/" element={<Public><Home /></Public>} />
          <Route path="/platform" element={<Public><Platform /></Public>} />
          <Route path="/security" element={<Public><Security /></Public>} />
          <Route path="/how-it-works" element={<Public><HowItWorks /></Public>} />
          <Route path="/about" element={<Public><About /></Public>} />
          <Route path="/results" element={<Public><Results /></Public>} />
          <Route path="/access" element={<Access />} />
          <Route path="/docs" element={<DocsHome />} />
          <Route path="/docs/:slug" element={<DocPage />} />

          {/* ------------------------------- Auth ------------------------------ */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/voter/login" element={<VoterLogin />} />
          <Route path="/auditor/login" element={<AuditorLogin />} />

          {/* ------------------------------ Admin ------------------------------ */}
          <Route
            path="/admin"
            element={
              <RequireRole role="ADMIN">
                <AdminShell />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="elections" element={<AdminElections />} />
            <Route path="elections/create" element={<AdminElectionCreate />} />
            <Route path="elections/:id" element={<AdminElectionDetail />} />
            <Route path="voters" element={<AdminVoters />} />
            <Route path="candidates" element={<AdminCandidates />} />
            <Route path="ballot-management" element={<AdminBallots />} />
            <Route path="results" element={<AdminResults />} />
            <Route path="blockchain" element={<AdminBlockchain />} />
            <Route path="validators" element={<AdminValidators />} />
            <Route path="ledger" element={<AdminLedger />} />
            <Route path="zkp-verification" element={<AdminZkp />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="profile" element={<Navigate to="/admin/settings" replace />} />
          </Route>

          {/* ------------------------------ Voter ------------------------------ */}
          <Route
            path="/voter"
            element={
              <RequireRole role="VOTER">
                <VoterShell />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="/voter/dashboard" replace />} />
            <Route path="dashboard" element={<VoterDashboard />} />
            <Route path="elections" element={<VoterElections />} />
            <Route path="elections/:electionId" element={<VoterElectionDetail />} />
            <Route path="elections/:electionId/vote" element={<VoterBallot />} />
            <Route path="history" element={<VoterHistory />} />
            <Route path="results" element={<VoterResults />} />
            <Route path="profile" element={<VoterProfile />} />
            <Route path="security" element={<VoterSecurity />} />
            <Route path="help" element={<VoterHelp />} />
          </Route>

          {/* ----------------------------- Auditor ----------------------------- */}
          <Route
            path="/auditor"
            element={
              <RequireRole role="AUDITOR">
                <AuditorShell />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="/auditor/dashboard" replace />} />
            <Route path="dashboard" element={<AuditorDashboard />} />
            <Route path="elections" element={<AuditorElections />} />
            <Route path="ledger" element={<AuditorLedger />} />
            <Route path="zkp-verification" element={<AuditorZkp />} />
            <Route path="validators" element={<AuditorValidators />} />
            <Route path="ballot-integrity" element={<AuditorBallotIntegrity />} />
            <Route path="reports" element={<AuditorReports />} />
            <Route path="profile" element={<AuditorProfile />} />
            <Route path="security" element={<AuditorSecurity />} />
            <Route path="help" element={<AuditorHelp />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
