'use strict';

const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const productService = require('../services/product.service');
const orderService = require('../services/order.service');
const settingService = require('../services/setting.service');
const env = require('../config/env');
const logger = require('../lib/logger');

const prisma = new PrismaClient();

// ─── Auth Middleware ─────────────────────────────────────────────────────────

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
}

// ─── Login ───────────────────────────────────────────────────────────────────

function loginPage(req, res) {
  if (req.session?.isAdmin) return res.redirect('/admin');
  res.render('admin/login', { title: 'Login Admin – CidGrowtopia', error: null });
}

async function loginPost(req, res) {
  try {
    const { password } = req.body;
    if (!password) {
      return res.render('admin/login', { title: 'Login Admin – CidGrowtopia', error: 'Password wajib diisi.' });
    }

    const savedHash = await settingService.getSetting('admin_password_hash');
    let isValid = false;

    if (savedHash) {
      const inputHash = crypto.createHash('sha256').update(password).digest('hex');
      isValid = inputHash === savedHash;
    } else {
      isValid = password === env.admin.password;
    }

    if (isValid) {
      req.session.isAdmin = true;
      return res.redirect('/admin');
    }
    res.render('admin/login', { title: 'Login Admin – CidGrowtopia', error: 'Password salah.' });
  } catch (err) {
    res.render('admin/login', { title: 'Login Admin – CidGrowtopia', error: 'Server error.' });
  }
}

function logout(req, res) {
  req.session.destroy();
  res.redirect('/admin/login');
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

async function dashboard(req, res, next) {
  try {
    const stats = await orderService.getDashboardStats();
    const recentOrders = (await orderService.listOrdersAdmin({ limit: 10 })).orders;
    res.render('admin/dashboard', {
      title: 'Dashboard – Admin CidGrowtopia',
      stats,
      recentOrders,
      activePage: 'dashboard',
    });
  } catch (err) {
    next(err);
  }
}

// ─── Pesanan ─────────────────────────────────────────────────────────────────

async function pesanan(req, res, next) {
  try {
    const { status, page = 1 } = req.query;
    const { orders, total } = await orderService.listOrdersAdmin({
      status: status || undefined,
      page: parseInt(page, 10),
      limit: 25,
    });
    res.render('admin/pesanan', {
      title: 'Pesanan – Admin CidGrowtopia',
      orders,
      total,
      currentPage: parseInt(page, 10),
      currentStatus: status || '',
      activePage: 'pesanan',
    });
  } catch (err) {
    next(err);
  }
}

// ─── Produk ──────────────────────────────────────────────────────────────────

async function produk(req, res, next) {
  try {
    const products = await productService.listAllProductsAdmin();
    res.render('admin/produk', {
      title: 'Produk – Admin CidGrowtopia',
      products,
      activePage: 'produk',
      success: req.query.success || null,
      error: req.query.error || null,
    });
  } catch (err) {
    next(err);
  }
}

async function tambahProduk(req, res, next) {
  try {
    const { name, category, price, description, icon } = req.body;
    if (!name || !category || !price) {
      return res.redirect('/admin/produk?error=data-tidak-lengkap');
    }
    await productService.createProduct({
      name: name.trim(),
      category: category.trim(),
      price: parseInt(price, 10),
      description: description?.trim() || null,
      icon: icon?.trim() || null,
    });
    logger.info(`[admin] Produk baru: ${name}`);
    res.redirect('/admin/produk?success=produk-ditambahkan');
  } catch (err) {
    next(err);
  }
}

async function editProduk(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, category, price, description, icon } = req.body;
    if (!name || !category || !price) {
      return res.redirect('/admin/produk?error=data-tidak-lengkap');
    }
    await productService.updateProduct(id, {
      name: name.trim(),
      category: category.trim(),
      price: parseInt(price, 10),
      description: description?.trim() || null,
      icon: icon?.trim() || null,
    });
    logger.info(`[admin] Edit produk ID ${id}: ${name}`);
    res.redirect('/admin/produk?success=produk-diupdate');
  } catch (err) {
    next(err);
  }
}

async function deleteProduk(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    await productService.deleteProduct(id);
    logger.info(`[admin] Hapus produk ID ${id}`);
    res.redirect('/admin/produk?success=produk-dihapus');
  } catch (err) {
    if (err.code === 'P2003') {
      return res.redirect('/admin/produk?error=riwayat-order-ada');
    }
    next(err);
  }
}

async function toggleProdukStatus(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const product = await prisma.product.findUnique({ where: { id }, select: { isActive: true } });
    if (!product) return res.status(404).json({ success: false });
    await productService.updateProduct(id, { isActive: !product.isActive });
    res.json({ success: true, isActive: !product.isActive });
  } catch (err) {
    next(err);
  }
}

async function toggleFeaturedProduct(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const product = await prisma.product.findUnique({ where: { id }, select: { isFeatured: true } });
    if (!product) return res.status(404).json({ success: false });
    
    // Check limit of featured products if setting to true
    if (!product.isFeatured) {
       const featuredCount = await prisma.product.count({ where: { isFeatured: true } });
       if (featuredCount >= 2) {
          return res.status(400).json({ success: false, message: 'Maksimal 2 produk yang bisa di-feature.' });
       }
    }

    await productService.toggleFeaturedProduct(id, !product.isFeatured);
    res.json({ success: true, isFeatured: !product.isFeatured });
  } catch (err) {
    next(err);
  }
}

