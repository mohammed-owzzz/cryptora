import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../server/lib/prisma.js';
import { hashPassword, lockedPasswordHash } from '../server/lib/auth.js';
import { deriveSecret, leafCommitment, buildTree, MERKLE_DEPTH, levelsDigest, authPath, electionFieldId, nullifierFor } from '../server/lib/merkle.js';
import { generateKeypair, encryptVector } from '../server/lib/paillier.js';
import { aggregate, decrypt } from '../server/lib/paillier.js';
import { ensureValidators, createGenesisBlock, blockHeader, computeBlockHash, transactionMerkleRoot, txHashFor } from '../server/lib/chain.js';
import { signMessage } from '../server/lib/ed25519.js';
import { canonical, randomHex, sha256 } from '../server/lib/hash.js';

const DAY = 86_400_000;
const now = new Date();
const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);

interface ElectionDef {
  electionId: string;
  name: string;
  description: string;
  status: 'LIVE' | 'COMPLETED';
  eligible: number;
  ballots: number;
  start: Date;
  end: Date;
  candidates: { name: string; position: string; slogan: string }[];
  weights: number[];
  includeAlex: boolean;
  alexVotes?: boolean;
}

const ELECTION_DEFS: ElectionDef[] = [
  {
    electionId: 'ELEC-2026-001',
    name: 'National Student Council Election 2026',
    description:
      'Election of the national student council representatives for the 2026 academic year. Registered students elect one representative to lead the council.',
    status: 'LIVE',
    eligible: 4200,
    ballots: 2864,
    start: startOfToday,
    end: new Date(startOfToday.getTime() + 3 * DAY + 15.99 * 3600_000),
    candidates: [
      { name: 'Sarah Mitchell', position: 'Student Council President', slogan: 'Building a more inclusive and connected campus.' },
      { name: 'Daniel Carter', position: 'Student Council President', slogan: 'Putting student opportunities first.' },
      { name: 'Emily Anderson', position: 'Student Council President', slogan: 'A stronger student community through collaboration.' },
      { name: 'Ryan Thompson', position: 'Student Council President', slogan: 'Making student voices count.' },
    ],
    weights: [34, 27, 23, 16],
    includeAlex: true,
  },
  {
    electionId: 'ELEC-2026-002',
    name: 'Department Representative Election',
    description:
      'Departmental representative election covering all faculties. Elected representatives sit on the departmental academic board.',
    status: 'LIVE',
    eligible: 2180,
    ballots: 1562,
    start: new Date(startOfToday.getTime() - DAY),
    end: new Date(startOfToday.getTime() + 4 * DAY),
    candidates: [
      { name: 'Aisha Rahman', position: 'Department Representative', slogan: 'Representation that listens first.' },
      { name: 'Marcus Lee', position: 'Department Representative', slogan: 'Better resources for every department.' },
      { name: 'Priya Nair', position: 'Department Representative', slogan: 'Transparent decisions, shared progress.' },
    ],
    weights: [41, 33, 26],
    includeAlex: true,
    alexVotes: true,
  },
  {
    electionId: 'ELEC-2026-003',
    name: 'University Senate Election',
    description:
      'University senate election for academic governance. All registered voters participated in this completed election.',
    status: 'COMPLETED',
    eligible: 3500,
    ballots: 3500,
    start: new Date(startOfToday.getTime() - 20 * DAY),
    end: new Date(startOfToday.getTime() - 14 * DAY),
    candidates: [
      { name: 'Helena Brooks', position: 'Senate Member', slogan: 'Rigorous governance, open minutes.' },
      { name: 'Tomas Vega', position: 'Senate Member', slogan: 'Student interests at the senate table.' },
      { name: 'Grace Osei', position: 'Senate Member', slogan: 'Accountable academic strategy.' },
    ],
    weights: [38, 34, 28],
    includeAlex: true,
    alexVotes: true,
  },
  {
    electionId: 'ELEC-2025-004',
    name: 'Faculty of Engineering Election',
    description: 'Faculty of Engineering representative election for the 2025 academic cycle.',
    status: 'COMPLETED',
    eligible: 600,
    ballots: 140,
    start: new Date(startOfToday.getTime() - 160 * DAY),
    end: new Date(startOfToday.getTime() - 155 * DAY),
    candidates: [
      { name: 'Noah Fischer', position: 'Faculty Representative', slogan: 'Engineering a better student experience.' },
      { name: 'Lena Kovacs', position: 'Faculty Representative', slogan: 'Practical support for every project.' },
    ],
    weights: [58, 42],
    includeAlex: false,
  },
  {
    electionId: 'ELEC-2025-005',
    name: 'Student Union Referendum',
    description: 'Referendum on the student union constitution amendments.',
    status: 'COMPLETED',
    eligible: 550,
    ballots: 120,
    start: new Date(startOfToday.getTime() - 140 * DAY),
    end: new Date(startOfToday.getTime() - 136 * DAY),
    candidates: [
      { name: 'Motion A — Adopt amendments', position: 'Referendum Option', slogan: 'Adopt the revised constitution.' },
      { name: 'Motion B — Retain current text', position: 'Referendum Option', slogan: 'Keep the existing constitution.' },
    ],
    weights: [63, 37],
    includeAlex: false,
  },
  {
    electionId: 'ELEC-2025-006',
    name: 'Postgraduate Representative Election',
    description: 'Election of the postgraduate research representative.',
    status: 'COMPLETED',
    eligible: 500,
    ballots: 160,
    start: new Date(startOfToday.getTime() - 120 * DAY),
    end: new Date(startOfToday.getTime() - 116 * DAY),
    candidates: [
      { name: 'Ibrahim Yusuf', position: 'Postgraduate Representative', slogan: 'Research funding that reaches students.' },
      { name: 'Clara Fontaine', position: 'Postgraduate Representative', slogan: 'A stronger voice for postgraduate researchers.' },
      { name: 'Dmitri Sokolov', position: 'Postgraduate Representative', slogan: 'Fair supervision and clear timelines.' },
    ],
    weights: [45, 31, 24],
    includeAlex: false,
  },
  {
    electionId: 'ELEC-2025-007',
    name: 'Library Committee Election',
    description: 'Election of student representatives to the university library committee.',
    status: 'COMPLETED',
    eligible: 480,
    ballots: 110,
    start: new Date(startOfToday.getTime() - 100 * DAY),
    end: new Date(startOfToday.getTime() - 96 * DAY),
    candidates: [
      { name: 'Sofia Marino', position: 'Library Committee Member', slogan: 'Longer hours and better study spaces.' },
      { name: 'Jonas Weber', position: 'Library Committee Member', slogan: 'Open access for every student.' },
    ],
    weights: [54, 46],
    includeAlex: false,
  },
  {
    electionId: 'ELEC-2025-008',
    name: 'Campus Sustainability Referendum',
    description: 'Referendum on the campus sustainability strategy and funding.',
    status: 'COMPLETED',
    eligible: 470,
    ballots: 70,
    start: new Date(startOfToday.getTime() - 80 * DAY),
    end: new Date(startOfToday.getTime() - 76 * DAY),
    candidates: [
      { name: 'Strategy 1 — Accelerated', position: 'Referendum Option', slogan: 'Front-load sustainability investment.' },
      { name: 'Strategy 2 — Phased', position: 'Referendum Option', slogan: 'Phase investment over four years.' },
    ],
    weights: [61, 39],
    includeAlex: false,
  },
];

