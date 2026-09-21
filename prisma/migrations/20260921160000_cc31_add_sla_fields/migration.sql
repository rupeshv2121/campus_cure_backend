-- CC-31: SLA deadlines and escalation cooldown.
--
-- Additive: two nullable columns and one index. Existing rows get NULL, which
-- reads as "no clock running" - so applying this alone escalates nothing.
-- src/scripts/backfillSlaDueAt.ts starts the clocks, and floors them 24 hours
-- out so a system that has never had SLAs does not declare its entire history
-- a failure on the first sweep.
ALTER TABLE "Complaint" ADD COLUMN "slaDueAt" TIMESTAMP(3);
ALTER TABLE "Complaint" ADD COLUMN "lastEscalationAt" TIMESTAMP(3);

-- Drives the nightly overdue query: status filter first, then the deadline.
CREATE INDEX "Complaint_status_slaDueAt_idx" ON "Complaint"("status", "slaDueAt");
