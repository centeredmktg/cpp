-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('INTERIOR', 'EXTERIOR', 'EPOXY');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('LEAD', 'QUOTED', 'CONTRACTED', 'IN_PROGRESS', 'COMPLETE', 'LOST');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED');

-- CreateEnum
CREATE TYPE "ChangeOrderStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED');

-- CreateEnum
CREATE TYPE "PersonRole" AS ENUM ('HOMEOWNER', 'PROPERTY_OWNER', 'PROPERTY_MANAGER', 'GENERAL_CONTRACTOR', 'OTHER');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'LEAD',
    "description" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startDate" TIMESTAMP(3),
    "targetDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "revenue" DOUBLE PRECISION,
    "cost" DOUBLE PRECISION,
    "notes" TEXT,
    "hubspotId" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "hubspotId" TEXT,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonOnProject" (
    "personId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" "PersonRole" NOT NULL,

    CONSTRAINT "PersonOnProject_pkey" PRIMARY KEY ("personId","projectId")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "lineItems" JSONB NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION,
    "total" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentTerms" TEXT,
    "exclusions" TEXT,
    "termsAndConditions" TEXT,
    "signingToken" TEXT,
    "signingTokenExpiresAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signedPdfPath" TEXT,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingBaseline" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "PricingBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpoxyRate" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "systemLevel" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "EpoxyRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Acceptance" (
    "id" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "signaturePngPath" TEXT NOT NULL,
    "quoteId" TEXT,
    "changeOrderId" TEXT,

    CONSTRAINT "Acceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeOrder" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quoteId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "lineItems" JSONB NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "newTotal" DOUBLE PRECISION NOT NULL,
    "status" "ChangeOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "signingToken" TEXT,
    "signingTokenExpiresAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signedPdfPath" TEXT,

    CONSTRAINT "ChangeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_signingToken_key" ON "Quote"("signingToken");

-- CreateIndex
CREATE UNIQUE INDEX "PricingBaseline_key_key" ON "PricingBaseline"("key");

-- CreateIndex
CREATE UNIQUE INDEX "EpoxyRate_jobType_systemLevel_key" ON "EpoxyRate"("jobType", "systemLevel");

-- CreateIndex
CREATE UNIQUE INDEX "Acceptance_quoteId_key" ON "Acceptance"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "Acceptance_changeOrderId_key" ON "Acceptance"("changeOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeOrder_signingToken_key" ON "ChangeOrder"("signingToken");

-- AddForeignKey
ALTER TABLE "PersonOnProject" ADD CONSTRAINT "PersonOnProject_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonOnProject" ADD CONSTRAINT "PersonOnProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acceptance" ADD CONSTRAINT "Acceptance_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acceptance" ADD CONSTRAINT "Acceptance_changeOrderId_fkey" FOREIGN KEY ("changeOrderId") REFERENCES "ChangeOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
