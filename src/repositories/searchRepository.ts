/**
 * Retrieval queries for CC-11.
 *
 * Full-text search lives here because it is raw SQL; the keyword scorer is pure
 * TypeScript and lives in services/search/keywordRetriever.ts.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";
import { extractKeywords } from "../services/search/keywordRetriever.js";

export interface SearchFilters {
  subject?: string | undefined;
  semester?: number | undefined;
  excludeId?: string | undefined;
}

export interface DoubtCandidate {
  id: string;
  title: string;
  description: string;
  subject: string;
  semester: number;
  views: number;
  createdAt: Date;
  _count: { answers: number };
}

/**
 * Candidate set for the keyword retriever — unchanged from the original
 * implementation: substring match on the whole query OR on any extracted
 * keyword, capped at 40 rows.
 */
export const fetchKeywordCandidates = async (
  query: string,
  filters: SearchFilters,
  take = 40,
): Promise<DoubtCandidate[]> => {
  const keywords = extractKeywords(query);

  const insensitive = (
    field: "title" | "description",
    value: string,
  ): Prisma.DoubtWhereInput => ({
    [field]: { contains: value, mode: Prisma.QueryMode.insensitive },
  });

  const orClauses: Prisma.DoubtWhereInput[] = [
    insensitive("title", query),
    insensitive("description", query),
    ...keywords.flatMap((keyword) => [
      insensitive("title", keyword),
      insensitive("description", keyword),
    ]),
  ];

  return prisma.doubt.findMany({
    where: {
      ...(filters.subject ? { subject: filters.subject } : {}),
      ...(filters.semester ? { semester: filters.semester } : {}),
      ...(filters.excludeId ? { id: { not: filters.excludeId } } : {}),
      OR: orClauses,
    },
    // Explicit select — never pull the embedding column into a list response.
    select: {
      id: true,
      title: true,
      description: true,
      subject: true,
      semester: true,
      views: true,
      createdAt: true,
      _count: { select: { answers: true } },
    },
    take,
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Tokenise a query for `to_tsquery`.
 *
 * Sanitised to [a-z0-9] before the terms are joined with `|` in SQL, so the
 * query string can never inject tsquery syntax.
 */
const toSearchTerms = (query: string): string[] =>
  query
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((term) => term.length >= 2);

/**
 * Postgres full-text search, ranked by `ts_rank`, with OR semantics.
 *
 * `plainto_tsquery` joins every term with AND, so "why is quicksort sometimes
 * slow" matches only documents containing ALL of those lexemes. Measured on the
 * CC-11 corpus that scored 38.5% Recall@5; switching to OR took the same
 * retriever to 96.2%. This endpoint suggests possible duplicates, so recall
 * matters far more than precision — RRF handles the ordering.
 *
 * The `to_tsvector` expression must match `doubt_fts_idx` EXACTLY — including
 * the 'english' config and the coalesce calls — or Postgres silently ignores
 * the index and falls back to a sequential scan. Change one, change both.
 */
export const fullTextSearchDoubts = async (
  query: string,
  filters: SearchFilters,
  limit = 20,
): Promise<Array<{ id: string; rank: number }>> => {
  const terms = toSearchTerms(query);
  if (terms.length === 0) return [];

  const rows = await prisma.$queryRaw<Array<{ id: string; rank: number }>>`
    SELECT "id",
           ts_rank(
             to_tsvector('english', coalesce("title", '') || ' ' || coalesce("description", '')),
             to_tsquery('english', array_to_string(${terms}::text[], ' | '))
           ) AS rank
      FROM "Doubt"
     WHERE to_tsvector('english', coalesce("title", '') || ' ' || coalesce("description", ''))
           @@ to_tsquery('english', array_to_string(${terms}::text[], ' | '))
       AND (${filters.subject ?? null}::text IS NULL OR "subject" = ${filters.subject ?? null})
       AND (${filters.semester ?? null}::int  IS NULL OR "semester" = ${filters.semester ?? null})
       AND (${filters.excludeId ?? null}::text IS NULL OR "id" <> ${filters.excludeId ?? null})
     ORDER BY rank DESC
     LIMIT ${limit}
  `;

  return rows.map((row) => ({ id: row.id, rank: Number(row.rank) }));
};

/** Hydrate fused ids back into display rows, preserving the fused order. */
export const hydrateDoubts = async (
  ids: string[],
): Promise<DoubtCandidate[]> => {
  if (ids.length === 0) return [];

  const rows = await prisma.doubt.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      title: true,
      description: true,
      subject: true,
      semester: true,
      views: true,
      createdAt: true,
      _count: { select: { answers: true } },
    },
  });

  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids
    .map((id) => byId.get(id))
    .filter((row): row is DoubtCandidate => Boolean(row));
};
