/**
 * BRIK/KOTA — Google Apps Script (API untuk website)
 *
 * Cara pakai:
 * 1. Buka Google Sheets baru > Ekstensi > Apps Script.
 * 2. Hapus isi default, tempel seluruh kode ini, lalu simpan.
 * 3. Pilih fungsi "setup" > Run. Izinkan akses. Sheet "Produk", "Pesanan", dan "Pengaturan" dibuat otomatis.
 * 4. Deploy > New deployment > Type: Web app
 *      Execute as: Me | Who has access: Anyone
 *    Salin URL yang berakhiran /exec ke WEB_APP_URL di app.js.
 * 5. Setiap kali kode ini diubah, deploy ulang (Manage deployments > Edit > New version).
 *
 * Alur: website menampilkan sheet "Produk". Saat pembeli mengirim form,
 * pesanan ditambahkan ke sheet "Pesanan" dan stok di "Produk" otomatis berkurang.
 */

const SHEET_PRODUK = "Produk";
const SHEET_PESANAN = "Pesanan";
const SHEET_SETTING = "Pengaturan";

const HEADER_PRODUK = ["nama", "seri", "kategori", "harga", "stok", "warna", "ukuran", "keterangan", "gambar", "aktif"];
const HEADER_PESANAN = ["waktu", "id_pesanan", "produk", "seri", "harga", "jumlah", "total", "nama", "hp", "alamat", "catatan", "status"];

/* ---------------- GET: kirim produk + pengaturan ---------------- */
function doGet() {
  try {
    return json_({ settings: readSettings_(), products: readProducts_() });
  } catch (err) {
    return json_({ error: String(err) });
  }
}

/* ---------------- POST: simpan pesanan ---------------- */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const d = JSON.parse(e.postData.contents);
    if (d.action !== "order") throw new Error("Aksi tidak dikenal.");

    const nama = clean_(d.nama, 80), hp = clean_(d.hp, 20), alamat = clean_(d.alamat, 300), catatan = clean_(d.catatan, 200);
    const qty = parseInt(d.jumlah, 10);
    if (!nama || !hp || !alamat) throw new Error("Nama, No. HP, dan alamat wajib diisi.");
    if (!(qty >= 1)) throw new Error("Jumlah tidak valid.");

    // Harga & stok selalu diambil dari sheet, bukan dari browser
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(SHEET_PRODUK);
    if (!sh) throw new Error('Sheet "Produk" tidak ditemukan.');
    const rows = sh.getDataRange().getValues();
    const head = rows[0].map(h => String(h).trim().toLowerCase());
    const c = k => head.indexOf(k);

    let r = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][c("nama")]) === String(d.nama_produk) && String(rows[i][c("seri")]) === String(d.seri || "")) { r = i; break; }
    }
    if (r < 0) throw new Error("Produk tidak ditemukan.");
    if (String(rows[r][c("aktif")] || "YA").trim().toUpperCase() === "TIDAK") throw new Error("Produk sedang tidak dijual.");

    const stok = Number(rows[r][c("stok")]) || 0;
    if (qty > stok) throw new Error(stok > 0 ? "Stok tinggal " + stok + "." : "Stok habis.");
    const harga = Number(rows[r][c("harga")]) || 0;

    const id = "BK-" + Utilities.formatDate(new Date(), "Asia/Jakarta", "yyMMdd") + "-" + Math.floor(1000 + Math.random() * 9000);
    const ps = getPesananSheet_();
    ps.appendRow([new Date(), id, rows[r][c("nama")], rows[r][c("seri")], harga, qty, harga * qty, nama, "'" + hp, alamat, catatan, "Baru"]);
    sh.getRange(r + 1, c("stok") + 1).setValue(stok - qty);
    SpreadsheetApp.flush();

    return json_({ ok: true, id: id });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/* ---------------- Helper ---------------- */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Bersihkan teks dan cegah formula injection (=, +, -, @)
