-- Itemized line-item splits (M5-13).

-- CreateTable
CREATE TABLE "ExpenseItem" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "participantMemberIds" TEXT[],
    CONSTRAINT "ExpenseItem_pkey" PRIMARY KEY ("id")
);

-- Money integrity: every line item is a positive amount.
ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_amountMinor_positive" CHECK ("amountMinor" > 0);

-- CreateIndex
CREATE INDEX "ExpenseItem_expenseId_idx" ON "ExpenseItem"("expenseId");

-- AddForeignKey
ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
