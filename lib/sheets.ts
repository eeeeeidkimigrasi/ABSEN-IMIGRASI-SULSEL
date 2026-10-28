import { google, sheets_v4 } from 'googleapis';

const clientEmail = process.env.GOOGLE_CLIENT_EMAIL!;
const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const spreadsheetId = process.env.SPREADSHEET_ID!;

if (!clientEmail || !privateKey || !spreadsheetId) {
  throw new Error('Missing Google Sheets credentials');
}

const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const HEADER = ['NAMA', 'UNIVERSITAS', 'TANGGAL', 'HARI', 'JAM MASUK', 'JAM KELUAR', 'KETERANGAN'];

const COLUMN_WIDTHS = [220, 240, 110, 110, 130, 130, 220];

async function ensureSheetExists(sheetName: string): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets?.find((s) => s.properties?.title === sheetName);
  if (existing?.properties?.sheetId != null) {
    return existing.properties.sheetId;
  }

  const addSheetReq: sheets_v4.Schema$BatchUpdateSpreadsheetRequest = {
    requests: [
      {
        addSheet: {
          properties: {
            title: sheetName,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      },
    ],
  };
  const res = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: addSheetReq,
  });
  const newSheetId = res.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (newSheetId == null) throw new Error(`Failed to create sheet ${sheetName}`);

  await formatNewSheet(newSheetId);

  return newSheetId;
}

async function formatNewSheet(sheetId: number): Promise<void> {
  const requests: sheets_v4.Schema$Request[] = [];

  requests.push({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: 0,
        endRowIndex: 1,
        startColumnIndex: 0,
        endColumnIndex: 7,
      },
      cell: {
        userEnteredFormat: {
          textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
          backgroundColor: { red: 0.12, green: 0.24, blue: 0.45 },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          borders: {
            top: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
            bottom: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
            left: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
            right: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
          },
        },
      },
      fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment,borders)',
    },
  });

  COLUMN_WIDTHS.forEach((width, index) => {
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: index,
          endIndex: index + 1,
        },
        properties: { pixelSize: width },
        fields: 'pixelSize',
      },
    });
  });

  requests.push({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: 1,
        startColumnIndex: 2,
        endColumnIndex: 7,
      },
      cell: {
        userEnteredFormat: {
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          borders: {
            top: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
            bottom: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
            left: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
            right: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
          },
        },
      },
      fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment,borders)',
    },
  });

  requests.push({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: 1,
        startColumnIndex: 0,
        endColumnIndex: 7,
      },
      cell: {
        userEnteredFormat: {
          borders: {
            top: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
            bottom: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
            left: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
            right: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
          },
          verticalAlignment: 'MIDDLE',
        },
      },
      fields: 'userEnteredFormat(borders,verticalAlignment)',
    },
  });

  requests.push({
    setBasicFilter: {
      filter: {
        range: {
          sheetId,
          startRowIndex: 0,
          startColumnIndex: 0,
          endColumnIndex: 7,
        },
      },
    },
  });

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }
}

