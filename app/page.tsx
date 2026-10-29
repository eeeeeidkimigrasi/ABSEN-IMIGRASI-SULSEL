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

  // Set default jam masuk / jam keluar ke waktu sekarang saat mode berubah
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
        setError('Lokasi tidak terbaca. Izinkan akses lokasi di browser.');
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
          setStatusMsg(`Kamu sudah absen hadir hari ini (jam masuk ${data.jam_masuk || '-'}).`);
          return;
        }

        if (data.status === 'belum_hadir') {
          setLoading(false);
          setError('Kamu belum absen hadir hari ini. Hubungi pembimbing.');
          return;
        }

        if (data.status === 'sudah_pulang') {
          setLoading(false);
          setStatusMsg(`Kamu sudah melakukan absen pulang hari ini (jam keluar ${data.jam_keluar}).`);
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

        if (!res.ok || (data.ok === false)) {
          setLoading(false);
          setError(data.error || 'Terjadi kesalahan.');
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
        setError('Gagal mengirim, coba lagi.');
      }
    } else {
      // Mode Izin
      try {
        const res = await fetch('/api/izin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nama: form.nama,
            universitas: form.universitas,
            jenis: form.jenis,
            keterangan: form.keterangan,
            link_surat: form.link_surat, konfirmasi_baru, tgl_mulai: form.tgl_mulai, tgl_selesai: form.tgl_selesai,
          }),
        });
        const data = await res.json();

        if (data.status === 'sudah_hadir') {
          setLoading(false);
          setStatusMsg('Kamu sudah absen hadir hari ini, jadi izin tidak dicatat.');
          return;
        }
        if (data.status === 'sudah_izin') {
          setLoading(false);
          setStatusMsg('Izin hari ini sudah tercatat.');
          return;
        }
        if (data.status === 'nama_baru') {
          setLoading(false);
          setShowConfirm(true);
          return;
        }

        if (!res.ok || (data.ok === false)) {
          setLoading(false);
          setError(data.error || 'Terjadi kesalahan.');
          return;
        }

        try {
          localStorage.setItem('absen_last', JSON.stringify({ nama: form.nama, universitas: form.universitas }));
        } catch {}

        setForm((f) => ({ ...f, keterangan: '', link_surat: '' }));
        router.push(`/sukses?mode=izin&nama=${encodeURIComponent(data.nama)}&tanggal=${data.tanggal}&jenis=${data.jenis}`);
      } catch {
        setLoading(false);
        setError('Gagal mengirim, coba lagi.');
      }
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Konfirmasi Nama Baru</h2>
            <p className="text-gray-600 mb-4">
              Nama dan kampus <strong>{form.nama} - {form.universitas}</strong> ini belum pernah terdaftar sebelumnya. Apakah kamu anak magang baru? Jika ya, klik Kirim. Jika tidak, mohon periksa kembali data yang diisi.
            </p>
            <div className="bg-gray-50 p-3 rounded mb-4 text-sm">
              <p><strong>Nama:</strong> {form.nama}</p>
              <p><strong>Kampus:</strong> {form.universitas}</p>
            </div>
            <div className="space-y-3 mb-4 text-left">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal Mulai Magang</label>
                <input name="tgl_mulai" type="date" required value={form.tgl_mulai} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal Selesai Magang</label>
                <input name="tgl_selesai" type="date" required value={form.tgl_selesai} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowConfirm(false)} className="flex-1 py-2 border rounded">Periksa kembali</button>
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
                className="flex-1 py-2 bg-blue-600 text-white rounded"
              >
                Kirim, saya baru
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex gap-1 mb-6">
          <button
            type="button"
            onClick={() => setMode('hadir')}
            className={`flex-1 py-2 rounded-lg font-medium text-sm ${mode === 'hadir' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Hadir
          </button>
          <button
            type="button"
            onClick={() => setMode('pulang')}
            className={`flex-1 py-2 rounded-lg font-medium text-sm ${mode === 'pulang' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Pulang
          </button>
          <button
            type="button"
            onClick={() => setMode('izin')}
            className={`flex-1 py-2 rounded-lg font-medium text-sm ${mode === 'izin' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Izin
          </button>
        </div>

        {mode === 'hadir' && <h1 className="text-2xl font-semibold text-gray-900 text-center mb-6">Absen Hadir (Pagi)</h1>}
        {mode === 'pulang' && <h1 className="text-2xl font-semibold text-gray-900 text-center mb-6">Absen Pulang (Sore)</h1>}
        {mode === 'izin' && <h1 className="text-2xl font-semibold text-gray-900 text-center mb-6">Izin Tidak Hadir</h1>}

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
        {statusMsg && <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-sm">{statusMsg}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
            <input name="nama" type="text" maxLength={80} required value={form.nama} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base" placeholder="Nama lengkap" disabled={loading} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Universitas</label>
            <input name="universitas" type="text" maxLength={80} required value={form.universitas} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base" placeholder="Universitas Hasanuddin" disabled={loading} />
            <p className="text-xs text-gray-500 mt-1">Tulis nama lengkap kampus, contoh: Universitas Hasanuddin.</p>
          </div>

          {mode === 'hadir' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jam Masuk</label>
                <input name="jam_masuk" type="time" required value={form.jam_masuk} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base" disabled={loading} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
                <input name="keterangan" type="text" maxLength={100} value={form.keterangan} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base" placeholder="Opsional" disabled={loading} />
              </div>
            </>
          )}

          {mode === 'pulang' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jam Keluar</label>
                <input name="jam_keluar" type="time" required value={form.jam_keluar} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base" disabled={loading} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan (Opsional)</label>
                <input name="keterangan" type="text" maxLength={100} value={form.keterangan} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base" placeholder="Jika diisi, menimpa keterangan lama" disabled={loading} />
              </div>
            </>
          )}

          {mode === 'izin' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jenis</label>
                <select name="jenis" value={form.jenis} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base" disabled={loading}>
                  <option value="Sakit">Sakit</option>
                  <option value="Izin">Izin</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
                <input name="keterangan" type="text" maxLength={100} value={form.keterangan} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base" placeholder="Opsional" disabled={loading} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link surat (Google Drive)</label>
                <input name="link_surat" type="url" maxLength={300} value={form.link_surat} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base" placeholder="https://drive.google.com/..." disabled={loading} />
                <p className="text-xs text-gray-500 mt-1">
                  Opsional. Unggah surat ke Google Drive kamu, atur akses ke 'Siapa saja yang memiliki link' (Viewer), lalu tempel link-nya di sini.
                </p>
              </div>
              <p className="text-xs text-gray-500 text-center">Izin hanya untuk hari ini.</p>
            </>
          )}

          <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg text-base disabled:opacity-50">
            {loading ? 'Mengirim...' : mode === 'hadir' ? 'Kirim Hadir' : mode === 'pulang' ? 'Kirim Pulang' : 'Kirim Izin'}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-gray-500">Scan QR di ruang kantor untuk mengakses halaman ini.</p>
      </div>
    </main>
  );
}
