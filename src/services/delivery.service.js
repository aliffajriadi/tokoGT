'use strict';

const { PrismaClient } = require('@prisma/client');
const logger = require('../lib/logger');

const prisma = new PrismaClient();

/**
 * Assign stok ke tiap OrderItem dan ubah Order.status = DELIVERED.
 * Menggunakan Prisma transaction agar atomik — kalau stok kurang, seluruh operasi rollback.
 */
async function deliverOrder(order) {
  const itemsWithQty = order.items.map((item) => ({
    orderItemId: item.id,
    productId: item.productId,
    qty: item.qty,
  }));

  await prisma.$transaction(async (tx) => {
    for (const { orderItemId, productId, qty } of itemsWithQty) {
      // Ambil stok yang belum dipakai secukupnya — 1 query per product type
      const stocks = await tx.stock.findMany({
        where: { productId, isUsed: false },
        select: { id: true },
        take: qty,
        orderBy: { createdAt: 'asc' }, // FIFO
      });

      if (stocks.length < qty) {
        throw new Error(
          `Stok tidak cukup untuk productId ${productId}. Butuh ${qty}, tersedia ${stocks.length}.`
        );
      }

      const stockIds = stocks.map((s) => s.id);

      // Mark stok sebagai terpakai
      await tx.stock.updateMany({
        where: { id: { in: stockIds } },
        data: { isUsed: true, usedInOrderItemId: orderItemId },
      });

      // Simpan referensi stok pertama di OrderItem (untuk tracking)
      await tx.orderItem.update({
        where: { id: orderItemId },
        data: { stockId: stockIds[0] },
      });
    }

    // Update order status ke DELIVERED
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'DELIVERED' },
    });
  });

  logger.info(`[delivery.service] Order ${order.invoiceCode} berhasil dikirim (DELIVERED).`);
}

/**
 * Ambil payload stok yang sudah dikirim untuk order tertentu.
 * Dipanggil saat buyer lacak pesanan yang sudah DELIVERED.
 */
async function getDeliveredPayloads(orderId) {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    select: {
      id: true,
      qty: true,
      priceEach: true,
      product: { select: { name: true, icon: true } },
    },
  });

  // Ambil semua stock payloads yang terhubung ke orderItem ini
  const payloads = await prisma.stock.findMany({
    where: { usedInOrderItemId: { in: items.map((i) => i.id) } },
    select: { usedInOrderItemId: true, payload: true },
  });

  // Group payloads by orderItemId
  const payloadMap = {};
  for (const s of payloads) {
    if (!payloadMap[s.usedInOrderItemId]) payloadMap[s.usedInOrderItemId] = [];
    payloadMap[s.usedInOrderItemId].push(s.payload);
  }

  return items.map((item) => ({
    productName: item.product.name,
    icon: item.product.icon,
    qty: item.qty,
    priceEach: item.priceEach,
    payloads: payloadMap[item.id] || [],
  }));
}

module.exports = { deliverOrder, getDeliveredPayloads };