async function ensureHeader(sheetName: string, sheetId: number): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:G1`,
  });
  const values = res.data.values;
  if (!values || values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:G1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADER] },
    });
  }
}

/**
 * Menambahkan satu baris absensi ke tab bulanan dan tab "Semua Data".
 * @param data { nama, universitas, tanggal, hari, jam_masuk, jam_keluar, keterangan }
 */
export async function appendAbsen(data: {
  nama: string;
  universitas: string;
  tanggal: string;
  hari: string;
  jam_masuk: string;
  jam_keluar?: string | null;
  keterangan?: string | null;
}): Promise<void> {
  const month = data.tanggal.slice(0, 7); // YYYY-MM

  // 1) Pastikan tab bulan ada
  await ensureSheetExists(month);
  await ensureHeader(month, 0);

  // 2) Pastikan tab "Semua Data" ada
  await ensureSheetExists('Semua Data');
  await ensureHeader('Semua Data', 0);

  let ket = data.keterangan || '';
  if (/^[=+\-@]/.test(ket)) {
    ket = `'${ket}`;
  }

  const row = [data.nama, data.universitas, data.tanggal, data.hari, data.jam_masuk, data.jam_keluar || '', ket];

  // 3) Append ke tab bulanan
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${month}!A:G`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });

  // 4) Append ke tab "Semua Data"
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Semua Data!A:G',
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
}

const HEADER_IZIN = ['NAMA', 'UNIVERSITAS', 'TANGGAL', 'HARI', 'JENIS', 'KETERANGAN', 'LINK SURAT'];
const COLUMN_WIDTHS_IZIN = [220, 240, 110, 110, 150, 220, 220];

async function ensureIzinSheetExists(): Promise<number> {
  const sheetName = 'Izin';
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets?.find((s) => s.properties?.title === sheetName);
  if (existing?.properties?.sheetId != null) {
    return existing.properties.sheetId;
  }

  const addSheetReq: sheets_v4.Schema$BatchUpdateSpreadsheetRequest = {
    requests: [
      {
        addSheet: {
          properties: {
            title: sheetName,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      },
    ],
  };
  const res = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: addSheetReq,
  });
  const newSheetId = res.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (newSheetId == null) throw new Error(`Failed to create sheet ${sheetName}`);

  await formatIzinSheet(newSheetId);
  return newSheetId;
}

async function formatIzinSheet(sheetId: number): Promise<void> {
  const requests: sheets_v4.Schema$Request[] = [];

  requests.push({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: 0,
        endRowIndex: 1,
        startColumnIndex: 0,
        endColumnIndex: 7,
      },
      cell: {
        userEnteredFormat: {
          textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
          backgroundColor: { red: 0.12, green: 0.24, blue: 0.45 },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          borders: {
            top: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
            bottom: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
            left: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
            right: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
          },
        },
      },
      fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment,borders)',
    },
  });

  COLUMN_WIDTHS_IZIN.forEach((width, index) => {
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: index,
          endIndex: index + 1,
        },
        properties: { pixelSize: width },
        fields: 'pixelSize',
      },
    });
  });

  requests.push({
    setBasicFilter: {
      filter: {
        range: {
          sheetId,
          startRowIndex: 0,
          startColumnIndex: 0,
          endColumnIndex: 7,
        },
      },
    },
  });

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }
}

async function ensureIzinHeader(sheetName: string, sheetId: number): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:G1`,
  });
  const values = res.data.values;
  if (!values || values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:G1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADER_IZIN] },
    });
  }
}

export async function appendIzin(data: {
  nama: string;
  universitas: string;
  tanggal: string;
  hari: string;
  jenis: string;
  keterangan: string;
  link_surat: string;
}) {
  const sheetName = 'Izin';
  const sheetId = await ensureIzinSheetExists();
  await ensureIzinHeader(sheetName, sheetId);

  let ket = data.keterangan || '';
  if (/^[=+\-@]/.test(ket)) {
    ket = `'${ket}`;
  }

  const linkCol = data.link_surat || '';

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:G`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[data.nama, data.universitas, data.tanggal, data.hari, data.jenis, ket, linkCol]],
    },
  });
}

export async function deleteIzinRow(nama: string, universitas: string, tanggal: string) {
  const sheetName = 'Izin';
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName);
  if (!sheet || sheet.properties?.sheetId == null) return;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:C`,
  });
  const rows = res.data.values;
  if (!rows) return;

  const namaKey = nama.toLowerCase().trim();
  const univKey = universitas.toLowerCase().trim();

  const rowIndex = rows.findIndex((row) => 
    row[0]?.toLowerCase().trim() === namaKey &&
    row[1]?.toLowerCase().trim() === univKey &&
    row[2]?.trim() === tanggal
  );

  if (rowIndex !== -1) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 }
          }
        }]
      }
    });
  }
}

export async function deleteAbsenRows(nama: string, universitas: string, tanggal: string): Promise<void> {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });

  for (const tabName of ['Semua Data', tanggal.slice(0, 7)]) {
    const sheet = spreadsheet.data.sheets?.find((s) => s.properties?.title === tabName);
    if (!sheet || sheet.properties?.sheetId == null) continue;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!A:C`,
    });

    const rows = res.data.values;
    if (!rows) continue;

    const rowIndex = rows.findIndex((row, idx) => 
      idx > 0 && 
      row[0]?.toLowerCase().trim() === nama.toLowerCase().trim() && 
      row[1]?.toLowerCase().trim() === universitas.toLowerCase().trim() && 
      row[2]?.trim() === tanggal
    );

    if (rowIndex != null && rowIndex > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: { 
                sheetId: sheet.properties.sheetId, 
                dimension: 'ROWS', 
                startIndex: rowIndex, 
                endIndex: rowIndex + 1 
              }
            }
          }]
        }
      });
    }
  }
}
function sanitizeForSheets(value: string): string {
  let ket = value || '';
  if (/^[=+\-@]/.test(ket)) {
    ket = `'${ket}`;
  }
  return ket;
}

