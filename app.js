/* ============================================================
   ISI DI SINI: tempel URL Web App dari Google Apps Script
   Contoh: "https://script.google.com/macros/s/AKfycb.../exec"
   Kosongkan untuk memakai data contoh (demo).
   ============================================================ */
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzlbXB8Gn5JKQ8SwGLRwn4bIt35s_PfQ38X9p5fhbF3aGmxhhEvqhCEXWp15t3pbNg/exec";

/* ---------- Data contoh (dipakai bila URL kosong / gagal dimuat) ---------- */
const DEMO = {
  settings: {
    toko: "BRIK/KOTA", tagline: "Tersedia hari ini",
    email: "halo@brikkota.id", kota: "Kudus, Jawa Tengah", instagram: "@brikkota"
  },
  products: [
    { nama: "Kota Malam", seri: "City 60350", kategori: "Set", harga: 425000, stok: 6, warna: "biru", ukuran: "4x2", keterangan: "Bandara mini lengkap dengan pesawat dan 4 minifigure." },
    { nama: "Balap Merah", seri: "Speed 76900", kategori: "Set", harga: 389000, stok: 3, warna: "merah", ukuran: "4x2", keterangan: "Mobil balap 8 stud, mudah dirakit, cocok untuk pemula." },
    { nama: "Robot Kuning", seri: "Creator 31129", kategori: "Set", harga: 265000, stok: 12, warna: "kuning", ukuran: "3x2", keterangan: "Tiga model dalam satu kotak: robot, kucing, dan burung." },
    { nama: "Paket Bata Merah", seri: "Bata satuan", kategori: "Bata Satuan", harga: 85000, stok: 40, warna: "merah", ukuran: "6x1", keterangan: "100 keping bata campuran ukuran, warna merah." },
    { nama: "Astronot", seri: "Minifigure 71046", kategori: "Minifigure", harga: 49000, stok: 0, warna: "putih", ukuran: "2x2", keterangan: "Minifigure seri koleksi, kemasan blind bag." },
    { nama: "Menara Hijau", seri: "Architecture 21058", kategori: "Koleksi", harga: 1250000, stok: 2, warna: "hijau", ukuran: "4x3", keterangan: "Set edisi koleksi untuk dipajang." },
    { nama: "Kapal Oranye", seri: "Ideas 21338", kategori: "Koleksi", harga: 980000, stok: 4, warna: "oranye", ukuran: "4x2", keterangan: "Model kapal dengan detail layar dan kabin." },
    { nama: "Paket Bata Biru", seri: "Bata satuan", kategori: "Bata Satuan", harga: 85000, stok: 25, warna: "biru", ukuran: "6x1", keterangan: "100 keping bata campuran ukuran, warna biru." }
  ]
};

