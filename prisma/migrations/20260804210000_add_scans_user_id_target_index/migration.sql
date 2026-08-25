-- Supports listScansForTarget (lib/scans/store.ts), which powers the
-- risk-over-time trend: all of a user's scans sharing a target, oldest first.
CREATE INDEX "scans_user_id_target_idx" ON "scans"("user_id", "target");
