'use strict';

// Baca & validasi env pertama kali sebelum apapun
const env = require('./config/env');

const express = require('express');
const path = require('path');
const session = require('express-session');
const logger = require('./lib/logger');
const { expireStaleOrders } = require('./services/order.service');

const app = express();

// ─── View Engine ──────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'public', 'favicon.svg')));

// ─── Session ──────────────────────────────────────────────────────────────────
app.use(session({
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000, // 8 jam
    secure: env.nodeEnv === 'production',
  },
}));

// ─── Request Logger (terpusat, 1 middleware) ──────────────────────────────────
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// ─── Body Parsers (GLOBAL) ────────────────────────────────────────────────────
// express.json() dan urlencoded untuk semua route KECUALI /webhook
// Webhook butuh raw body untuk verifikasi signature — middleware-nya di webhook.route.js
app.use((req, res, next) => {
  if (req.path.startsWith('/webhook')) return next(); // skip — handled per-route
  express.json()(req, res, next);
});
app.use((req, res, next) => {
  if (req.path.startsWith('/webhook')) return next();
  express.urlencoded({ extended: false })(req, res, next);
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/', require('./routes/pages.route'));
app.use('/', require('./routes/order.route'));
app.use('/webhook', require('./routes/webhook.route'));
app.use('/admin', require('./routes/admin.route'));

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).render('pages/404', { title: '404 – Halaman Tidak Ditemukan' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error:', err);
  res.status(500).render('pages/error', {
    title: 'Error – CidGrowtopia',
    message: env.nodeEnv === 'development' ? err.message : 'Terjadi kesalahan server.',
  });
});

// ─── Expire Stale Orders (simple setInterval, no cron lib needed) ─────────────
const EXPIRE_INTERVAL_MS = 60 * 1000; // cek tiap 1 menit
setInterval(() => {
  expireStaleOrders().catch((err) =>
    logger.error('[app] expireStaleOrders error:', err)
  );
}, EXPIRE_INTERVAL_MS);

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(env.port, () => {
  logger.info(`CidGrowtopia server running at http://localhost:${env.port}`);
});

module.exports = app; // for testing
