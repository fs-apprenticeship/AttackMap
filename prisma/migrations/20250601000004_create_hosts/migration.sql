CREATE TABLE "hosts" (
    "id"               TEXT    NOT NULL,
    "scan_id"          TEXT    NOT NULL,
    "ip_address"       TEXT    NOT NULL,
    "hostname"         TEXT,
    "operating_system" TEXT    NOT NULL,
    "role"             TEXT    NOT NULL,
    "internet_exposed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "hosts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hosts_scan_id_idx" ON "hosts"("scan_id");

ALTER TABLE "hosts"
    ADD CONSTRAINT "hosts_scan_id_fkey"
    FOREIGN KEY ("scan_id") REFERENCES "scans"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