const COLORS = {
  merah: "#ff2e12", biru: "#0a3cff", kuning: "#f5c400", hijau: "#00a651",
  hitam: "#1b1b1b", putih: "#f2f2f2", oranye: "#ff8a00", abu: "#8a8f98",
  ungu: "#7a3cff", pink: "#ff5fa2", coklat: "#7a4a2b"
};
const colorOf = c => COLORS[String(c || "").toLowerCase().trim()] || (/^#|^rgb/i.test(c) ? c : "#ff2e12");
const rupiah = n => "Rp " + Number(n || 0).toLocaleString("id-ID");
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

/* ---------- Gambar bata LEGO (SVG) ---------- */
function brickSVG(color, ukuran, layers) {
  const m = String(ukuran || "4x2").match(/(\d+)\s*x\s*(\d+)/i);
  const cols = Math.min(8, Math.max(1, m ? +m[1] : 4));
  layers = layers || Math.min(3, Math.max(1, m ? +m[2] : 2));
  const uw = 34, W = cols * uw + 20, bh = 46, H = layers * bh + 34;
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bata LEGO">`;
  for (let l = 0; l < layers; l++) {
    const y = 26 + l * bh;
    for (let i = 0; i < cols; i++) {
      const x = 10 + i * uw + 5;
      s += `<rect x="${x}" y="${y - 12}" width="${uw - 10}" height="14" rx="4" fill="${color}"/>` +
           `<rect x="${x}" y="${y - 12}" width="${uw - 10}" height="14" rx="4" fill="rgba(255,255,255,.28)"/>`;
    }
    s += `<rect x="10" y="${y}" width="${cols * uw}" height="${bh - 4}" rx="5" fill="${color}"/>` +
         `<rect x="10" y="${y + bh - 14}" width="${cols * uw}" height="10" rx="4" fill="rgba(0,0,0,.2)"/>` +
         `<rect x="14" y="${y + 4}" width="${cols * uw - 8}" height="5" rx="2.5" fill="rgba(255,255,255,.3)"/>`;
  }
  return s + "</svg>";
}

/* ---------- Animasi muncul saat scroll ---------- */
const io = "IntersectionObserver" in window
  ? new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" })
  : null;
function watch(root) {
  (root || document).querySelectorAll(".rv:not(.in)").forEach(el => io ? io.observe(el) : el.classList.add("in"));
}

/* ---------- Render ---------- */
let allProducts = [], settings = {}, activeCat = "Semua";

function applySettings() {
  document.querySelectorAll("[data-s]").forEach(el => {
    const v = settings[el.dataset.s]; if (v) el.textContent = v;
  });
  if (settings.toko) document.title = settings.toko + " — Toko LEGO";
}

function renderChips() {
  const cats = ["Semua", ...new Set(allProducts.map(p => p.kategori).filter(Boolean))];
  const box = document.getElementById("chips");
  box.innerHTML = cats.map(c => `<button class="chip" type="button" aria-pressed="${c === activeCat}" data-c="${esc(c)}">${esc(c)}</button>`).join("");
  box.onclick = e => {
    const b = e.target.closest(".chip"); if (!b) return;
    activeCat = b.dataset.c; renderChips(); renderGrid();
  };
}

function renderGrid() {
  const grid = document.getElementById("grid");
  const list = allProducts.filter(p => activeCat === "Semua" || p.kategori === activeCat);
  if (!list.length) { grid.innerHTML = '<p class="state-msg">Belum ada produk di kategori ini. Coba kategori lain.</p>'; return; }
  grid.innerHTML = list.map((p, i) => {
    const habis = Number(p.stok) <= 0;
    const art = p.gambar
      ? `<img src="${esc(p.gambar)}" alt="${esc(p.nama)}" loading="lazy">`
      : brickSVG(colorOf(p.warna), p.ukuran);
    const idx = allProducts.indexOf(p);
    return `<article class="card rv" style="--d:${(i % 4) * 0.09}s">
      <span class="cat">${esc(p.kategori)} · ${esc(p.seri)}</span>
      <h3>${esc(p.nama)}</h3>
      <div class="art">${art}</div>
      <p class="desc">${esc(p.keterangan)}</p>
      <div class="row">
        <div><div class="price">${rupiah(p.harga)}</div><div class="stok">${habis ? "Stok habis" : "Stok " + esc(p.stok)}</div></div>
        <button type="button" class="btn" data-i="${idx}" ${habis ? "disabled" : ""}>${habis ? "Habis" : "Pesan"} <span>↗</span></button>
      </div></article>`;
  }).join("");
  watch(grid);
}

function renderHero() {
  document.getElementById("heroBricks").innerHTML =
    brickSVG("#ff2e12", "4x2") + brickSVG("#f5ff3b", "3x2") + brickSVG("#f4f0e8", "2x1", 1);
}

/* ---------- Form pesanan (disimpan ke sheet "Pesanan") ---------- */
const $ = id => document.getElementById(id);
let cur = null;

function updateTotal() {
  const q = Math.max(0, parseInt($("f").jumlah.value, 10) || 0);
  $("oTotal").textContent = rupiah(cur ? cur.harga * q : 0);
}

function openOrder(p) {
  cur = p;
  $("f").reset();
  $("oTitle").textContent = p.nama;
  $("f").jumlah.max = p.stok;
  $("oMsg").textContent = ""; $("oMsg").className = "msg";
  $("oSubmit").disabled = false;
  $("oForm").hidden = false; $("oDone").hidden = true;
  updateTotal();
  $("order").showModal();
}

function setMsg(t, err) { $("oMsg").textContent = t; $("oMsg").className = "msg" + (err ? " err" : ""); }

async function sendOrder(payload) {
  if (!WEB_APP_URL) { await new Promise(r => setTimeout(r, 700)); return { ok: true, id: "DEMO", demo: true }; }
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 20000);
  try {
    // text/plain menghindari preflight CORS pada Apps Script
    const r = await fetch(WEB_APP_URL, { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "text/plain;charset=utf-8" }, signal: ctl.signal });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || "Pesanan ditolak server.");
    return d;
  } finally { clearTimeout(t); }
}

