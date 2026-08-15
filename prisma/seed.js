'use strict';

/**
 * prisma/seed.js — isi data sample untuk development.
 * Jalankan: node prisma/seed.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Hapus data lama kalau ada
  await prisma.stock.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();

  // Buat produk sample
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'SOCKS5 Proxy Private',
        category: 'Proxy',
        price: 25000,
        description: 'Proxy SOCKS5 private eksklusif untuk akses GT. Cepat dan stabil.',
        icon: 'plug',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Legacy Account RCE',
        category: 'Akun',
        price: 45000,
        description: 'Akun GT lama dengan fitur RCE. Siap pakai, login langsung.',
        icon: 'user',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Diamond Lock x1',
        category: 'Currency',
        price: 15000,
        description: '1 Diamond Lock (DL) asli, dikirim via trade di dalam game.',
        icon: 'gem',
      },
    }),
    prisma.product.create({
      data: {
        name: 'World Lock Bundle',
        category: 'Item Langka',
        price: 120000,
        description: 'Bundle World Lock × 5 + bonus item acak. Limited stock!',
        icon: 'globe',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Diamond Lock x10',
        category: 'Currency',
        price: 140000,
        description: '10 Diamond Lock hemat, cocok untuk trader aktif.',
        icon: 'gem',
      },
    }),
  ]);

  // Isi stok sample
  await prisma.stock.createMany({
    data: [
      ...Array.from({ length: 5 }, (_, i) => ({
        productId: products[0].id,
        payload: `socks5://user${i+1}:pass${i+1}@proxy.example.com:1080`,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        productId: products[1].id,
        payload: `gt_legacy_acc_${i+1}:password${i+1}`,
      })),
      ...Array.from({ length: 20 }, (_, i) => ({
        productId: products[2].id,
        payload: `DL_TRADE_CODE_${Math.random().toString(36).slice(2,10).toUpperCase()}`,
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        productId: products[3].id,
        payload: `WL_BUNDLE_CODE_${Math.random().toString(36).slice(2,10).toUpperCase()}`,
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        productId: products[4].id,
        payload: `DL10_CODE_${Math.random().toString(36).slice(2,10).toUpperCase()}`,
      })),
    ],
  });

  console.log(`✅ Seeded ${products.length} produk dengan sample stok.`);
  console.log('📦 Jalankan `pnpm prisma studio` untuk lihat data.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
