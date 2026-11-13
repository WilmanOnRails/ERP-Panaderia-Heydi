-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "erp_products" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bread_type" TEXT NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_raw_materials" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "available_units" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_raw_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_recipes" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bom_units" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_routes" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "operations" TEXT NOT NULL DEFAULT '',
    "duration_minutes" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_warehouses" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "warehouse_type" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_suppliers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL DEFAULT '',
    "identity_number" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_customers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_inventory_movements" (
    "id" SERIAL NOT NULL,
    "movement_type" TEXT NOT NULL,
    "product_id" INTEGER,
    "raw_material_id" INTEGER,
    "quantity" DECIMAL(12,3) NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_production_orders" (
    "id" SERIAL NOT NULL,
    "order_number" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "planned_units" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pendiente',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_users" (
    "id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'usuario',
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "erp_products_code_key" ON "erp_products"("code");

-- CreateIndex
CREATE UNIQUE INDEX "erp_raw_materials_code_key" ON "erp_raw_materials"("code");

-- CreateIndex
CREATE UNIQUE INDEX "erp_recipes_code_key" ON "erp_recipes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "erp_routes_code_key" ON "erp_routes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "erp_warehouses_code_key" ON "erp_warehouses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "erp_customers_code_key" ON "erp_customers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "erp_production_orders_order_number_key" ON "erp_production_orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "erp_users_username_key" ON "erp_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "erp_users_code_key" ON "erp_users"("code");

-- CreateIndex
CREATE UNIQUE INDEX "erp_users_email_key" ON "erp_users"("email");
