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
      jam_keluar: (r.jam_keluar || '').slice(0, 5),
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
          'Data tersimpan di database, tetapi gagal disinkronkan ke Google Sheets. Silakan cek tab Log Aktivitas.'
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
          'Data dihapus di database, tetapi gagal dihapus di Google Sheets. Silakan cek tab Log Aktivitas.'
        );
      }

      fetchData();
    } catch {
      alert('Gagal menghubungi server.');
    }
  };

  return (
    <div className="space-y-6">
      {sheetsWarn && (
        <div className="bg-amber-50 text-amber-900 p-4 rounded-lg flex justify-between items-center text-xs font-medium border-l-4 border-amber-500">
          <span>{sheetsWarn}</span>
          <button
            type="button"
            onClick={() => setSheetsWarn(null)}
            className="ml-4 px-2 py-1 font-bold text-amber-900 hover:bg-amber-100 rounded"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Bilah Filter & Tombol Aksi */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-wrap justify-between items-end gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1 min-w-[260px]">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Dari Tanggal
            </label>
            <input
              name="start"
              type="date"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:border-[#043666]"
              value={filters.start}
              onChange={handleFilter}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Sampai Tanggal
            </label>
            <input
              name="end"
              type="date"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:border-[#043666]"
              value={filters.end}
              onChange={handleFilter}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Filter Universitas
            </label>
            <input
              name="univ"
              type="text"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#043666]"
              value={filters.univ}
              onChange={handleFilter}
              placeholder="Contoh: Hasanuddin"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Cari Nama Peserta
            </label>
            <input
              name="q"
              type="text"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#043666]"
              value={filters.q}
              onChange={handleFilter}
              placeholder="Ketik nama..."
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openTambah}
            className="px-4 py-2 bg-[#043666] hover:bg-[#04315C] text-[#E9C170] font-bold text-xs uppercase tracking-wider rounded-md shadow-sm transition-colors"
          >
            + Tambah Presensi
          </button>
          <a
            href={`/api/admin/export?tipe=riwayat&${new URLSearchParams({
              start: filters.start,
              end: filters.end,
              univ: filters.univ,
              q: filters.q,
              page: '1',
            }).toString()}`}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-md shadow-sm transition-colors"
          >
            Ekspor CSV
          </a>
        </div>
      </div>

      {/* Tabel Riwayat Kehadiran */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <div className="bg-[#043666] px-5 py-3.5 border-b-2 border-[#E9C170] flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-white">
            Data Riwayat Kehadiran Peserta
          </h2>
          <span className="px-2.5 py-0.5 text-[11px] font-extrabold rounded bg-[#E9C170] text-[#04315C]">
            Total {total} Baris
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase text-[11px] font-extrabold tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Tanggal</th>
                <th className="px-5 py-3.5">Nama Peserta</th>
                <th className="px-5 py-3.5">Universitas / Instansi</th>
                <th className="px-5 py-3.5">Jam Masuk</th>
                <th className="px-5 py-3.5">Jam Keluar</th>
                <th className="px-5 py-3.5">Keterangan</th>
                <th className="px-5 py-3.5 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-xs font-bold uppercase tracking-widest text-[#043666]">
                    Memuat Riwayat Kehadiran...
                  </td>
                </tr>
              ) : (
                data.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap font-semibold text-slate-700">{r.tanggal}</td>
                    <td className="px-5 py-3.5 font-bold text-slate-900">{r.nama}</td>
                    <td className="px-5 py-3.5 text-slate-700">{r.universitas}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-block px-2.5 py-0.5 text-xs font-bold rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {String(r.jam_masuk || '').slice(0, 5)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {r.jam_keluar ? (
                        <span className="inline-block px-2.5 py-0.5 text-xs font-bold rounded bg-slate-100 text-slate-800 border border-slate-300">
                          {String(r.jam_keluar).slice(0, 5)}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{r.keterangan || '-'}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-[#043666] border border-slate-300 rounded hover:bg-[#043666] hover:text-white transition-colors"
                      >
                        Ubah
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r)}
                        className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-700 hover:text-white transition-colors"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {!loading && data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-xs font-medium text-slate-400">
                    Tidak ada data riwayat kehadiran yang sesuai dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Navigasi Halaman (Pagination) */}
      <div className="flex justify-between items-center text-xs font-bold text-slate-600 pt-1">
        <div>Menampilkan {data.length} dari total {total} baris</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={filters.page === 1}
            onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 uppercase tracking-wider"
          >
            Sebelumnya
          </button>
          <span className="px-3 py-1.5 bg-[#043666] text-[#E9C170] rounded-md">
            Halaman {filters.page}
          </span>
          <button
            type="button"
            disabled={data.length < 50}
            onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 uppercase tracking-wider"
          >
            Berikutnya
          </button>
        </div>
      </div>

      {/* Modal Tambah / Edit Presensi */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-[#043666] px-6 py-4 border-b-2 border-[#E9C170]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#E9C170] block">
                Manajemen Data Presensi
              </span>
              <h2 className="text-base font-extrabold text-white mt-0.5">
                {mode === 'tambah' ? 'Tambah Data Presensi Baru' : 'Ubah Data Presensi Peserta'}
              </h2>
            </div>

            <div className="p-6">
              {formError && (
                <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-600 text-red-800 rounded-r text-xs font-medium">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Nama Lengkap Peserta
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nama}
                    onChange={(e) => setForm({ ...form, nama: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#043666]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Universitas / Instansi
                  </label>
                  <input
                    type="text"
                    required
                    value={form.universitas}
                    onChange={(e) => setForm({ ...form, universitas: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#043666]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Tanggal Presensi
                  </label>
                  <input
                    type="date"
                    required
                    max={todayStr}
                    value={form.tanggal}
                    onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#043666]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Jam Masuk
                    </label>
                    <input
                      type="time"
                      required
                      value={form.jam_masuk}
                      onChange={(e) => setForm({ ...form, jam_masuk: e.target.value })}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#043666]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Jam Keluar
                    </label>
                    <input
                      type="time"
                      value={form.jam_keluar}
                      onChange={(e) => setForm({ ...form, jam_keluar: e.target.value })}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#043666]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Keterangan (Opsional)
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={form.keterangan}
                    onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#043666]"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-slate-300 rounded-md text-slate-700 hover:bg-slate-100"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-[#043666] hover:bg-[#04315C] text-[#E9C170] rounded-md disabled:opacity-50"
                  >
                    {submitting ? 'Menyimpan...' : 'Simpan Data'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}