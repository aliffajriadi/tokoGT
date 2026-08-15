'use strict';

const crypto = require('crypto');

/**
 * Generate kode invoice unik format: INV-XXXXXXXX
 * Pakai crypto.randomBytes (bawaan Node), tidak perlu package uuid.
 */
function generateInvoiceCode() {
  return 'INV-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

module.exports = { generateInvoiceCode };
