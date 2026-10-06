// =====================================================
// KONFIGURASI GLOBAL
// =====================================================
const SHEET_ID = '1nEAlE_VQuWwOkRY4WTpNNGwbSYZ6WiM2NzY601InRKE';
const SHEET_NAME = 'FUP';
const HEADERS = [
  'ID', 'ISP', 'Paket', 'FUP_GB', 'Terpakai_GB', 'Auto_Sync',
  'Periode_Mulai', 'Periode_Selesai', 'Catatan', 'Updated_At'
];

// =====================================================
// KONFIGURASI RESET DATA
// Hanya tab Hotspot & FUP yang boleh dikosongkan.
// Tab Admin (akun login) dan tab lain otomatis terkunci.
// Baris judul kolom (baris 1) selalu dipertahankan.
// =====================================================
const HOTSPOT_SHEET_NAME = 'Hotspot';
const ADMIN_SHEET_NAME = 'Admin';
const FACE_DESCRIPTOR_HEADER = 'facedescriptor';
const RESET_TARGET_SHEETS = ['Hotspot', 'FUP'];
const PROTECTED_SHEET_NAMES = ['admin'];

// Fungsi bantuan untuk membaca Sheet FUP
function getSheet_() {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
}


// =====================================================
// FUNGSI LOGIKA FUP (Diletakkan di luar agar bisa dibaca)
// =====================================================
function toObject_(row) {
  return {
    ID: row[0],
    ISP: row[1],
    Paket: row[2],
    FUP_GB: Number(row[3]) || 0,
    Terpakai_GB: Number(row[4]) || 0,
    Auto_Sync: String(row[5]).toLowerCase() === 'true' || String(row[5]) === '1' || String(row[5]).toLowerCase() === 'aktif',
    Periode_Mulai: row[6] instanceof Date ? Utilities.formatDate(row[6], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(row[6] || ''),
    Periode_Selesai: row[7] instanceof Date ? Utilities.formatDate(row[7], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(row[7] || ''),
    Catatan: row[8] || '',
    Updated_At: row[9] instanceof Date ? Utilities.formatDate(row[9], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : String(row[9] || '')
  };
}

function getAll_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  return values.filter(row => String(row[0] || '') !== '').map(toObject_);
}

function findRow_(sheet, id) {
  if (!id || sheet.getLastRow() < 2) return -1;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i += 1) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function normalize_(data) {
  return {
    id: String(data.id || Utilities.getUuid()),
    isp: String(data.isp || '').trim(),
    packageName: String(data.packageName || '').trim(),
    limitGB: Number(data.limitGB) || 0,
    manualUsedGB: Math.max(0, Number(data.manualUsedGB) || 0),
    isAutoSync: Boolean(data.isAutoSync),
    periodStart: String(data.periodStart || '').trim(),
    periodEnd: String(data.periodEnd || '').trim(),
    notes: String(data.notes || '').trim()
  };
}

function validate_(data) {
  if (!data.isp) throw new Error('Nama ISP wajib diisi.');
  if (!(data.limitGB > 0)) throw new Error('FUP_GB harus lebih besar dari 0.');
  if (data.periodStart && data.periodEnd && data.periodStart > data.periodEnd) {
    throw new Error('Periode mulai tidak boleh melewati periode selesai.');
  }
}

function toRow_(item) {
  return [
    item.id, item.isp, item.packageName, item.limitGB, item.manualUsedGB,
    item.isAutoSync, item.periodStart, item.periodEnd, item.notes, new Date()
  ];
}

function create_(data) {
  const sheet = getSheet_();
  const item = normalize_(data);
  validate_(item);
  sheet.appendRow(toRow_(item));
  return item;
}

function update_(id, data) {
  const sheet = getSheet_();
  const rowNumber = findRow_(sheet, id);
  if (rowNumber < 2) throw new Error('Provider tidak ditemukan.');
  const item = normalize_(Object.assign({}, data, { id }));
  validate_(item);
  sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([toRow_(item)]);
  return item;
}

function delete_(id) {
  const sheet = getSheet_();
  const rowNumber = findRow_(sheet, id);
  if (rowNumber < 2) throw new Error('Provider tidak ditemukan.');
  sheet.deleteRow(rowNumber);
  return { id: String(id) };
}


// =====================================================
// LOGIKA RESET DATA (Kecuali Admin)
// =====================================================

// Admin/akun login tidak boleh dihapus dari aplikasi
function isProtectedSheet_(name) {
  return PROTECTED_SHEET_NAMES.indexOf(String(name || '').trim().toLowerCase()) !== -1;
}

// Hanya Hotspot & FUP yang boleh di-reset (tab lain ikut terkunci)
function isResettableSheet_(name) {
  var target = String(name || '').trim().toLowerCase();
  return RESET_TARGET_SHEETS.some(function (item) {
    return String(item).trim().toLowerCase() === target;
  });
}

// Alasan kenapa sebuah tab terkunci
function sheetNote_(name) {
  if (isProtectedSheet_(name)) return 'Data akun admin tidak dapat dihapus.';
  if (!isResettableSheet_(name)) return 'Hanya tab ' + RESET_TARGET_SHEETS.join(' dan ') + ' yang dapat di-reset.';
  return '';
}

// Kirim daftar tab + jumlah baris ke dashboard
function listResetSheets_() {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  return spreadsheet.getSheets().map(function (sheet) {
    var name = sheet.getName();
    return {
      name: name,
      exists: true,
      protected: !isResettableSheet_(name),
      note: sheetNote_(name),
      dataRows: Math.max(0, sheet.getLastRow() - 1)
    };
  });
}

// Kosongkan data pada tab yang dipilih, baris judul kolom tetap
function resetSheets_(names) {
  var targets = (names || []).filter(Boolean);
  if (targets.length === 0) throw new Error('Pilih minimal satu data untuk dihapus.');

  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var cleared = [];

  targets.forEach(function (name) {
    // Pengaman: hanya Hotspot & FUP, penolakan tetap di server walau checkbox dipaksa
    if (!isResettableSheet_(name)) throw new Error('Data ' + name + ' terkunci dan tidak boleh dihapus.');
    var sheet = spreadsheet.getSheetByName(name);
    if (!sheet) throw new Error('Sheet ' + name + ' tidak ditemukan.');
    var lastRow = sheet.getLastRow();
    var deletedRows = Math.max(0, lastRow - 1);
    if (deletedRows > 0) sheet.deleteRows(2, deletedRows);
    cleared.push({ name: name, deletedRows: deletedRows });
  });

  return cleared;
}


// =====================================================
// LOGIN DENGAN WAJAH (FaceDescriptor di sheet Admin)
// =====================================================

function adminSheet_() {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = spreadsheet.getSheetByName(ADMIN_SHEET_NAME);
  if (!sheet) throw new Error('Sheet ' + ADMIN_SHEET_NAME + ' tidak ditemukan.');
  return sheet;
}

// Peta nama kolom -> nomor kolom (1-based). Tidak bergantung pada urutan kolom.
function adminColumns_(sheet) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  headers.forEach(function (header, index) {
    var key = String(header || '').trim().toLowerCase();
    if (key) map[key] = index + 1;
  });
  return map;
}

// Ambil semua wajah yang sudah terdaftar (untuk pencocokan di browser)
function readFaces_() {
  var sheet = adminSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var columns = adminColumns_(sheet);
  var userCol = columns['username'];
  if (!userCol) throw new Error('Kolom Username tidak ditemukan di sheet Admin.');
  if (!columns[FACE_DESCRIPTOR_HEADER]) return []; // kolom belum dibuat: bukan error

  var faceCol = columns[FACE_DESCRIPTOR_HEADER];
  var values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var result = [];

  values.forEach(function (row) {
    var username = String(row[userCol - 1] || '').trim();
    var descriptor = String(row[faceCol - 1] || '').trim();
    if (!username || !descriptor) return;
    result.push({ username: username, faceDescriptor: descriptor });
  });

  return result;
}

// Simpan descriptor wajah milik satu username
function enrollFace_(username, descriptor) {
  var name = String(username || '').trim();
  if (!name) throw new Error('Username wajib diisi.');
  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    throw new Error('Descriptor wajah tidak valid, harus berisi 128 angka.');
  }
  var numbers = descriptor.map(Number);
  for (var i = 0; i < numbers.length; i += 1) {
    if (!isFinite(numbers[i])) throw new Error('Descriptor wajah berisi angka tidak valid.');
  }

  var sheet = adminSheet_();
  var columns = adminColumns_(sheet);
  var userCol = columns['username'];
  if (!userCol) throw new Error('Kolom Username tidak ditemukan di sheet Admin.');
  if (!columns[FACE_DESCRIPTOR_HEADER]) {
    throw new Error('Kolom FaceDescriptor belum ada di sheet Admin.');
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Data admin kosong.');

  var usernames = sheet.getRange(2, userCol, lastRow - 1, 1).getValues();
  var targetRow = -1;
  for (var r = 0; r < usernames.length; r += 1) {
    if (String(usernames[r][0] || '').trim() === name) { targetRow = r + 2; break; }
  }
  if (targetRow < 0) throw new Error('Username ' + name + ' tidak ditemukan di sheet Admin.');

  sheet.getRange(targetRow, columns[FACE_DESCRIPTOR_HEADER]).setValue(JSON.stringify(numbers));
  return { username: name, row: targetRow };
}

// Hapus data wajah milik satu username
function deleteFace_(username) {
  var name = String(username || '').trim();
  if (!name) throw new Error('Username wajib diisi.');

  var sheet = adminSheet_();
  var columns = adminColumns_(sheet);
  var userCol = columns['username'];
  if (!userCol) throw new Error('Kolom Username tidak ditemukan di sheet Admin.');
  if (!columns[FACE_DESCRIPTOR_HEADER]) throw new Error('Kolom FaceDescriptor belum ada di sheet Admin.');

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Data admin kosong.');

  var usernames = sheet.getRange(2, userCol, lastRow - 1, 1).getValues();
  for (var r = 0; r < usernames.length; r += 1) {
    if (String(usernames[r][0] || '').trim() === name) {
      sheet.getRange(r + 2, columns[FACE_DESCRIPTOR_HEADER]).setValue('');
      return { username: name };
    }
  }
  throw new Error('Username ' + name + ' tidak ditemukan di sheet Admin.');
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}


// =====================================================
// FUNGSI UTAMA (Menerima Request API)
// =====================================================
function doGet(e) {
  // --- JALUR 1: DATA DARI MIKROTIK ---
  if (e && e.parameter && e.parameter.hotspotData) {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(HOTSPOT_SHEET_NAME);
    var timestamp = new Date();

    // FITUR AUTO-CLEAN: Hapus Data Tiap Tanggal 1
    if (timestamp.getDate() === 1) {
      var lastRow = sheet.getLastRow();
      // Jika ada data selain header (baris 1), hapus semuanya
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
    }

    var rawData = e.parameter.hotspotData;
    var records = rawData.split(',');

    for (var i = 0; i < records.length; i++) {
      var details = records[i].split('|');
      if (details.length === 3) {
        var user = details[0];
        var uploadBytes = parseFloat(details[1]) || 0;
        var downloadBytes = parseFloat(details[2]) || 0;

        var uploadMB = (uploadBytes / 1048576).toFixed(2);
        var downloadMB = (downloadBytes / 1048576).toFixed(2);
        var totalMB = ((uploadBytes + downloadBytes) / 1048576).toFixed(2);

        // Catatan: urutan ini sama seperti script aslimu (download ditulis lebih dulu),
        // sedangkan header sheet menulis kolom C sebagai "Upload (MB)".
        // Dashboard hanya memakai kolom "Total (MB)", jadi tidak terpengaruh.
        if (totalMB >= 0) {
           sheet.appendRow([timestamp, user, downloadMB, uploadMB, totalMB]);
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Data direkam. (Sistem Auto-Clean Aktif)"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // --- JALUR 2: WEB DASHBOARD ---
  var params = (e && e.parameter) || {};
  var action = String(params.action || 'list').toLowerCase();

  // Ambil daftar tab untuk halaman Reset Data
  if (action === 'sheets') {
    try {
      return json_({ success: true, data: listResetSheets_() });
    } catch (error) {
      return json_({ success: false, message: error.message || String(error) });
    }
  }

  // Ambil daftar wajah terdaftar untuk login FaceID
  if (action === 'faces') {
    try {
      return json_({ success: true, data: readFaces_() });
    } catch (error) {
      return json_({ success: false, message: error.message || String(error) });
    }
  }

  if (action === 'list') {
    try {
      var dataFUP = getAll_(); // Sekarang getAll_() bisa dibaca dengan normal
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: dataFUP
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: error.message
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Jika action tidak dikenali
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    message: "Action tidak dikenali atau tidak ada data."
  })).setMimeType(ContentService.MimeType.JSON);
}


// =====================================================
//doPost (WAJIB ADA untuk Tambah / Edit / Hapus / Reset)
// Dashboard mengirim permintaan lewat POST untuk semua aksi ini.
// =====================================================
function doPost(e) {
  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000);

    var body = (e && e.postData && e.postData.contents)
      ? JSON.parse(e.postData.contents)
      : {};
    var action = String(body.action || '').toLowerCase();

    // Reset data (danger: menghapus semua baris data pada tab yang dipilih)
    if (action === 'reset') {
      var cleared = resetSheets_(body.sheets);
      var total = cleared.reduce(function (sum, item) { return sum + item.deletedRows; }, 0);
      var label = cleared.map(function (item) { return item.name + ' (' + item.deletedRows + ')'; }).join(', ');
      return json_({
        success: true,
        message: total > 0 ? total + ' baris dihapus: ' + label + '.' : 'Data sudah kosong, tidak ada yang dihapus.',
        data: cleared
      });
    }

    if (action === 'create') {
      return json_({ success: true, message: 'Provider berhasil ditambahkan.', data: create_(body.data || {}) });
    }

    // Simpan wajah pemilik akun (kolom FaceDescriptor di sheet Admin)
    if (action === 'enrollface') {
      return json_({ success: true, message: 'Wajah berhasil disimpan.', data: enrollFace_(body.username, body.descriptor) });
    }

    // Hapus wajah pemilik akun
    if (action === 'deleteface') {
      return json_({ success: true, message: 'Data wajah berhasil dihapus.', data: deleteFace_(body.username) });
    }

    if (action === 'update') {
      return json_({ success: true, message: 'Provider berhasil diperbarui.', data: update_(body.id, body.data || {}) });
    }

    if (action === 'delete') {
      return json_({ success: true, message: 'Provider berhasil dihapus.', data: delete_(body.id) });
    }

    return json_({ success: false, message: 'Action POST tidak dikenali atau tidak ada data.' });

  } catch (error) {
    return json_({ success: false, message: error.message || String(error) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}