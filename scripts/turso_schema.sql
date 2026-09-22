-- CreateTable
CREATE TABLE "rr_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "rr_products" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "soldQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "rr_sales" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "saleId" TEXT NOT NULL,
    "salesman" TEXT NOT NULL,
    "total" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL,
    "amountReceived" REAL,
    "changeReturned" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "rr_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "rr_sale_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "saleId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "rr_sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "rr_sales" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "rr_sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "rr_products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rr_orders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL DEFAULT '',
    "itemsJson" TEXT NOT NULL,
    "total" REAL NOT NULL,
    "advance" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dueAt" DATETIME,
    "note" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "rr_users_username_key" ON "rr_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "rr_products_productId_key" ON "rr_products"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "rr_sales_saleId_key" ON "rr_sales"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "rr_settings_key_key" ON "rr_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "rr_orders_orderId_key" ON "rr_orders"("orderId");

