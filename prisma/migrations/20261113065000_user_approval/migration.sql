ALTER TABLE "erp_users"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'approved';

ALTER TABLE "erp_users"
ADD CONSTRAINT "erp_users_status_check"
CHECK ("status" IN ('pending', 'approved', 'rejected'));