const FIRST_NAMES = ['Amelia', 'Oliver', 'Isla', 'Ethan', 'Maya', 'Lucas', 'Zara', 'Hugo', 'Nina', 'Caleb', 'Leila', 'Owen', 'Freya', 'Adam', 'Sofia', 'Idris', 'Chloe', 'Mateo', 'Elena', 'Yusuf', 'Ava', 'Felix', 'Hana', 'Leo'];
const LAST_NAMES = ['Bennett', 'Okafor', 'Lindqvist', 'Moreau', 'Haddad', 'Novak', 'Silva', 'Kim', 'Duarte', 'Andersen', 'Farah', 'Petrov', 'Nyberg', 'Chen', 'Rossi', 'Mensah', 'Kaya', 'Wright', 'Ivanova', 'Toure'];
const FACULTIES = ['Engineering', 'Computer Science', 'Business School', 'Faculty of Law', 'Health Sciences', 'Social Sciences', 'Natural Sciences', 'Arts & Humanities'];

const uuid = () => crypto.randomUUID();

async function clearAll() {
  await prisma.validatorSignature.deleteMany();
  await prisma.consensusRound.deleteMany();
  await prisma.blockchainTransaction.deleteMany();
  await prisma.blockchainBlock.deleteMany();
  await prisma.electionResult.deleteMany();
  await prisma.nullifier.deleteMany();
  await prisma.encryptedBallot.deleteMany();
  await prisma.ballot.deleteMany();
  await prisma.zKPProof.deleteMany();
  await prisma.eligibleVoter.deleteMany();
  await prisma.merkleTree.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.election.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.auditor.deleteMany();
  await prisma.voter.deleteMany();
  await prisma.user.deleteMany();
  await prisma.validator.deleteMany();
}

