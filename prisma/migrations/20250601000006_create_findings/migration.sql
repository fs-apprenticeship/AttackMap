CREATE TABLE "findings" (
    "id"          TEXT        NOT NULL,
    "scan_id"     TEXT        NOT NULL,
    "host_id"     TEXT,
    "severity"    "RiskLevel" NOT NULL,
    "title"       TEXT        NOT NULL,
    "evidence"    TEXT        NOT NULL,
    "remediation" TEXT        NOT NULL,
    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "findings_scan_id_idx"  ON "findings"("scan_id");
CREATE INDEX "findings_severity_idx" ON "findings"("severity");

ALTER TABLE "findings"
    ADD CONSTRAINT "findings_scan_id_fkey"
    FOREIGN KEY ("scan_id") REFERENCES "scans"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "findings"
    ADD CONSTRAINT "findings_host_id_fkey"
    FOREIGN KEY ("host_id") REFERENCES "hosts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
