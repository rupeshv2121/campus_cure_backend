/**
 * Recount the denormalised vote and answer counters from the rows they count.
 *
 *   npx tsx src/scripts/reconcileCounters.ts            # report only
 *   npx tsx src/scripts/reconcileCounters.ts --apply    # fix them
 *
 * Why it exists (2026-10-04):
 *  - Doubt.upVoteCount was also incremented by votes on the doubt's ANSWERS,
 *    so the "Upvote this doubt" button showed an inflated number. Fixed in
 *    code; this repairs the stored values.
 *  - The demo seed used to write random vote counts with no vote rows behind
 *    them. Applying this to seeded data sets those to the real number of
 *    votes - usually 0. Reseed first if the demo should look busy (the seed
 *    now creates real votes).
 */

import "dotenv/config";
import { prisma } from "../config/database.js";

const apply = process.argv.includes("--apply");

const report = await prisma.$queryRaw<
  Array<{ kind: string; total: number; wrong: number }>
>`
  SELECT 'Doubt.upVoteCount' AS kind, COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE d."upVoteCount" <>
           (SELECT COUNT(*) FROM "DoubtUpvote" u WHERE u."doubtId" = d.id))::int AS wrong
    FROM "Doubt" d
  UNION ALL
  SELECT 'Answer.upvotes', COUNT(*)::int,
         COUNT(*) FILTER (WHERE a.upvotes <>
           (SELECT COUNT(*) FROM "AnswerUpvote" u WHERE u."answerId" = a.id))::int
    FROM "Answer" a
  UNION ALL
  SELECT 'Doubt.answerCount', COUNT(*)::int,
         COUNT(*) FILTER (WHERE d."answerCount" <>
           (SELECT COUNT(*) FROM "Answer" a WHERE a."doubtId" = d.id))::int
    FROM "Doubt" d`;

for (const row of report) {
  console.log(`${row.kind.padEnd(20)} ${row.wrong} of ${row.total} out of step`);
}

if (!apply) {
  console.log("\nReport only. Run with --apply to fix.");
} else {
  const [doubts, answers, counts] = await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE "Doubt" d SET "upVoteCount" =
        (SELECT COUNT(*) FROM "DoubtUpvote" u WHERE u."doubtId" = d.id)
      WHERE d."upVoteCount" <> (SELECT COUNT(*) FROM "DoubtUpvote" u WHERE u."doubtId" = d.id)`,
    prisma.$executeRaw`
      UPDATE "Answer" a SET upvotes =
        (SELECT COUNT(*) FROM "AnswerUpvote" u WHERE u."answerId" = a.id)
      WHERE a.upvotes <> (SELECT COUNT(*) FROM "AnswerUpvote" u WHERE u."answerId" = a.id)`,
    prisma.$executeRaw`
      UPDATE "Doubt" d SET "answerCount" =
        (SELECT COUNT(*) FROM "Answer" a WHERE a."doubtId" = d.id)
      WHERE d."answerCount" <> (SELECT COUNT(*) FROM "Answer" a WHERE a."doubtId" = d.id)`,
  ]);
  console.log(`\nFixed: ${doubts} doubt vote counts, ${answers} answer vote counts, ${counts} answer counts.`);
}

process.exit(0);
