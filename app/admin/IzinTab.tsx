'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

function extractGroupTag(ket?: string | null): { cleanKet: string; groupId: string | null } {
  const raw = String(ket || '');
  const match = raw.match(/\[GRP:([a-zA-Z0-9_-]+)\]/);
  const cleanKet = raw.replace(/\[GRP:[a-zA-Z0-9_-]+\]/g, '').trim();
  return {
    cleanKet,
    groupId: match ? match[1] : null,
  };
}

export function IzinTab() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ start: '', end: '' });
  const [sheetsWarn, setSheetsWarn] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<'tambah' | 'edit'>('tambah');
  const [oldKeys, setOldKeys] = useState<{ nama: string; universitas: string; tanggal: string; tanggalList: string[] }>({
    nama: '',
    universitas: '',
    tanggal: '',
    tanggalList: [],
  });
  const [form, setForm] = useState({
    nama: '',
    universitas: '',
    tanggal: '',
    tanggal_selesai: '',
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

  // HANYA mengelompokkan baris izin yang diajukan bersamaan dalam 1 pengajuan rentang ([GRP:...])
  const groupedData = useMemo(() => {
    const groupMap = new Map<string, any>();
    const result: any[] = [];

    for (const r of data) {
      const { cleanKet, groupId } = extractGroupTag(r.keterangan);

      if (!groupId) {
        // Pengajuan izin 1 hari: JANGAN digabung dengan hari lain
        result.push({
          ...r,
          keterangan: cleanKet,
          tgl_awal: r.tanggal,
          tgl_akhir: r.tanggal,
          tanggal_list: [r.tanggal],
        });
      } else {
        const key = `${(r.nama || '').toLowerCase().trim()}|${(r.universitas || '').toLowerCase().trim()}|${groupId}`;
        const existing = groupMap.get(key);
        if (!existing) {
          const newGroup = {
            ...r,
            keterangan: cleanKet,
            tgl_awal: r.tanggal,
            tgl_akhir: r.tanggal,
            tanggal_list: [r.tanggal],
          };
          groupMap.set(key, newGroup);
          result.push(newGroup);
        } else {
          if (r.tanggal < existing.tgl_awal) existing.tgl_awal = r.tanggal;
          if (r.tanggal > existing.tgl_akhir) existing.tgl_akhir = r.tanggal;
          if (!existing.tanggal_list.includes(r.tanggal)) {
            existing.tanggal_list.push(r.tanggal);
          }
        }
      }
    }

    for (const item of result) {
      item.tanggal_list.sort();
    }

    result.sort((a, b) => (a.tgl_akhir > b.tgl_akhir ? -1 : a.tgl_akhir < b.tgl_akhir ? 1 : 0));
    return result;
  }, [data]);

  const handleFilter = (e: any) => {
    setFilters((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const openTambah = () => {
    setMode('tambah');
    setForm({
      nama: '',
      universitas: '',
      tanggal: todayStr,
      tanggal_selesai: todayStr,
      jenis: 'Sakit',
      keterangan: '',
      link_surat: '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (r: any) => {
    setMode('edit');
    setOldKeys({
      nama: r.nama,
      universitas: r.universitas,
      tanggal: r.tgl_awal,
      tanggalList: r.tanggal_list || [r.tanggal],
    });
    setForm({
      nama: r.nama || '',
      universitas: r.universitas || '',
      tanggal: r.tgl_awal || r.tanggal || '',
      tanggal_selesai: r.tgl_akhir || r.tanggal || '',
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
              oldNama: oldKeys.nama,
              oldUniv: oldKeys.universitas,
              oldTanggal: oldKeys.tanggal,
              oldTanggalList: oldKeys.tanggalList,
            };

      const res = await fetch('/api/admin/izin', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFormError(d.error || 'Gagal menyimpan data izin.');
        setSubmitting(false);
        return;
      }

      if (d.sheets_ok === false) {
        setSheetsWarn(
          'Data izin tersimpan di database, tetapi gagal disinkronkan ke Google Sheets. Silakan cek tab Log Aktivitas.'
        );
      }

      setModalOpen(false);
      fetchIzin();
    } catch {
      setFormError('Gagal menghubungi server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (r: any) => {
    const labelTgl =
      r.tgl_awal === r.tgl_akhir
        ? r.tgl_awal
        : `${r.tgl_awal} s/d ${r.tgl_akhir} (${r.tanggal_list.length} hari kerja)`;

    const ok = window.confirm(
      `Hapus data izin untuk:\nNama: ${r.nama}\nUniversitas: ${r.universitas}\nTanggal: ${labelTgl}?`
    );
    if (!ok) return;

    try {
      const res = await fetch('/api/admin/izin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: r.nama,
          universitas: r.universitas,
          tanggal: r.tgl_awal,
          tanggal_list: r.tanggal_list,
        }),
      });
      const d = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(d.error || 'Gagal menghapus data izin.');
        return;
      }

      if (d.sheets_ok === false) {
        setSheetsWarn(
          'Data dihapus di database, tetapi gagal dihapus di Google Sheets. Silakan cek tab Log Aktivitas.'
        );
      }

      fetchIzin();
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
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Dari Tanggal
            </label>
            <input
              name="start"
              type="date"
              className="px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:border-[#043666]"
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
              className="px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:border-[#043666]"
              value={filters.end}
              onChange={handleFilter}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openTambah}
            className="px-4 py-2 bg-[#043666] hover:bg-[#04315C] text-[#E9C170] font-bold text-xs uppercase tracking-wider rounded-md shadow-sm transition-colors"
          >
            + Tambah Izin
          </button>
          <a
            href={`/api/admin/export?tipe=izin&${new URLSearchParams(filters).toString()}`}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-md shadow-sm transition-colors"
          >
            Ekspor CSV
          </a>
        </div>
      </div>

      {/* Tabel Data Izin */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <div className="bg-[#043666] px-5 py-3.5 border-b-2 border-[#E9C170] flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-white">
            Daftar Laporan Izin & Sakit Peserta
          </h2>
          <span className="px-2.5 py-0.5 text-[11px] font-extrabold rounded bg-[#E9C170] text-[#04315C]">
            {groupedData.length} Laporan
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase text-[11px] font-extrabold tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Tanggal / Rentang</th>
                <th className="px-5 py-3.5">Nama Peserta</th>
                <th className="px-5 py-3.5">Universitas / Instansi</th>
                <th className="px-5 py-3.5">Kategori</th>
                <th className="px-5 py-3.5">Keterangan</th>
                <th className="px-5 py-3.5">Dokumen Surat</th>
                <th className="px-5 py-3.5 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-xs font-bold uppercase tracking-widest text-[#043666]">
                    Memuat Data Izin...
                  </td>
                </tr>
              ) : (
                groupedData.map((r, i) => {
                  const isMulti = r.tanggal_list.length > 1;
                  return (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap font-semibold text-slate-700">
                        <div className="flex items-center gap-2">
                          <span>{isMulti ? `${r.tgl_awal} s/d ${r.tgl_akhir}` : r.tgl_awal}</span>
                          {isMulti && (
                            <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-slate-100 text-[#043666] border border-slate-300">
                              {r.tanggal_list.length} Hari
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-900">{r.nama}</td>
                      <td className="px-5 py-3.5 text-slate-700">{r.universitas}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-block px-2.5 py-0.5 text-xs font-bold rounded bg-amber-50 text-amber-800 border border-amber-200">
                          {r.jenis}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{r.keterangan || '-'}</td>
                      <td className="px-5 py-3.5">
                        {r.link_surat ? (
                          <a
                            href={r.link_surat}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-3 py-1 text-xs font-bold text-[#043666] bg-slate-100 hover:bg-[#043666] hover:text-white rounded transition-colors"
                          >
                            Lihat Surat
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
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
                  );
                })
              )}
              {!loading && groupedData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-xs font-medium text-slate-400">
                    Tidak ada data laporan izin yang ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah / Edit Izin */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-[#043666] px-6 py-4 border-b-2 border-[#E9C170]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#E9C170] block">
                Manajemen Data Ketidakhadiran
              </span>
              <h2 className="text-base font-extrabold text-white mt-0.5">
                {mode === 'tambah' ? 'Tambah Laporan Izin / Sakit' : 'Ubah Data Izin Peserta'}
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Dari Tanggal
                    </label>
                    <input
                      type="date"
                      required
                      value={form.tanggal}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          tanggal: e.target.value,
                          tanggal_selesai: f.tanggal_selesai < e.target.value ? e.target.value : f.tanggal_selesai,
                        }))
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#043666]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Sampai Tanggal
                    </label>
                    <input
                      type="date"
                      required
                      min={form.tanggal}
                      value={form.tanggal_selesai}
                      onChange={(e) => setForm({ ...form, tanggal_selesai: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#043666]"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 -mt-2">
                  Jika izin beberapa hari, hari libur (Jumat–Minggu) otomatis dilewati.
                </p>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Kategori Izin
                  </label>
                  <select
                    value={form.jenis}
                    onChange={(e) => setForm({ ...form, jenis: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#043666]"
                  >
                    <option value="Sakit">Sakit</option>
                    <option value="Izin">Izin</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
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

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Tautan Surat Google Drive (Opsional)
                  </label>
                  <input
                    type="url"
                    maxLength={300}
                    placeholder="https://drive.google.com/..."
                    value={form.link_surat}
                    onChange={(e) => setForm({ ...form, link_surat: e.target.value })}
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