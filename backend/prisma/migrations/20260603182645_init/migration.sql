-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'USER', 'BANKER');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'IN_AUCTION', 'WON', 'CLOSED');

-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('OPEN', 'CLOSED', 'EXPIRED', 'WON');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('DOCUMENT_UPLOADED', 'STATUS_CHANGED', 'NOTE_ADDED', 'AUCTION_OPENED', 'OFFER_SUBMITTED', 'AUCTION_CLOSED');

-- CreateEnum
CREATE TYPE "SyncTrigger" AS ENUM ('STATUS_CHANGED', 'DOCUMENT_UPLOADED', 'AUCTION_OPENED', 'WINNING_OFFER_SELECTED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "bankId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bank" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "managerId" TEXT NOT NULL,
    "isHighActivity" BOOLEAN NOT NULL DEFAULT false,
    "lastActivity" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "payload" JSONB,
    "accountId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionOpportunity" (
    "id" TEXT NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT 'OPEN',
    "accountId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "winningOfferId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AuctionOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankOffer" (
    "id" TEXT NOT NULL,
    "interestRate" DECIMAL(5,2) NOT NULL,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "auctionId" TEXT NOT NULL,
    "bankerId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "BankOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "trigger" "SyncTrigger" NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "failureReason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Bank_name_key" ON "Bank"("name");

-- CreateIndex
CREATE INDEX "Event_accountId_createdAt_idx" ON "Event"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionOpportunity_winningOfferId_key" ON "AuctionOpportunity"("winningOfferId");

-- CreateIndex
CREATE INDEX "AuctionOpportunity_status_endsAt_idx" ON "AuctionOpportunity"("status", "endsAt");

-- CreateIndex
CREATE INDEX "BankOffer_auctionId_interestRate_createdAt_idx" ON "BankOffer"("auctionId", "interestRate", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BankOffer_auctionId_bankerId_key" ON "BankOffer"("auctionId", "bankerId");

-- CreateIndex
CREATE INDEX "SyncLog_status_createdAt_idx" ON "SyncLog"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionOpportunity" ADD CONSTRAINT "AuctionOpportunity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionOpportunity" ADD CONSTRAINT "AuctionOpportunity_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionOpportunity" ADD CONSTRAINT "AuctionOpportunity_winningOfferId_fkey" FOREIGN KEY ("winningOfferId") REFERENCES "BankOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankOffer" ADD CONSTRAINT "BankOffer_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "AuctionOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankOffer" ADD CONSTRAINT "BankOffer_bankerId_fkey" FOREIGN KEY ("bankerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankOffer" ADD CONSTRAINT "BankOffer_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
