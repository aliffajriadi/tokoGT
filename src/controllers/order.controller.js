'use strict';

const productService = require('../services/product.service');
const orderService = require('../services/order.service');
const paymentService = require('../services/payment.service');
const settingService = require('../services/setting.service');
const { validateCheckout } = require('../lib/validate');
const logger = require('../lib/logger');

const ipCheckoutLimit = new Map();

/**
 * POST /checkout
 * Body: { items: [{ productId, qty }], contact }
 */
async function createOrder(req, res) {
  // Rate limit checkout: maks 3 per menit per IP
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  const windowMs = 60 * 1000;
  
  if (!ipCheckoutLimit.has(ip)) {
    ipCheckoutLimit.set(ip, []);
  }
  
  const requests = ipCheckoutLimit.get(ip).filter(timestamp => now - timestamp < windowMs);
  requests.push(now);
  ipCheckoutLimit.set(ip, requests);
  
  if (requests.length > 3) {
    return res.status(429).json({ success: false, errors: ['Terlalu banyak pesanan dibuat. Silakan tunggu 1 menit.'] });
  }

  const { valid, errors } = validateCheckout(req.body);
  if (!valid) {
    return res.status(400).json({ success: false, errors });
  }

  const { items, contact } = req.body;
  const finalContact = (contact && typeof contact === 'string' && contact.trim()) ? contact.trim() : 'Pembeli';

  try {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Check existing pending order for the same IP and product ID
    for (const item of items) {
      const existingPending = await orderService.getPendingOrderByIpAndProduct(clientIp, item.productId);
      if (existingPending) {
        return res.status(409).json({
          success: false,
          errors: ['Anda masih memiliki pesanan pending untuk produk ini. Harap selesaikan pembayaran.'],
          existingInvoice: existingPending.invoiceCode
        });
      }
    }

    // 1. Resolve harga tiap produk dari DB (jangan percaya harga dari client)
    const productIds = items.map((i) => i.productId);
    const products = await productService.listActiveProducts();
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    const resolvedItems = [];
    let totalPrice = 0;
    const stockErrors = [];

    for (const item of items) {
      const product = productMap[item.productId];
      if (!product) {
        stockErrors.push(`Produk ID ${item.productId} tidak ditemukan atau tidak aktif.`);
        continue;
      }
      if (product.stockCount < item.qty) {
        stockErrors.push(
          `Stok ${product.name} tidak cukup. Diminta: ${item.qty}, tersedia: ${product.stockCount}.`
        );
        continue;
      }
      resolvedItems.push({ productId: product.id, qty: item.qty, priceEach: product.price });
      totalPrice += product.price * item.qty;
    }

    if (stockErrors.length > 0) {
      return res.status(409).json({ success: false, errors: stockErrors });
    }

    // 2. Buat order di DB
    const order = await orderService.createOrder({ contact: finalContact, items: resolvedItems, totalPrice, ipAddress: clientIp });

    // 3. Generate QRIS dari payment provider
    let qrisData = null;
    try {
      qrisData = await paymentService.generateQris(order);
      await orderService.saveQrisToOrder(
        order.id, 
        qrisData.qrCode || qrisData.payment_number, 
        qrisData.invoiceCode || null,
        qrisData.platformFee || 0,
        qrisData.totalAmount || totalPrice
      );
    } catch (payErr) {
      logger.error('[order.controller] Gagal generate QRIS:', payErr.message);
      // Order tetap dibuat, buyer bisa retry atau hubungi admin
    }

    logger.info(`[order.controller] Order baru: ${order.invoiceCode}, total: ${totalPrice}`);

    return res.json({
      success: true,
      data: {
        invoiceCode: order.invoiceCode,
        totalPrice,
        expiresAt: order.expiresAt,
        qrisPayload: qrisData?.qrCode || qrisData?.payment_number || null,
        items: resolvedItems,
      },
    });
  } catch (err) {
    logger.error('[order.controller] createOrder error:', err);
    return res.status(500).json({ success: false, errors: ['Terjadi kesalahan server. Coba lagi.'] });
  }
}

/**
 * GET /order/:invoiceCode/status
 * Polling endpoint — kembalikan status saja (JSON ringan).
 */
async function getOrderStatus(req, res) {
  try {
    const disableInvoice = await settingService.getSetting('disable_invoice');
    if (disableInvoice === 'true') {
      return res.status(403).json({ success: false, message: 'Fitur cek invoice dinonaktifkan oleh administrator.' });
    }

    const { invoiceCode } = req.params;
    const order = await orderService.getOrderByInvoiceCode(invoiceCode.toUpperCase());
    if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan.' });

    if (order.isDisabled) {
      return res.status(403).json({ success: false, message: 'Invoice ini telah dinonaktifkan oleh administrator.' });
    }

    return res.json({
      success: true,
      data: {
        invoiceCode: order.invoiceCode,
        status: order.status,
        paidAt: order.paidAt,
        expiresAt: order.expiresAt,
      },
    });
  } catch (err) {
    logger.error('[order.controller] getOrderStatus error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { createOrder, getOrderStatus };
