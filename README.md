# Absen Mahasiswa Magang Imigrasi Makassar

Web absen untuk mahasiswa magang di lingkungan Kantor Wilayah Direktorat Jenderal Imigrasi Sulawesi Selatan, diakses lewat QR statis di poster (domain: `magang-imigrasi-sulsel.my.id`). Menggunakan tema resmi instansi (*Wisdom Blue* `#043666` & *Dignity Gold* `#E9C170`).

Terdapat halaman publik peserta dengan empat mode (**Hadir**, **Pulang**, **Izin**, dan **Rekap Saya**) serta halaman **Dashboard Admin (`/admin`)** untuk pengelolaan data, rekapitulasi, dan ekspor laporan.

## Arsitektur Data

Seluruh proses baca/tulis dari form peserta maupun fitur di Dashboard Admin (pantauan hari ini, rekapitulasi, filter riwayat, edit/hapus data, hari libur, hingga periode magang) disimpan dan dikelola **langsung di Supabase (PostgreSQL)**. 

Pembuatan laporan (PDF A4, Kartu Profil PNG, dan CSV) dilakukan langsung dari browser tanpa ketergantungan pada Google Sheets.

## Cara Kerja

### 1. Mode Hadir & Mode Pulang (`/api/absen`)
Absen dilakukan saat datang (**Mode Hadir**) dan saat selesai kerja (**Mode Pulang**). Form menyimpan nama dan universitas terakhir di browser (`localStorage`) agar peserta tidak perlu mengetik ulang setiap hari.

Urutan di server:
1. Rapikan spasi nama, universitas, dan keterangan.
2. Validasi kelengkapan isian dan kesesuaian jam (jam keluar tidak boleh mendahului jam masuk).
3. Validasi lokasi menggunakan rumus Haversine sesuai batas `RADIUS_METER` dari titik koordinat kantor.
4. Cek status SP dan status presensi hari ini di Supabase:
   * Pada **Mode Hadir**: Jika sudah tercatat hadir hari ini, sistem menampilkan informasi jam masuk yang sudah tersimpan.
   * Pada **Mode Pulang**: Jika belum absen hadir pagi hari, ditolak. Jika sudah absen pulang sebelumnya, menampilkan jam keluar yang sudah tercatat. Saat Mode Pulang, keterangan yang sudah tersimpan saat hadir tidak ditimpa bila kolom keterangan dikosongkan.
5. Cek nama baru. Jika kombinasi nama + universitas belum pernah terdaftar di database (`absensi` maupun `izin`), muncul popup konfirmasi peserta baru yang meminta input **Tanggal Mulai Magang** dan **Tanggal Selesai Magang** (dikirim ulang dengan `konfirmasi_baru: true`).
6. Simpan ke **Supabase**.
7. Peserta diarahkan ke halaman bukti presensi (`/sukses`) yang menampilkan rincian nama, universitas, tanggal, dan jam tercatat (WITA).

### 2. Mode Izin (`/api/izin`)
* Tanpa validasi lokasi GPS.
* Field: tanggal mulai & selesai izin (bisa 1 hari atau rentang beberapa hari sekaligus, maks 30 hari), `jenis` (`Sakit`, `Izin`, `Lainnya`), `keterangan` (maks 85 karakter), link surat bukti (opsional, hanya `https://drive.google.com/` atau `https://docs.google.com/`).
* Jika izin diajukan untuk rentang beberapa hari, hari libur (Jumat, Sabtu, Minggu, dan tanggal merah) otomatis dilewati dan digabung menjadi 1 baris rentang (`[GRP:...]`) di tabel Admin.
* Popup konfirmasi peserta baru beserta input periode mulai dan selesai magang berlaku sama seperti mode Hadir.
* Surat izin hanya berupa tautan Google Drive dari peserta; isinya diperiksa oleh pembimbing melalui Dashboard Admin.

### 3. Mode Rekap Saya (`/api/rekap-peserta`)
* Peserta dapat mengecek jumlah hadir, izin/sakit, tidak hadir (alpha), status SP, dan rincian kehadiran harian cukup dengan memasukkan nama dan universitas (*read-only*, dibatasi 20 request/menit per IP).
* Peserta dapat mengunduh sendiri file **CSV**, **Kartu Profil PNG**, dan **Cetak / PDF A4** tanpa harus meminta ke Admin.

### 4. Sistem Peringatan (SP) Tidak Absen Pulang
Deteksi berjalan **otomatis**, tanpa perlu admin. Satu baris absensi dihitung sebagai pelanggaran bila:
* `jam_keluar` masih kosong dan harinya sudah lewat (dan tidak sedang izin pada hari tersebut), atau
* `jam_keluar` masih kosong dan jam sekarang (WITA) sudah melewati batas jam pulang pada hari itu (default `18:00`, diatur lewat env `BATAS_JAM_PULANG`, format `HH:mm`), atau
* baris bertanda `[TAP]` (dicentang manual oleh admin).

