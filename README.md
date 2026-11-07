# Absen Mahasiswa Magang Imigrasi Makassar

Web absen untuk mahasiswa magang di lingkungan Kantor Wilayah Direktorat Jenderal Imigrasi Sulawesi Selatan, diakses lewat QR statis di poster (domain: `magang-imigrasi-sulsel.my.id`). Menggunakan tema resmi instansi (*Wisdom Blue* `#043666` & *Dignity Gold* `#E9C170`).

Terdapat halaman publik peserta dengan tiga mode (**Hadir**, **Pulang**, dan **Izin**) serta halaman **Dashboard Admin (`/admin`)** untuk pengelolaan data, rekapitulasi, dan ekspor laporan.

## Arsitektur Data: Supabase (Utama) vs Google Sheets (Cadangan)

Sistem ini menempatkan **Supabase (PostgreSQL) sebagai Database Utama (*Single Source of Truth*)**, sedangkan **Google Spreadsheet hanya berfungsi sebagai media pencadangan sekunder (*automated backup*)**:
- Seluruh proses baca/tulis dari form peserta maupun fitur di Dashboard Admin (pantauan hari ini, rekapitulasi, filter riwayat, edit/hapus data, hingga periode magang) mengambil dan memodifikasi data **langsung di Supabase**.
- **Google Sheets bukan lagi data utama.** Setiap kali ada data masuk atau diubah, server otomatis mencadangkannya ke Google Sheets.
- Jika sinkronisasi ke Google Sheets gagal (misalnya karena gangguan jaringan ke Google API), data presensi **tetap aman tersimpan di Supabase** dengan penanda `synced_to_sheets = false`. Baris yang tertunda akan disinkronkan ulang secara otomatis oleh Cron harian atau ditandai lewat peringatan di Dashboard Admin.

## Cara Kerja

### 1. Mode Hadir & Mode Pulang (`/api/absen`)
Absen dilakukan saat datang (**Mode Hadir**) dan saat selesai kerja (**Mode Pulang**). Form menyimpan nama dan universitas terakhir di browser (`localStorage`) agar peserta tidak perlu mengetik ulang setiap hari.

Urutan di server:
1. Rapikan spasi nama, universitas, dan keterangan.
2. Validasi kelengkapan isian dan kesesuaian jam (jam keluar tidak boleh mendahului jam masuk).
3. Validasi lokasi menggunakan rumus Haversine sesuai batas `RADIUS_METER` dari titik koordinat kantor.
4. Cek status presensi hari ini di Supabase:
   - Pada **Mode Hadir**: Jika sudah tercatat hadir hari ini, sistem menampilkan informasi jam masuk yang sudah tersimpan.
   - Pada **Mode Pulang**: Jika belum absen hadir pagi hari, ditolak. Jika sudah absen pulang sebelumnya, menampilkan jam keluar yang sudah tercatat.
5. Cek nama baru. Jika kombinasi `nama + universitas` belum pernah terdaftar di database, muncul popup konfirmasi peserta baru yang meminta input **Tanggal Mulai Magang** dan **Tanggal Selesai Magang** (dikirim ulang dengan `konfirmasi_baru: true`).
6. Simpan ke **Supabase** (database utama), lalu sinkronkan baris ke **Google Sheets** (cadangan di tab bulanan dan `Semua Data`).
7. Peserta diarahkan ke halaman bukti presensi (`/sukses`) yang menampilkan rincian nama, universitas, tanggal, dan jam tercatat (WITA).

### 2. Mode Izin (`/api/izin`)
- Tanpa validasi lokasi GPS.
- Field: jenis (`Sakit`, `Izin`, `Lainnya`), keterangan (maks 100 karakter), link surat bukti (opsional, hanya `https://drive.google.com/` atau `https://docs.google.com/`).
- Tanggal diambil dari server (WITA), sehingga izin hanya berlaku untuk hari berjalan.
- Tetap diizinkan walau hari itu peserta sudah tercatat hadir. Hanya ditolak jika peserta sudah mengirim izin pada hari yang sama.
- Saat Mode Pulang, keterangan yang sudah tersimpan saat hadir tidak ditimpa bila kolom keterangan dikosongkan.
- Popup konfirmasi peserta baru beserta input periode mulai dan selesai magang berlaku sama seperti mode Hadir.
- Surat izin hanya berupa tautan Google Drive dari peserta; isinya diperiksa oleh pembimbing melalui Dashboard Admin.