async function updateProdukIcon(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { icon } = req.body;
    if (!icon) return res.status(400).json({ success: false, message: 'Icon tidak boleh kosong.' });
    await productService.updateProduct(id, { icon: icon.trim() });
    res.json({ success: true, icon: icon.trim() });
  } catch (err) {
    next(err);
  }
}

// ─── Stok ────────────────────────────────────────────────────────────────────

async function stok(req, res, next) {
  try {
    const stockSummary = await productService.getStockSummaryAdmin();
    res.render('admin/stok', {
      title: 'Stok – Admin CidGrowtopia',
      stockSummary,
      activePage: 'stok',
      success: req.query.success || null,
    });
  } catch (err) {
    next(err);
  }
}

async function restockProduk(req, res, next) {
  try {
    const productId = parseInt(req.params.productId, 10);
    const { payloads } = req.body; // string, satu baris = satu item stok

    if (!payloads || !payloads.trim()) {
      return res.redirect('/admin/stok?error=payload-kosong');
    }

    const lines = payloads
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return res.redirect('/admin/stok?error=payload-kosong');
    }

    await productService.addStock(productId, lines);
    logger.info(`[admin] Restock productId ${productId}: +${lines.length} item`);
    res.redirect(`/admin/stok?success=${lines.length}-stok-ditambahkan`);
  } catch (err) {
    next(err);
  }
}

async function stokDetail(req, res, next) {
  try {
    const productId = parseInt(req.params.productId, 10);
    const product = await productService.getProductByIdAdmin(productId);
    if (!product) return res.status(404).send('Produk tidak ditemukan');

    const stocks = await productService.getProductStocks(productId);

    res.render('admin/stok-detail', {
      title: `Detail Stok: ${product.name} – Admin CidGrowtopia`,
      product,
      stocks,
      activePage: 'stok',
      success: req.query.success || null,
      error: req.query.error || null,
    });
  } catch (err) {
    next(err);
  }
}

async function editStokPayload(req, res, next) {
  try {
    const productId = parseInt(req.params.productId, 10);
    const stockId = parseInt(req.params.stockId, 10);
    const { payload } = req.body;

    if (!payload || !payload.trim()) {
      return res.redirect(`/admin/stok/detail/${productId}?error=payload-kosong`);
    }

    await productService.updateStockPayload(stockId, payload.trim());
    logger.info(`[admin] Update stockId ${stockId} payload`);
    res.redirect(`/admin/stok/detail/${productId}?success=stok-berhasil-diupdate`);
  } catch (err) {
    next(err);
  }
}

async function deleteStok(req, res, next) {
  try {
    const productId = parseInt(req.params.productId, 10);
    const stockId = parseInt(req.params.stockId, 10);

    await productService.deleteStock(stockId);
    logger.info(`[admin] Delete stockId ${stockId}`);
    res.redirect(`/admin/stok/detail/${productId}?success=stok-berhasil-dihapus`);
  } catch (err) {
    next(err);
  }
}

// ─── Pengaturan ──────────────────────────────────────────────────────────────

async function pengaturan(req, res, next) {
  try {
    const discordWebhookUrl = await settingService.getSetting('discord_webhook_url');
    res.render('admin/pengaturan', {
      title: 'Pengaturan – Admin CidGrowtopia',
      activePage: 'pengaturan',
      success: req.query.success || null,
      error: req.query.error || null,
      discordWebhookUrl: discordWebhookUrl || '',
    });
  } catch (err) {
    next(err);
  }
}

async function savePengaturan(req, res, next) {
  try {
    const { discord_webhook_url } = req.body;
    await settingService.setSetting('discord_webhook_url', discord_webhook_url || '');
    logger.info('[admin] Pengaturan webhook Discord diupdate');
    res.redirect('/admin/pengaturan?success=pengaturan-disimpan');
  } catch (err) {
    next(err);
  }
}

async function uploadImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tidak ada file yang diunggah.' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, imageUrl });
  } catch (err) {
    logger.error('[admin.controller] uploadImage error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengunggah file.' });
  }
}

async function changePassword(req, res, next) {
  try {
    const { new_password, confirm_password } = req.body;
    if (!new_password || !confirm_password) {
      return res.redirect('/admin/pengaturan?error=password-tidak-boleh-kosong');
    }
    if (new_password !== confirm_password) {
      return res.redirect('/admin/pengaturan?error=password-tidak-cocok');
    }
    if (new_password.length < 5) {
      return res.redirect('/admin/pengaturan?error=password-terlalu-pendek');
    }

    const hash = crypto.createHash('sha256').update(new_password).digest('hex');
    await settingService.setSetting('admin_password_hash', hash);
    logger.info('[admin] Password admin berhasil diubah');
    res.redirect('/admin/pengaturan?success=password-berhasil-diubah');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  requireAdmin,
  loginPage,
  loginPost,
  logout,
  dashboard,
  pesanan,
  produk,
  tambahProduk,
  editProduk,
  deleteProduk,
  toggleProdukStatus,
  toggleFeaturedProduct,
  updateProdukIcon,
  stok,
  restockProduk,
  stokDetail,
  editStokPayload,
  deleteStok,
  pengaturan,
  savePengaturan,
  uploadImage,
  changePassword,
};
