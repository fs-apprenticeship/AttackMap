-- Natural-key unique constraints, enabling the chunked upsert path
-- (lib/scans/store.ts saveScanChunked) used by large-scan async imports.
-- See docs/LARGE_SCAN_PROCESSING.md.
--
-- CAVEAT: these will fail to apply if any existing rows already violate
-- them. Check for duplicates before running against a database with
-- existing scan data, e.g.:
--   SELECT scan_id, ip_address, count(*) FROM hosts GROUP BY 1, 2 HAVING count(*) > 1;
--   SELECT host_id, port, protocol, count(*) FROM services GROUP BY 1, 2, 3 HAVING count(*) > 1;
--   SELECT scan_id, host_id, severity, title, count(*) FROM findings GROUP BY 1, 2, 3, 4 HAVING count(*) > 1;
CREATE UNIQUE INDEX "hosts_scan_id_ip_address_key" ON "hosts"("scan_id", "ip_address");
CREATE UNIQUE INDEX "services_host_id_port_protocol_key" ON "services"("host_id", "port", "protocol");
CREATE UNIQUE INDEX "findings_natural_key" ON "findings"("scan_id", "host_id", "severity", "title");

-- Persisted job tracking for the large-scan async import pipeline, replacing
-- an in-memory job map that did not survive Vercel serverless cold starts
-- and wasn't shared across instances.
CREATE TYPE "ScanImportStatus" AS ENUM ('queued', 'validating', 'parsing', 'saving', 'complete', 'failed');

CREATE TABLE "scan_import_jobs" (
    "id"              TEXT               NOT NULL,
    "user_id"         TEXT               NOT NULL,
    "filename"        TEXT               NOT NULL,
    "file_size_bytes" INTEGER            NOT NULL,
    "upload_id"       TEXT               NOT NULL,
    "status"          "ScanImportStatus" NOT NULL DEFAULT 'queued',
    "scan_id"         TEXT,
    "error_code"      TEXT,
    "error_message"   TEXT,
    "attempts"        INTEGER            NOT NULL DEFAULT 0,
    "created_at"      TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3)       NOT NULL,
    "started_at"      TIMESTAMP(3),
    "completed_at"    TIMESTAMP(3),
    CONSTRAINT "scan_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "scan_import_jobs_scan_id_key" ON "scan_import_jobs"("scan_id");
CREATE INDEX "scan_import_jobs_user_id_idx" ON "scan_import_jobs"("user_id");
CREATE INDEX "scan_import_jobs_status_updated_at_idx" ON "scan_import_jobs"("status", "updated_at");

ALTER TABLE "scan_import_jobs"
    ADD CONSTRAINT "scan_import_jobs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scan_import_jobs"
    ADD CONSTRAINT "scan_import_jobs_scan_id_fkey"
    FOREIGN KEY ("scan_id") REFERENCES "scans"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Large-file transport with no Blob storage dependency: the client splits a
-- scan into sub-4.5MB pieces (Vercel's hard Function request-body cap) and
-- uploads each here; the finalize call reassembles them by chunk_index.
CREATE TABLE "scan_upload_chunks" (
    "id"          TEXT         NOT NULL,
    "upload_id"   TEXT         NOT NULL,
    "user_id"     TEXT         NOT NULL,
    "chunk_index" INTEGER      NOT NULL,
    "data"        BYTEA        NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scan_upload_chunks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "scan_upload_chunks_upload_id_chunk_index_key" ON "scan_upload_chunks"("upload_id", "chunk_index");
CREATE INDEX "scan_upload_chunks_upload_id_idx" ON "scan_upload_chunks"("upload_id");

ALTER TABLE "scan_upload_chunks"
    ADD CONSTRAINT "scan_upload_chunks_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