### 3. Sistem Peringatan (SP) Tidak Absen Pulang
Deteksi berjalan **otomatis**, tanpa perlu admin. Satu baris absensi dihitung sebagai pelanggaran bila:
- jam keluar masih kosong dan harinya sudah lewat, atau
- jam keluar masih kosong dan jam sekarang (WITA) sudah melewati batas jam pulang pada hari itu (default `17:00`, diatur lewat env `BATAS_JAM_PULANG`, format `HH:mm`), atau
- baris bertanda `[TAP]` (dicentang manual oleh admin).

Peserta yang terlambat absen pulang setelah batas jam tetap bisa absen pulang. Begitu jam keluar terisi, pelanggaran hari itu hilang (kecuali ada tag `[TAP]`). Aturan ini ada di `lib/sp.ts`. Di Dashboard Admin, baris yang kena ditandai **Tidak Absen Pulang**, dan di ekspor CSV kolom jam keluar berisi `TIDAK ABSEN PULANG`.

Pengecekan saat presensi dilakukan di `/api/absen` (hanya hari-hari sebelumnya yang dihitung):
- **2 pelanggaran (SP-2)**: muncul popup peringatan terakhir. Peserta harus menekan konfirmasi (`ack_sp2`) untuk melanjutkan presensi hadir.
- **3 pelanggaran (SP-3)**: peserta diblokir untuk presensi hadir dan muncul popup SP-3. Absen pulang tidak diblokir.
- Admin dapat membuka blokir dari tab **Rekap & Profil** (aksi `unblock_sp`). Sistem mengisi jam keluar yang kosong dengan `16:00` dan menghapus tag `[TAP]`.

### 4. Dashboard Admin (`/admin` & `/admin/login`)
Dilindungi autentikasi sesi admin, terbagi menjadi 5 tab utama yang membaca langsung dari database Supabase:
- **Hari Ini**: Menampilkan 4 kartu ringkasan (*Sudah Hadir*, *Belum Pulang*, *Izin / Sakit*, dan *Belum Absen*), daftar kehadiran hari berjalan, daftar peserta yang masih di kantor (belum absen pulang), serta peserta aktif yang belum absen sama sekali.
- **Rekap & Profil**: Menampilkan total kehadiran, tanggal terakhir hadir, filter peserta aktif (14 hari terakhir), pengaturan periode mulai/selesai magang, ekspor CSV, serta fitur **Kartu Profil Peserta** (dilengkapi progres persentase magang, hitung mundur sisa hari, dan tombol **Unduh PNG** berbasis HTML5 Canvas).
- **Riwayat Kehadiran**: Tabel seluruh data presensi dengan filter rentang tanggal, universitas, dan nama. Mendukung **Tambah Absensi manual, Edit jam/data, Hapus baris**, serta **Ekspor CSV**.
- **Data Izin / Sakit**: Tabel laporan ketidakhadiran dengan akses cepat ke tautan surat bukti Google Drive, filter tanggal, fitur **Tambah/Edit/Hapus Izin**, dan **Ekspor CSV**.
- **Log Aktivitas**: Memantau riwayat operasi sistem dan status sinkronisasi cadangan ke Google Sheets.

## Stack
Next.js 14 (App Router, TypeScript, Tailwind CSS), Supabase (Postgres - Database Utama), Google Sheets API (Service Account - Backup Sekunder), Vercel (hosting dan cron).

