'use strict';

/**
 * Validasi body POST /checkout
 * Return { valid: true } atau { valid: false, errors: string[] }
 */
function validateCheckout(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body tidak valid.'] };
  }

  const { items, contact } = body;

  // contact: opsional, string, max 100 char
  if (contact !== undefined && contact !== null && contact !== '') {
    if (typeof contact !== 'string') {
      errors.push('Kontak harus berupa text.');
    } else if (contact.trim().length > 100) {
      errors.push('Kontak terlalu panjang (maks 100 karakter).');
    }
  }

  // items: harus array, minimal 1 item
  if (!Array.isArray(items) || items.length === 0) {
    errors.push('Minimal 1 item harus dipilih.');
  } else {
    items.forEach((item, idx) => {
      const label = `Item [${idx + 1}]`;
      if (!item.productId || typeof item.productId !== 'number' || item.productId < 1) {
        errors.push(`${label}: productId tidak valid.`);
      }
      if (!item.qty || typeof item.qty !== 'number' || !Number.isInteger(item.qty) || item.qty < 1) {
        errors.push(`${label}: qty harus integer >= 1.`);
      }
      if (item.qty > 100) {
        errors.push(`${label}: qty terlalu besar (maks 100).`);
      }
    });
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Validasi input tracking order (GET /lacak?invoice=)
 */
function validateInvoiceCode(code) {
  if (!code || typeof code !== 'string') return false;
  return /^INV-[0-9A-F]{8}$/.test(code.trim().toUpperCase());
}

module.exports = { validateCheckout, validateInvoiceCode };
