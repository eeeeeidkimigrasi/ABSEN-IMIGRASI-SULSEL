# Absen Mahasiswa Magang Imigrasi Makassar

Web absen untuk mahasiswa magang, diakses lewat QR statis di poster (domain: magang-imigrasi-sulsel.my.id). Satu halaman, dua mode: **Hadir** dan **Izin**.

## Cara Kerja

### Mode Hadir (`/api/absen`)
Satu kali absen per hari, saat pulang. Form: nama, universitas, jam masuk (manual), jam keluar (default jam sekarang), keterangan (opsional, maks 100 karakter), dan lokasi dari browser.

Urutan di server:
1. Rapikan spasi nama, universitas, dan keterangan.
2. Validasi kelengkapan isian.
3. Validasi lokasi (Haversine, radius dari `RADIUS_METER`).
4. Cek sudah absen hari ini. Jika ya, ditolak (panel kuning).
5. Cek nama baru. Jika kombinasi nama + universitas belum pernah ada di tabel `absensi` maupun `izin`, tampil popup konfirmasi. Peserta klik "Kirim, saya baru" untuk melanjutkan (dikirim ulang dengan `konfirmasi_baru: true`).
6. Simpan ke Supabase (upsert), lalu tambah baris ke Google Sheets (tab bulanan dan Semua Data).
7. Jika hari itu ada baris izin untuk orang yang sama, baris izin dihapus di Supabase dan Sheets (hadir selalu menang).

### Mode Izin (`/api/izin`)
- Tanpa validasi lokasi.
- Field: jenis (Sakit, Izin, Lainnya), keterangan (maks 100 karakter), link surat (opsional, hanya `https://drive.google.com/` atau `https://docs.google.com/`).
- Tanggal diambil dari server, jadi izin hanya untuk hari ini.
- Ditolak jika hari itu sudah hadir atau sudah izin.
- Popup nama baru berlaku sama seperti mode Hadir.
- Surat izin hanya berupa link Drive dari peserta. Isinya tidak diverifikasi oleh sistem.

## Stack
Next.js 14 (App Router, TypeScript, Tailwind), Supabase (Postgres), Google Sheets API (Service Account), Vercel (hosting dan cron).

## Database
Dua tabel: `absensi` dan `izin`. Struktur `absensi` ada di `setup.sql`.

Aturan penting:
- Primary key `(nama_key, univ_key, tanggal)`.
- `nama_key` dan `univ_key` adalah **generated column** (`lower(trim(...))`). **Jangan pernah diisi dari kode** (insert/upsert), hanya dipakai untuk filter. Jika diisi, Supabase menolak dengan error 428C9.
- RLS aktif tanpa policy. Akses hanya lewat service role dari server.
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

## Google Sheets

Tab yang dibuat **otomatis** oleh server: tab bulanan (`YYYY-MM`), `Semua Data`, dan `Izin` (lengkap dengan format).

| Tab | Kolom |
|---|---|
| Bulanan dan Semua Data | NAMA, UNIVERSITAS, TANGGAL, HARI, JAM MASUK, JAM KELUAR, KETERANGAN |
| Izin | NAMA, UNIVERSITAS, TANGGAL, HARI, JENIS, KETERANGAN, LINK SURAT |

Jika menambah kolom baru lewat kode, tab yang sudah ada **tidak berubah otomatis**. Tambahkan kolomnya manual di tab tersebut. Kiriman ulang di hari yang sama tidak mungkin (dibatasi satu kali sehari), jadi tidak ada baris ganda.

Tab **Rekap** dan **Aktif** dibuat **manual** satu kali.

**Rekap**, isi sel A1:

```
=QUERY(UNIQUE('Semua Data'!A2:C); "select Col1, Col2, count(Col3), max(Col3) where Col1 is not null group by Col1, Col2 label Col1 'Nama', Col2 'Universitas', count(Col3) 'Jumlah Hadir', max(Col3) 'Terakhir Hadir'"; 0)
```

**Aktif** (hanya peserta yang absen dalam 14 hari terakhir). Ketik judul manual di A1:D1 (Nama, Universitas, Jumlah Hadir, Terakhir Hadir), lalu isi sel A2:

