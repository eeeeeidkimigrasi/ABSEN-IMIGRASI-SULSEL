'use client';

import { useState, useEffect } from 'react';

export function RekapTab() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [sortCol, setSortCol] = useState('terakhir');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');

  const [editItem, setEditItem] = useState<{ nama: string; universitas: string; tgl_mulai: string; tgl_selesai: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const loadRekap = () => {
    setLoading(true);
    fetch(`/api/admin/data?tipe=rekap&q=${encodeURIComponent(search)}&active=${activeOnly}`)
      .then(res => res.json())
      .then(d => { setData(d); setLoading(false); });
  };

  useEffect(() => {
    loadRekap();
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

  const handleSavePeriode = async () => {
    if (!editItem) return;
    if (!editItem.tgl_mulai || !editItem.tgl_selesai || editItem.tgl_selesai < editItem.tgl_mulai) {
      setEditError('Tanggal mulai dan selesai wajib diisi dengan benar.');
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      const res = await fetch('/api/admin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editItem),
      });
      const result = await res.json();
      if (!res.ok || !result.ok) {
        setEditError(result.error || 'Gagal menyimpan perubahan.');
      } else {
        setEditItem(null);
        loadRekap();
      }
    } catch {
      setEditError('Terjadi kesalahan jaringan.');
    } finally {
      setSaving(false);
    }
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
                <td className="px-4 py-3 text-gray-600 text-xs">
                  <div className="flex items-center gap-2">
                    <span>{r.tgl_mulai && r.tgl_selesai ? `${r.tgl_mulai} s/d ${r.tgl_selesai}` : '-'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditError('');
                        setEditItem({
                          nama: r.nama,
                          universitas: r.universitas,
                          tgl_mulai: r.tgl_mulai || '',
                          tgl_selesai: r.tgl_selesai || '',
                        });
                      }}
                      className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-medium"
                    >
                      Edit
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">{r.count}</td>
                <td className="px-4 py-3">{r.terakhir}</td>
              </tr>
            ))}
            {!loading && sortedData.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Tidak ada data</td></tr>}
          </tbody>
        </table>
      </div>

      {editItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-1">Edit Periode Magang</h3>
            <p className="text-xs text-gray-500 mb-4">{editItem.nama} — {editItem.universitas}</p>

            {editError && (
              <div className="mb-3 p-2.5 bg-red-50 text-red-600 text-xs rounded border border-red-200">
                {editError}
              </div>
            )}

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal Mulai Magang</label>
                <input
                  type="date"
                  value={editItem.tgl_mulai}
                  onChange={(e) => setEditItem({ ...editItem, tgl_mulai: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal Selesai Magang</label>
                <input
                  type="date"
                  value={editItem.tgl_selesai}
                  onChange={(e) => setEditItem({ ...editItem, tgl_selesai: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditItem(null)}
                disabled={saving}
                className="px-4 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSavePeriode}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}