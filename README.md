# Sistem Absensi Mahasiswa Magang Imigrasi Makassar

Web absen untuk mahasiswa magang Imigrasi Makassar, diakses lewat QR statis di poster (domain: magang-imigrasi-sulsel.my.id). Halaman ini mendukung dua mode: **Hadir** dan **Izin**.

## Alur Sistem

### 1. Alur Hadir (`/api/absen`)
1. **Validasi:** Rapikan spasi nama, universitas, keterangan; validasi kelengkapan data; validasi lokasi (Haversine distance dari koordinat `OFFICE_LAT` & `OFFICE_LNG` dalam radius `RADIUS_METER`).
2. **Cek Duplikasi:** Jika sudah absen hari ini, akan ditolak (panel kuning).
3. **Konfirmasi Nama Baru:** Jika nama/universitas belum terdaftar di tabel `absensi` atau `izin`, muncul popup konfirmasi sebelum kirim.
4. **Penyimpanan:** Data di-upsert ke Supabase.
5. **Sinkronisasi:** Tambah baris ke Google Sheets (tab bulanan & "Semua Data"). Jika berhasil, baris izin hari itu untuk orang yang sama di Supabase dan Sheets dihapus (hadir membatalkan izin).

### 2. Alur Izin (`/api/izin`)
1. **Fitur:** Tanpa validasi lokasi. Field: jenis (Sakit, Izin, Lainnya), keterangan (maks 100 char), dan link surat opsional (hanya `drive.google.com` atau `docs.google.com`).
2. **Batasan:** Tanggal diambil dari server (hanya untuk hari ini). Ditolak jika hari itu sudah hadir atau sudah izin.
3. **Konfirmasi Nama Baru:** Sama seperti alur Hadir.

## Stack & Database
- **Stack:** Next.js 14, Supabase (PostgreSQL), Google Sheets API (Service Account), Vercel (hosting & cron).
- **Database:** Tabel `absensi` dan `izin`. `nama_key` dan `univ_key` adalah kolom *generated* (`lower(trim())`), jangan diisi dari kode. Akses lewat *service role*.
- **Google Sheets:** Tab "Semua Data", tab bulanan (format `YYYY-MM`), dan tab "Izin".
  - Kolom Absensi: NAMA, UNIVERSITAS, TANGGAL, HARI, JAM MASUK, JAM KELUAR, KETERANGAN.
  - Kolom Izin: NAMA, UNIVERSITAS, TANGGAL, HARI, JENIS, KETERANGAN, LINK SURAT.

### Rumus Manual Google Sheets
- **Rekap:**
  `=QUERY(UNIQUE('Semua Data'!A2:G); "select Col1, Col2, count(Col3) where Col1 is not null group by Col1, Col2 label count(Col3) 'Jumlah Hadir'"; 0)`
- **Aktif (Filter 14 hari terakhir):**
  `=FILTER('Semua Data'!A2:G; 'Semua Data'!C2:C >= TODAY()-14)`

## Konfigurasi
### Environment Variables (Vercel)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: Koneksi Supabase.
- `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`: Service Account Google.
- `SPREADSHEET_ID`: ID spreadsheet.
- `OFFICE_LAT`, `OFFICE_LNG`, `RADIUS_METER`: Parameter lokasi kantor.
- `CRON_SECRET`: Kode otentikasi untuk `/api/cron`.

### Cron
Satu cron harian `/api/cron` (dilindungi `CRON_SECRET`) berfungsi melakukan *retry* sinkronisasi baris (`synced_to_sheets=false`) dan *keepalive* Supabase.

## Perawatan & Serah Terima
- **Koreksi Data:** Lakukan manual di Supabase dan Sheets.
- **Ubah Lokasi:** Update env, lalu Redeploy.
- **Redeploy:** Wajib dilakukan setelah mengubah env di Vercel.
- **Domain:** Perpanjang domain setiap tahun.
- **Serah Terima:** Pindahkan kepemilikan akun Supabase, Vercel, Google Cloud, dan domain.

*Catatan: Tanpa login/admin. Identitas hanya nama + universitas.*