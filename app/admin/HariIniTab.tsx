'use client';

import { useState, useEffect } from 'react';

export function HariIniTab() {
  const [data, setData] = useState<{ hadir: any[]; izin: any[]; belum: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/data?tipe=summary')
      .then(res => res.json())
      .then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div className="py-10 text-center">Memuat data...</div>;
  if (!data) return null;

  const belumPulang = data.hadir.filter((h) => !h.jam_keluar);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-4 text-green-700">Sudah Hadir ({data.hadir.length})</h2>
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Universitas</th>
                <th className="px-4 py-3">Masuk</th>
                <th className="px-4 py-3">Keluar</th>
                <th className="px-4 py-3">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.hadir.map((h, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">{h.nama}</td>
                  <td className="px-4 py-3">{h.universitas}</td>
                  <td className="px-4 py-3">{String(h.jam_masuk).slice(0, 5)}</td>
                  <td className="px-4 py-3">{h.jam_keluar ? String(h.jam_keluar).slice(0, 5) : '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{h.keterangan || '-'}</td>
                </tr>
              ))}
              {data.hadir.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada yang hadir</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4 text-blue-700">Belum Pulang ({belumPulang.length})</h2>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {belumPulang.map((b, i) => (
              <div key={i} className="p-3 border rounded bg-blue-50">
                <div className="font-medium">{b.nama}</div>
                <div className="text-xs text-gray-500 uppercase">{b.universitas}</div>
                <div className="text-xs text-gray-600 mt-1">Masuk {String(b.jam_masuk).slice(0, 5)}</div>
              </div>
            ))}
          </div>
          {belumPulang.length === 0 && <div className="text-center text-gray-400 py-4">Tidak ada yang menunggu pulang</div>}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4 text-orange-600">Izin ({data.izin.length})</h2>
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Universitas</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3">Keterangan</th>
                <th className="px-4 py-3">Surat</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.izin.map((iz, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">{iz.nama}</td>
                  <td className="px-4 py-3">{iz.universitas}</td>
                  <td className="px-4 py-3">{iz.jenis}</td>
                  <td className="px-4 py-3 text-gray-500">{iz.keterangan || '-'}</td>
                  <td className="px-4 py-3">
                    {iz.link_surat ? (
                      <a href={iz.link_surat} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Link</a>
                    ) : '-'}
                  </td>
                </tr>
              ))}
              {data.izin.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Tidak ada yang izin</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4 text-gray-600">Belum Absen ({data.belum.length})</h2>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.belum.map((b, i) => (
              <div key={i} className="p-3 border rounded bg-gray-50">
                <div className="font-medium">{b.nama}</div>
                <div className="text-xs text-gray-500 uppercase">{b.universitas}</div>
              </div>
            ))}
          </div>
          {data.belum.length === 0 && <div className="text-center text-gray-400 py-4">Semua peserta aktif sudah diabsen</div>}
        </div>
      </section>
    </div>
  );
}
