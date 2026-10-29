'use client';

import { useState, useEffect } from 'react';

export function RekapTab() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [sortCol, setSortCol] = useState('terakhir');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/data?tipe=rekap&q=${encodeURIComponent(search)}&active=${activeOnly}`)
      .then(res => res.json())
      .then(d => { setData(d); setLoading(false); });
  }, [search, activeOnly]);

  const sortedData = [...data].sort((a, b) => {
    let valA = a[sortCol];
    let valB = b[sortCol];
    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-6 items-center justify-between">
        <div className="flex gap-4 items-center">
          <input
            type="text"
            placeholder="Cari nama..."
            className="px-4 py-2 border rounded-lg text-sm w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
            Hanya yang aktif (14 hari)
          </label>
        </div>
        <a
          href={`/api/admin/export?tipe=rekap&q=${encodeURIComponent(search)}&active=${activeOnly}`}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
        >
          Ekspor CSV
        </a>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold">
            <tr>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('nama')}>Nama {sortCol === 'nama' && (sortDir === 'asc' ? '↑' : '↓')}</th>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('universitas')}>Universitas {sortCol === 'universitas' && (sortDir === 'asc' ? '↑' : '↓')}</th>
              <th className="px-4 py-3">Periode Magang</th>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('count')}>Jumlah Hadir {sortCol === 'count' && (sortDir === 'asc' ? '↑' : '↓')}</th>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('terakhir')}>Terakhir Hadir {sortCol === 'terakhir' && (sortDir === 'asc' ? '↑' : '↓')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Memuat...</td></tr>
            ) : sortedData.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-3 font-medium">{r.nama}</td>
                <td className="px-4 py-3">{r.universitas}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{r.tgl_mulai && r.tgl_selesai ? `${r.tgl_mulai} s/d ${r.tgl_selesai}` : '-'}</td>
                <td className="px-4 py-3 text-center">{r.count}</td>
                <td className="px-4 py-3">{r.terakhir}</td>
              </tr>
            ))}
            {!loading && sortedData.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Tidak ada data</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
