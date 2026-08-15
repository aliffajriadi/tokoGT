'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/admin.controller');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../public/uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Login (tidak perlu auth)
router.get('/login', ctrl.loginPage);
router.post('/login', express.urlencoded({ extended: false }), ctrl.loginPost);
router.post('/logout', ctrl.logout);

// Semua route di bawah butuh auth
router.use(ctrl.requireAdmin);

router.get('/', ctrl.dashboard);
router.get('/pesanan', ctrl.pesanan);

router.get('/produk', ctrl.produk);
router.post('/produk', express.urlencoded({ extended: false }), ctrl.tambahProduk);
router.post('/produk/:id/toggle', ctrl.toggleProdukStatus);
router.post('/produk/:id/feature', ctrl.toggleFeaturedProduct);
router.post('/produk/:id/icon', express.urlencoded({ extended: false }), ctrl.updateProdukIcon);
router.post('/produk/upload', upload.single('image'), ctrl.uploadImage);

router.get('/stok', ctrl.stok);
router.post('/stok/:productId/restock', express.urlencoded({ extended: false }), ctrl.restockProduk);
router.get('/stok/detail/:productId', ctrl.stokDetail);
router.post('/stok/detail/:productId/edit/:stockId', express.urlencoded({ extended: false }), ctrl.editStokPayload);
router.post('/stok/detail/:productId/delete/:stockId', ctrl.deleteStok);

router.get('/pengaturan', ctrl.pengaturan);
router.post('/pengaturan', express.urlencoded({ extended: false }), ctrl.savePengaturan);
router.post('/pengaturan/password', express.urlencoded({ extended: false }), ctrl.changePassword);

module.exports = router;
