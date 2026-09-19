/**
 * CC-13: calibrate the duplicate-complaint similarity threshold.
 *
 * Duplicate detection makes a claim ("this already exists"), so a wrong answer
 * is worse than no answer — unlike ranked suggestions, which can afford noise.
 * The threshold therefore needs measuring, not guessing.
 *
 * Production data cannot calibrate it: measured on all 15 live complaints,
 * same-location pairs peaked at 0.144 similarity and were not real duplicates,
 * while the highest similarity overall (0.857) was between two junk placeholder
 * titles in different rooms. So labelled fixtures are used instead.
 *
 * Writes nothing. Run from campus_cure_backend:
 *     npx tsx src/scripts/calibrateDuplicateThreshold.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { prisma } from "../config/database.js";
import { getEmbeddingProvider } from "../services/ai/embeddings/index.js";
import { buildEmbeddingText } from "../repositories/embeddingRepository.js";

interface Pair {
  label: "duplicate" | "distinct";
  a: { title: string; description: string };
  b: { title: string; description: string };
}

const here = dirname(fileURLToPath(import.meta.url));
const fixturesPath = join(here, "../__tests__/fixtures/complaint-pairs.json");

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

const main = async () => {
  const { pairs } = JSON.parse(readFileSync(fixturesPath, "utf8")) as {
    pairs: Pair[];
  };

  const provider = getEmbeddingProvider();
  if (!provider) throw new Error("No embedding provider configured");

  const texts = pairs.flatMap((p) => [
    buildEmbeddingText({ id: "", ...p.a }),
    buildEmbeddingText({ id: "", ...p.b }),
  ]);
  const vectors = await provider.embed(texts);

  const scored = pairs.map((pair, i) => ({
    ...pair,
    sim: cosine(vectors[i * 2]!, vectors[i * 2 + 1]!),
  }));

  const dupes = scored.filter((p) => p.label === "duplicate");
  const distinct = scored.filter((p) => p.label === "distinct");

  const min = (xs: number[]) => Math.min(...xs);
  const max = (xs: number[]) => Math.max(...xs);

  console.log("=== duplicates (must be caught) ===");
  for (const p of [...dupes].sort((x, y) => x.sim - y.sim)) {
    console.log(`  ${p.sim.toFixed(3)}  "${p.a.title}" ~ "${p.b.title}"`);
  }

  console.log("\n=== distinct (must NOT be flagged) ===");
  for (const p of [...distinct].sort((x, y) => y.sim - x.sim)) {
    console.log(`  ${p.sim.toFixed(3)}  "${p.a.title}" vs "${p.b.title}"`);
  }

  const lowestDuplicate = min(dupes.map((p) => p.sim));
  const highestDistinct = max(distinct.map((p) => p.sim));

  console.log(`\nlowest duplicate  : ${lowestDuplicate.toFixed(3)}`);
  console.log(`highest distinct  : ${highestDistinct.toFixed(3)}`);

  if (lowestDuplicate > highestDistinct) {
    const mid = (lowestDuplicate + highestDistinct) / 2;
    console.log(
      `\nCLEANLY SEPARABLE. Any threshold in (${highestDistinct.toFixed(3)}, ${lowestDuplicate.toFixed(3)}) works.`,
    );
    console.log(`Recommended: ${mid.toFixed(2)} (midpoint, maximum margin)`);
  } else {
    console.log(
      `\nOVERLAPPING — no threshold separates these perfectly.\n` +
        `Choose by which error is worse. Missing a duplicate is recoverable;\n` +
        `falsely telling a student their problem is already reported is not.\n` +
        `So prefer precision: a threshold just above ${highestDistinct.toFixed(3)}\n` +
        `suppresses every false positive at the cost of missing some duplicates.`,
    );
    for (const t of [0.6, 0.65, 0.7, 0.75, 0.8, 0.85]) {
      const caught = dupes.filter((p) => p.sim >= t).length;
      const falsePos = distinct.filter((p) => p.sim >= t).length;
      console.log(
        `  threshold ${t.toFixed(2)}: catches ${caught}/${dupes.length} duplicates, ` +
          `${falsePos}/${distinct.length} false positives`,
      );
    }
  }

  console.log(
    `\nn=${pairs.length} labelled pairs. Small — re-calibrate once real duplicates exist.`,
  );
};

main()
  .catch((error) => {
    console.error("Calibration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
