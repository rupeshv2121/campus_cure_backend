/*
  Warnings:

  - You are about to drop the column `approvalStatus` on the `Doubt` table. All the data in the column will be lost.
  - You are about to drop the column `moderatedAt` on the `Doubt` table. All the data in the column will be lost.
  - You are about to drop the column `moderatedById` on the `Doubt` table. All the data in the column will be lost.
  - You are about to drop the column `moderationHistory` on the `Doubt` table. All the data in the column will be lost.
  - You are about to drop the column `moderationNote` on the `Doubt` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Doubt" DROP CONSTRAINT "Doubt_moderatedById_fkey";

-- AlterTable
ALTER TABLE "Doubt" DROP COLUMN "approvalStatus",
DROP COLUMN "moderatedAt",
DROP COLUMN "moderatedById",
DROP COLUMN "moderationHistory",
DROP COLUMN "moderationNote";
