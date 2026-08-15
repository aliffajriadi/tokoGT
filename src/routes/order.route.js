'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/order.controller');

router.post('/checkout', ctrl.createOrder);
router.get('/order/:invoiceCode/status', ctrl.getOrderStatus);

module.exports = router;
