/**
 * CC-14 evaluation: rules vs model vs hybrid.
 *
 * The point is a defensible comparison, not a demonstration that the AI wins.
 * If rules beat the model, that is the result and it gets reported.
 *
 * Writes nothing. Run from campus_cure_backend:
 *     npx tsx src/scripts/evalIntake.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { completeWithFallback } from "../services/ai/chat/index.js";
import { parseComplaintText } from "../services/intake/parseComplaint.js";
import { __testing } from "../services/intake/parseComplaint.js";
import { parseWithRules } from "../services/intake/rules.js";

interface Case {
  kind: string;
  text: string;
  expectedCategory: string | null;
  expectedRoom: string | null;
}

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "../__tests__/fixtures/complaint-intake.json");

/** Model with no rules in front of it, for the comparison. */
const modelOnly = async (text: string): Promise<string | null> => {
  const completion = await completeWithFallback(
    [
      { role: "system", content: __testing.systemPrompt() },
      { role: "user", content: text },
    ],
    { maxTokens: 800, temperature: 0 },
  ).catch(() => null);

  if (!completion) return null;
  return __testing.parseModelJson(completion.content).category ?? null;
};

const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;

const main = async () => {
  const { cases } = JSON.parse(readFileSync(fixtures, "utf8")) as {
    cases: Case[];
  };

  const configs = ["rules", "model", "hybrid"] as const;
  const correct: Record<string, number> = { rules: 0, model: 0, hybrid: 0 };
  const byKind: Record<string, Record<string, number>> = {};
  const counts: Record<string, number> = {};
  let roomCorrect = 0;
  let modelCalls = 0;

  console.log(`Evaluating ${cases.length} labelled complaints...\n`);

  for (const testCase of cases) {
    counts[testCase.kind] = (counts[testCase.kind] ?? 0) + 1;
    byKind[testCase.kind] ??= {};

    const rulesCategory = parseWithRules(testCase.text).category;
    const modelCategory = await modelOnly(testCase.text);
    const hybrid = await parseComplaintText(testCase.text);
    if (hybrid.source === "model") modelCalls++;

    // Rules returning null is "no opinion", which is only right when no
    // category applies.
    const results: Record<string, string | null> = {
      rules: rulesCategory,
      model: modelCategory,
      hybrid: hybrid.category,
    };

    for (const config of configs) {
      const got = results[config] ?? "OTHER";
      const want = testCase.expectedCategory ?? "OTHER";
      if (got === want) {
        correct[config]!++;
        byKind[testCase.kind]![config] = (byKind[testCase.kind]![config] ?? 0) + 1;
      }
    }

    if ((hybrid.classroomNumber ?? null) === testCase.expectedRoom) roomCorrect++;
  }

  const n = cases.length;
  console.log("=== Category accuracy ===\n");
  console.log("config    accuracy");
  console.log("-".repeat(22));
  for (const config of configs) {
    console.log(`${config.padEnd(9)} ${pct(correct[config]!, n).padStart(7)}`);
  }

  console.log("\n=== By case type ===\n");
  console.log(`kind${" ".repeat(7)}n  ` + configs.map((c) => c.padStart(9)).join(""));
  console.log("-".repeat(45));
  for (const kind of Object.keys(counts).sort()) {
    const row = configs
      .map((c) => pct(byKind[kind]![c] ?? 0, counts[kind]!).padStart(9))
      .join("");
    console.log(`${kind.padEnd(10)} ${String(counts[kind]).padStart(2)} ${row}`);
  }

  console.log(
    `\nRoom extraction (hybrid): ${pct(roomCorrect, n)} exact match`,
  );
  console.log(
    `Model was called for ${modelCalls}/${n} cases — the rest were answered by rules at no cost.`,
  );
  console.log(`\nn=${n}. Small: treat as directional.`);
};

main()
  .catch((error) => {
    console.error("Evaluation failed:", error);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
