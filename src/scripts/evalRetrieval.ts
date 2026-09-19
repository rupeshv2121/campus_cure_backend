/**
 * CC-11 evaluation harness.
 *
 * Reports Recall@5 and MRR for four configurations — keyword, fts, vector and
 * hybrid — over a labelled corpus. This is the measurement that justifies the
 * feature; without it, "semantic search is better" is an assertion.
 *
 * It WRITES NOTHING. The corpus is handed to Postgres as a VALUES CTE, so
 * `ts_rank` is computed by the real engine with the real text-search config
 * without inserting a row. Vector similarity is computed in-process from real
 * HuggingFace embeddings. Both retrievers are therefore the genuine articles,
 * not reimplementations, while production data stays clean.
 *
 * Run from campus_cure_backend:
 *     npx tsx src/scripts/evalRetrieval.ts
 *     npx tsx src/scripts/evalRetrieval.ts --text=title   (embed titles only)
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { prisma } from "../config/database.js";
import { getEmbeddingProvider } from "../services/ai/embeddings/index.js";
import { keywordRank } from "../services/search/keywordRetriever.js";
import { reciprocalRankFusion, DEFAULT_WEIGHTS } from "../services/search/rrf.js";

interface CorpusDoc {
  id: string;
  title: string;
  description: string;
  subject: string;
  semester: number;
}

interface LabelledQuery {
  q: string;
  relevant: string[];
  kind: string;
}

const AT_K = 5;

const here = dirname(fileURLToPath(import.meta.url));
const fixturesPath = join(here, "../__tests__/fixtures/retrieval-corpus.json");

/** How the document text is composed before embedding — the CC-10 open question. */
type TextMode = "concat" | "title" | "description";

const textFor = (doc: CorpusDoc, mode: TextMode): string => {
  if (mode === "title") return doc.title;
  if (mode === "description") return doc.description;
  return `${doc.title}\n${doc.description}`;
};

const cosine = (a: number[], b: number[]): number => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return dot / Math.sqrt(na * nb);
};

/**
 * Full-text ranking from the real Postgres engine, over an in-memory corpus.
 * The to_tsvector expression mirrors searchRepository.ts and doubt_fts_idx.
 */
const ftsRank = async (query: string, corpus: CorpusDoc[]): Promise<string[]> => {
  const ids = corpus.map((d) => d.id);
  const titles = corpus.map((d) => d.title);
  const descriptions = corpus.map((d) => d.description);

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH corpus AS (
      SELECT unnest(${ids}::text[])          AS id,
             unnest(${titles}::text[])       AS title,
             unnest(${descriptions}::text[]) AS description
    )
    SELECT id
      FROM corpus
     WHERE to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))
           @@ plainto_tsquery('english', ${query})
     ORDER BY ts_rank(
       to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')),
       plainto_tsquery('english', ${query})
     ) DESC
  `;

  return rows.map((r) => r.id);
};

/**
 * Full-text with OR semantics.
 *
 * `plainto_tsquery` joins every term with AND, so "why is quicksort sometimes
 * slow" only matches a document containing ALL of those lexemes. That is why
 * the AND variant scores 38.5% Recall@5 — it is precision-oriented, and recall
 * is what this endpoint needs. Terms are sanitised to [a-z0-9] in JS before
 * being joined with `|`, so `to_tsquery` cannot be injected.
 */
const ftsOrRank = async (query: string, corpus: CorpusDoc[]): Promise<string[]> => {
  const terms = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  if (terms.length === 0) return [];

  const ids = corpus.map((d) => d.id);
  const titles = corpus.map((d) => d.title);
  const descriptions = corpus.map((d) => d.description);

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH corpus AS (
      SELECT unnest(${ids}::text[])          AS id,
             unnest(${titles}::text[])       AS title,
             unnest(${descriptions}::text[]) AS description
    )
    SELECT id
      FROM corpus
     WHERE to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))
           @@ to_tsquery('english', array_to_string(${terms}::text[], ' | '))
     ORDER BY ts_rank(
       to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')),
       to_tsquery('english', array_to_string(${terms}::text[], ' | '))
     ) DESC
  `;

  return rows.map((r) => r.id);
};

const recallAtK = (ranked: string[], relevant: string[], k: number): number =>
  relevant.some((id) => ranked.slice(0, k).includes(id)) ? 1 : 0;

