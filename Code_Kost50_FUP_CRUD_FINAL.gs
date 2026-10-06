const SPREADSHEET_ID = '1nEAlE_VQuWwOkRY4WTpNNGwbSYZ6WiM2NzY601InRKE';
const SHEET_NAME = 'FUP';

const HEADERS = [
  'ID',
  'ISP',
  'Paket',
  'FUP_GB',
  'Terpakai_GB',
  'Auto_Sync',
  'Periode_Mulai',
  'Periode_Selesai',
  'Catatan',
  'Updated_At'
];

// ============ RESET DATA (kecuali Admin) ============
const RESET_TARGET_SHEETS = ['Hotspot', 'FUP'];
const PROTECTED_SHEET_NAMES = ['admin'];

function isProtectedSheet_(name) {
  return PROTECTED_SHEET_NAMES.indexOf(String(name || '').trim().toLowerCase()) !== -1;
}

function isResettableSheet_(name) {
  const target = String(name || '').trim().toLowerCase();
  return RESET_TARGET_SHEETS.some(function (item) {
    return String(item).trim().toLowerCase() === target;
  });
}

function sheetNote_(name) {
  if (isProtectedSheet_(name)) return 'Data akun admin tidak dapat dihapus.';
  if (!isResettableSheet_(name)) return 'Hanya tab ' + RESET_TARGET_SHEETS.join(' dan ') + ' yang dapat di-reset.';
  return '';
}

function listResetSheets_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  return spreadsheet.getSheets().map(function (sheet) {
    const name = sheet.getName();
    return {
      name: name,
      exists: true,
      protected: !isResettableSheet_(name),
      note: sheetNote_(name),
      dataRows: Math.max(0, sheet.getLastRow() - 1)
    };
  });
}

function resetSheets_(names) {
  const targets = (names || []).filter(Boolean);
  if (targets.length === 0) throw new Error('Pilih minimal satu data untuk dihapus.');

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const cleared = [];

  targets.forEach(function (name) {
    if (!isResettableSheet_(name)) throw new Error('Data ' + name + ' terkunci dan tidak boleh dihapus.');
    const sheet = spreadsheet.getSheetByName(name);
    if (!sheet) throw new Error('Sheet ' + name + ' tidak ditemukan.');
    const lastRow = sheet.getLastRow();
    const deletedRows = Math.max(0, lastRow - 1);
    if (deletedRows > 0) sheet.deleteRows(2, deletedRows);
    cleared.push({ name: name, deletedRows: deletedRows });
  });

  return cleared;
}

function output_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  } else {
    const currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    const isHeaderMissing = HEADERS.some((header, index) => currentHeaders[index] !== header);
    if (isHeaderMissing) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.setFrozenRows(1);
    }
  }

  return sheet;
}

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

function create_(data) {
  const sheet = getSheet_();
  const item = normalize_(data);
  validate_(item);

  sheet.appendRow([
    item.id,
    item.isp,
    item.packageName,
    item.limitGB,
    item.manualUsedGB,
    item.isAutoSync,
    item.periodStart,
    item.periodEnd,
    item.notes,
    new Date()
  ]);

  return item;
}

function update_(id, data) {
  const sheet = getSheet_();
  const rowNumber = findRow_(sheet, id);
  if (rowNumber < 2) throw new Error('Provider tidak ditemukan.');

  const item = normalize_(Object.assign({}, data, { id }));
  validate_(item);

  sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([[
    item.id,
    item.isp,
    item.packageName,
    item.limitGB,
    item.manualUsedGB,
    item.isAutoSync,
    item.periodStart,
    item.periodEnd,
    item.notes,
    new Date()
  ]]);

  return item;
}

function delete_(id) {
  const sheet = getSheet_();
  const rowNumber = findRow_(sheet, id);
  if (rowNumber < 2) throw new Error('Provider tidak ditemukan.');
  sheet.deleteRow(rowNumber);
  return { id: String(id) };
}

function doGet(e) {
  try {
    const action = String(e && e.parameter && e.parameter.action || 'list').toLowerCase();

    if (action === 'list') {
      return output_({ success: true, data: getAll_() });
    }

    if (action === 'setup') {
      getSheet_();
      return output_({ success: true, message: `Sheet ${SHEET_NAME} siap.` });
    }

    if (action === 'sheets') {
      return output_({ success: true, data: listResetSheets_() });
    }

    return output_({ success: false, message: 'Action GET tidak dikenali.' });
  } catch (error) {
    return output_({ success: false, message: error.message || String(error) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000);

    const body = e && e.postData && e.postData.contents
      ? JSON.parse(e.postData.contents)
      : {};

    const action = String(body.action || '').toLowerCase();

    if (action === 'create') {
      return output_({ success: true, message: 'Provider berhasil ditambahkan.', data: create_(body.data || {}) });
    }

    if (action === 'update') {
      return output_({ success: true, message: 'Provider berhasil diperbarui.', data: update_(body.id, body.data || {}) });
    }

    if (action === 'delete') {
      return output_({ success: true, message: 'Provider berhasil dihapus.', data: delete_(body.id) });
    }

    if (action === 'reset') {
      const cleared = resetSheets_(body.sheets);
      const total = cleared.reduce((sum, item) => sum + item.deletedRows, 0);
      const label = cleared.map(item => `${item.name} (${item.deletedRows})`).join(', ');
      return output_({
        success: true,
        message: total > 0 ? `${total} baris dihapus: ${label}.` : 'Data sudah kosong, tidak ada yang dihapus.',
        data: cleared
      });
    }

    return output_({ success: false, message: 'Action POST tidak dikenali.' });
  } catch (error) {
    return output_({ success: false, message: error.message || String(error) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}
