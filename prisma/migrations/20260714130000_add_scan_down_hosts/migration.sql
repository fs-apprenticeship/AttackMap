-- Hosts nmap reported as down never became a Host row (nothing to scan a
-- role/OS/services out of), so Compare could not tell "scanned and found
-- down" apart from "not in this scan's target range at all". This column
-- stores the down hosts' IPs (and hostnames, when nmap has one) as JSON so
-- lib/scans/compare.ts can make that distinction.
ALTER TABLE "scans"
    ADD COLUMN "down_hosts" JSONB NOT NULL DEFAULT '[]';