function clean_(v, max) {
  let s = String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function getPesananSheet_() {
  const ss = SpreadsheetApp.getActive();
  let ps = ss.getSheetByName(SHEET_PESANAN);
  if (!ps) {
    ps = ss.insertSheet(SHEET_PESANAN);
    ps.getRange(1, 1, 1, HEADER_PESANAN.length).setValues([HEADER_PESANAN])
      .setFontWeight("bold").setBackground("#ff2e12").setFontColor("#ffffff");
    ps.setFrozenRows(1);
    ps.getRange("A2:A").setNumberFormat("dd/mm/yyyy hh:mm");
    ps.getRange("E2:E").setNumberFormat("#,##0");
    ps.getRange("G2:G").setNumberFormat("#,##0");
    ps.getRange("L2:L").setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(["Baru", "Diproses", "Dikirim", "Selesai", "Batal"], true).build());
    ps.setColumnWidths(1, HEADER_PESANAN.length, 130);
    ps.setColumnWidth(10, 260);
  }
  return ps;
}

function readProducts_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_PRODUK);
  if (!sh) throw new Error('Sheet "' + SHEET_PRODUK + '" tidak ditemukan. Jalankan fungsi setup().');
  const rows = sh.getDataRange().getValues();
  if (rows.length < 2) return [];
  const head = rows[0].map(h => String(h).trim().toLowerCase());
  return rows.slice(1)
    .filter(r => String(r[head.indexOf("nama")] || "").trim() !== "")
    .map(r => { const o = {}; head.forEach((h, i) => { o[h] = r[i]; }); return o; })
    .filter(o => String(o.aktif || "YA").trim().toUpperCase() !== "TIDAK")
    .map(o => ({
      nama: String(o.nama),
      seri: String(o.seri || ""),
      kategori: String(o.kategori || "Lainnya"),
      harga: Number(o.harga) || 0,
      stok: Number(o.stok) || 0,
      warna: String(o.warna || "merah"),
      ukuran: String(o.ukuran || "4x2"),
      keterangan: String(o.keterangan || ""),
      gambar: String(o.gambar || "")
    }));
}

function readSettings_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_SETTING);
  const out = {};
  if (!sh) return out;
  sh.getDataRange().getValues().slice(1).forEach(r => {
    const k = String(r[0] || "").trim();
    if (k) out[k] = String(r[1] == null ? "" : r[1]).trim();
  });
  return out;
}

/** Jalankan sekali untuk membuat sheet + data contoh. */
function setup() {
  const ss = SpreadsheetApp.getActive();

  let p = ss.getSheetByName(SHEET_PRODUK);
  if (!p) {
    p = ss.insertSheet(SHEET_PRODUK);
    p.getRange(1, 1, 1, HEADER_PRODUK.length).setValues([HEADER_PRODUK])
      .setFontWeight("bold").setBackground("#0a3cff").setFontColor("#ffffff");
    p.setFrozenRows(1);
    p.getRange(2, 1, 4, HEADER_PRODUK.length).setValues([
      ["Kota Malam", "City 60350", "Set", 425000, 6, "biru", "4x2", "Bandara mini lengkap dengan pesawat dan 4 minifigure.", "", "YA"],
      ["Balap Merah", "Speed 76900", "Set", 389000, 3, "merah", "4x2", "Mobil balap 8 stud, mudah dirakit.", "", "YA"],
      ["Robot Kuning", "Creator 31129", "Set", 265000, 12, "kuning", "3x2", "Tiga model dalam satu kotak.", "", "YA"],
      ["Paket Bata Merah", "Bata satuan", "Bata Satuan", 85000, 40, "merah", "6x1", "100 keping bata campuran.", "", "YA"]
    ]);
    p.getRange("D2:D").setNumberFormat("#,##0");
    p.getRange("J2:J").setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(["YA", "TIDAK"], true).build());
    p.autoResizeColumns(1, HEADER_PRODUK.length);
  }

  getPesananSheet_();

  let s = ss.getSheetByName(SHEET_SETTING);
  if (!s) {
    s = ss.insertSheet(SHEET_SETTING);
    s.getRange(1, 1, 1, 2).setValues([["kunci", "nilai"]])
      .setFontWeight("bold").setBackground("#0a3cff").setFontColor("#ffffff");
    s.getRange(2, 1, 5, 2).setValues([
      ["toko", "BRIK/KOTA"],
      ["tagline", "Tersedia hari ini"],
      ["email", "halo@brikkota.id"],
      ["kota", "Kudus, Jawa Tengah"],
      ["instagram", "@brikkota"]
    ]);
    s.setColumnWidth(1, 120); s.setColumnWidth(2, 260);
  }

  const def = ss.getSheetByName("Sheet1");
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);
}
