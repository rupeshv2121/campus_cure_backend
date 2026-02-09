/*
  Warnings:

  - The required column `id` was added to the `User` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Changed the type of `role` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `approvalStatus` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'FACULTY', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Subject" AS ENUM ('DSA', 'DBMS', 'OS', 'NETWORKS');

-- CreateEnum
CREATE TYPE "DoubtStatus" AS ENUM ('OPEN', 'ANSWERED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ComplaintCategory" AS ENUM ('PROJECTOR', 'FAN', 'LIGHT', 'SMART_BOARD', 'SEATING');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('RAISED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AdminLevel" AS ENUM ('SUPER', 'NORMAL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "id" TEXT NOT NULL,
DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL,
DROP COLUMN "approvalStatus",
ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL,
ALTER COLUMN "isActive" SET DEFAULT false,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enrollmentNumber" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "phoneNumber" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "isStudying" BOOLEAN NOT NULL DEFAULT true,
    "guardianName" TEXT NOT NULL,
    "guardianPhone" TEXT NOT NULL,
    "doubtsAsked" INTEGER NOT NULL DEFAULT 0,
    "doubtsSolved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacultyProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "isTeaching" BOOLEAN NOT NULL DEFAULT true,
    "subjects" TEXT[],
    "doubtsSolved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacultyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminLevel" "AdminLevel" NOT NULL,
    "manageUsers" BOOLEAN NOT NULL DEFAULT false,
    "manageComplaints" BOOLEAN NOT NULL DEFAULT false,
    "manageDoubts" BOOLEAN NOT NULL DEFAULT false,
    "viewAnalytics" BOOLEAN NOT NULL DEFAULT false,
    "assignedDepartments" TEXT[],
    "allowedCategories" TEXT[],
    "complaintsAssigned" INTEGER NOT NULL DEFAULT 0,
    "complaintsClosed" INTEGER NOT NULL DEFAULT 0,
    "usersManaged" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Doubt" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "subject" "Subject" NOT NULL,
    "labels" TEXT[],
    "postedById" TEXT NOT NULL,
    "status" "DoubtStatus" NOT NULL DEFAULT 'OPEN',
    "views" INTEGER NOT NULL DEFAULT 0,
    "upVoteCount" INTEGER NOT NULL DEFAULT 0,
    "answerCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedAnswerId" TEXT,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Doubt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "doubtId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "answeredById" TEXT NOT NULL,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isAccepted" BOOLEAN NOT NULL DEFAULT false,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ComplaintCategory" NOT NULL,
    "classroomNumber" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'RAISED',
    "priority" INTEGER NOT NULL,
    "raisedById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "resolutionNote" TEXT,
    "feedbackRating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_enrollmentNumber_key" ON "StudentProfile"("enrollmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FacultyProfile_userId_key" ON "FacultyProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_userId_key" ON "AdminProfile"("userId");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacultyProfile" ADD CONSTRAINT "FacultyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doubt" ADD CONSTRAINT "Doubt_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_doubtId_fkey" FOREIGN KEY ("doubtId") REFERENCES "Doubt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
