# Sistem Absensi Mahasiswa Magang

Web absen sederhana untuk mahasiswa magang. Mahasiswa scan QR code, isi form, data tersimpan di Supabase dan Google Sheets.

## Cara Kerja
1. Mahasiswa scan QR code statis.
2. Isi Nama, Universitas, Jam Masuk, dan Jam Keluar.
3. Sistem memvalidasi lokasi (radius kantor).
4. Data disimpan di Supabase.
5. Data dikirim ke Google Sheets (tab bulanan & tab "Semua Data").
6. Jika Sheets gagal, cron harian akan mencoba sinkron ulang.

## Setup Project

### 1. Supabase
- Buat project di Supabase.
- Jalankan SQL berikut di SQL Editor:
```sql
create table absensi (
  nama text not null,
  universitas text not null,
  nama_key text generated always as (lower(trim(nama))) stored,
  univ_key text generated always as (lower(trim(universitas))) stored,
  tanggal date not null,
  jam_masuk time not null,
  jam_keluar time not null,
  waktu_kirim timestamptz not null default now(),
  lat double precision,
  lng double precision,
  akurasi_gps real,
  synced_to_sheets boolean not null default false,
  primary key (nama_key, univ_key, tanggal)
);
alter table absensi enable row level security;
```

### 2. Google Sheets
- Buat spreadsheet baru.
- Buat Service Account di Google Cloud Console.
- Unduh file kunci JSON Service Account.
- Bagikan (Share) spreadsheet ke email Service Account sebagai Editor.
- Ambil `SPREADSHEET_ID` dari URL spreadsheet.

### 3. Environment Variables
Isi variabel berikut di Vercel:
- `SUPABASE_URL`: URL project Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key Supabase (bukan anon key).
- `GOOGLE_CLIENT_EMAIL`: Email Service Account Google.
- `GOOGLE_PRIVATE_KEY`: Private key dari JSON Service Account.
- `SPREADSHEET_ID`: ID spreadsheet Google.
- `OFFICE_LAT`: Latitude kantor (contoh: -5.1477).
- `OFFICE_LNG`: Longitude kantor (contoh: 119.4327).
- `RADIUS_METER`: Radius maksimal (default 150).
- `CRON_SECRET`: Kode rahasia untuk cron (bebas, minimal 16 karakter).

### 4. Tab Rekap
Buat tab baru bernama **Rekap** di Google Sheets, lalu masukkan rumus ini di sel A1:
```
=QUERY(UNIQUE('Semua Data'!A2:C); "select Col1, Col2, count(Col3) where Col1 is not null group by Col1, Col2 label count(Col3) 'Jumlah Hadir'"; 0)
```

## QR Code
Buat QR code dari URL domain Vercel Anda dan tempel di kantor.

## Maintenance
- **Ubah Lokasi:** Update `OFFICE_LAT` dan `OFFICE_LNG` di environment variables Vercel.
- **Tambah Data Manual:** Bisa langsung lewat Table Editor di Supabase atau tambah baris di Sheets.
- **Keepalive:** Sistem otomatis melakukan ping ke Supabase sekali sehari lewat Vercel Cron agar project gratis tidak dijeda.