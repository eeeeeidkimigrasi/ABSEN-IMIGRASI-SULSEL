'use client';

import { useState, useEffect, useCallback } from 'react';

export function IzinTab() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ start: '', end: '' });
  const [sheetsWarn, setSheetsWarn] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<'tambah' | 'edit'>('tambah');
  const [oldKeys, setOldKeys] = useState({ nama: '', universitas: '', tanggal: '' });
  const [form, setForm] = useState({
    nama: '',
    universitas: '',
    tanggal: '',
    jenis: 'Sakit',
    keterangan: '',
    link_surat: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const todayStr = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

  const fetchIzin = useCallback(() => {
    setLoading(true);
    const query = new URLSearchParams({ tipe: 'izin', ...filters }).toString();
    fetch(`/api/admin/data?${query}`)
      .then((res) => res.json())
      .then((d) => {
        setData(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    fetchIzin();
  }, [fetchIzin]);

  const handleFilter = (e: any) => {
    setFilters((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const openTambah = () => {
    setMode('tambah');
    setForm({
      nama: '',
      universitas: '',
      tanggal: todayStr,
      jenis: 'Sakit',
      keterangan: '',
      link_surat: '',
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
      jenis: r.jenis || 'Sakit',
      keterangan: r.keterangan || '',
      link_surat: r.link_surat || '',
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
              old_nama: oldKeys.nama,
              old_universitas: oldKeys.universitas,
              old_tanggal: oldKeys.tanggal,
              oldNama: oldKeys.nama,
              oldUniversitas: oldKeys.universitas,
              oldTanggal: oldKeys.tanggal,
            };

      const res = await fetch('/api/admin/izin', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const resData = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFormError(resData.error || 'Terjadi kesalahan saat menyimpan data izin');
        setSubmitting(false);
        return;
      }

      if (resData.sheets_ok === false) {
        setSheetsWarn(
          'Data tersimpan di database, tetapi gagal disinkronkan ke Google Sheets. Silakan cek tab Log.'
        );
      }

      setModalOpen(false);
      fetchIzin();
    } catch {
      setFormError('Gagal menghubungi server');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (r: any) => {
    const ok = window.confirm(
      `Hapus data izin untuk:\nNama: ${r.nama}\nUniversitas: ${r.universitas}\nTanggal: ${r.tanggal}?`
    );
    if (!ok) return;

    try {
      const params = new URLSearchParams({
        nama: r.nama,
        universitas: r.universitas,
        tanggal: r.tanggal,
      });
      const res = await fetch(`/api/admin/izin?${params.toString()}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: r.nama,
          universitas: r.universitas,
          tanggal: r.tanggal,
        }),
      });
      const resData = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(resData.error || 'Gagal menghapus data izin');
        return;
      }

      if (resData.sheets_ok === false) {
        setSheetsWarn(
          'Data dihapus di database, tetapi gagal dihapus di Google Sheets. Silakan cek tab Log.'
        );
      }

      fetchIzin();
    } catch {
      alert('Gagal menghubungi server');
    }
  };

  return (
    <div>
      {sheetsWarn && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-lg flex items-center justify-between text-sm">
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

      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <input
          name="start"
          type="date"
          className="px-4 py-2 border rounded-lg text-sm"
          value={filters.start}
          onChange={handleFilter}
          placeholder="Mulai"
        />
        <input
          name="end"
          type="date"
          className="px-4 py-2 border rounded-lg text-sm"
          value={filters.end}
          onChange={handleFilter}
          placeholder="Selesai"
        />
        <div className="flex gap-2 ml-auto">
          <button
            type="button"
            onClick={openTambah}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            + Tambah Izin
          </button>
          <a
            href={`/api/admin/export?tipe=izin&${new URLSearchParams(filters).toString()}`}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
          >
            Ekspor CSV
          </a>
        </div>
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
                  <td className="px-4 py-3">{r.jenis}</td>
                  <td className="px-4 py-3 text-gray-500">{r.keterangan || '-'}</td>
                  <td className="px-4 py-3">
                    {r.link_surat ? (
                      <a
                        href={r.link_surat}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Link
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
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
                  Tidak ada data izin
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">
              {mode === 'tambah' ? 'Tambah Izin' : 'Edit Izin'}
            </h3>

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

              <div className="grid grid-cols-2 gap-3">
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

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Jenis</label>
                  <select
                    value={form.jenis}
                    onChange={(e) => setForm({ ...form, jenis: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="Sakit">Sakit</option>
                    <option value="Izin">Izin</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
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

              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Link Surat Google Drive/Docs (opsional)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={form.link_surat}
                  onChange={(e) => setForm({ ...form, link_surat: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
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