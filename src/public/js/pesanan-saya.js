'use strict';

/**
 * pesanan-saya.js — halaman /pesanan-saya
 * Baca localStorage, render list, refresh status tiap buka halaman.
 */

const STORAGE_KEY = 'my_orders';

function getMyOrders() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveMyOrders(orders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

function fmt(n) { return 'Rp ' + n.toLocaleString('id-ID'); }

function statusLabel(s) {
  return { PENDING: 'Pending', PAID: 'Dibayar', DELIVERED: 'Terkirim', EXPIRED: 'Kadaluarsa', FAILED: 'Gagal', REFUNDED: 'Dikembalikan' }[s] || s;
}

function renderOrders() {
  const orders = getMyOrders();
  const list = document.getElementById('orderList');
  const count = document.getElementById('countLabel');
  if (!list) return;

  count.textContent = orders.length + ' pesanan';

  if (orders.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="icon"><i data-lucide="package" style="width: 1em; height: 1em;"></i></div>
        <p>Belum ada pesanan yang tersimpan di perangkat ini.</p>
        <a href="/produk" class="btn btn-gold mt-4">Lihat Produk</a>
      </div>`;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  list.innerHTML = orders.slice().reverse().map((o) => `
    <div class="order-card" id="card-${o.invoiceCode}">
      <div class="l">
        <div class="inv">${o.invoiceCode}</div>
        <div class="name">${o.productName}</div>
        <div class="time">${new Date(o.createdAt).toLocaleString('id-ID')}</div>
      </div>
      <div class="r">
        <div class="price">${fmt(o.price)}</div>
        <span class="status-badge ${o.status}" id="status-${o.invoiceCode}">${statusLabel(o.status)}</span>
      </div>
    </div>
  `).join('');
}

async function refreshStatuses() {
  const orders = getMyOrders();
  // Hanya refresh yang masih PENDING (yang lain sudah final)
  const pending = orders.filter((o) => o.status === 'PENDING');
  if (pending.length === 0) return;

  // Fetch semua secara paralel — best-effort
  await Promise.allSettled(
    pending.map(async (o) => {
      try {
        const res = await fetch(`/order/${o.invoiceCode}/status`);
        const { success, data } = await res.json();
        if (success && data.status !== o.status) {
          o.status = data.status;
          const el = document.getElementById(`status-${o.invoiceCode}`);
          if (el) {
            el.className = `status-badge ${data.status}`;
            el.textContent = statusLabel(data.status);
          }
        }
      } catch { /* ignore */ }
    })
  );

  saveMyOrders(orders);
}

// Tombol hapus semua
document.getElementById('clearAll')?.addEventListener('click', () => {
  if (!confirm('Hapus semua riwayat pesanan dari perangkat ini?')) return;
  localStorage.removeItem(STORAGE_KEY);
  renderOrders();
});

renderOrders();
refreshStatuses();
