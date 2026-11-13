CREATE TABLE "erp_workspace" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_workspace_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "erp_workspace_singleton_check" CHECK ("id" = 1)
);
