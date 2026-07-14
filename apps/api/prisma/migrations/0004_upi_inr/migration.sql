-- India-first pivot (2026-07-14): INR defaults + UPI settle-up.

-- AlterEnum: UPI joins the settlement methods.
ALTER TYPE "PaymentMethod" ADD VALUE 'upi';

-- AlterTable: user-attached UPI VPA, with a shape check (local@handle).
ALTER TABLE "User" ADD COLUMN "upiId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_upiId_shape"
  CHECK ("upiId" IS NULL OR "upiId" ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@[a-zA-Z][a-zA-Z0-9]{1,63}$');

-- New accounts and groups default to INR. Existing rows keep their value —
-- shipped data is never silently rewritten.
ALTER TABLE "User" ALTER COLUMN "defaultCurrency" SET DEFAULT 'INR';
ALTER TABLE "Group" ALTER COLUMN "defaultCurrency" SET DEFAULT 'INR';
