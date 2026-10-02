/**
 * Bootstrap the first SUPER_ADMIN on a fresh database.
 *
 * POST /api/auth/register refuses privileged roles unless an active super
 * admin authorises the request, so an empty database has no way to get its
 * first one through the API. This is that way in. Every later admin should be
 * created from the admin UI by this account.
 *
 * Idempotent: if the email or userID already exists, nothing is written.
 *
 * Run:
 *   npx tsx src/scripts/createSuperAdmin.ts <email> <userID> "<name>" [password]
 *
 * With no password, a random one is generated and printed once.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { AdminLevel, ApprovalStatus, Role } from "@prisma/client";
import { prisma } from "../config/database.js";

const main = async () => {
  const [email, userID, name, givenPassword] = process.argv.slice(2);

  if (!email || !userID || !name) {
    console.error(
      'Usage: npx tsx src/scripts/createSuperAdmin.ts <email> <userID> "<name>" [password]',
    );
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { userID }] },
    select: { email: true, role: true },
  });
  if (existing) {
    console.log(`A user with that email or userID already exists (${existing.role}). Nothing written.`);
    return;
  }

  const password = givenPassword ?? randomBytes(12).toString("base64url");

  await prisma.user.create({
    data: {
      name,
      email,
      userID,
      password: await bcrypt.hash(password, 10),
      role: Role.SUPER_ADMIN,
      approvalStatus: ApprovalStatus.APPROVED,
      adminProfile: {
        create: {
          adminLevel: AdminLevel.SUPER,
          manageUsers: true,
          manageComplaints: true,
          manageDoubts: true,
          viewAnalytics: true,
          assignedDepartments: [],
          allowedCategories: [],
        },
      },
    },
  });

  console.log(`Super admin created: ${email} (userID ${userID})`);
  if (!givenPassword) console.log(`Generated password (shown once): ${password}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
