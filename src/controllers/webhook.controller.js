'use strict';

const paymentService = require('../services/payment.service');
const orderService = require('../services/order.service');
const deliveryService = require('../services/delivery.service');
const settingService = require('../services/setting.service');
const logger = require('../lib/logger');
const env = require('../config/env');

/**
 * POST /webhook/payment
 * Route ini wajib pakai express.raw() — jangan express.json() biasa.
 * Signature diverifikasi dari raw body sebelum parse.
 */
async function handlePaymentWebhook(req, res) {
  // Log request info
  logger.info(`[webhook] Request webhook masuk. Query: ${JSON.stringify(req.query)}`);

  const webhookApiKey = env.payment.webhookApiKey || env.payment.webhookSecret;
  if (webhookApiKey && req.query.apikey !== webhookApiKey) {
    logger.warn(`[webhook] Akses ditolak: apikey tidak valid atau tidak ada (${req.query.apikey}).`);
    return res.status(403).json({ error: 'Forbidden' });
  }

  const rawBody = req.body; // Buffer dari express.raw()
  const rawString = rawBody.toString('utf-8');
  
  // Log raw body payload
  logger.info(`[webhook] Payload body webhook: ${rawString}`);

  // 1. Verifikasi signature (Lewati jika apikey valid digunakan)
  const isApiKeyValid = webhookApiKey && req.query.apikey === webhookApiKey;
  
  if (!isApiKeyValid) {
    const isValidSignature = paymentService.verifyWebhookSignature(rawString, req.headers);
    if (!isValidSignature) {
      logger.warn('[webhook] Signature tidak valid — request diabaikan.');
      return res.status(401).json({ error: 'Unauthorized: Invalid Signature' });
    }
  } else {
    logger.info('[webhook] Bypassing signature check karena API Key valid digunakan.');
  }

  let payload;
  try {
    payload = JSON.parse(rawString);
  } catch {
    logger.warn('[webhook] Body bukan JSON valid.');
    return res.sendStatus(400);
  }

  const { externalId, paymentStatus } = payload;
  if (!externalId || !paymentStatus) {
    logger.warn('[webhook] Payload tidak lengkap:', payload);
    return res.sendStatus(400);
  }

  // 2. Cari order berdasarkan externalId = invoiceCode
  const order = await orderService.getOrderByInvoiceCode(externalId);
  if (!order) {
    logger.warn(`[webhook] Order tidak ditemukan untuk externalId: ${externalId}`);
    return res.sendStatus(200); // Bukan 404 biar provider tidak retry terus
  }

  // 3. Map paymentStatus provider → internal status
  const STATUS_MAP = {
    PENDING: 'PENDING',
    WAITING_PAYMENT: 'PENDING',
    PAID: 'PAID',
    EXPIRED: 'EXPIRED',
    FAILED: 'FAILED',
    CANCELLED: 'FAILED',
    REFUNDED: 'REFUNDED',
  };

  const newStatus = STATUS_MAP[paymentStatus] || null;
  if (!newStatus) {
    logger.warn(`[webhook] paymentStatus tidak dikenal: ${paymentStatus}`);
    return res.sendStatus(200);
  }

  // 4. Proses sesuai status
  try {
    if (newStatus === 'PAID' && order.status === 'PENDING') {
      await orderService.updateOrderStatus(order.id, 'PAID', { paidAt: new Date() });

      // Reload order untuk dapat items
      const freshOrder = await orderService.getOrderByInvoiceCode(externalId);
      await deliveryService.deliverOrder(freshOrder);

      logger.info(`[webhook] Order ${externalId} PAID → DELIVERED.`);

      // Send Discord Webhook if configured
      try {
        const discordUrl = await settingService.getSetting('discord_webhook_url');
        if (discordUrl) {
          const productName = freshOrder.items.map(i => i.product.name).join(', ');
          const qty = freshOrder.items.reduce((sum, i) => sum + i.qty, 0);
          const total = `Rp ${(freshOrder.totalAmount || freshOrder.totalPrice).toLocaleString('id-ID')}`;

          const content = `<a:VERIF4:1175696761705214034> Buyer Logs <a:adrn_cart:1463943672352608407> \n\n<a:arrowren:1389190346797350994>Product : **${productName}**\n<a:arrowren:1389190346797350994>Qty : **${qty}**\n<a:arrowren:1389190346797350994>Total : **${total}**`;

          await fetch(discordUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              embeds: [{
                description: content,
                color: 65280 // Decimal for #00FF00 green
              }]
            })
          });
        }
      } catch (e) {
        logger.error(`[webhook] Gagal mengirim discord webhook untuk ${externalId}:`, e);
      }

    } else if (['EXPIRED', 'FAILED', 'REFUNDED'].includes(newStatus) && order.status === 'PENDING') {
      await orderService.updateOrderStatus(order.id, newStatus);
      logger.info(`[webhook] Order ${externalId} → ${newStatus}.`);
    } else {
      logger.info(`[webhook] Order ${externalId} status ${order.status} — no action for ${newStatus}.`);
    }
  } catch (err) {
    logger.error(`[webhook] Error saat proses order ${externalId}:`, err);
    // Tetap balas 200 agar provider tidak retry — log untuk manual review
  }

  return res.sendStatus(200);
}

module.exports = { handlePaymentWebhook };
