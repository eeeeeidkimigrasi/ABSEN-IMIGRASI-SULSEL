'use client';

import { useState, useEffect, useCallback } from 'react';

export function RiwayatTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ start: '', end: '', univ: '', q: '', page: 1 });
  const [sheetsWarn, setSheetsWarn] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<'tambah' | 'edit'>('tambah');
  const [oldKeys, setOldKeys] = useState({ nama: '', universitas: '', tanggal: '' });
  const [form, setForm] = useState({
    nama: '',
    universitas: '',
    tanggal: '',
    jam_masuk: '08:00',
    jam_keluar: '16:00',
    keterangan: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const todayStr = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        tipe: 'riwayat',
        start: filters.start,
        end: filters.end,
        univ: filters.univ,
        q: filters.q,
        page: String(filters.page),
      }).toString();
      const res = await fetch(`/api/admin/data?${query}`);
      const d = await res.json();
      setData(d.data || []);
      setTotal(d.total || 0);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilter = (e: any) => {
    setFilters((f) => ({ ...f, [e.target.name]: e.target.value, page: 1 }));
  };

  const openTambah = () => {
    setMode('tambah');
    setForm({
      nama: '',
      universitas: '',
      tanggal: todayStr,
      jam_masuk: '08:00',
      jam_keluar: '16:00',
      keterangan: '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (r: any) => {
    setMode('edit');
    setOldKeys({ nama: r.nama, universitas: r.universitas, tanggal: r.tanggal });
    setForm({
      nama: r.nama || '',
      universitas: r.universitas || '',
      tanggal: r.tanggal || '',
      jam_masuk: (r.jam_masuk || '08:00').slice(0, 5),
      jam_keluar: (r.jam_keluar || '16:00').slice(0, 5),
      keterangan: r.keterangan || '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const method = mode === 'tambah' ? 'POST' : 'PUT';
      const payload =
        mode === 'tambah'
          ? form
          : {
              ...form,
              oldNama: oldKeys.nama,
              oldUniv: oldKeys.universitas,
              oldTanggal: oldKeys.tanggal,
            };

      const res = await fetch('/api/admin/absensi', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFormError(d.error || 'Gagal menyimpan data absensi.');
        setSubmitting(false);
        return;
      }

      if (d.sheets_ok === false) {
        setSheetsWarn(
          'Data tersimpan di database, tetapi gagal disinkronkan ke Google Sheets. Silakan cek tab Log.'
        );
      }

      setModalOpen(false);
      fetchData();
    } catch {
      setFormError('Gagal menghubungi server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (r: any) => {
    const ok = window.confirm(
      `Hapus data absensi untuk:\nNama: ${r.nama}\nUniversitas: ${r.universitas}\nTanggal: ${r.tanggal}?`
    );
    if (!ok) return;

    try {
      const res = await fetch('/api/admin/absensi', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: r.nama,
          universitas: r.universitas,
          tanggal: r.tanggal,
        }),
      });
      const d = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(d.error || 'Gagal menghapus data absensi.');
        return;
      }

      if (d.sheets_ok === false) {
        setSheetsWarn(
          'Data dihapus di database, tetapi gagal dihapus di Google Sheets. Silakan cek tab Log.'
        );
      }

      fetchData();
    } catch {
      alert('Gagal menghubungi server.');
    }
  };

  return (
    <div>
      {sheetsWarn && (
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg mb-4 flex justify-between items-center text-sm border border-yellow-300">
          <span>{sheetsWarn}</span>
          <button
            type="button"
            onClick={() => setSheetsWarn(null)}
            className="ml-4 font-bold text-yellow-900 hover:text-yellow-700"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            name="start"
            type="date"
            className="px-4 py-2 border rounded-lg text-sm"
            value={filters.start}
            onChange={handleFilter}
          />
          <input
            name="end"
            type="date"
            className="px-4 py-2 border rounded-lg text-sm"
            value={filters.end}
            onChange={handleFilter}
          />
          <input
            name="univ"
            type="text"
            className="px-4 py-2 border rounded-lg text-sm"
            value={filters.univ}
            onChange={handleFilter}
            placeholder="Universitas"
          />
          <input
            name="q"
            type="text"
            className="px-4 py-2 border rounded-lg text-sm"
            value={filters.q}
            onChange={handleFilter}
            placeholder="Nama..."
          />
        </div>
        <div className="flex gap-2 ml-auto">
          <button
            type="button"
            onClick={openTambah}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            + Tambah Absensi
          </button>
          <a
            href={`/api/admin/export?tipe=riwayat&${new URLSearchParams({
              start: filters.start,
              end: filters.end,
              univ: filters.univ,
              q: filters.q,
              page: '1',
            }).toString()}`}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm text-center hover:bg-green-700"
          >
            Ekspor CSV
          </a>
        </div>
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
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  Memuat...
                </td>
              </tr>
            ) : (
              data.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">{r.tanggal}</td>
                  <td className="px-4 py-3 font-medium">{r.nama}</td>
                  <td className="px-4 py-3">{r.universitas}</td>
                  <td className="px-4 py-3">{r.jam_masuk}</td>
                  <td className="px-4 py-3">{r.jam_keluar}</td>
                  <td className="px-4 py-3 text-gray-500">{r.keterangan || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r)}
                      className="text-red-600 hover:underline font-medium"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))
            )}
            {!loading && data.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  Tidak ada data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center text-sm text-gray-500">
        <div>Total: {total} baris</div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={filters.page === 1}
            onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
            className="px-3 py-1 border rounded disabled:opacity-30"
          >
            Sblmnya
          </button>
          <span className="py-1">Hal {filters.page}</span>
          <button
            type="button"
            disabled={data.length < 50}
            onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
            className="px-3 py-1 border rounded disabled:opacity-30"
          >
            Brktnya
          </button>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">
              {mode === 'tambah' ? 'Tambah Absensi' : 'Edit Absensi'}
            </h2>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-sm">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Nama</label>
                <input
                  type="text"
                  required
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Universitas</label>
                <input
                  type="text"
                  required
                  value={form.universitas}
                  onChange={(e) => setForm({ ...form, universitas: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Tanggal</label>
                <input
                  type="date"
                  required
                  max={todayStr}
                  value={form.tanggal}
                  onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Jam Masuk</label>
                  <input
                    type="time"
                    required
                    value={form.jam_masuk}
                    onChange={(e) => setForm({ ...form, jam_masuk: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Jam Keluar</label>
                  <input
                    type="time"
                    required
                    value={form.jam_keluar}
                    onChange={(e) => setForm({ ...form, jam_keluar: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Keterangan (opsional, maks 100)
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={form.keterangan}
                  onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
