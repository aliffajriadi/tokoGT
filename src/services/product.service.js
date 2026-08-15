'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * List semua produk aktif beserta jumlah stok tersedia (isUsed: false).
 */
async function listActiveProducts() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      category: true,
      price: true,
      description: true,
      icon: true,
      isFeatured: true,
      stocks: {
        where: { isUsed: false },
        select: { id: true },
      },
    },
    orderBy: [
      { isFeatured: 'desc' },
      { createdAt: 'desc' }
    ],
  });

  return products.map((p) => ({
    ...p,
    stockCount: p.stocks.length,
    stocks: undefined, // jangan expose payload ke listing publik
  }));
}

/**
 * Ambil satu produk (aktif) dengan detail stok tersedia.
 * Stok payload TIDAK dikirim ke view — hanya jumlahnya.
 */
async function getProductById(id) {
  const product = await prisma.product.findUnique({
    where: { id, isActive: true },
    select: {
      id: true,
      name: true,
      category: true,
      price: true,
      description: true,
      icon: true,
      stocks: {
        where: { isUsed: false },
        select: { id: true },
      },
    },
  });

  if (!product) return null;
  return { ...product, stockCount: product.stocks.length, stocks: undefined };
}

async function getProductByIdAdmin(id) {
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      category: true,
      price: true,
      description: true,
      icon: true,
    },
  });
  return product;
}

/**
 * List semua produk untuk admin (termasuk nonaktif), dengan stok counts.
 */
async function listAllProductsAdmin() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      category: true,
      price: true,
      description: true,
      icon: true,
      isActive: true,
      isFeatured: true,
      createdAt: true,
      _count: {
        select: {
          stocks: { where: { isUsed: false } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return products.map((p) => ({
    ...p,
    stockCount: p._count.stocks,
    _count: undefined,
  }));
}

/**
 * Tambah produk baru (admin).
 */
async function createProduct({ name, category, price, description, icon }) {
  return prisma.product.create({
    data: { name, category, price, description: description || null, icon: icon || null },
  });
}

/**
 * Update produk (admin).
 */
async function updateProduct(id, data) {
  return prisma.product.update({ where: { id }, data });
}

async function deleteProduct(id) {
  await prisma.stock.deleteMany({ where: { productId: id } });
  return prisma.product.delete({ where: { id } });
}

/**
 * Tambah stok ke produk (admin restock). payloads = array of string.
 */
async function addStock(productId, payloads) {
  return prisma.stock.createMany({
    data: payloads.map((payload) => ({ productId, payload })),
  });
}

/**
 * List stok per produk untuk admin (jumlah saja, bukan payload).
 */
async function getStockSummaryAdmin() {
  const results = await prisma.$queryRaw`
    SELECT
      p.id,
      p.name,
      p.category,
      p.price,
      p.isActive,
      SUM(CASE WHEN s.isUsed = 0 THEN 1 ELSE 0 END) AS available,
      COUNT(s.id) AS total
    FROM Product p
    LEFT JOIN Stock s ON s.productId = p.id
    GROUP BY p.id
    ORDER BY p.id
  `;
  return results;
}

/**
 * Toggle featured status produk
 */
async function toggleFeaturedProduct(id, isFeatured) {
  return prisma.product.update({
    where: { id },
    data: { isFeatured },
  });
}

async function getProductStocks(productId) {
  return prisma.stock.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
  });
}

async function updateStockPayload(id, payload) {
  return prisma.stock.update({
    where: { id },
    data: { payload },
  });
}

async function deleteStock(id) {
  return prisma.stock.delete({
    where: { id },
  });
}

module.exports = {
  listActiveProducts,
  getProductById,
  getProductByIdAdmin,
  listAllProductsAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
  addStock,
  getStockSummaryAdmin,
  toggleFeaturedProduct,
  getProductStocks,
  updateStockPayload,
  deleteStock,
};
