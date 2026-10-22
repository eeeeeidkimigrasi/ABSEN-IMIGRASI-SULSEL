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

const HEADER = ['NAMA', 'UNIVERSITAS', 'TANGGAL', 'JAM MASUK', 'JAM KELUAR'];

const COLUMN_WIDTHS = [220, 240, 110, 130, 130];

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
        endColumnIndex: 5,
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
        endColumnIndex: 5,
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
        endColumnIndex: 5,
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
          endColumnIndex: 5,
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
    range: `${sheetName}!A1:E1`,
  });
  const values = res.data.values;
  if (!values || values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:E1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADER] },
    });
  }
}

/**
 * Menambahkan satu baris absensi ke tab bulanan dan tab "Semua Data".
 * @param data { nama, universitas, tanggal, jam_masuk, jam_keluar }
 */
export async function appendAbsen(data: {
  nama: string;
  universitas: string;
  tanggal: string;
  jam_masuk: string;
  jam_keluar: string;
}): Promise<void> {
  const month = data.tanggal.slice(0, 7); // YYYY-MM

  // 1) Pastikan tab bulan ada
  await ensureSheetExists(month);
  await ensureHeader(month, 0);

  // 2) Pastikan tab "Semua Data" ada
  await ensureSheetExists('Semua Data');
  await ensureHeader('Semua Data', 0);

  const row = [data.nama, data.universitas, data.tanggal, data.jam_masuk, data.jam_keluar];

  // 3) Append ke tab bulanan
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${month}!A:E`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });

  // 4) Append ke tab "Semua Data"
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Semua Data!A:E',
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
}