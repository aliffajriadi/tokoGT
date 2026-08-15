'use strict';

const { PrismaClient } = require('@prisma/client');
const { generateInvoiceCode } = require('../lib/invoice-code');
const logger = require('../lib/logger');

const prisma = new PrismaClient();

const ORDER_EXPIRY_MINUTES = 10;

/**
 * Buat Order baru dari data checkout.
 * items = [{ productId, qty, priceEach }]
 * Tidak buat QRIS di sini — hanya buat record. QRIS dibuat di controller setelah ini.
 */
async function createOrder({ contact, items, totalPrice, ipAddress }) {
  const invoiceCode = generateInvoiceCode();
  const expiresAt = new Date(Date.now() + ORDER_EXPIRY_MINUTES * 60 * 1000);

  const order = await prisma.order.create({
    data: {
      invoiceCode,
      contact: contact.trim(),
      totalPrice,
      ipAddress,
      expiresAt,
      items: {
        create: items.map(({ productId, qty, priceEach }) => ({
          productId,
          qty,
          priceEach,
        })),
      },
    },
    include: {
      items: {
        include: { product: { select: { name: true } } },
      },
    },
  });

  return order;
}

/**
 * Ambil order lengkap berdasarkan invoiceCode.
 * Sertakan items + product name, tapi bukan stock payload.
 */
async function getOrderByInvoiceCode(invoiceCode) {
  return prisma.order.findUnique({
    where: { invoiceCode },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, icon: true } },
        },
      },
    },
  });
}

/**
 * Update status order beserta optional fields (paidAt, qrisPayload, providerRef).
 */
async function updateOrderStatus(id, status, extras = {}) {
  return prisma.order.update({
    where: { id },
    data: { status, ...extras },
  });
}

/**
 * Simpan qrisPayload + providerRef ke order setelah QRIS dibuat.
 */
async function saveQrisToOrder(id, qrisPayload, providerRef, platformFee, totalAmount) {
  return prisma.order.update({
    where: { id },
    data: { 
      qrisPayload, 
      providerRef,
      platformFee: platformFee ? parseInt(platformFee, 10) : null,
      totalAmount: totalAmount ? parseInt(totalAmount, 10) : null
    },
  });
}

/**
 * Expire semua order PENDING yang sudah lewat expiresAt.
 * Dipanggil oleh setInterval di app.js.
 */
async function expireStaleOrders() {
  const result = await prisma.order.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  });
  if (result.count > 0) {
    logger.info(`[order.service] Expired ${result.count} stale order(s).`);
  }
}

/**
 * List order untuk admin — dengan filter status opsional.
 */
async function listOrdersAdmin({ status, limit = 100, page = 1 } = {}) {
  const where = status ? { status } : {};
  const skip = (page - 1) * limit;

  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        invoiceCode: true,
        contact: true,
        totalPrice: true,
        status: true,
        createdAt: true,
        expiresAt: true,
        paidAt: true,
        items: {
          select: {
            qty: true,
            product: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page, limit };
}

/**
 * Stat dashboard admin: penjualan hari ini, pending, delivered, stok menipis.
 */
async function getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayRevenue, pendingCount, deliveredCount] = await prisma.$transaction([
    prisma.order.aggregate({
      where: { status: 'DELIVERED', paidAt: { gte: today } },
      _sum: { totalPrice: true },
    }),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.count({ where: { status: 'DELIVERED', paidAt: { gte: today } } }),
  ]);

  // Stok menipis: produk aktif dengan stok tersedia < 5
  const lowStockProducts = await prisma.$queryRaw`
    SELECT p.id, p.name, COUNT(s.id) as available
    FROM Product p
    LEFT JOIN Stock s ON s.productId = p.id AND s.isUsed = 0
    WHERE p.isActive = 1
    GROUP BY p.id
    HAVING available < 5
  `;

  return {
    todaySales: todayRevenue._sum.totalPrice || 0,
    pendingCount,
    deliveredCount,
    lowStockCount: lowStockProducts.length,
    lowStockProducts,
  };
}

async function getPendingOrderByIpAndProduct(ipAddress, productId) {
  return prisma.order.findFirst({
    where: {
      status: 'PENDING',
      ipAddress,
      items: {
        some: {
          productId
        }
      },
      expiresAt: { gt: new Date() }
    },
    select: {
      invoiceCode: true
    }
  });
}

module.exports = {
  createOrder,
  getOrderByInvoiceCode,
  updateOrderStatus,
  saveQrisToOrder,
  expireStaleOrders,
  listOrdersAdmin,
  getDashboardStats,
  getPendingOrderByIpAndProduct,
};
