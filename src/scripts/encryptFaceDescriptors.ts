/**
 * CC-60: one-time migration of plaintext face templates to encrypted storage.
 *
 * Reads the deprecated `faceDescriptor` Float[], writes `faceDescriptorEnc`,
 * and clears the plaintext. SQL could not do this - the encryption key lives
 * in the environment, not the database.
 *
 * Idempotent: rows already migrated are skipped, so it is safe to re-run.
 *
 *   npx tsx src/scripts/encryptFaceDescriptors.ts          # dry run
 *   npx tsx src/scripts/encryptFaceDescriptors.ts --apply
 */

import "dotenv/config";
import { prisma } from "../config/database.js";
import { FACE_LOGIN_ENABLED } from "../config/env.js";
import { encryptDescriptor } from "../services/auth/faceCrypto.js";

const apply = process.argv.includes("--apply");

const main = async (): Promise<void> => {
  if (!FACE_LOGIN_ENABLED) {
    console.error(
      "FACE_ENCRYPTION_KEY is not set, so there is nothing to encrypt with.\n" +
        "Generate one:  openssl rand -base64 32",
    );
    process.exitCode = 1;
    return;
  }

  const users = await prisma.user.findMany({
    where: { faceDescriptorEnc: null },
    select: { id: true, userID: true, faceDescriptor: true },
  });

  const pending = users.filter((user) => user.faceDescriptor.length === 128);

  console.log(
    `${users.length} user(s) without an encrypted template; ` +
      `${pending.length} have a plaintext one to migrate.`,
  );

  if (!apply) {
    for (const user of pending) console.log(`  would migrate ${user.userID}`);
    console.log("\nDry run. Re-run with --apply to write.");
    return;
  }

  let migrated = 0;

  for (const user of pending) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        faceDescriptorEnc: encryptDescriptor(user.faceDescriptor),
        // Cleared in the same statement: leaving both is the worst outcome,
        // since the plaintext is what an attacker would read anyway.
        faceDescriptor: [],
      },
      select: { id: true },
    });
    migrated += 1;
    console.log(`  migrated ${user.userID}`);
  }

  const leftover = await prisma.user.count({
    where: { faceDescriptor: { isEmpty: false } },
  });

  console.log(`\nMigrated ${migrated}. Rows still holding plaintext: ${leftover}.`);
  if (leftover === 0) {
    console.log('Safe to drop "User"."faceDescriptor" in a later migration.');
  }
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  // The pg pool keeps the process alive otherwise; see the CC-03 spec note.
  .finally(() => process.exit(process.exitCode ?? 0));
