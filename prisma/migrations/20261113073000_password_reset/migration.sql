CREATE TABLE "erp_password_reset_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_password_reset_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "erp_password_reset_tokens_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "erp_users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "erp_password_reset_tokens_token_hash_key"
ON "erp_password_reset_tokens"("token_hash");

CREATE UNIQUE INDEX "erp_password_reset_tokens_user_id_key"
ON "erp_password_reset_tokens"("user_id");
