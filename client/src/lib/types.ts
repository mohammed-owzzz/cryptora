export type Role = 'ADMIN' | 'VOTER' | 'AUDITOR';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  voterId?: string | null;
  auditorId?: string | null;
  voterNumber?: string | null;
  auditorNumber?: string | null;
}

export interface Stats {
  registeredVoters: number;
  totalElections: number;
  liveElections: number;
  verifiedBallots: number;
  totalValidators: number;
  activeValidators: number;
  verifiedProofs: number;
  rejectedProofs: number;
  proofSuccessRate: number;
  seededProofs: number;
  liveProofs: number;
  ledgerIntegrity: string;
  ledgerBlocks: number;
  participationRate: number;
  remainingEligibleVoters: number;
  featuredElections: {
    electionId: string;
    name: string;
    status: string;
    registeredVoters: number;
    votesCast: number;
    participation: number;
    startDate: string;
    endDate: string;
  }[];
  dailyParticipation: { date: string; ballots: number; cumulative: number }[];
  recentTransactions: {
    txHash: string;
    type: string;
    blockNumber: number | null;
    timestamp: string;
    status: string;
    electionId: string | null;
  }[];
  validators: { validatorId: string; name: string; active: boolean; publicKey: string }[];
  generatedAt: string;
}

export interface BlockSummary {
  blockNumber: number;
  blockHash: string;
  previousHash: string;
  merkleRoot: string;
  timestamp: string;
  txCount: number;
  approvals: number;
  consensus: string;
  signatures?: number;
}

export interface BlockDetail {
  blockNumber: number;
  blockHash: string;
  previousHash: string;
  merkleRoot: string;
  timestamp: string;
  txCount: number;
  approvals: number;
  consensus: string;
  header: Record<string, unknown>;
  consensusRound: { required: number; votes: number; achieved: boolean; finishedAt?: string | null } | null;
  signatures: { validatorId: string; name?: string; publicKey: string; signature: string }[];
  transactions: { txHash: string; type?: string; label: string; timestamp: string; status: string; payload?: unknown }[];
}
