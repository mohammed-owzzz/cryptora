import { prisma } from './prisma.js';
import { buildTree, levelsDigest, MERKLE_DEPTH } from './merkle.js';
import { aggregate, tallyCiphertexts, type PrivateKey } from './paillier.js';
import { commitBlock } from './chain.js';

/**
 * Election lifecycle: publish eligibility root, open/close voting, publish tally.
 * State machine: DRAFT -> SCHEDULED -> LIVE -> CLOSED -> TALLYING -> COMPLETED
 */

export async function publishVoterRoot(electionId: string) {
  const election = await prisma.election.findUnique({ where: { electionId } });
  if (!election) throw new Error('Election not found');
  const eligible = await prisma.eligibleVoter.findMany({
    where: { electionId: election.id },
    orderBy: { leafIndex: 'asc' },
  });
  if (eligible.length === 0) throw new Error('Register at least one eligible voter before publishing');

  const leaves = eligible.map((e) => BigInt(e.commitment));
  const merkle = buildTree(leaves, MERKLE_DEPTH);
  const root = merkle.root.toString();

  await prisma.merkleTree.deleteMany({ where: { electionId: election.id } });
  await prisma.merkleTree.create({
    data: {
      electionId: election.id,
      depth: MERKLE_DEPTH,
      root,
      leafCount: leaves.length,
      levels: levelsDigest(merkle),
    },
  });

  await prisma.election.update({
    where: { id: election.id },
    data: {
      merkleRoot: root,
      leafCount: leaves.length,
      merkleDepth: MERKLE_DEPTH,
      status: election.status === 'DRAFT' ? 'SCHEDULED' : election.status,
    },
  });

  const result = await commitBlock([
    {
      type: 'VOTER_ROOT_PUBLISHED',
      electionId: election.id,
      payload: {
        electionId: election.electionId,
        merkleRoot: root,
        leafCount: leaves.length,
        depth: MERKLE_DEPTH,
        circuit: 'eligibility.circom',
      },
    },
  ]);

  return { root, leafCount: leaves.length, block: result };
}

export async function openElection(electionId: string) {
  const election = await prisma.election.findUnique({ where: { electionId } });
  if (!election) throw new Error('Election not found');
  if (!election.merkleRoot) throw new Error('Publish the voter eligibility root before opening');
  if (!['DRAFT', 'SCHEDULED'].includes(election.status)) throw new Error(`Cannot open an election in state ${election.status}`);

  const now = new Date();
  const start = election.startDate < now ? now : election.startDate;
  const updated = await prisma.election.update({
    where: { id: election.id },
    data: { status: 'LIVE', startDate: start },
  });
  const block = await commitBlock([
    {
      type: 'ELECTION_CREATED',
      electionId: election.id,
      payload: {
        electionId: election.electionId,
        action: 'OPEN',
        openedAt: new Date().toISOString(),
        closesAt: updated.endDate.toISOString(),
        merkleRoot: election.merkleRoot,
      },
    },
  ]);
  return { election: updated, block };
}

export async function closeElection(electionId: string) {
  const election = await prisma.election.findUnique({ where: { electionId } });
  if (!election) throw new Error('Election not found');
  if (election.status !== 'LIVE') throw new Error(`Only a LIVE election can be closed (state: ${election.status})`);

  const ballots = await prisma.ballot.count({ where: { electionId: election.id } });
  const updated = await prisma.election.update({ where: { id: election.id }, data: { status: 'CLOSED' } });
  const block = await commitBlock([
    {
      type: 'ELECTION_CLOSED',
      electionId: election.id,
      payload: {
        electionId: election.electionId,
        closedAt: new Date().toISOString(),
        acceptedBallots: ballots,
        merkleRoot: election.merkleRoot,
      },
    },
  ]);
  return { election: updated, block };
}

export async function tallyElection(electionId: string) {
  const election = await prisma.election.findUnique({
    where: { electionId },
    include: { candidates: { orderBy: { index: 'asc' } } },
  });
  if (!election) throw new Error('Election not found');
  if (!['CLOSED', 'TALLYING'].includes(election.status)) {
    throw new Error(`Tallying requires a CLOSED election (state: ${election.status})`);
  }
  if (!election.tallyPrivateKey || !election.tallyPublicKey) throw new Error('Election tally keys are missing');

  const pub = JSON.parse(election.tallyPublicKey);
  const priv: PrivateKey = JSON.parse(election.tallyPrivateKey);

  const encrypted = await prisma.encryptedBallot.findMany({
    where: { ballot: { electionId: election.id } },
    select: { ciphertexts: true, ballotId: true },
  });
  if (encrypted.length === 0) throw new Error('No accepted ballots to tally');

  const slots = election.candidates.length;
  const aggregated: bigint[] = Array.from({ length: slots }, () => 1n);
  for (const ballot of encrypted) {
    const cts: string[] = JSON.parse(ballot.ciphertexts);
    if (cts.length !== slots) throw new Error('Ballot vector length does not match candidate count');
    for (let i = 0; i < slots; i++) {
      aggregated[i] = aggregate([aggregated[i].toString(), cts[i]], pub.n);
    }
  }

  const totals = tallyCiphertexts(priv, aggregated);
  const sum = totals.reduce((a, b) => a + b, 0);
  if (sum !== encrypted.length) {
    throw new Error(`Tally integrity failure: decrypted total ${sum} != accepted ballots ${encrypted.length}`);
  }

  await prisma.election.update({ where: { id: election.id }, data: { status: 'TALLYING' } });
  await prisma.electionResult.deleteMany({ where: { electionId: election.id } });
  for (const candidate of election.candidates) {
    await prisma.electionResult.create({
      data: {
        electionId: election.id,
        candidateId: candidate.id,
        votes: totals[candidate.index] ?? 0,
      },
    });
  }

  const result = await commitBlock([
    {
      type: 'AGGREGATE_TALLY_PUBLISHED',
      electionId: election.id,
      payload: {
        electionId: election.electionId,
        acceptedBallots: encrypted.length,
        totals: election.candidates.map((c) => ({ candidateId: c.candidateId, votes: totals[c.index] ?? 0 })),
        scheme: 'paillier-additive',
        publishedAt: new Date().toISOString(),
      },
    },
  ]);

  await prisma.election.update({ where: { id: election.id }, data: { status: 'COMPLETED' } });

  return {
    totals: election.candidates.map((c) => ({ candidateId: c.candidateId, name: c.name, votes: totals[c.index] ?? 0 })),
    acceptedBallots: encrypted.length,
    block: result,
  };
}
