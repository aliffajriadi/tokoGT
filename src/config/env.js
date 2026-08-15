'use strict';

require('dotenv').config();

const REQUIRED = [
  'DATABASE_URL',
  'PORT',
  'PAYMENT_BASE_URL',
  'PAYMENT_API_KEY',
  'PAYMENT_WEBHOOK_SECRET',
  'ADMIN_PASSWORD',
  'SESSION_SECRET',
];

const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  console.error(
    `[CidGrowtopia] FATAL: Environment variable(s) wajib belum diset:\n  ${missing.join(', ')}\n` +
      `Salin .env.example ke .env dan isi nilainya.`
  );
  process.exit(1);
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  payment: {
    baseUrl: process.env.PAYMENT_BASE_URL,
    apiKey: process.env.PAYMENT_API_KEY,
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET,
    webhookApiKey: process.env.WEBHOOK_API_KEY, // opsional untuk webhook param protection
  },
  admin: {
    password: process.env.ADMIN_PASSWORD,
  },
  sessionSecret: process.env.SESSION_SECRET,
  nodeEnv: process.env.NODE_ENV || 'development',
};
