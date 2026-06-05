CREATE TABLE "ai_summaries" (
    "id"          TEXT         NOT NULL,
    "scan_id"     TEXT         NOT NULL,
    "executive"   TEXT         NOT NULL,
    "risk_score"  INTEGER      NOT NULL,
    "risk_level"  "RiskLevel"  NOT NULL,
    "top_risks"   JSONB        NOT NULL,
    "remediation" JSONB,
    "source"      "AiSource"   NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_summaries_scan_id_key" ON "ai_summaries"("scan_id");

ALTER TABLE "ai_summaries"
    ADD CONSTRAINT "ai_summaries_scan_id_fkey"
    FOREIGN KEY ("scan_id") REFERENCES "scans"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
