CREATE TABLE "ListeningShelfItem" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "albumName" TEXT,
    "releaseGroupMbid" TEXT,
    "coverArtUrl" TEXT,
    "source" TEXT,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListeningShelfItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ListeningShelfItem_fingerprint_key" ON "ListeningShelfItem"("fingerprint");
CREATE INDEX "ListeningShelfItem_savedAt_idx" ON "ListeningShelfItem"("savedAt");
