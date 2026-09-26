-- Buyurtmalarga foydalanuvchi ko‘radigan qisqa raqam (1, 2, 3...)
ALTER TABLE "orders" ADD COLUMN "order_number" SERIAL NOT NULL;
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");
