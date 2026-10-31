'use client';

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

type FormData = {
  nama: string;
  universitas: string;
  jam_masuk: string;
  jam_keluar: string;
  keterangan: string;
  jenis: string;
  link_surat: string;
  tgl_mulai: string;
  tgl_selesai: string;
};

type Mode = 'hadir' | 'pulang' | 'izin';

export default function AbsenPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('hadir');
  const [form, setForm] = useState<FormData>({
    nama: '',
    universitas: '',
    jam_masuk: '',
    jam_keluar: '',
    keterangan: '',
    jenis: 'Sakit',
    link_surat: '',
    tgl_mulai: '',
    tgl_selesai: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('absen_last');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.nama) setForm((f) => ({ ...f, nama: data.nama }));
        if (data.universitas) setForm((f) => ({ ...f, universitas: data.universitas }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;
    setForm((f) => ({
      ...f,
      jam_masuk: mode === 'hadir' ? currentTime : f.jam_masuk,
      jam_keluar: mode === 'pulang' ? currentTime : f.jam_keluar,
    }));
  }, [mode]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError(null);
    setStatusMsg(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement> | any, konfirmasi_baru?: boolean) => {
    if (e && e.preventDefault) e.preventDefault();
    setError(null);
    setStatusMsg(null);
    setLoading(true);

    if (mode === 'hadir' || mode === 'pulang') {
      let lat: number, lng: number, accuracy: number;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => {
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        accuracy = pos.coords.accuracy;
      } catch {
        setLoading(false);
        setError('Lokasi tidak terbaca. Pastikan izin akses lokasi (GPS) diaktifkan pada browser Anda.');
        return;
      }

      try {
        const payload: any = {
          mode,
          nama: form.nama,
          universitas: form.universitas,
          keterangan: form.keterangan,
          lat,
          lng,
          akurasi_gps: accuracy,
          konfirmasi_baru,
          tgl_mulai: form.tgl_mulai,
          tgl_selesai: form.tgl_selesai,
        };
        if (mode === 'hadir') payload.jam_masuk = form.jam_masuk;
        if (mode === 'pulang') payload.jam_keluar = form.jam_keluar;

        const res = await fetch('/api/absen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (data.status === 'sudah_hadir_hari_ini') {
          setLoading(false);
          setStatusMsg(`Presensi hadir Anda sudah tercatat hari ini (Jam Masuk: ${data.jam_masuk || '-'}).`);
          return;
        }

        if (data.status === 'belum_hadir') {
          setLoading(false);
          setError('Anda belum melakukan presensi hadir hari ini. Silakan hubungi pembimbing.');
          return;
        }

        if (data.status === 'sudah_pulang') {
          setLoading(false);
          setStatusMsg(`Presensi pulang Anda sudah tercatat hari ini (Jam Keluar: ${data.jam_keluar}).`);
          return;
        }

        if (data.status === 'jam_tidak_valid') {
          setLoading(false);
          setError('Jam keluar tidak boleh lebih awal dari jam masuk yang tersimpan.');
          return;
        }

        if (data.status === 'nama_baru') {
          setLoading(false);
          setShowConfirm(true);
          return;
        }

        if (!res.ok || data.ok === false) {
          setLoading(false);
          setError(data.error || 'Terjadi kesalahan saat memproses data.');
          return;
        }

        try {
          localStorage.setItem('absen_last', JSON.stringify({ nama: form.nama, universitas: form.universitas }));
        } catch {}

        setForm((f) => ({ ...f, keterangan: '' }));
        if (mode === 'hadir') {
          router.push(`/sukses?mode=hadir&nama=${encodeURIComponent(data.nama)}&tanggal=${data.tanggal}&jam_masuk=${data.jam_masuk}`);
        } else {
          router.push(`/sukses?mode=pulang&nama=${encodeURIComponent(data.nama)}&tanggal=${data.tanggal}&jam_keluar=${data.jam_keluar}`);
        }
      } catch {
        setLoading(false);
        setError('Gagal menghubungi server. Periksa koneksi internet Anda dan coba lagi.');
      }
    } else {
      try {
        const res = await fetch('/api/izin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nama: form.nama,
            universitas: form.universitas,
            jenis: form.jenis,
            keterangan: form.keterangan,
            link_surat: form.link_surat,
            konfirmasi_baru,
            tgl_mulai: form.tgl_mulai,
            tgl_selesai: form.tgl_selesai,
          }),
        });
        const data = await res.json();

        if (data.status === 'sudah_hadir') {
          setLoading(false);
          setStatusMsg('Anda sudah tercatat hadir hari ini, pengajuan izin tidak dapat diproses.');
          return;
        }
        if (data.status === 'sudah_izin') {
          setLoading(false);
          setStatusMsg('Laporan izin Anda untuk hari ini sudah tercatat di sistem.');
          return;
        }
        if (data.status === 'nama_baru') {
          setLoading(false);
          setShowConfirm(true);
          return;
        }

        if (!res.ok || data.ok === false) {
          setLoading(false);
          setError(data.error || 'Terjadi kesalahan saat mengirim laporan izin.');
          return;
        }

        try {
          localStorage.setItem('absen_last', JSON.stringify({ nama: form.nama, universitas: form.universitas }));
        } catch {}

        setForm((f) => ({ ...f, keterangan: '', link_surat: '' }));
        router.push(`/sukses?mode=izin&nama=${encodeURIComponent(data.nama)}&tanggal=${data.tanggal}&jenis=${data.jenis}`);
      } catch {
        setLoading(false);
        setError('Gagal menghubungi server. Periksa koneksi internet Anda dan coba lagi.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8] flex flex-col justify-between font-sans text-slate-900 selection:bg-[#043666] selection:text-[#E9C170]">
      {/* Top Bar Resmi dengan Palet Wisdom Blue (#043666) & Dignity Gold (#E9C170) */}
      <header className="bg-[#043666] border-b-4 border-[#E9C170] text-white shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/logo-imigrasi.png"
              alt="Logo Imigrasi"
              className="w-11 h-11 object-contain shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="leading-tight">
              <p className="text-[10px] font-bold tracking-[0.14em] text-[#E9C170] uppercase">
                Kementerian Imigrasi dan Pemasyarakatan
              </p>
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white mt-0.5">
                Direktorat Jenderal Imigrasi Kanwil Sulsel
              </h1>
            </div>
          </div>
          <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-[#04315C] text-[#E9C170] border border-[#BD944D]/50 shrink-0">
            Portal Presensi
          </span>
        </div>
      </header>

      {/* Modal Konfirmasi Peserta Magang Baru */}
      {showConfirm && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#043666] px-6 py-4 border-b-2 border-[#E9C170]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#E9C170] block">
                Verifikasi Data Peserta
              </span>
              <h2 className="text-lg font-extrabold text-white mt-0.5">
                Konfirmasi Peserta Magang Baru
              </h2>
            </div>

            <div className="p-6">
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Data atas nama <strong className="text-slate-900">{form.nama}</strong> dari{' '}
                <strong className="text-slate-900">{form.universitas}</strong> belum terdaftar di database. Apabila Anda peserta baru, lengkapi periode masa magang Anda di bawah ini:
              </p>

              <div className="bg-slate-50 border-l-4 border-[#043666] p-3.5 rounded-r-lg mb-5 text-xs space-y-1 text-slate-700">
                <div>
                  <span className="font-semibold text-slate-500 uppercase tracking-wider">Nama: </span>
                  <span className="font-bold text-slate-900">{form.nama}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 uppercase tracking-wider">Instansi/Kampus: </span>
                  <span className="font-bold text-slate-900">{form.universitas}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6 text-left">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Mulai Magang
                  </label>
                  <input
                    name="tgl_mulai"
                    type="date"
                    required
                    value={form.tgl_mulai}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Selesai Magang
                  </label>
                  <input
                    name="tgl_selesai"
                    type="date"
                    required
                    value={form.tgl_selesai}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666]"
                  />
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 px-4 border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs uppercase tracking-wider rounded-md transition-colors"
                >
                  Periksa Kembali
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!form.tgl_mulai || !form.tgl_selesai) {
                      alert('Mohon isi Tanggal Mulai dan Tanggal Selesai magang terlebih dahulu.');
                      return;
                    }
                    if (form.tgl_selesai < form.tgl_mulai) {
                      alert('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
                      return;
                    }
                    setShowConfirm(false);
                    handleSubmit(null, true);
                  }}
                  className="flex-1 py-2.5 px-4 bg-[#043666] hover:bg-[#04315C] text-[#E9C170] font-extrabold text-xs uppercase tracking-wider rounded-md shadow-sm transition-colors"
                >
                  Konfirmasi & Kirim
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Kontainer Utama Form Presensi */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Sub-Header Kartu dengan Wisdom Blue (#043666) Solid & Dignity Gold (#E9C170) */}
          <div className="bg-[#043666] px-6 py-5 text-white border-b-2 border-[#E9C170]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#E9C170] block">
                  Sistem Presensi Digital
                </span>
                <h2 className="text-lg font-extrabold tracking-tight text-white mt-0.5">
                  {mode === 'hadir' && 'Presensi Kehadiran (Pagi)'}
                  {mode === 'pulang' && 'Presensi Kepulangan (Sore)'}
                  {mode === 'izin' && 'Formulir Izin / Sakit'}
                </h2>
              </div>
              <div className="text-right">
                <span className="inline-block px-2.5 py-1 rounded text-[11px] font-extrabold bg-[#E9C170] text-[#04315C]">
                  {mode === 'hadir' ? 'HADIR' : mode === 'pulang' ? 'PULANG' : 'IZIN'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Navigasi Segmented Mode */}
            <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1.5 rounded-lg border border-slate-200 mb-6">
              {(['hadir', 'pulang', 'izin'] as Mode[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setMode(item);
                    setError(null);
                    setStatusMsg(null);
                  }}
                  className={`py-2 rounded-md font-extrabold text-xs uppercase tracking-wider transition-all ${
                    mode === item
                      ? 'bg-[#043666] text-[#E9C170] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                  }`}
                >
                  {item === 'hadir' ? 'Hadir' : item === 'pulang' ? 'Pulang' : 'Izin'}
                </button>
              ))}
            </div>

            {/* Notifikasi Error / Status */}
            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border-l-4 border-red-600 text-red-800 rounded-r-md text-xs font-medium leading-relaxed">
                {error}
              </div>
            )}
            {statusMsg && (
              <div className="mb-5 p-3.5 bg-amber-50 border-l-4 border-[#BD944D] text-amber-900 rounded-r-md text-xs font-medium leading-relaxed">
                {statusMsg}
              </div>
            )}

            {/* Formulir Input */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Nama Lengkap Peserta
                </label>
                <input
                  name="nama"
                  type="text"
                  maxLength={80}
                  required
                  value={form.nama}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-md text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666] transition-colors"
                  placeholder="Masukkan nama lengkap sesuai identitas"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Universitas / Instansi Asal
                </label>
                <input
                  name="universitas"
                  type="text"
                  maxLength={80}
                  required
                  value={form.universitas}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-md text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666] transition-colors"
                  placeholder="Contoh: Universitas Hasanuddin"
                  disabled={loading}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Gunakan nama lengkap perguruan tinggi atau sekolah (tanpa singkatan).
                </p>
              </div>

              {mode === 'hadir' && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Jam Masuk
                    </label>
                    <input
                      name="jam_masuk"
                      type="time"
                      required
                      value={form.jam_masuk}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-md text-sm font-semibold focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666]"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Keterangan / Catatan <span className="text-slate-400 font-normal normal-case">(Opsional)</span>
                    </label>
                    <input
                      name="keterangan"
                      type="text"
                      maxLength={100}
                      value={form.keterangan}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-md text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666]"
                      placeholder=""
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              {mode === 'pulang' && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Jam Keluar
                    </label>
                    <input
                      name="jam_keluar"
                      type="time"
                      required
                      value={form.jam_keluar}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-md text-sm font-semibold focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666]"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Keterangan Tambahan <span className="text-slate-400 font-normal normal-case">(Opsional)</span>
                    </label>
                    <input
                      name="keterangan"
                      type="text"
                      maxLength={100}
                      value={form.keterangan}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-md text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666]"
                      placeholder="Jika diisi, akan memperbarui catatan pagi"
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              {mode === 'izin' && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Kategori Ketidakhadiran
                    </label>
                    <select
                      name="jenis"
                      value={form.jenis}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-md text-sm font-medium focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666]"
                      disabled={loading}
                    >
                      <option value="Sakit">Sakit</option>
                      <option value="Izin">Izin Keperluan Akademik / Pribadi</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Alasan / Keterangan Detail
                    </label>
                    <input
                      name="keterangan"
                      type="text"
                      maxLength={100}
                      value={form.keterangan}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-md text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666]"
                      placeholder="Jelaskan alasan izin secara singkat"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Tautan Surat Bukti (Google Drive)
                    </label>
                    <input
                      name="link_surat"
                      type="url"
                      maxLength={300}
                      value={form.link_surat}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-md text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666]"
                      placeholder="https://drive.google.com/..."
                      disabled={loading}
                    />
                    <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                      Pastikan akses tautan Google Drive diatur ke <strong>&quot;Siapa saja yang memiliki link&quot; (Viewer)</strong>.
                    </p>
                  </div>
                </>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-[#043666] hover:bg-[#04315C] active:bg-[#032546] text-[#E9C170] font-extrabold text-xs uppercase tracking-widest rounded-md shadow-sm border border-[#BD944D]/40 transition-colors disabled:opacity-50"
                >
                  {loading
                    ? 'Memproses Data Presensi...'
                    : mode === 'hadir'
                    ? 'Kirim Presensi Hadir'
                    : mode === 'pulang'
                    ? 'Kirim Presensi Pulang'
                    : 'Kirim Laporan Izin'}
                </button>
              </div>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Verifikasi Koordinat GPS Aktif</span>
              <span className="font-bold text-[#043666]">Kanwil Sulsel</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Resmi dengan Shade Wisdom Blue (#04315C) & Border Dignity Gold (#BD944D) */}
      <footer className="bg-[#04315C] text-slate-300 py-3.5 text-center text-xs border-t-2 border-[#BD944D]">
        <div className="max-w-xl mx-auto px-4">
          Direktorat Jenderal Imigrasi Kantor Wilayah Sulawesi Selatan © 2026
        </div>
      </footer>
    </div>
  );
}