function initOrder() {
  $("grid").addEventListener("click", e => {
    const b = e.target.closest("[data-i]");
    if (b && allProducts[+b.dataset.i]) openOrder(allProducts[+b.dataset.i]);
  });
  $("f").jumlah.addEventListener("input", updateTotal);
  $("oClose").onclick = $("oOk").onclick = () => $("order").close();
  $("order").addEventListener("click", e => { if (e.target === $("order")) $("order").close(); });
  $("f").addEventListener("submit", async e => {
    e.preventDefault();
    const f = $("f"), q = parseInt(f.jumlah.value, 10);
    if (!f.checkValidity()) { f.reportValidity(); return; }
    if (!(q >= 1) || q > cur.stok) { setMsg("Jumlah harus 1 sampai " + cur.stok + ".", true); return; }
    $("oSubmit").disabled = true; setMsg("Mengirim pesanan…");
    try {
      const d = await sendOrder({
        action: "order", nama_produk: cur.nama, seri: cur.seri, jumlah: q,
        nama: f.nama.value.trim(), hp: f.hp.value.trim(), alamat: f.alamat.value.trim(), catatan: f.catatan.value.trim()
      });
      cur.stok -= q;
      $("oDoneTxt").textContent = d.demo
        ? "Mode demo: pesanan belum tersimpan karena WEB_APP_URL masih kosong."
        : "Nomor pesanan " + d.id + " sudah tercatat. Kami akan menghubungi Anda lewat nomor HP yang diisi.";
      $("oForm").hidden = true; $("oDone").hidden = false;
      renderGrid();
    } catch (err) {
      console.error(err);
      setMsg("Pesanan gagal dikirim: " + (err.name === "AbortError" ? "koneksi terlalu lama, coba lagi." : err.message), true);
      $("oSubmit").disabled = false;
    }
  });
}

/* ---------- Ambil data dari Google Sheets ---------- */
async function loadData() {
  if (!WEB_APP_URL) return DEMO;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(WEB_APP_URL, { signal: ctl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return d;
  } finally { clearTimeout(t); }
}

(async function init() {
  renderHero(); watch();
  let data;
  try { data = await loadData(); }
  catch (err) {
    console.error("Gagal memuat spreadsheet:", err);
    data = DEMO;
    document.getElementById("grid").insertAdjacentHTML("beforebegin",
      '<p class="mono" style="padding:0 var(--pad) 16px">Data spreadsheet tidak bisa dimuat, menampilkan contoh. Periksa URL Web App di app.js.</p>');
  }
  settings = Object.assign({}, DEMO.settings, data.settings || {});
  allProducts = data.products || [];
  applySettings(); renderChips(); renderGrid(); initOrder();
})();
