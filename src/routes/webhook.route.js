'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/webhook.controller');

// WAJIB: express.raw() untuk baca raw body — jangan pakai express.json() di sini
// Signature dihitung dari raw body, bukan dari JSON.stringify(req.body)
router.post('/payment', express.raw({ type: 'application/json' }), ctrl.handlePaymentWebhook);

module.exports = router;
