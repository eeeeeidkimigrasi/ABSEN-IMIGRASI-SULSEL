'use client';

import { useState, useEffect } from 'react';

export function RekapTab() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [sortCol, setSortCol] = useState('terakhir');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [editItem, setEditItem] = useState<{ nama: string; universitas: string; tgl_mulai: string; tgl_selesai: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [profileItem, setProfileItem] = useState<any | null>(null);

  const loadRekap = () => {
    setLoading(true);
    fetch(`/api/admin/data?tipe=rekap&q=${encodeURIComponent(search)}&active=${activeOnly}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
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
    else {
      setSortCol(col);
      setSortDir('desc');
    }
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

  const calcProgress = (mulai?: string | null, selesai?: string | null) => {
    if (!mulai || !selesai) return null;
    const start = new Date(mulai).getTime();
    const end = new Date(selesai).getTime();
    const now = Date.now();
    if (isNaN(start) || isNaN(end) || end <= start) return null;
    const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.round((now - start) / (1000 * 60 * 60 * 24));
    const pct = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
    const remaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
    const status = now > end ? 'Selesai Magang' : now < start ? 'Belum Mulai' : 'Aktif Magang';
    return { totalDays, pct, remaining, status };
  };

  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const drawFallbackEmblem = (ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(233, 193, 112, 0.18)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#E9C170';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy - radius * 0.68);
    ctx.lineTo(cx + radius * 0.58, cy - radius * 0.22);
    ctx.lineTo(cx + radius * 0.38, cy + radius * 0.58);
    ctx.lineTo(cx - radius * 0.38, cy + radius * 0.58);
    ctx.lineTo(cx - radius * 0.58, cy - radius * 0.22);
    ctx.closePath();
    ctx.fillStyle = '#04315C';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#E9C170';
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('IMIGRASI', cx, cy + 4);
    ctx.restore();
  };

  const downloadProfilePng = async (item: any) => {
    const canvas = document.createElement('canvas');
    canvas.width = 860;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Background Utama
    ctx.fillStyle = '#F4F6F8';
    ctx.fillRect(0, 0, 860, 600);

    // 2. Header Banner Wisdom Blue (#043666)
    ctx.fillStyle = '#043666';
    ctx.fillRect(0, 0, 860, 150);

    // Garis Dignity Gold (#E9C170)
    ctx.fillStyle = '#E9C170';
    ctx.fillRect(0, 150, 860, 6);

    // Teks Header Kiri
    ctx.fillStyle = '#E9C170';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('KARTU PROFIL & REKAPITULASI KEHADIRAN MAGANG', 42, 42);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(item.nama, 42, 82);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '16px sans-serif';
    ctx.fillText(item.universitas, 42, 114);

    // 3. Logo & Teks Instansi Kanan Atas
    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#E9C170';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('DIREKTORAT JENDERAL IMIGRASI', 722, 62);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('KANWIL SULAWESI SELATAN', 722, 85);
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '12px sans-serif';
    ctx.fillText('Sistem Presensi Peserta Magang', 722, 106);
    ctx.restore();

    const drawLogo = () =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.drawImage(img, 736, 32, 84, 84);
          resolve();
        };
        img.onerror = () => {
          drawFallbackEmblem(ctx, 778, 74, 38);
          resolve();
        };
        img.src = '/logo-imigrasi.png';
      });

    await drawLogo();

    // 4. Kotak Mulai & Berakhir Magang
    const periodBoxes = [
      { label: 'MULAI MAGANG', val: item.tgl_mulai || 'Belum diatur', accent: '#043666' },
      { label: 'BERAKHIR MAGANG', val: item.tgl_selesai || 'Belum diatur', accent: '#BD944D' },
    ];

    periodBoxes.forEach((pb, idx) => {
      const x = 42 + idx * 398;
      const y = 182;
      const w = 378;
      const h = 102;

      drawRoundedRect(ctx, x, y, w, h, 10);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#CBD5E1';
      ctx.stroke();

      ctx.fillStyle = pb.accent;
      ctx.fillRect(x, y + 10, 5, h - 20);

      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(pb.label, x + 24, y + 36);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 23px sans-serif';
      ctx.fillText(String(pb.val), x + 24, y + 74);
    });

    // 5. Statistik Kehadiran
    const stats = [
      { label: 'TOTAL HADIR', val: `${item.count} Hari`, color: '#043666', bg: '#F8FAFC', border: '#CBD5E1' },
      { label: 'TOTAL IZIN / SAKIT', val: `${item.izinCount || 0} Hari`, color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
      { label: 'TERAKHIR HADIR', val: item.terakhir || '-', color: '#04315C', bg: '#F8FAFC', border: '#CBD5E1' },
    ];

    stats.forEach((st, idx) => {
      const x = 42 + idx * 265;
      const y = 306;
      const w = 246;
      const h = 115;

      drawRoundedRect(ctx, x, y, w, h, 10);
      ctx.fillStyle = st.bg;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = st.border;
      ctx.stroke();

      ctx.fillStyle = '#475569';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(st.label, x + 22, y + 38);

      ctx.fillStyle = st.color;
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(String(st.val), x + 22, y + 82);
    });

    // 6. Progress Bar Masa Magang
    const prog = calcProgress(item.tgl_mulai, item.tgl_selesai);
    if (prog) {
      const px = 42;
      const py = 442;
      const pw = 776;
      const ph = 74;

      drawRoundedRect(ctx, px, py, pw, ph, 10);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`Status: ${prog.status}`, px + 20, py + 28);

      ctx.save();
      ctx.textAlign = 'right';
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`Progres: ${prog.pct}% (${prog.totalDays} hari total | Sisa ${prog.remaining} hari)`, px + pw - 20, py + 28);
      ctx.restore();

      drawRoundedRect(ctx, px + 20, py + 42, pw - 40, 14, 7);
      ctx.fillStyle = '#E2E8F0';
      ctx.fill();

      const fillW = Math.max(14, Math.round(((pw - 40) * prog.pct) / 100));
      drawRoundedRect(ctx, px + 20, py + 42, fillW, 14, 7);
      ctx.fillStyle = '#043666';
      ctx.fill();
    }

    // 7. Footer Resmi
    ctx.fillStyle = '#64748B';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Dicetak melalui Sistem Presensi Magang Ditjen Imigrasi Kanwil Sulsel | ${new Date().toISOString().slice(0, 10)}`, 42, 562);

    const link = document.createElement('a');
    link.download = `KartuProfil_${item.nama.replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Bilah Kontrol & Filter */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center">
          <input
            type="text"
            placeholder="Cari nama peserta..."
            className="px-3.5 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666] w-full sm:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="w-4 h-4 accent-[#043666] rounded"
            />
            Hanya Peserta Aktif (14 Hari)
          </label>
        </div>
        <a
          href={`/api/admin/export?tipe=rekap&q=${encodeURIComponent(search)}&active=${activeOnly}`}
          className="px-4 py-2 bg-[#043666] hover:bg-[#04315C] text-[#E9C170] font-bold text-xs uppercase tracking-wider rounded-md shadow-sm transition-colors"
        >
          Ekspor CSV
        </a>
      </div>

      {/* Tabel Rekapitulasi */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <div className="bg-[#043666] px-5 py-3.5 border-b-2 border-[#E9C170] flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-white">
            Rekapitulasi & Profil Peserta Magang
          </h2>
          <span className="px-2.5 py-0.5 text-[11px] font-extrabold rounded bg-[#E9C170] text-[#04315C]">
            {sortedData.length} Peserta
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase text-[11px] font-extrabold tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5 cursor-pointer hover:bg-slate-100 select-none" onClick={() => toggleSort('nama')}>
                  Nama Peserta {sortCol === 'nama' && (sortDir === 'asc' ? '(A-Z)' : '(Z-A)')}
                </th>
                <th className="px-5 py-3.5 cursor-pointer hover:bg-slate-100 select-none" onClick={() => toggleSort('universitas')}>
                  Universitas / Instansi {sortCol === 'universitas' && (sortDir === 'asc' ? '(A-Z)' : '(Z-A)')}
                </th>
                <th className="px-5 py-3.5">Periode Magang</th>
                <th className="px-5 py-3.5 cursor-pointer hover:bg-slate-100 text-center select-none" onClick={() => toggleSort('count')}>
                  Total Hadir {sortCol === 'count' && (sortDir === 'asc' ? '(Min)' : '(Maks)')}
                </th>
                <th className="px-5 py-3.5 cursor-pointer hover:bg-slate-100 select-none" onClick={() => toggleSort('terakhir')}>
                  Terakhir Hadir {sortCol === 'terakhir' && (sortDir === 'asc' ? '(Lama)' : '(Baru)')}
                </th>
                <th className="px-5 py-3.5 text-center">Kartu Profil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-xs font-bold uppercase tracking-widest text-[#043666]">
                    Memuat Data Rekapitulasi...
                  </td>
                </tr>
              ) : (
                sortedData.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-900">{r.nama}</td>
                    <td className="px-5 py-3.5 text-slate-700">{r.universitas}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {r.tgl_mulai && r.tgl_selesai ? `${r.tgl_mulai} s/d ${r.tgl_selesai}` : 'Belum diatur'}
                        </span>
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
                          className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-[#043666] border border-slate-300 rounded hover:bg-[#043666] hover:text-white transition-colors"
                        >
                          Ubah
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-block px-2.5 py-0.5 text-xs font-extrabold rounded bg-slate-100 text-[#043666] border border-slate-300">
                        {r.count} Hari
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-700">{r.terakhir}</td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => setProfileItem(r)}
                        className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-[#043666] hover:bg-[#04315C] text-[#E9C170] rounded shadow-sm transition-colors"
                      >
                        Lihat Kartu
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {!loading && sortedData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-xs font-medium text-slate-400">
                    Tidak ada data peserta yang ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edit Periode */}
      {editItem && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="bg-[#043666] px-6 py-4 border-b-2 border-[#E9C170]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#E9C170] block">
                Pengaturan Masa Magang
              </span>
              <h3 className="text-base font-extrabold text-white mt-0.5">{editItem.nama}</h3>
              <p className="text-xs text-slate-200 mt-0.5">{editItem.universitas}</p>
            </div>

            <div className="p-6">
              {editError && (
                <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-600 text-red-800 text-xs font-medium rounded-r">
                  {editError}
                </div>
              )}

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Tanggal Mulai Magang
                  </label>
                  <input
                    type="date"
                    value={editItem.tgl_mulai}
                    onChange={(e) => setEditItem({ ...editItem, tgl_mulai: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:border-[#043666]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Tanggal Selesai Magang
                  </label>
                  <input
                    type="date"
                    value={editItem.tgl_selesai}
                    onChange={(e) => setEditItem({ ...editItem, tgl_selesai: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:border-[#043666]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditItem(null)}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-slate-300 rounded-md text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSavePeriode}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-[#043666] hover:bg-[#04315C] text-[#E9C170] rounded-md disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Periode'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Kartu Profil Individu */}
      {profileItem &&
        (() => {
          const prog = calcProgress(profileItem.tgl_mulai, profileItem.tgl_selesai);
          return (
            <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center z-50 p-4">
              <div className="bg-[#F4F6F8] rounded-xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-300">
                {/* Header Kartu Profil */}
                <div className="bg-[#043666] p-6 text-white border-b-4 border-[#E9C170]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className="inline-block px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-[#04315C] text-[#E9C170] border border-[#BD944D]/50 rounded mb-1.5">
                        Kartu Profil Peserta Magang
                      </span>
                      <h3 className="text-2xl font-extrabold truncate text-white">{profileItem.nama}</h3>
                      <p className="text-slate-200 text-sm truncate mt-0.5">{profileItem.universitas}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <div className="hidden sm:block leading-snug">
                        <div className="text-[11px] font-extrabold tracking-wider text-[#E9C170] uppercase">
                          DITJEN IMIGRASI
                        </div>
                        <div className="text-xs font-bold text-white">Kanwil Sulsel</div>
                      </div>
                      <img
                        src="/logo-imigrasi.png"
                        alt="Logo Imigrasi"
                        className="w-14 h-14 object-contain"
                      />
                    </div>
                  </div>
                </div>

                {/* Isi Statistik Kehadiran */}
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#043666]">
                      Statistik Kehadiran & Masa Magang
                    </h4>
                    {prog && (
                      <span
                        className={`px-2.5 py-0.5 text-xs font-bold rounded border ${
                          prog.status === 'Selesai Magang'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-amber-50 text-amber-900 border-amber-300'
                        }`}
                      >
                        {prog.status} ({prog.pct}%)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="p-3.5 rounded-lg bg-white border border-slate-200 border-l-4 border-l-[#043666]">
                      <div className="text-[11px] font-bold text-slate-500 uppercase">Mulai Magang</div>
                      <div className="text-base font-extrabold text-slate-900 mt-1">
                        {profileItem.tgl_mulai || 'Belum diatur'}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg bg-white border border-slate-200 border-l-4 border-l-[#BD944D]">
                      <div className="text-[11px] font-bold text-slate-500 uppercase">Berakhir Magang</div>
                      <div className="text-base font-extrabold text-slate-900 mt-1">
                        {profileItem.tgl_selesai || 'Belum diatur'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-lg bg-white border border-slate-200 text-center">
                      <div className="text-[11px] font-bold text-slate-500 uppercase">Total Hadir</div>
                      <div className="text-xl font-black text-[#043666] mt-1">
                        {profileItem.count} <span className="text-xs font-semibold">Hari</span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg bg-white border border-slate-200 text-center">
                      <div className="text-[11px] font-bold text-slate-500 uppercase">Total Izin</div>
                      <div className="text-xl font-black text-amber-700 mt-1">
                        {profileItem.izinCount || 0} <span className="text-xs font-semibold">Hari</span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg bg-white border border-slate-200 text-center">
                      <div className="text-[11px] font-bold text-slate-500 uppercase">Terakhir Hadir</div>
                      <div className="text-sm font-extrabold text-slate-900 mt-2">
                        {profileItem.terakhir || '-'}
                      </div>
                    </div>
                  </div>

                  {prog && (
                    <div className="bg-white px-4 py-3.5 rounded-lg border border-slate-200">
                      <div className="flex justify-between text-xs text-slate-700 mb-2 font-bold">
                        <span>Progres Durasi ({prog.totalDays} hari total)</span>
                        <span className="text-[#043666]">Sisa {prog.remaining} hari</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#043666] rounded-full"
                          style={{ width: `${prog.pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Tombol Aksi Modal */}
                <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setProfileItem(null)}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-slate-300 bg-white rounded-md text-slate-700 hover:bg-slate-100"
                  >
                    Tutup
                  </button>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/api/admin/export?tipe=individu&nama=${encodeURIComponent(profileItem.nama)}&univ=${encodeURIComponent(profileItem.universitas)}`}
                      className="px-3.5 py-2 text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-300 rounded-md hover:bg-slate-200"
                    >
                      Unduh CSV
                    </a>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-3.5 py-2 text-xs font-bold uppercase tracking-wider bg-slate-800 text-white rounded-md hover:bg-slate-900"
                    >
                      Cetak / PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadProfilePng(profileItem)}
                      className="px-3.5 py-2 text-xs font-bold uppercase tracking-wider bg-[#043666] hover:bg-[#04315C] text-[#E9C170] rounded-md shadow-sm"
                    >
                      Unduh PNG
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}