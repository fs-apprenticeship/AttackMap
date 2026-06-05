CREATE TABLE "services" (
    "id"           TEXT        NOT NULL,
    "host_id"      TEXT        NOT NULL,
    "port"         INTEGER     NOT NULL,
    "protocol"     "Protocol"  NOT NULL,
    "service_name" TEXT        NOT NULL,
    "product"      TEXT,
    "version"      TEXT,
    "extrainfo"    TEXT,
    "risk_level"   "RiskLevel" NOT NULL,
    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "services_host_id_idx" ON "services"("host_id");

ALTER TABLE "services"
    ADD CONSTRAINT "services_host_id_fkey"
    FOREIGN KEY ("host_id") REFERENCES "hosts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
