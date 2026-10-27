'use client';

import { useState, useEffect } from 'react';

export function RiwayatTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ start: '', end: '', univ: '', q: '', page: 1 });

  useEffect(() => {
    setLoading(true);
    const query = new URLSearchParams({ tipe: 'riwayat', ...filters } as any).toString();
    fetch(`/api/admin/data?${query}`)
      .then(res => res.json())
      .then(d => { setData(d.data); setTotal(d.total); setLoading(false); });
  }, [filters]);

  const handleFilter = (e: any) => {
    setFilters(f => ({ ...f, [e.target.name]: e.target.value, page: 1 }));
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <input name="start" type="date" className="px-4 py-2 border rounded-lg text-sm" value={filters.start} onChange={handleFilter} placeholder="Mulai" />
        <input name="end" type="date" className="px-4 py-2 border rounded-lg text-sm" value={filters.end} onChange={handleFilter} placeholder="Selesai" />
        <input name="univ" type="text" className="px-4 py-2 border rounded-lg text-sm" value={filters.univ} onChange={handleFilter} placeholder="Universitas" />
        <input name="q" type="text" className="px-4 py-2 border rounded-lg text-sm" value={filters.q} onChange={handleFilter} placeholder="Nama..." />
        <a
          href={`/api/admin/export?tipe=riwayat&${new URLSearchParams({ ...filters, page: '1' } as any).toString()}`}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm text-center hover:bg-green-700"
        >
          Ekspor CSV
        </a>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto mb-4">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Universitas</th>
              <th className="px-4 py-3">Masuk</th>
              <th className="px-4 py-3">Keluar</th>
              <th className="px-4 py-3">Keterangan</th>
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
                <td className="px-4 py-3">{r.jam_masuk}</td>
                <td className="px-4 py-3">{r.jam_keluar}</td>
                <td className="px-4 py-3 text-gray-500">{r.keterangan || '-'}</td>
              </tr>
            ))}
            {!loading && data.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Tidak ada data</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center text-sm text-gray-500">
        <div>Total: {total} baris</div>
        <div className="flex gap-2">
          <button
            disabled={filters.page === 1}
            onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
            className="px-3 py-1 border rounded disabled:opacity-30"
          >
            Sblmnya
          </button>
          <span className="py-1">Hal {filters.page}</span>
          <button
            disabled={data.length < 50}
            onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
            className="px-3 py-1 border rounded disabled:opacity-30"
          >
            Brktnya
          </button>
        </div>
      </div>
    </div>
  );
}
