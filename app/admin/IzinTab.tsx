'use client';

import { useState, useEffect } from 'react';

export function IzinTab() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ start: '', end: '' });

  useEffect(() => {
    setLoading(true);
    const query = new URLSearchParams({ tipe: 'izin', ...filters }).toString();
    fetch(`/api/admin/data?${query}`)
      .then(res => res.json())
      .then(d => { setData(d); setLoading(false); });
  }, [filters]);

  const handleFilter = (e: any) => {
    setFilters(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-6">
        <input name="start" type="date" className="px-4 py-2 border rounded-lg text-sm" value={filters.start} onChange={handleFilter} placeholder="Mulai" />
        <input name="end" type="date" className="px-4 py-2 border rounded-lg text-sm" value={filters.end} onChange={handleFilter} placeholder="Selesai" />
        <a
          href={`/api/admin/export?tipe=izin&${new URLSearchParams(filters).toString()}`}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 ml-auto"
        >
          Ekspor CSV
        </a>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Universitas</th>
              <th className="px-4 py-3">Jenis</th>
              <th className="px-4 py-3">Keterangan</th>
              <th className="px-4 py-3">Surat</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Memuat...</td></tr>
            ) : data.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-3 whitespace-nowrap">{r.tanggal}</td>
                <td className="px-4 py-3 font-medium">{r.nama}</td>
                <td className="px-4 py-3">{r.universitas}</td>
                <td className="px-4 py-3">{r.jenis}</td>
                <td className="px-4 py-3 text-gray-500">{r.keterangan || '-'}</td>
                <td className="px-4 py-3">
                  {r.link_surat ? (
                    <a href={r.link_surat} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Link</a>
                  ) : '-'}
                </td>
              </tr>
            ))}
            {!loading && data.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Tidak ada data izin</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