interface PendingTx {
  type: string;
  electionId: string | null;
  payload: Record<string, unknown>;
  nullifier?: string | null;
  timestamp: Date;
  hash?: string;
  blockNumber?: number;
}

async function main() {
  console.log('CRYPTORA seed — resetting demonstration dataset');
  await clearAll();

  const validators = await ensureValidators();
  await createGenesisBlock();
  const validatorSet = validators.map((v) => v.validatorId).join(',');

  /* ---------------- demo accounts ---------------- */
  const adminPassword = await hashPassword('Admin@1234!');
  const voterPassword = await hashPassword('Voter@1234!');
  const auditorPassword = await hashPassword('Auditor@1234!');

  const admin = await prisma.user.create({
    data: {
      name: 'System Administrator',
      email: 'admin@cryptora.demo',
      passwordHash: adminPassword,
      role: 'ADMIN',
      lastLoginAt: now,
    },
  });

  const auditorUser = await prisma.user.create({
    data: {
      name: 'Jordan Blake',
      email: 'jordan@cryptora.demo',
      passwordHash: auditorPassword,
      role: 'AUDITOR',
      auditorId: 'AUD-2026-001',
      auditor: {
        create: {
          auditorNumber: 'AUD-2026-001',
          organisation: 'Independent Election Commission',
          accreditation: 'ACCREDITED',
        },
      },
      lastLoginAt: new Date(now.getTime() - 3600_000),
    },
  });

  const alexUser = await prisma.user.create({
    data: {
      name: 'Alex Morgan',
      email: 'alex@cryptora.demo',
      passwordHash: voterPassword,
      role: 'VOTER',
      voterId: 'VOTER-2026-0042',
      voter: {
        create: {
          voterNumber: 'VOTER-2026-0042',
          faculty: 'Computer Science',
          district: 'North Campus',
          eligibility: 'ELIGIBLE',
          credentialSalt: randomHex(32),
        },
      },
      lastLoginAt: new Date(now.getTime() - 7200_000),
    },
    include: { voter: true },
  });
  const alex = alexUser.voter!;

  const txEntries: PendingTx[] = [];
  const ballotsToInsert: any[] = [];
  const encryptedToInsert: any[] = [];
  const nullifiersToInsert: any[] = [];
  const proofsToInsert: any[] = [];
  const resultsToInsert: any[] = [];
  const auditEntries: any[] = [];
  const completedElections: { electionId: string; dbId: string; candidates: any[]; def: ElectionDef }[] = [];

  let syntheticCounter = 0;

  for (const def of ELECTION_DEFS) {
    process.stdout.write(`  • ${def.electionId} ${def.name}\n`);
    const keypair = generateKeypair(1024);
    const election = await prisma.election.create({
      data: {
        electionId: def.electionId,
        name: def.name,
        description: def.description,
        status: def.status,
        startDate: def.start,
        endDate: def.end,
        rules: def.candidates.length === 2 && def.name.includes('Referendum') ? 'Simple majority' : 'Plurality',
        voterGroup: def.name.includes('Faculty') ? 'Faculty of Engineering students' : 'All registered students',
        maxSelections: 1,
        tallyPublicKey: JSON.stringify(keypair.publicKey),
        tallyPrivateKey: JSON.stringify(keypair.privateKey),
        keyBits: keypair.publicKey.bits,
        createdBy: admin.id,
        createdAt: new Date(def.start.getTime() - 2 * DAY),
      },
    });

    const candidates = [];
    for (let i = 0; i < def.candidates.length; i++) {
      const c = def.candidates[i];
      candidates.push(
        await prisma.candidate.create({
          data: {
            candidateId: `${def.electionId}-C${String(i + 1).padStart(2, '0')}`,
            electionId: election.id,
            name: c.name,
            position: c.position,
            slogan: c.slogan,
            index: i,
          },
        }),
      );
    }

    txEntries.push({
      type: 'ELECTION_CREATED',
      electionId: election.id,
      timestamp: new Date(def.start.getTime() - 2 * DAY),
      payload: {
        electionId: def.electionId,
        name: def.name,
        opensAt: def.start.toISOString(),
        closesAt: def.end.toISOString(),
        candidateCount: candidates.length,
        tallyKeyBits: keypair.publicKey.bits,
        tallyPublicKey: keypair.publicKey,
      },
    });

    /* ---------------- voter registry ---------------- */
    const syntheticCount = def.eligible - (def.includeAlex ? 1 : 0);
    const usersData: any[] = [];
    const votersData: any[] = [];
    const salts: string[] = [];
    for (let i = 0; i < syntheticCount; i++) {
      syntheticCounter++;
      const n = syntheticCounter;
      const name = `${FIRST_NAMES[n % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(n / FIRST_NAMES.length) % LAST_NAMES.length]}`;
      const userId = uuid();
      const voterId = uuid();
      const salt = randomHex(32);
      salts.push(salt);
      usersData.push({
        id: userId,
        name,
        email: `voter.${n}@cryptora.demo`,
        passwordHash: lockedPasswordHash,
        role: 'VOTER',
        voterId: `VOTER-${String(1000 + n).padStart(4, '0')}-${def.electionId.slice(-3)}`,
        createdAt: new Date(def.start.getTime() - 3 * DAY),
      });
      votersData.push({
        id: voterId,
        userId,
        voterNumber: `VOTER-${String(1000 + n).padStart(4, '0')}-${def.electionId.slice(-3)}`,
        faculty: FACULTIES[n % FACULTIES.length],
        district: n % 3 === 0 ? 'North Campus' : n % 3 === 1 ? 'Central Campus' : 'South Campus',
        eligibility: 'ELIGIBLE',
        credentialSalt: salt,
        verifiedAt: new Date(def.start.getTime() - 2 * DAY),
      });
    }

    for (let i = 0; i < usersData.length; i += 800) {
      await prisma.user.createMany({ data: usersData.slice(i, i + 800) });
      await prisma.voter.createMany({ data: votersData.slice(i, i + 800) });
    }

    const eligibleRows: any[] = [];
    let leafIndex = 0;
    if (def.includeAlex) {
      eligibleRows.push({
        electionId: election.id,
        voterId: alex.id,
        commitment: leafCommitment(deriveSecret(alex.credentialSalt, def.electionId)).toString(),
        leafIndex: leafIndex++,
      });
    }
    for (let i = 0; i < votersData.length; i++) {
      eligibleRows.push({
        electionId: election.id,
        voterId: votersData[i].id,
        commitment: leafCommitment(deriveSecret(salts[i], def.electionId)).toString(),
        leafIndex: leafIndex++,
      });
    }
    for (let i = 0; i < eligibleRows.length; i += 800) {
      await prisma.eligibleVoter.createMany({ data: eligibleRows.slice(i, i + 800) });
    }

    /* ---------------- eligibility merkle tree ---------------- */
    const tree = buildTree(eligibleRows.map((r) => BigInt(r.commitment)), MERKLE_DEPTH);
    const root = tree.root.toString();
    await prisma.merkleTree.create({
      data: {
        electionId: election.id,
        depth: MERKLE_DEPTH,
        root,
        leafCount: eligibleRows.length,
        levels: levelsDigest(tree),
        publishedAt: def.start,
      },
    });
    await prisma.election.update({
      where: { id: election.id },
      data: { merkleRoot: root, leafCount: eligibleRows.length, merkleDepth: MERKLE_DEPTH },
    });

    txEntries.push({
      type: 'VOTER_ROOT_PUBLISHED',
      electionId: election.id,
      timestamp: new Date(def.start.getTime() - 3600_000),
      payload: {
        electionId: def.electionId,
        merkleRoot: root,
        leafCount: eligibleRows.length,
        depth: MERKLE_DEPTH,
        circuit: 'eligibility.circom',
      },
    });

    /* ---------------- ballots ---------------- */
    const fieldId = electionFieldId(def.electionId);
    const voterPool = votersData.map((v, i) => ({
      id: v.id,
      salt: salts[i],
      leafIndex: i + (def.includeAlex ? 1 : 0),
    }));

    const chosen: { id: string; salt: string; leafIndex: number }[] = [];
    if (def.alexVotes) chosen.push({ id: alex.id, salt: alex.credentialSalt, leafIndex: 0 });
    for (const v of voterPool) {
      if (chosen.length >= def.ballots) break;
      chosen.push(v);
    }

    const weightTotal = def.weights.reduce((a, b) => a + b, 0);
    const allotted = def.weights.map((w) => Math.floor((def.ballots * w) / weightTotal));
    // deterministic distribution across the required ballot count
    const assignment: number[] = [];
    def.weights.forEach((w, ci) => {
      for (let i = 0; i < allotted[ci]; i++) assignment.push(ci);
    });
    while (assignment.length < chosen.length) assignment.push(assignment.length % def.candidates.length);

    const spanMs = Math.max(def.end.getTime() - def.start.getTime(), 3600_000);
    const cutoff = Math.min(def.end.getTime(), now.getTime() - 60_000);
    const usableSpan = Math.max(cutoff - def.start.getTime(), 3600_000);

    let counter = 0;
    for (const voter of chosen) {
      const candidateIndex = assignment[counter % assignment.length];
      counter++;
      const oneHot = def.candidates.map((_, i) => (i === candidateIndex ? 1 : 0));
      const ciphertexts = encryptVector(keypair.publicKey, oneHot).map((c) => c.toString());
      const secret = deriveSecret(voter.salt, def.electionId);
      const nullifier = nullifierFor(secret, fieldId).toString();
      // deterministic pseudo-random spread of submission times, sorted ascending
      const fraction = (counter * 0.6180339887498949) % 1;
      const committedAt = new Date(def.start.getTime() + Math.floor(fraction * usableSpan));
      const ballotId = uuid();
      const receiptCode = `CRY-${crypto.createHash('sha256').update(ballotId).digest('hex').slice(0, 12).toUpperCase()}`;
      const commitment = sha256(canonical(ciphertexts));

      ballotsToInsert.push({
        id: ballotId,
        electionId: election.id,
        voterId: voter.id,
        nullifier,
        receiptCode,
        committedAt,
      });
      encryptedToInsert.push({
        id: uuid(),
        ballotId,
        scheme: 'paillier-additive',
        modulus: keypair.publicKey.n,
        generator: keypair.publicKey.g,
        ciphertexts: JSON.stringify(ciphertexts),
        commitment,
        createdAt: committedAt,
      });
      nullifiersToInsert.push({ id: uuid(), electionId: election.id, value: nullifier, usedAt: committedAt, ballotId });
      proofsToInsert.push({
        id: uuid(),
        electionId: election.id,
        nullifier,
        root,
        proofJson: JSON.stringify({ seeded: true }),
        publicSignalsJson: JSON.stringify([root, fieldId.toString(), nullifier]),
        verified: true,
        status: 'VERIFIED',
        verificationMs: 0,
        provenance: 'SEEDED',
        createdAt: committedAt,
      });

      txEntries.push({
        type: 'BALLOT_ACCEPTED',
        electionId: election.id,
        nullifier,
        timestamp: committedAt,
        payload: {
          electionId: def.electionId,
          encryptedBallot: ciphertexts,
          scheme: 'paillier-additive',
          tallyModulus: keypair.publicKey.n,
          ballotCommitment: commitment,
          proofVerified: true,
          nullifier,
          merkleRoot: root,
        },
      });
      txEntries.push({
        type: 'ZKP_VERIFIED',
        electionId: election.id,
        nullifier,
        timestamp: new Date(committedAt.getTime() + 4),
        payload: {
          electionId: def.electionId,
          circuit: 'eligibility.circom',
          protocol: 'groth16',
          root,
          nullifier,
          verified: true,
        },
      });
    }

    /* ---------------- close + tally completed elections ---------------- */
    if (def.status === 'COMPLETED') {
      txEntries.push({
        type: 'ELECTION_CLOSED',
        electionId: election.id,
        timestamp: def.end,
        payload: {
          electionId: def.electionId,
          closedAt: def.end.toISOString(),
          acceptedBallots: def.ballots,
          merkleRoot: root,
        },
      });

      const slots = def.candidates.length;
      const aggregated = Array.from({ length: slots }, () => 1n);
      const n2 = BigInt(keypair.publicKey.n) ** 2n;
      const startedAt = Date.now();
      const electionBallots = encryptedToInsert.filter((e) => e.modulus === keypair.publicKey.n);
      for (const enc of electionBallots) {
        const cts: string[] = JSON.parse(enc.ciphertexts);
        for (let i = 0; i < slots; i++) {
          aggregated[i] = (aggregated[i] * BigInt(cts[i])) % n2;
        }
      }
      const totals = aggregated.map((c) => Number(decrypt(keypair.privateKey, c)));
      const sum = totals.reduce((a, b) => a + b, 0);
      if (sum !== def.ballots) {
        throw new Error(`Tally mismatch for ${def.electionId}: ${sum} != ${def.ballots}`);
      }
      console.log(`    tally decrypted in ${Date.now() - startedAt}ms -> ${totals.join(', ')}`);

      candidates.forEach((c, i) => {
        resultsToInsert.push({
          id: uuid(),
          electionId: election.id,
          candidateId: c.id,
          votes: totals[i] ?? 0,
          publishedAt: new Date(def.end.getTime() + 3600_000),
        });
      });

      txEntries.push({
        type: 'AGGREGATE_TALLY_PUBLISHED',
        electionId: election.id,
        timestamp: new Date(def.end.getTime() + 3600_000),
        payload: {
          electionId: def.electionId,
          acceptedBallots: def.ballots,
          totals: candidates.map((c, i) => ({ candidateId: c.candidateId, votes: totals[i] ?? 0 })),
          scheme: 'paillier-additive',
          publishedAt: new Date(def.end.getTime() + 3600_000).toISOString(),
        },
      });

      completedElections.push({ electionId: def.electionId, dbId: election.id, candidates, def });
    }
  }

  /* ---------------- insert ballots ---------------- */
  console.log('  • inserting encrypted ballots');
  const ballotTxByNullifier = new Map<string, number>();

  // Assign block numbers to every pending transaction (40 transactions per block)
  txEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const genesis = await prisma.blockchainBlock.findUnique({ where: { blockNumber: 0 } });
  const startBlock = (genesis?.blockNumber ?? 0) + 1;
  txEntries.forEach((tx, i) => {
    tx.blockNumber = startBlock + Math.floor(i / 40);
    tx.hash = txHashFor({
      type: tx.type,
      payload: tx.payload,
      electionId: tx.electionId,
      nullifier: tx.nullifier ?? null,
      timestamp: tx.timestamp,
    });
    if (tx.type === 'BALLOT_ACCEPTED' && tx.nullifier) ballotTxByNullifier.set(tx.nullifier, tx.blockNumber!);
  });

  for (const b of ballotsToInsert) {
    b.blockNumber = ballotTxByNullifier.get(b.nullifier) ?? null;
  }

  for (let i = 0; i < ballotsToInsert.length; i += 500) {
    await prisma.ballot.createMany({ data: ballotsToInsert.slice(i, i + 500) });
  }
  for (let i = 0; i < encryptedToInsert.length; i += 300) {
    await prisma.encryptedBallot.createMany({ data: encryptedToInsert.slice(i, i + 300) });
  }
  for (let i = 0; i < nullifiersToInsert.length; i += 500) {
    await prisma.nullifier.createMany({ data: nullifiersToInsert.slice(i, i + 500) });
  }
  for (let i = 0; i < proofsToInsert.length; i += 500) {
    await prisma.zKPProof.createMany({ data: proofsToInsert.slice(i, i + 500) });
  }
  for (let i = 0; i < resultsToInsert.length; i += 200) {
    await prisma.electionResult.createMany({ data: resultsToInsert.slice(i, i + 200) });
  }

  /* ---------------- real ZK proofs for Alex's historical ballots ---------------- */
  console.log('  • generating real Groth16 proofs for the demo voter\'s historical ballots');
  const zkpDir = path.join(process.cwd(), 'client', 'public', 'zkp');
  const wasmPath = path.join(zkpDir, 'eligibility.wasm');
  const zkeyPath = path.join(zkpDir, 'eligibility_final.zkey');
  if (fs.existsSync(wasmPath) && fs.existsSync(zkeyPath)) {
    const snarkjs: any = await import('snarkjs');
    for (const electionId of ['ELEC-2026-002', 'ELEC-2026-003']) {
      const def = ELECTION_DEFS.find((d) => d.electionId === electionId)!;
      const election = await prisma.election.findUnique({ where: { electionId } });
      if (!election || !election.merkleRoot) continue;
      const leaves = await prisma.eligibleVoter.findMany({
        where: { electionId: election.id },
        orderBy: { leafIndex: 'asc' },
        select: { commitment: true, voterId: true, leafIndex: true },
      });
      const tree = buildTree(leaves.map((l) => BigInt(l.commitment)), MERKLE_DEPTH);
      const membership = leaves.find((l) => l.voterId === alex.id);
      if (!membership) continue;
      const secret = deriveSecret(alex.credentialSalt, electionId);
      const fieldId = electionFieldId(electionId);
      const nullifier = nullifierFor(secret, fieldId);
      const p = authPath(tree, membership.leafIndex);
      const input = {
        secret: secret.toString(),
        pathElements: p.pathElements,
        pathIndices: p.pathIndices,
        root: election.merkleRoot,
        electionId: fieldId.toString(),
        nullifier: nullifier.toString(),
      };
      const started = Date.now();
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
      const vkey = JSON.parse(fs.readFileSync(path.join(zkpDir, 'verification_key.json'), 'utf8'));
      const ok = await snarkjs.groth16.verify(vkey, publicSignals, proof);
      if (!ok) throw new Error(`Seeded proof failed verification for ${electionId}`);
      const proofRecord = await prisma.zKPProof.findFirst({
        where: { electionId: election.id, nullifier: nullifier.toString() },
      });
      if (proofRecord) {
        await prisma.zKPProof.update({
          where: { id: proofRecord.id },
          data: {
            proofJson: JSON.stringify({ proof, publicSignals }),
            publicSignalsJson: JSON.stringify(publicSignals),
            provenance: 'LIVE',
            verificationMs: Date.now() - started,
          },
        });
      }
      console.log(`    ${electionId}: real proof generated and verified in ${Date.now() - started}ms`);
    }
  }

  /* ---------------- build the consortium ledger ---------------- */
  console.log(`  • committing ${txEntries.length} transactions into the signed ledger`);
  let prevHash = genesis?.blockHash ?? '0'.repeat(64);
  let blockNumber = genesis?.blockNumber ?? 0;
  let index = 0;
  while (index < txEntries.length) {
    const currentBlock = txEntries[index].blockNumber!;
    const group: PendingTx[] = [];
    while (index < txEntries.length && txEntries[index].blockNumber === currentBlock) {
      group.push(txEntries[index]);
      index++;
    }
    blockNumber = currentBlock;
    const timestamp = group[group.length - 1].timestamp;
    const merkleRoot = transactionMerkleRoot(group.map((g) => g.hash!));
    const header = blockHeader({
      blockNumber,
      previousHash: prevHash,
      merkleRoot,
      timestamp,
      txCount: group.length,
      validatorSet,
    });
    const blockHash = computeBlockHash(header);
    const block = await prisma.blockchainBlock.create({
      data: {
        id: uuid(),
        blockNumber,
        previousHash: prevHash,
        merkleRoot,
        timestamp,
        txCount: group.length,
        consensus: 'ACHIEVED',
        approvals: validators.length,
        validatorSet: JSON.stringify(header),
        blockHash,
      },
    });
    await prisma.validatorSignature.createMany({
      data: validators.map((v) => ({
        id: uuid(),
        blockId: block.id,
        validatorId: v.id,
        signature: signMessage(v.secretKey, blockHash),
        message: blockHash,
        createdAt: timestamp,
      })),
    });
    await prisma.blockchainTransaction.createMany({
      data: group.map((tx) => ({
        id: uuid(),
        txHash: tx.hash!,
        type: tx.type,
        blockNumber,
        blockId: block.id,
        electionId: tx.electionId,
        payload: JSON.stringify(tx.payload),
        nullifier: tx.nullifier ?? null,
        timestamp: tx.timestamp,
        status: 'CONFIRMED',
      })),
    });
    await prisma.consensusRound.create({
      data: {
        id: uuid(),
        blockId: block.id,
        required: 4,
        votes: validators.length,
        achieved: true,
        startedAt: timestamp,
        finishedAt: new Date(timestamp.getTime() + 900),
      },
    });
    prevHash = blockHash;
  }

  /* ---------------- audit history ---------------- */
  console.log('  • seeding audit history');
  const auditSamples = [
    { action: 'ZKP_VERIFIED', detail: 'Eligibility proof verified for ELEC-2026-001', role: 'SYSTEM' },
    { action: 'CONSENSUS_ACHIEVED', detail: 'Four-of-five validator approval recorded', role: 'SYSTEM' },
    { action: 'BALLOT_SUBMITTED', detail: 'Encrypted ballot committed to the consortium ledger', role: 'VOTER' },
    { action: 'LEDGER_VERIFIED', detail: 'Independent ledger integrity verification passed', role: 'AUDITOR' },
    { action: 'ELECTION_CLOSED', detail: 'Voting closed and ballots sealed', role: 'ADMIN' },
    { action: 'VOTER_ROOT_PUBLISHED', detail: 'Eligibility Merkle root published', role: 'ADMIN' },
    { action: 'LOGIN_SUCCESS', detail: 'auditor session established', role: 'AUDITOR' },
  ];
  for (let i = 0; i < auditSamples.length; i++) {
    const sample = auditSamples[i];
    auditEntries.push({
      id: uuid(),
      actorId:
        sample.role === 'ADMIN' ? admin.id : sample.role === 'AUDITOR' ? auditorUser.id : sample.role === 'VOTER' ? alexUser.id : null,
      actorRole: sample.role,
      action: sample.action,
      detail: sample.detail,
      createdAt: new Date(now.getTime() - i * 3600_000),
      ip: '127.0.0.1',
    });
  }
  auditEntries.push({
    id: uuid(),
    actorId: alexUser.id,
    actorRole: 'VOTER',
    action: 'ELIGIBILITY_VERIFIED',
    detail: 'Voter credential verified against the published Merkle root',
    createdAt: new Date(now.getTime() - 2 * 3600_000),
    ip: '127.0.0.1',
  });
  await prisma.auditLog.createMany({ data: auditEntries });

  const counts = {
    users: await prisma.user.count(),
    voters: await prisma.voter.count(),
    eligibleEntries: await prisma.eligibleVoter.count(),
    elections: await prisma.election.count(),
    ballots: await prisma.ballot.count(),
    proofs: await prisma.zKPProof.count(),
    blocks: await prisma.blockchainBlock.count(),
    transactions: await prisma.blockchainTransaction.count(),
  };
  console.log('\nSeed complete:', JSON.stringify(counts, null, 2));
  console.log('\nDemo credentials');
  console.log('  Administrator  admin@cryptora.demo   / Admin@1234!');
  console.log('  Voter          VOTER-2026-0042       / Voter@1234!');
  console.log('  Auditor        jordan@cryptora.demo  / Auditor@1234!  (Auditor ID AUD-2026-001)');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
