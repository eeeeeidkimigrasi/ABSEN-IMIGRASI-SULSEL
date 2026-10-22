'use client';

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

type FormData = {
  nama: string;
  universitas: string;
  jam_masuk: string;
  jam_keluar: string;
};

export default function AbsenPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({
    nama: '',
    universitas: '',
    jam_masuk: '',
    jam_keluar: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    setForm((f) => ({ ...f, jam_keluar: `${hh}:${mm}` }));
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
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
      const res = await fetch('/api/absen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, lat, lng, akurasi_gps: accuracy }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setLoading(false);
        setError(data.error || 'Terjadi kesalahan.');
        return;
      }
      try {
        localStorage.setItem('absen_last', JSON.stringify({ nama: form.nama, universitas: form.universitas }));
      } catch {}
      router.push(`/sukses?nama=${data.nama}&tanggal=${data.tanggal}&jam_masuk=${data.jam_masuk}&jam_keluar=${data.jam_keluar}`);
    } catch {
      setLoading(false);
      setError('Gagal mengirim, coba lagi.');
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-semibold text-gray-900 text-center mb-6">Absen Pulang</h1>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
            <input name="nama" type="text" maxLength={80} required value={form.nama} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base" placeholder="Nama lengkap" disabled={loading} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Universitas</label>
            <input name="universitas" type="text" maxLength={80} required value={form.universitas} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base" placeholder="Nama universitas" disabled={loading} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jam Masuk</label>
            <input name="jam_masuk" type="time" required value={form.jam_masuk} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base" disabled={loading} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jam Keluar</label>
            <input name="jam_keluar" type="time" required value={form.jam_keluar} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base" disabled={loading} />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg text-base disabled:opacity-50">
            {loading ? 'Mengirim...' : 'Kirim'}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-gray-500">Scan QR di ruang kantor untuk mengakses halaman ini.</p>
      </div>
    </main>
  );
}