-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowMP" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mpId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowMP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowBill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowBill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FollowMP_userId_mpId_key" ON "FollowMP"("userId", "mpId");

-- CreateIndex
CREATE UNIQUE INDEX "FollowBill_userId_billId_key" ON "FollowBill"("userId", "billId");

-- AddForeignKey
ALTER TABLE "FollowMP" ADD CONSTRAINT "FollowMP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowMP" ADD CONSTRAINT "FollowMP_mpId_fkey" FOREIGN KEY ("mpId") REFERENCES "MP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowBill" ADD CONSTRAINT "FollowBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowBill" ADD CONSTRAINT "FollowBill_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
