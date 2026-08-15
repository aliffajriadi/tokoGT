'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/pages.controller');

router.get('/', ctrl.home);
router.get('/produk', ctrl.products);
router.get('/produk/:id', ctrl.productDetail);
router.get('/checkout', ctrl.checkout);
router.get('/lacak', ctrl.track);
router.get('/pesanan-saya', ctrl.pesananSaya);

module.exports = router;
