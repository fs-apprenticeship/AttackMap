CREATE TABLE "scans" (
    "id"          TEXT         NOT NULL,
    "user_id"     TEXT,
    "filename"    TEXT         NOT NULL,
    "target"      TEXT         NOT NULL,
    "scanned_at"  TIMESTAMP(3),
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parsed_at"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scans_user_id_idx" ON "scans"("user_id");

ALTER TABLE "scans"
    ADD CONSTRAINT "scans_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
