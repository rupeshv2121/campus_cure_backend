/**
 * Removes everything `seedDemoData.ts` created, and nothing else.
 *
 * Written alongside the seeder rather than after it: seeded accounts are real,
 * loginable accounts with a shared password in a real database, so the way out
 * needs to exist before the way in is used.
 *
 * Safe by construction:
 *   - selects users only by the SEED_ userID prefix
 *   - refuses to touch any account whose email is not @seed.campuscure.local,
 *     so a real user who happens to match the prefix is never deleted
 *   - deletes child rows before parents, in one transaction
 *   - reports what it will do and takes --dry-run
 *
 * Run:
 *   npx tsx src/scripts/removeDemoData.ts --dry-run
 *   npx tsx src/scripts/removeDemoData.ts
 */
import "dotenv/config";
import { prisma } from "../config/database.js";
import { SEED_EMAIL_DOMAIN, SEED_PREFIX } from "./seedConstants.js";

const main = async () => {
  const dryRun = process.argv.includes("--dry-run");

  const users = await prisma.user.findMany({
    where: { userID: { startsWith: SEED_PREFIX } },
    select: { id: true, userID: true, email: true, role: true },
  });

  if (users.length === 0) {
    console.log("No seeded users found. Nothing to do.");
    return;
  }

  // Belt and braces: the prefix alone should be enough, but a real account
  // named SEED_something would otherwise be destroyed by a convention.
  const unexpected = users.filter(
    (user) => !user.email.endsWith(SEED_EMAIL_DOMAIN),
  );
  if (unexpected.length > 0) {
    console.error(
      "ABORT: these users match the seed prefix but are not seed accounts:",
    );
    for (const user of unexpected) console.error(`  ${user.userID} ${user.email}`);
    process.exitCode = 1;
    return;
  }

  const ids = users.map((user) => user.id);

  const [doubts, complaints, answers] = await Promise.all([
    prisma.doubt.count({ where: { postedById: { in: ids } } }),
    prisma.complaint.count({ where: { raisedById: { in: ids } } }),
    prisma.answer.count({ where: { answeredById: { in: ids } } }),
  ]);

  console.log(
    `Will remove: ${users.length} users, ${doubts} doubts, ${answers} answers, ${complaints} complaints`,
  );

  if (dryRun) {
    console.log("--dry-run: nothing deleted.");
    return;
  }

  const doubtIds = (
    await prisma.doubt.findMany({
      where: { postedById: { in: ids } },
      select: { id: true },
    })
  ).map((row) => row.id);

  await prisma.$transaction([
    // Answers on seeded doubts may have been written by real faculty, so they
    // go with the doubt rather than being kept as orphans.
    prisma.answerUpvote.deleteMany({
      where: { answer: { doubtId: { in: doubtIds } } },
    }),
    prisma.answerUpvote.deleteMany({ where: { userId: { in: ids } } }),
    prisma.answer.deleteMany({ where: { doubtId: { in: doubtIds } } }),
    prisma.answer.deleteMany({ where: { answeredById: { in: ids } } }),
    prisma.answerDraft.deleteMany({ where: { doubtId: { in: doubtIds } } }),
    prisma.doubtUpvote.deleteMany({ where: { doubtId: { in: doubtIds } } }),
    prisma.doubtUpvote.deleteMany({ where: { userId: { in: ids } } }),
    prisma.doubtView.deleteMany({ where: { doubtId: { in: doubtIds } } }),
    prisma.doubtView.deleteMany({ where: { userId: { in: ids } } }),
    prisma.doubt.deleteMany({ where: { postedById: { in: ids } } }),
    prisma.complaint.deleteMany({ where: { raisedById: { in: ids } } }),
    prisma.notification.deleteMany({ where: { userId: { in: ids } } }),
    prisma.studentProfile.deleteMany({ where: { userId: { in: ids } } }),
    prisma.facultyProfile.deleteMany({ where: { userId: { in: ids } } }),
    prisma.adminProfile.deleteMany({ where: { userId: { in: ids } } }),
    prisma.user.deleteMany({ where: { id: { in: ids } } }),
  ]);

  // Embedding jobs reference entities that no longer exist. The worker parks
  // those as FAILED harmlessly, but clearing them keeps the queue honest.
  await prisma.$executeRaw`
    DELETE FROM "EmbeddingJob"
     WHERE "entityType" = 'doubt'
       AND NOT EXISTS (SELECT 1 FROM "Doubt" WHERE "Doubt"."id" = "EmbeddingJob"."entityId")
  `;
  await prisma.$executeRaw`
    DELETE FROM "EmbeddingJob"
     WHERE "entityType" = 'complaint'
       AND NOT EXISTS (SELECT 1 FROM "Complaint" WHERE "Complaint"."id" = "EmbeddingJob"."entityId")
  `;

  const remaining = await prisma.user.count({
    where: { userID: { startsWith: SEED_PREFIX } },
  });
  console.log(
    remaining === 0
      ? "Done. All seeded data removed."
      : `WARNING: ${remaining} seeded users remain.`,
  );
};

main()
  .catch((error) => {
    console.error("Removal failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
