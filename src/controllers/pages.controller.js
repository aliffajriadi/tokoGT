'use strict';

const productService = require('../services/product.service');
const orderService = require('../services/order.service');
const deliveryService = require('../services/delivery.service');
const settingService = require('../services/setting.service');

async function home(req, res, next) {
  try {
    const products = await productService.listActiveProducts();
    const featuredProducts = products.filter(p => p.isFeatured).slice(0, 2);
    const regularProducts = products.filter(p => !p.isFeatured);
    // Group by category untuk hero section
    const categories = [...new Set(products.map((p) => p.category))];
    res.render('pages/home', { title: 'CidGrowtopia – Growtopia Digital Store', products: regularProducts, featuredProducts, categories });
  } catch (err) {
    next(err);
  }
}

async function products(req, res, next) {
  try {
    const allProducts = await productService.listActiveProducts();
    const { cat } = req.query;
    const categories = [...new Set(allProducts.map((p) => p.category))];
    const filtered = cat ? allProducts.filter((p) => p.category === cat) : allProducts;
    res.render('pages/products', {
      title: 'Produk – CidGrowtopia',
      products: filtered,
      categories,
      activeCategory: cat || null,
    });
  } catch (err) {
    next(err);
  }
}

async function productDetail(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(404).render('pages/404', { title: '404 – Tidak Ditemukan' });

    const product = await productService.getProductById(id);
    if (!product) return res.status(404).render('pages/404', { title: '404 – Tidak Ditemukan' });

    res.render('pages/product-detail', {
      title: `${product.name} – CidGrowtopia`,
      product,
    });
  } catch (err) {
    next(err);
  }
}

async function checkout(req, res, next) {
  try {
    const disableInvoice = await settingService.getSetting('disable_invoice');
    if (disableInvoice === 'true') {
      return res.status(403).render('pages/error', {
        title: 'Akses Ditolak – CidGrowtopia',
        message: 'Fitur invoice dan pengecekan pesanan dinonaktifkan oleh administrator.',
      });
    }

    // Halaman checkout dirender setelah POST /checkout sukses dan redirect dengan query params
    // atau bisa render langsung jika ada productId di query
    const { invoice } = req.query;
    if (!invoice) return res.redirect('/produk');

    const order = await orderService.getOrderByInvoiceCode(invoice);
    if (!order) return res.redirect('/produk');

    if (order.isDisabled) {
      return res.status(403).render('pages/error', {
        title: 'Akses Ditolak – CidGrowtopia',
        message: 'Invoice ini telah dinonaktifkan oleh administrator.',
      });
    }

    res.render('pages/checkout', {
      title: 'Pembayaran – CidGrowtopia',
      order,
    });
  } catch (err) {
    next(err);
  }
}

async function track(req, res, next) {
  try {
    const disableInvoice = await settingService.getSetting('disable_invoice');
    if (disableInvoice === 'true') {
      return res.status(403).render('pages/error', {
        title: 'Akses Ditolak – CidGrowtopia',
        message: 'Fitur invoice dan pengecekan pesanan dinonaktifkan oleh administrator.',
      });
    }

    const { invoice } = req.query;
    let order = null;
    let deliveredItems = null;

    if (invoice) {
      order = await orderService.getOrderByInvoiceCode(invoice.toUpperCase().trim());
      if (order && order.isDisabled) {
        return res.status(403).render('pages/error', {
          title: 'Akses Ditolak – CidGrowtopia',
          message: 'Invoice ini telah dinonaktifkan oleh administrator.',
        });
      }
      if (order && order.status === 'DELIVERED') {
        deliveredItems = await deliveryService.getDeliveredPayloads(order.id);
      }
    }

    res.render('pages/track', {
      title: 'Lacak Pesanan – CidGrowtopia',
      invoice: invoice || '',
      order,
      deliveredItems,
    });
  } catch (err) {
    next(err);
  }
}

function pesananSaya(req, res) {
  // Halaman ini murni client-side (localStorage). Server hanya render shell EJS.
  res.render('pages/pesanan-saya', { title: 'Pesanan Saya – CidGrowtopia' });
}

module.exports = { home, products, productDetail, checkout, track, pesananSaya };
