/**
 * Duplicate complaint detection — CC-13.
 *
 * Surfaces candidates; it never merges, alters or hides a complaint. Merging
 * would destroy the reporter list and could bury a distinct fault that happens
 * to read alike, and it is unrecoverable. Humans decide.
 *
 * See docs/specs/CC-13-complaint-dedup.md.
 */
import { DUPLICATE_SIMILARITY_THRESHOLD } from "../../config/env.js";
import {
  buildEmbeddingText,
  findSimilarComplaints,
  type SimilarComplaint,
} from "../../repositories/embeddingRepository.js";
import { getEmbeddingProvider } from "../ai/embeddings/index.js";

export interface DuplicateCandidate {
  id: string;
  title: string;
  status: string;
  similarity: number;
  createdAt: string;
}

export interface DuplicateCheckInput {
  title: string;
  description: string;
  block: string;
  classroomNumber: string;
  excludeId?: string | undefined;
  limit?: number;
}

/**
 * Candidate duplicates of a complaint.
 *
 * Never throws. An AI failure must not stop a complaint being filed, so every
 * failure path returns an empty list — "we found nothing", which is exactly how
 * the caller should treat an unavailable provider.
 */
export const findDuplicateComplaints = async (
  input: DuplicateCheckInput,
): Promise<DuplicateCandidate[]> => {
  // Location is required: a fault is physical, and text similarity alone cannot
  // tell "fan broken in ML02" from the same words about NL28.
  if (!input.block?.trim() || !input.classroomNumber?.trim()) return [];

  const provider = getEmbeddingProvider();
  if (!provider) return [];

  let vector: number[] | undefined;
  try {
    [vector] = await provider.embed([
      buildEmbeddingText({
        id: "",
        title: input.title,
        description: input.description,
      }),
    ]);
  } catch (error) {
    console.error(
      "[duplicates] embedding failed, skipping detection:",
      (error as Error).message,
    );
    return [];
  }

  if (!vector) return [];

  let matches: SimilarComplaint[];
  try {
    matches = await findSimilarComplaints(vector, {
      block: input.block.trim(),
      classroomNumber: input.classroomNumber.trim(),
      limit: input.limit ?? 3,
      // pgvector's <=> is cosine DISTANCE; the calibrated threshold is a
      // SIMILARITY, so it is converted here rather than at the call site.
      maxDistance: 1 - DUPLICATE_SIMILARITY_THRESHOLD,
      excludeId: input.excludeId,
    });
  } catch (error) {
    console.error(
      "[duplicates] similarity query failed:",
      (error as Error).message,
    );
    return [];
  }

  return matches.map((match) => ({
    id: match.id,
    title: match.title,
    status: match.status,
    similarity: Number((1 - match.distance).toFixed(4)),
    createdAt: match.createdAt.toISOString(),
  }));
};
