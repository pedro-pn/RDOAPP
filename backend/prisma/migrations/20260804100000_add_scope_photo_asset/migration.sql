-- CreateTable
CREATE TABLE "comercial"."ScopePhotoAsset" (
    "id" TEXT NOT NULL,
    "assetKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScopePhotoAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScopePhotoAsset_assetKey_key" ON "comercial"."ScopePhotoAsset"("assetKey");

-- CreateIndex
CREATE INDEX "ScopePhotoAsset_createdAt_idx" ON "comercial"."ScopePhotoAsset"("createdAt");

