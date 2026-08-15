'use strict';

/**
 * checkout.js — dijalankan di halaman /checkout
 * Fungsi:
 * 1. Simpan order ke localStorage setelah sukses
 * 2. Countdown timer hingga expiresAt
 * 3. Polling status order tiap 4 detik
 */

const STORAGE_KEY = 'my_orders';

function getMyOrders() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveMyOrders(orders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

function addToMyOrders(order) {
  const orders = getMyOrders();
  // Hindari duplikat berdasarkan invoiceCode
  if (orders.find((o) => o.invoiceCode === order.invoiceCode)) return;
  orders.push(order);
  saveMyOrders(orders);
}

// ─── Countdown Timer ──────────────────────────────────────────────────────────
function startCountdown(expiresAt, el) {
  function tick() {
    const diff = new Date(expiresAt) - Date.now();
    if (diff <= 0) {
      el.textContent = '00:00';
      el.classList.add('urgent');
      return;
    }
    const m = String(Math.floor(diff / 60000)).padStart(2, '0');
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
    el.textContent = `${m}:${s}`;
    if (diff < 2 * 60 * 1000) el.classList.add('urgent');
    setTimeout(tick, 1000);
  }
  tick();
}

// ─── Status Polling ───────────────────────────────────────────────────────────
let pollInterval = null;

function startPolling(invoiceCode, statusEl, labelEl) {
  pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/order/${invoiceCode}/status`);
      const { success, data } = await res.json();
      if (!success) return;

      const statusMap = {
        PENDING: 'Menunggu Pembayaran',
        PAID: 'Pembayaran Diterima',
        DELIVERED: 'Produk Terkirim ✓',
        EXPIRED: 'Kadaluarsa',
        FAILED: 'Gagal',
        REFUNDED: 'Dikembalikan',
      };

      if (statusEl) {
        statusEl.className = `status-badge ${data.status}`;
        statusEl.textContent = statusMap[data.status] || data.status;
      }
      if (labelEl) labelEl.textContent = statusMap[data.status] || data.status;

      // Update localStorage
      const orders = getMyOrders();
      const existing = orders.find((o) => o.invoiceCode === invoiceCode);
      if (existing) {
        existing.status = data.status;
        saveMyOrders(orders);
      }

      if (['DELIVERED', 'EXPIRED', 'FAILED'].includes(data.status)) {
        clearInterval(pollInterval);
        if (data.status === 'DELIVERED') {
          const successModal = document.getElementById('paymentSuccessModal');
          if (successModal) {
            successModal.style.display = 'flex';
          }
          setTimeout(() => window.location.href = `/lacak?invoice=${invoiceCode}`, 3500);
        }
      }
    } catch { /* ignore network errors, tetap polling */ }
  }, 4000); // 4 detik sesuai PRD §7
}

// ─── Init (dipanggil dari EJS dengan data inline) ─────────────────────────────
function initCheckoutPage({ invoiceCode, totalPrice, expiresAt, productName, items }) {
  // Simpan ke localStorage
  addToMyOrders({
    invoiceCode,
    productName,
    price: totalPrice,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  });

  // Countdown
  const countdownEl = document.getElementById('countdown');
  if (countdownEl) startCountdown(expiresAt, countdownEl);

  // Polling
  const statusEl = document.getElementById('orderStatus');
  const statusLabelEl = document.getElementById('statusLabel');
  startPolling(invoiceCode, statusEl, statusLabelEl);
}

window.initCheckoutPage = initCheckoutPage;
