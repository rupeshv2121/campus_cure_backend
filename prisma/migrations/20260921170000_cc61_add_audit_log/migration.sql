-- CC-61: an immutable trail of privileged actions.
CREATE TYPE "AuditActor" AS ENUM ('USER', 'SYSTEM');

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" "AuditActor" NOT NULL DEFAULT 'USER',
    -- No foreign key, deliberately. A cascade from User would let anyone erase
    -- their own history by deleting their account.
    "actorId" TEXT,
    -- Snapshot of who the actor was at the time, not a lookup.
    "actorRole" TEXT,
    "actorLabel" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- APPEND-ONLY, ENFORCED BY THE DATABASE.
--
-- The application has no code path that updates or deletes an audit row, but
-- convention is not a control. This stops the application, an ORM mistake, and
-- a hand-written UPDATE in a console.
--
-- It does NOT stop a database superuser, who can drop this trigger. Real
-- immutability needs append-only storage the application cannot reach. This is
-- tamper-resistant, not tamper-proof, and the spec says so.
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