const reciprocalRank = (ranked: string[], relevant: string[]): number => {
  const index = ranked.findIndex((id) => relevant.includes(id));
  return index === -1 ? 0 : 1 / (index + 1);
};

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const main = async () => {
  const mode = ((process.argv
    .find((a) => a.startsWith("--text="))
    ?.split("=")[1] ?? "concat") as TextMode);

  const fixtures = JSON.parse(readFileSync(fixturesPath, "utf8")) as {
    corpus: CorpusDoc[];
    queries: LabelledQuery[];
  };
  const { corpus, queries } = fixtures;

  console.log(
    `Corpus: ${corpus.length} documents | Queries: ${queries.length} | embedding text: ${mode}\n`,
  );

  const provider = getEmbeddingProvider();
  if (!provider) throw new Error("No embedding provider configured");

  // Row counts before, so criterion 11 ("writes nothing") is verified, not claimed.
  const before = await prisma.doubt.count();

  console.log("Embedding corpus and queries...");
  const docVectors = await provider.embed(corpus.map((d) => textFor(d, mode)));
  const queryVectors = await provider.embed(queries.map((q) => q.q));

  const configs = ["keyword", "fts", "ftsOr", "vector", "hybrid", "hybridW", "hybridOr"] as const;
  const totals: Record<string, { recall: number; mrr: number }> = {};
  const byKind: Record<string, Record<string, number>> = {};
  for (const c of configs) totals[c] = { recall: 0, mrr: 0 };

  for (const [i, query] of queries.entries()) {
    const kwIds = keywordRank(query.q, corpus);
    const ftsIds = await ftsRank(query.q, corpus);
    const ftsOrIds = await ftsOrRank(query.q, corpus);

    const qv = queryVectors[i]!;
    const vecIds = corpus
      .map((doc, j) => ({ id: doc.id, score: cosine(qv, docVectors[j]!) }))
      .sort((a, b) => b.score - a.score)
      .map((r) => r.id);

    const lists = [
      { source: "keyword", ids: kwIds },
      { source: "fts", ids: ftsIds },
      { source: "vector", ids: vecIds.slice(0, 20) },
    ];
    // Equal weighting, to show what naive RRF does here.
    const hybridIds = reciprocalRankFusion(lists, {
      weights: { keyword: 1, fts: 1, vector: 1 },
    }).map((r) => r.id);
    // Weighted by measured retriever quality.
    const hybridWIds = reciprocalRankFusion(lists, {
      weights: DEFAULT_WEIGHTS,
    }).map((r) => r.id);
    // Weighted, with OR-semantics full text instead of AND.
    const hybridOrIds = reciprocalRankFusion(
      [
        { source: "keyword", ids: kwIds },
        { source: "fts", ids: ftsOrIds },
        { source: "vector", ids: vecIds.slice(0, 20) },
      ],
      { weights: DEFAULT_WEIGHTS },
    ).map((r) => r.id);

    const ranked: Record<string, string[]> = {
      keyword: kwIds,
      fts: ftsIds,
      vector: vecIds,
      hybrid: hybridIds,
      hybridW: hybridWIds,
      ftsOr: ftsOrIds,
      hybridOr: hybridOrIds,
    };

    for (const config of configs) {
      const r = recallAtK(ranked[config]!, query.relevant, AT_K);
      totals[config]!.recall += r;
      totals[config]!.mrr += reciprocalRank(ranked[config]!, query.relevant);
      byKind[query.kind] ??= {};
      byKind[query.kind]![config] = (byKind[query.kind]![config] ?? 0) + r;
    }
  }

  const n = queries.length;
  console.log(`\n=== Results (n=${n}) ===\n`);
  console.log("config     Recall@5   MRR");
  console.log("-".repeat(32));
  for (const config of configs) {
    console.log(
      `${config.padEnd(10)} ${pct(totals[config]!.recall / n).padStart(8)}   ${(totals[config]!.mrr / n).toFixed(3)}`,
    );
  }

  const kinds = Object.keys(byKind).sort();
  const counts: Record<string, number> = {};
  for (const q of queries) counts[q.kind] = (counts[q.kind] ?? 0) + 1;

  console.log(`\n=== Recall@5 by query type ===\n`);
  console.log(`kind${" ".repeat(9)}n  ` + configs.map((c) => c.padStart(9)).join(""));
  console.log("-".repeat(80));
  for (const kind of kinds) {
    const row = configs
      .map((c) => pct((byKind[kind]![c] ?? 0) / counts[kind]!).padStart(9))
      .join("");
    console.log(`${kind.padEnd(12)} ${String(counts[kind]).padStart(2)}   ${row}`);
  }

  const after = await prisma.doubt.count();
  console.log(
    `\nDoubt rows before/after: ${before}/${after} ` +
      (before === after ? "(harness wrote nothing)" : "(WROTE TO THE DATABASE!)"),
  );
  if (before !== after) process.exitCode = 1;

  console.log(
    `\nNote: n=${n} is small. Treat these as directional, not definitive.`,
  );
};

main()
  .catch((error) => {
    console.error("Evaluation failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
