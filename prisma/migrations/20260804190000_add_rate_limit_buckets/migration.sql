-- Per-user fixed-window request counters, guarding the AI routes
-- (chat/summarize/remediate) against unbounded OpenAI/NVD/EPSS/KEV spend.
-- See lib/rate-limit/rate-limiter.ts.
CREATE TABLE "rate_limit_buckets" (
    "id"           TEXT         NOT NULL,
    "user_id"      TEXT         NOT NULL,
    "key"          TEXT         NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "count"        INTEGER      NOT NULL DEFAULT 1,
    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rate_limit_buckets_user_id_key_window_start_key" ON "rate_limit_buckets"("user_id", "key", "window_start");
CREATE INDEX "rate_limit_buckets_window_start_idx" ON "rate_limit_buckets"("window_start");

ALTER TABLE "rate_limit_buckets"
    ADD CONSTRAINT "rate_limit_buckets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
