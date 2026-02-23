import "dotenv/config";
import app from "../src/app.js";
import { prisma } from "../src/config/database.js";

let prismaConnectionPromise: Promise<void> | null = null;

const ensurePrismaConnected = async () => {
  if (!prismaConnectionPromise) {
    prismaConnectionPromise = prisma.$connect();
  }

  await prismaConnectionPromise;
};

export default async function handler(
  req: Parameters<typeof app>[0],
  res: Parameters<typeof app>[1],
) {
  await ensurePrismaConnected();
  return app(req, res);
}
