-- Ensure chain_wax tables have DEFAULT CURRENT_TIMESTAMP on created_at
-- This migration guards against schema drift where defaults may be missing in production

ALTER TABLE "chain_wax_period" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "chain_wax_activity" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "chain_wax_puck" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
