'use strict';

const crypto = require('crypto');
const env = require('../config/env');

/**
 * Buat QRIS / invoice di payment provider (Pakasir-compatible).
 * Persis sesuai spec PRD §6.
 */
async function generateQris(order) {
  const res = await fetch(`${env.payment.baseUrl}/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.payment.apiKey,
    },
    body: JSON.stringify({
      externalId: order.invoiceCode,
      amount: order.totalPrice,
      description: `CidGrowtopia – ${order.invoiceCode}`,
      productName: `Order ${order.invoiceCode}`,
      customerName: order.contact,
      customerContact: order.contact,
    }),
  });

  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Gagal membuat invoice');

  // json.data diharapkan berisi { qrCode, paymentNumber, providerRef, ... }
  return json.data;
}

/**
 * Verifikasi HMAC-SHA256 signature dari webhook provider.
 * HARUS dipanggil dengan rawBody (Buffer/string), bukan req.body setelah JSON.parse.
 * Sesuai PRD §6.
 */
function verifyWebhookSignature(rawBody, headers) {
  const signature = headers['x-webhook-signature'];
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', env.payment.webhookSecret)
    .update(rawBody) // raw body string, bukan stringify ulang
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}

module.exports = { generateQris, verifyWebhookSignature };
