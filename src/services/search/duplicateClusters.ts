/**
 * Grouping duplicate complaints into clusters — CC-13, admin view.
 *
 * Pairwise similarity is not enough for triage. If A~B and B~C, an admin needs
 * to see one group of three, not two overlapping pairs. Clusters are the
 * connected components of the "is a possible duplicate of" graph, built with
 * union-find.
 *
 * Nothing here mutates a complaint. The output is a view.
 */
import { DUPLICATE_SIMILARITY_THRESHOLD } from "../../config/env.js";
import {
  findDuplicateComplaintPairs,
  type DuplicatePair,
} from "../../repositories/embeddingRepository.js";
import { prisma } from "../../config/database.js";

export interface ClusterMember {
  id: string;
  title: string;
  status: string;
  category: string;
  createdAt: string;
  raisedBy: string | null;
}

export interface DuplicateCluster {
  block: string;
  classroomNumber: string;
  /** Highest pairwise similarity inside the cluster — how confident we are. */
  topSimilarity: number;
  size: number;
  complaints: ClusterMember[];
}

/**
 * Union-find. Small and explicit rather than a dependency: the whole point is
 * that A~B and B~C must collapse into one group even when A and C were never
 * directly compared.
 */
const buildGroups = (pairs: DuplicatePair[]): Map<string, string[]> => {
  const parent = new Map<string, string>();

  const find = (id: string): string => {
    if (!parent.has(id)) parent.set(id, id);
    let root = parent.get(id)!;
    while (root !== parent.get(root)!) root = parent.get(root)!;
    parent.set(id, root); // path compression
    return root;
  };

  const union = (a: string, b: string): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  };

  for (const pair of pairs) union(pair.aId, pair.bId);

  const groups = new Map<string, string[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    const members = groups.get(root) ?? [];
    members.push(id);
    groups.set(root, members);
  }

  return groups;
};

/**
 * Clusters of open complaints that look like the same fault.
 *
 * Never throws: with no embeddings, no provider, or a failing query it returns
 * an empty list. An admin dashboard must not break because AI is unavailable.
 */
export const getDuplicateClusters = async (): Promise<DuplicateCluster[]> => {
  let pairs: DuplicatePair[];
  try {
    pairs = await findDuplicateComplaintPairs(
      // The configured value is a similarity; the operator returns a distance.
      1 - DUPLICATE_SIMILARITY_THRESHOLD,
    );
  } catch (error) {
    console.error(
      "[duplicates] cluster query failed:",
      (error as Error).message,
    );
    return [];
  }

  if (pairs.length === 0) return [];

  const groups = buildGroups(pairs);
  const allIds = [...new Set(pairs.flatMap((p) => [p.aId, p.bId]))];

  const rows = await prisma.complaint.findMany({
    where: { id: { in: allIds } },
    select: {
      id: true,
      title: true,
      status: true,
      category: true,
      block: true,
      classroomNumber: true,
      createdAt: true,
      raisedBy: { select: { name: true } },
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  /** Best similarity seen between any two members of a group. */
  const topFor = (ids: string[]): number => {
    const inGroup = new Set(ids);
    let top = 0;
    for (const pair of pairs) {
      if (inGroup.has(pair.aId) && inGroup.has(pair.bId)) {
        top = Math.max(top, pair.similarity);
      }
    }
    return top;
  };

  const clusters: DuplicateCluster[] = [];

  for (const ids of groups.values()) {
    const members = ids
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    // A group of one cannot be a duplicate of anything.
    if (members.length < 2) continue;

    const first = members[0]!;
    clusters.push({
      block: first.block,
      classroomNumber: first.classroomNumber,
      topSimilarity: topFor(ids),
      size: members.length,
      complaints: members
        .map((row) => ({
          id: row.id,
          title: row.title,
          status: String(row.status),
          category: row.category,
          createdAt: row.createdAt.toISOString(),
          raisedBy: row.raisedBy?.name ?? null,
        }))
        // Oldest first: the original report is the one to keep and assign.
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    });
  }

  // Largest clusters first — they waste the most triage effort.
  return clusters.sort(
    (a, b) => b.size - a.size || b.topSimilarity - a.topSimilarity,
  );
};