## Database (Utama)
Data operasional utama disimpan di Supabase pada tabel berikut:
- `absensi`: data kehadiran (memuat juga kolom `tgl_mulai` dan `tgl_selesai`).
- `izin`: data izin / sakit (juga memuat `tgl_mulai` dan `tgl_selesai`).
- `peserta`: periode magang peserta (`nama_key`, `univ_key`, `tgl_mulai`, `tgl_selesai`), diisi saat peserta baru dikonfirmasi.
- `admin_log`: riwayat tambah/edit/hapus dari Dashboard Admin (`waktu`, `aksi`, `tabel`, `sebelum`, `sesudah`, `sheets_ok`).

Skrip pembuatan tabel `absensi`, `peserta`, dan `admin_log` tidak disertakan di repositori. Buat sesuai kolom di atas. SQL tabel `izin` ada di bawah.

Aturan penting:
- Primary key `(nama_key, univ_key, tanggal)`.
- `nama_key` dan `univ_key` adalah **generated column** (`lower(trim(...))`). **Jangan pernah diisi dari kode** (`insert`/`upsert`), hanya dipakai untuk filter. Jika diisi, Supabase menolak dengan error `428C9`.
- RLS aktif tanpa policy publik. Akses hanya lewat `service_role` dari server.
- Service role butuh grant: `grant select, insert, update, delete on table public.<tabel> to service_role;`

SQL tabel `izin`:

```sql
create table if not exists public.izin (
  nama text not null,
  universitas text not null,
  nama_key text generated always as (lower(trim(nama))) stored,
  univ_key text generated always as (lower(trim(universitas))) stored,
  tanggal date not null,
  jenis text not null check (jenis in ('Sakit','Izin','Lainnya')),
  keterangan text,
  link_surat text,
  waktu_kirim timestamptz not null default now(),
  synced_to_sheets boolean not null default false,
  primary key (nama_key, univ_key, tanggal)
);
alter table public.izin enable row level security;
grant select, insert, update, delete on table public.izin to service_role;
```

Kolom tambahan di `absensi`: `alter table public.absensi add column if not exists keterangan text;`

## Google Sheets (Cadangan / Backup)

Karena seluruh rekapitulasi, pemantauan peserta aktif, dan ekspor CSV kini sudah tersedia langsung di **Dashboard Admin (`/admin`)** dari database Supabase, Google Sheets hanya berperan sebagai **arsip cadangan (*backup*)**.

Tab yang dibuat dan diisi **otomatis** oleh server sebagai cadangan: tab bulanan (`YYYY-MM`), `Semua Data`, dan `Izin` (lengkap dengan format).

| Tab | Kolom |
|---|---|
| Bulanan dan Semua Data | NAMA, UNIVERSITAS, TANGGAL, HARI, JAM MASUK, JAM KELUAR, KETERANGAN |
| Izin | NAMA, UNIVERSITAS, TANGGAL, HARI, JENIS, KETERANGAN, LINK SURAT |

Jika menambah kolom baru lewat kode, tab yang sudah ada di Sheets **tidak berubah otomatis**. Tambahkan kolomnya manual di tab tersebut.

*(Opsional)* Jika pembimbing tetap ingin melihat tab rumus manual di dalam Google Sheets tanpa membuka Dashboard Admin, tab **Rekap** dan **Aktif** dapat dibuat manual satu kali di Sheets:

**Rekap**, isi sel A1:

```text
=QUERY(UNIQUE('Semua Data'!A2:C); "select Col1, Col2, count(Col3), max(Col3) where Col1 is not null group by Col1, Col2 label Col1 'Nama', Col2 'Universitas', count(Col3) 'Jumlah Hadir', max(Col3) 'Terakhir Hadir'"; 0)
```

**Aktif** (hanya peserta yang absen dalam 14 hari terakhir). Ketik judul manual di A1:D1 (Nama, Universitas, Jumlah Hadir, Terakhir Hadir), lalu isi sel A2:

```text
=QUERY(Rekap!A2:D; "select A, B, C, D where D >= date '"&TEXT(TODAY()-14; "yyyy-mm-dd")&"'"; 0)
```

Tab ini bergantung pada tab **Rekap** di atas.