export async function updateAbsenRow(
  lama: { nama: string; universitas: string; tanggal: string },
  baru: { nama: string; universitas: string; tanggal: string; hari: string; jam_masuk: string; jam_keluar?: string | null; keterangan?: string | null }
): Promise<void> {
  if (lama.tanggal.slice(0, 7) !== baru.tanggal.slice(0, 7)) {
    await deleteAbsenRows(lama.nama, lama.universitas, lama.tanggal);
    await appendAbsen(baru);
    return;
  }

  const rowData = [
    baru.nama,
    baru.universitas,
    `'${baru.tanggal}`,
    baru.hari,
    baru.jam_masuk,
    baru.jam_keluar || '',
    sanitizeForSheets(baru.keterangan || ''),
  ];

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });

  for (const tabName of ['Semua Data', baru.tanggal.slice(0, 7)]) {
    const sheet = spreadsheet.data.sheets?.find((s) => s.properties?.title === tabName);
    if (!sheet) continue;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!A:C`,
    });

    const rows = res.data.values;
    if (!rows) continue;

    const rowIndex = rows.findIndex((row, idx) =>
      idx > 0 &&
      row[0]?.toLowerCase().trim() === lama.nama.toLowerCase().trim() &&
      row[1]?.toLowerCase().trim() === lama.universitas.toLowerCase().trim() &&
      row[2]?.trim() === lama.tanggal
    );

    if (rowIndex != null && rowIndex > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tabName}!A${rowIndex + 1}:G${rowIndex + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowData] },
      });
    }
  }
}


export async function updateIzinRow(
  lama: { nama: string; universitas: string; tanggal: string },
  baru: { nama: string; universitas: string; tanggal: string; hari: string; jenis: string; keterangan?: string | null; link_surat?: string | null }
): Promise<void> {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = spreadsheet.data.sheets?.find((s) => s.properties?.title === 'Izin');

  if (!sheet) {
    await appendIzin({ ...baru, keterangan: baru.keterangan || '', link_surat: baru.link_surat || '' });
    return;
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Izin!A:C',
  });

  const rows = res.data.values;
  if (!rows) return;

  const rowIndex = rows.findIndex((row, idx) =>
    idx > 0 &&
    row[0]?.toLowerCase().trim() === lama.nama.toLowerCase().trim() &&
    row[1]?.toLowerCase().trim() === lama.universitas.toLowerCase().trim() &&
    row[2]?.trim() === lama.tanggal
  );

  const rowData = [
    baru.nama,
    baru.universitas,
    `'${baru.tanggal}`,
    baru.hari,
    baru.jenis,
    sanitizeForSheets(baru.keterangan || ''),
    baru.link_surat || ''
  ];

  if (rowIndex != null && rowIndex > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Izin!A${rowIndex + 1}:G${rowIndex + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowData] },
    });
  }
}

export async function updateJamKeluarRow(
  data: { nama: string; universitas: string; tanggal: string; jam_keluar: string; keterangan?: string | null }
): Promise<void> {
  const month = data.tanggal.slice(0, 7);
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const hasKet = data.keterangan !== undefined && data.keterangan !== null && data.keterangan.trim() !== '';

  for (const tabName of ['Semua Data', month]) {
    const sheet = spreadsheet.data.sheets?.find((s) => s.properties?.title === tabName);
    if (!sheet) continue;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!A:C`,
    });

    const rows = res.data.values;
    if (!rows) continue;

    const rowIndex = rows.findIndex(
      (row, idx) =>
        idx > 0 &&
        row[0]?.toLowerCase().trim() === data.nama.toLowerCase().trim() &&
        row[1]?.toLowerCase().trim() === data.universitas.toLowerCase().trim() &&
        row[2]?.replace(/^'/, '').trim() === data.tanggal
    );

    if (rowIndex != null && rowIndex > 0) {
      const rowNum = rowIndex + 1;
      if (hasKet) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${tabName}!F${rowNum}:G${rowNum}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[data.jam_keluar, sanitizeForSheets(data.keterangan!.trim())]] },
        });
      } else {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${tabName}!F${rowNum}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[data.jam_keluar]] },
        });
      }
    }
  }
}

export async function syncAbsenRow(data: {
  nama: string;
  universitas: string;
  tanggal: string;
  hari: string;
  jam_masuk: string;
  jam_keluar?: string | null;
  keterangan?: string | null;
}): Promise<void> {
  const res = await sheets.spreadsheets.values
    .get({ spreadsheetId, range: 'Semua Data!A:C' })
    .catch(() => null);
  const rows = res?.data.values || [];
  const ada = rows.some(
    (row, idx) =>
      idx > 0 &&
      row[0]?.toLowerCase().trim() === data.nama.toLowerCase().trim() &&
      row[1]?.toLowerCase().trim() === data.universitas.toLowerCase().trim() &&
      row[2]?.replace(/^'/, '').trim() === data.tanggal
  );
  if (ada) {
    await updateAbsenRow(
      { nama: data.nama, universitas: data.universitas, tanggal: data.tanggal },
      { ...data, jam_keluar: data.jam_keluar || '' }
    );
  } else {
    await appendAbsen(data);
  }
}
