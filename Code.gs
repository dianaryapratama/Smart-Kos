/**
 * Smart Kost 50 - Google Sheets API untuk Monitoring FUP ISP
 *
 * Script ini dipasang di Google Spreadsheet yang sama dengan database admin.
 * Buat sheet/tab bernama: FUP
 * Kolom akan dibuat otomatis saat pertama kali API dipanggil.
 */

const SPREADSHEET_ID = '1nEAlE_VQuWwOkRY4WTpNNGwbSYZ6WiM2NzY601InRKE';
const FUP_SHEET_NAME = 'FUP';
const FUP_HEADERS = [
  'ID',
  'ISP',
  'Paket',
  'FUP_GB',
  'Terpakai_GB',
  'Periode_Mulai',
  'Periode_Selesai',
  'Catatan',
  'Updated_At',
];

function getFupSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(FUP_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(FUP_SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, FUP_HEADERS.length).setValues([FUP_HEADERS]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : 'fup';

    if (action === 'fup') {
      return json_({ ok: true, rows: readFup_() });
    }

    return json_({ ok: false, message: 'Action GET tidak dikenali.' });
  } catch (error) {
    return json_({ ok: false, message: error.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    const action = body.action;

    if (action === 'saveFup') {
      return json_(saveFup_(body.row || {}));
    }

    if (action === 'deleteFup') {
      return json_(deleteFup_(body.id));
    }

    return json_({ ok: false, message: 'Action POST tidak dikenali.' });
  } catch (error) {
    return json_({ ok: false, message: error.message });
  }
}

function readFup_() {
  const sheet = getFupSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(String);
  return values.slice(1).filter(row => row.some(cell => cell !== '')).map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] instanceof Date
        ? Utilities.formatDate(row[index], Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : row[index];
    });
    return obj;
  });
}

function saveFup_(row) {
  const sheet = getFupSheet_();
  const id = String(row.ID || '').trim() || ('FUP-' + Utilities.getUuid().slice(0, 8).toUpperCase());
  const record = [
    id,
    String(row.ISP || '').trim(),
    String(row.Paket || '').trim(),
    Number(row.FUP_GB) || 0,
    Number(row.Terpakai_GB) || 0,
    String(row.Periode_Mulai || ''),
    String(row.Periode_Selesai || ''),
    String(row.Catatan || '').trim(),
    new Date(),
  ];

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String);
    const foundIndex = ids.findIndex(existingId => existingId === id);

    if (foundIndex !== -1) {
      const targetRow = foundIndex + 2;
      sheet.getRange(targetRow, 1, 1, record.length).setValues([record]);
      return { ok: true, mode: 'updated', id: id };
    }
  }

  sheet.appendRow(record);
  return { ok: true, mode: 'created', id: id };
}

function deleteFup_(id) {
  const targetId = String(id || '').trim();
  if (!targetId) throw new Error('ID FUP tidak boleh kosong.');

  const sheet = getFupSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { ok: false, message: 'Data FUP kosong.' };

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String);
  const foundIndex = ids.findIndex(existingId => existingId === targetId);

  if (foundIndex === -1) {
    return { ok: false, message: 'Data FUP tidak ditemukan.' };
  }

  sheet.deleteRow(foundIndex + 2);
  return { ok: true, id: targetId };
}