Peserta yang terlambat absen pulang setelah batas jam tetap bisa absen pulang. Begitu jam keluar terisi, pelanggaran hari itu hilang (kecuali ada tag `[TAP]`). Di Dashboard Admin, baris yang kena ditandai **Tidak Absen Pulang**, dan di ekspor CSV kolom jam keluar berisi `TIDAK ABSEN PULANG`.

Pengecekan saat presensi dilakukan di `/api/absen` (hanya hari-hari sebelumnya yang dihitung):
* **1 pelanggaran (SP-1)**: muncul label SP-1 di tabel Rekap & Kartu Profil.
* **2 pelanggaran (SP-2)**: muncul popup peringatan terakhir. Peserta harus menekan konfirmasi (`ack_sp2`) untuk melanjutkan presensi hadir.
* **3 pelanggaran (SP-3)**: peserta diblokir untuk presensi hadir dan muncul popup SP-3. Absen pulang tidak diblokir.
* Admin dapat menghapus SP kapan saja dari tab **Rekap & Profil** (tombol **Hapus SP** untuk mereset penuh, atau menghapus SP pada 1 tanggal tertentu di dalam modal **Lihat Kartu**). Sistem mengisi jam keluar yang kosong dengan `16:00` dan menghapus tag `[TAP]`.

### 5. Dashboard Admin (`/admin` & `/admin/login`)
Dilindungi autentikasi sesi admin, terbagi menjadi 5 tab utama yang membaca langsung dari database Supabase:
* **Hari Ini**: Menampilkan 4 kartu ringkasan (*Sudah Hadir*, *Belum Pulang*, *Izin / Sakit*, dan *Belum Absen*), daftar kehadiran hari berjalan, daftar peserta yang belum absen pulang, serta peserta aktif yang belum absen sama sekali. Otomatis menampilkan banner **Hari Libur** saat hari Jumat, Sabtu, Minggu, atau tanggal merah.
* **Rekap & Profil**: Menampilkan total kehadiran, izin, alpha, status SP, tanggal terakhir hadir, filter peserta aktif (14 hari terakhir), pengaturan periode mulai/selesai magang, tombol **Hapus Peserta**, tombol **Kelola Hari Libur** (tambah/hapus tanggal merah), ekspor CSV, serta fitur **Kartu Profil Peserta** (dilengkapi fitur **Isi Otomatis Masa Lalu / Backfill**, pengaturan nama pejabat penandatangan *Ketua Tim Kepegawaian dan Kerja Sama*, cetak **PDF A4**, dan tombol **Unduh PNG**).
* **Riwayat Kehadiran**: Tabel seluruh data presensi dengan filter rentang tanggal dan universitas. Mendukung **Tambah Absensi manual** (dengan saran nama otomatis), **Edit jam/data**, **Hapus baris**, serta **Ekspor CSV**.
* **Data Izin / Sakit**: Tabel laporan ketidakhadiran dengan akses cepat ke tautan surat bukti Google Drive, filter tanggal, fitur **Tambah/Edit/Hapus Izin**, dan **Ekspor CSV**.
* **Log Aktivitas**: Memantau 50 riwayat perubahan data terakhir oleh admin beserta tombol **Ekspor CSV Log**.

### 6. Pembersihan Otomatis (Cron `/api/cron`)
Berjalan otomatis setiap hari lewat Vercel Cron (`lib/auto-clean.ts`):
* **Auto-Delete Peserta (> 6 Bulan Tidak Aktif):** Menghapus seluruh data peserta (`absensi`, `izin`, `peserta`) yang sudah tidak pernah absen/izin lagi selama lebih dari 180 hari (6 bulan) sejak tanggal aktivitas terakhirnya, agar penyimpanan Supabase tidak penuh.
* **Auto-Delete Log (> 90 Hari):** Menghapus baris `admin_log` biasa yang umurnya lebih dari 90 hari (kecuali data `hari_libur`).
* **Keep-Alive:** Melakukan query ringan ke Supabase setiap hari agar project tidak terkena *auto-pause*.

## Stack

Next.js 14 (App Router, TypeScript, Tailwind CSS), Supabase (Postgres), Vercel (hosting dan cron).

## Database

Data disimpan di Supabase pada tabel berikut:
* `absensi`: data kehadiran (memuat juga kolom `tgl_mulai` dan `tgl_selesai`).
* `izin`: data izin / sakit (juga memuat `tgl_mulai` dan `tgl_selesai`).
* `peserta`: periode magang peserta (`nama_key`, `univ_key`, `tgl_mulai`, `tgl_selesai`), diisi saat peserta baru dikonfirmasi.
* `admin_log`: riwayat tambah/edit/hapus dari Dashboard Admin (`waktu`, `aksi`, `tabel`, `sebelum`, `sesudah`, `sheets_ok`) dan daftar tanggal merah (`tabel = 'hari_libur'`).

