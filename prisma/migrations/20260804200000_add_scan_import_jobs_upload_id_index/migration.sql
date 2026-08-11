-- Supports the retention sweep's NOT EXISTS lookup in lib/scans/retention.ts
-- (find scan_upload_chunks with no still-active scan_import_jobs row).
CREATE INDEX "scan_import_jobs_upload_id_idx" ON "scan_import_jobs"("upload_id");