```
=IFERROR(FILTER(Rekap!A2:D; Rekap!A2:A<>""; TEXT(Rekap!D2:D;"yyyy-mm-dd")>=TEXT(TODAY()-14;"yyyy-mm-dd")); "Belum ada peserta aktif")
```

Catatan:
- Angka 14 bisa diganti (misalnya 30).
- Jika Sheets memakai koma sebagai pemisah argumen, ganti semua titik koma menjadi koma.
- Ketik rumus langsung di Sheets. Jangan tempel dari tempat lain karena tanda kutip bisa berubah menjadi kutip melengkung dan rumus error.
- Rekap dan Aktif berisi hasil rumus. **Jangan hapus baris di kedua tab itu.** Saat membersihkan data, hapus baris hanya di Semua Data, tab bulanan, dan Izin.
- Tab Izin berisi keterangan dan link surat. Bagikan hanya ke pembimbing.

## Cron
Satu cron harian `/api/cron` (dilindungi `CRON_SECRET`, dikonfigurasi di `vercel.json`):
- Mengulang sinkronisasi baris `absensi` dan `izin` dengan `synced_to_sheets = false`.
- Keepalive Supabase agar project gratis tidak dijeda.

## Environment Variable (sembilan, nama harus persis)

| Variabel | Fungsi |
|---|---|
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key Supabase (`sb_secret_...`), hanya di server |
| `GOOGLE_CLIENT_EMAIL` | Email Service Account Google |
| `GOOGLE_PRIVATE_KEY` | Private key Service Account |
| `SPREADSHEET_ID` | ID spreadsheet tujuan |
| `OFFICE_LAT` | Latitude kantor |
| `OFFICE_LNG` | Longitude kantor |
| `RADIUS_METER` | Radius absen dalam meter (150) |
| `CRON_SECRET` | String acak panjang pelindung `/api/cron` |

Catatan:
- Di Vercel, `GOOGLE_PRIVATE_KEY` ditempel **tanpa tanda kutip**, dan `\n` tetap berupa tulisan `\n`.
- Spreadsheet harus dibagikan sebagai Editor ke email Service Account.
- Setelah mengubah env di Vercel, **wajib Redeploy**.
- Nilai rahasia tidak boleh masuk Git. `.env.local` dan file JSON key Google ada di `.gitignore`.

## Menjalankan Lokal

```
npm install
copy .env.example .env.local
npm run dev
```

Isi `.env.local` dengan sembilan variabel di atas, lalu buka http://localhost:3000.

Untuk uji dari luar kantor, ganti sementara `OFFICE_LAT` dan `OFFICE_LNG` di `.env.local` ke lokasi sendiri, dan **kembalikan setelahnya**. Uji lokal memakai Supabase dan Sheets yang sama dengan produksi, jadi baris uji harus dihapus di **Supabase dan Sheets sekaligus** (seluruh barisnya).

## Perawatan Rutin
- **Koreksi typo atau salah isi jam:** manual di Supabase (tabel `absensi`, kolom nama atau jam) dan di sel Sheets. Peserta tidak bisa mengirim ulang di hari yang sama.
- **Lokasi ditolak di kantor:** naikkan `RADIUS_METER` ke 200 di Vercel, lalu Redeploy. Jika masih ditolak, ambil ulang koordinat dari Google Maps tepat di titik absen.
- **Nama atau universitas tertulis berbeda** (misalnya singkatan vs nama lengkap) dianggap orang berbeda di Rekap. Koreksi manual di Sheets dan Supabase.
- **Domain `.my.id`** perlu diperpanjang tiap tahun. Jika lupa, QR di poster mati.
- Cek Rekap sesekali. Nama aneh dengan Jumlah Hadir 1 biasanya typo.

## Serah Terima
Pindahkan atau bagikan ke pembimbing (email resmi kantor): akun Supabase, Vercel, Google Cloud (project dan Service Account), GitHub, dan penyedia domain.

## Batasan yang Disengaja
- Tanpa login, tanpa pendaftaran peserta, tanpa halaman admin.
- Identitas peserta hanya kombinasi nama + universitas (huruf besar kecil tidak dibedakan).
- Hari masuk Senin sampai Kamis, tetapi sistem tidak memblokir hari lain.
- Tidak ada jendela waktu dan tidak ada validasi jam masuk.
- QR statis, satu kali absen per orang per hari.