Skrip pembuatan tabel `absensi`, `peserta`, dan `admin_log` tidak disertakan di repositori. Buat sesuai kolom di atas. SQL tabel `izin` ada di bawah.

Aturan penting:
* Primary key `(nama_key, univ_key, tanggal)`.
* `nama_key` dan `univ_key` adalah **generated column** (`lower(trim(...))`). **Jangan pernah diisi dari kode** (`insert` / `upsert`), hanya dipakai untuk filter. Jika diisi, Supabase menolak dengan error `428C9`.
* RLS aktif tanpa policy publik. Akses hanya lewat `service_role` dari server.
* Service role butuh grant: `grant select, insert, update, delete on table public.<tabel> to service_role;`

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
  tgl_mulai date,
  tgl_selesai date,
  waktu_kirim timestamptz not null default now(),
  synced_to_sheets boolean not null default false,
  primary key (nama_key, univ_key, tanggal)
);
alter table public.izin enable row level security;
grant select, insert, update, delete on table public.izin to service_role;
```

Kolom tambahan di `absensi`:
```sql
alter table public.absensi add column if not exists keterangan text;
alter table public.absensi add column if not exists tgl_mulai date;
alter table public.absensi add column if not exists tgl_selesai date;
```

## Environment Variables

| Variabel | Keterangan | Contoh |
| :--- | :--- | :--- |
| `SUPABASE_URL` | URL project Supabase | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key Supabase (rahasia, hanya di server) | `eyJhbGci...` |
| `KANTOR_LAT` | Latitude titik kantor | `-5.134266` |
| `KANTOR_LNG` | Longitude titik kantor | `119.488340` |
| `RADIUS_METER` | Batas jarak absen (meter, angka bulat) | `150` |
| `BATAS_JAM_PULANG` | Batas jam sore sebelum dihitung belum absen pulang (WITA) | `18:00` |
| `ADMIN_PASSWORD` | Password login `/admin/login` | `password_admin` |
| `ADMIN_SESSION_SECRET` | Secret untuk cookie sesi admin | `random_secret_string` |
| `CRON_SECRET` | Secret untuk endpoint `/api/cron` | `cron_secret` |

## Perawatan Rutin

* **Koreksi typo, lupa absen pulang, atau salah isi jam:** Tidak perlu lagi mengubah manual di tabel database. Cukup buka **Dashboard Admin (`/admin`)** -> tab **Riwayat Kehadiran** atau **Data Izin / Sakit**, lalu klik tombol **Ubah** atau **Hapus**.
* **Mengatur masa magang atau menghapus peserta tes:** Buka tab **Rekap & Profil** di Dashboard Admin, klik tombol **Ubah** pada kolom Periode Magang peserta terkait (tersedia juga tombol **Hapus Peserta** di dalamnya).
* **Membuka blokir SP:** Buka tab **Rekap & Profil**, klik tombol **Hapus SP** di samping nama peserta, atau klik **Lihat Kartu** untuk menghapus SP pada tanggal tertentu saja.
* **Menambah / membatalkan hari libur nasional:** Buka tab **Rekap & Profil**, klik tombol **Kelola Hari Libur**, lalu tambahkan tanggal merah atau klik **Hapus** jika ingin membatalkannya.
* **Lokasi ditolak di kantor:** Naikkan `RADIUS_METER` ke `200` di Vercel, lalu Redeploy. Jika masih ditolak, ambil ulang koordinat dari Google Maps tepat di titik absen.
* **Nama atau universitas tertulis berbeda** (misalnya singkatan vs nama lengkap) dianggap orang berbeda di Rekap. Admin dapat mengedit nama/universitas tersebut langsung lewat tab **Riwayat Kehadiran** di Dashboard Admin.
* **Domain `.my.id`** perlu diperpanjang tiap tahun. Jika lupa, QR di poster mati.

## Serah Terima

Pindahkan atau bagikan ke pembimbing (email resmi kantor): akun Supabase, Vercel, GitHub, kredensial login Dashboard Admin, dan penyedia domain.

## Ketentuan Sistem Saat Ini

* Peserta tidak memerlukan pembuatan akun/kata sandi (identitas didasarkan pada kombinasi nama + universitas tanpa membedakan huruf besar/kecil, dibantu penyimpanan lokal browser).
* Halaman pengelolaan data sepenuhnya terpusat di **Dashboard Admin (`/admin`)** dengan autentikasi khusus administrator.
* Hari kerja normal Senin sampai Kamis (Jumat, Sabtu, Minggu, dan tanggal merah otomatis dihitung libur), tetapi sistem tidak memblokir hari lain untuk mengakomodasi penugasan khusus.
* QR bersifat statis menuju domain web presensi.