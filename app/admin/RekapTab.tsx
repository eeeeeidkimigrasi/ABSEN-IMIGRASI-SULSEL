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

  const [profileItem, setProfileItem] = useState<any | null>(null);

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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join('');
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
    // Lingkaran Luar Emas
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(212, 175, 55, 0.18)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#d4af37';
    ctx.stroke();

    // Perisai Segi Lima Khas Imigrasi
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius * 0.68);
    ctx.lineTo(cx + radius * 0.58, cy - radius * 0.22);
    ctx.lineTo(cx + radius * 0.38, cy + radius * 0.58);
    ctx.lineTo(cx - radius * 0.38, cy + radius * 0.58);
    ctx.lineTo(cx - radius * 0.58, cy - radius * 0.22);
    ctx.closePath();
    ctx.fillStyle = '#0b1f3a';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fbbf24';
    ctx.stroke();

    // Bintang / Simbol Emas di Tengah Perisai
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', cx, cy - 2);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('IMIGRASI', cx, cy + 12);
    ctx.restore();
  };

  const downloadProfilePng = async (item: any) => {
    const canvas = document.createElement('canvas');
    canvas.width = 860;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Background Utama
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, 860, 600);

    // 2. Header Banner Tema Imigrasi (Deep Navy Gradient)
    const grad = ctx.createLinearGradient(0, 0, 860, 155);
    grad.addColorStop(0, '#07162c');
    grad.addColorStop(0.55, '#0f294a');
    grad.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 860, 150);

    // Ornamen Garis Emas Khas Imigrasi di Bawah Header
    const goldGrad = ctx.createLinearGradient(0, 0, 860, 0);
    goldGrad.addColorStop(0, '#b45309');
    goldGrad.addColorStop(0.5, '#fbbf24');
    goldGrad.addColorStop(1, '#d97706');
    ctx.fillStyle = goldGrad;
    ctx.fillRect(0, 150, 860, 6);

    // Teks Header Kiri
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('KARTU PROFIL & REKAPITULASI KEHADIRAN MAGANG', 42, 42);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(item.nama, 42, 82);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '16px sans-serif';
    ctx.fillText(item.universitas, 42, 114);

    // 3. Logo & Teks Instansi Imigrasi di Kanan Atas (Diperbesar)
    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('DIREKTORAT JENDERAL IMIGRASI', 722, 62);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('KANWIL SULAWESI SELATAN', 722, 85);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '12px sans-serif';
    ctx.fillText('Sistem Absensi Peserta Magang', 722, 106);
    ctx.restore();

    // Muat /logo-imigrasi.png dengan ukuran lebih besar (84x84) tanpa border bulat
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

    // 4. Baris 1: Kotak Mulai Magang & Berakhir Magang
    const periodBoxes = [
      { label: 'MULAI MAGANG', val: item.tgl_mulai || 'Belum diatur', accent: '#0f294a' },
      { label: 'BERAKHIR MAGANG', val: item.tgl_selesai || 'Belum diatur', accent: '#d97706' },
    ];

    periodBoxes.forEach((pb, idx) => {
      const x = 42 + idx * 398;
      const y = 182;
      const w = 378;
      const h = 102;

      drawRoundedRect(ctx, x, y, w, h, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#cbd5e1';
      ctx.stroke();

      // Garis Aksen Kiri
      ctx.fillStyle = pb.accent;
      ctx.fillRect(x, y + 12, 5, h - 24);

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(pb.label, x + 24, y + 36);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 23px sans-serif';
      ctx.fillText(String(pb.val), x + 24, y + 74);
    });

    // 5. Baris 2: Statistik Kehadiran (Total Hadir, Total Izin, Terakhir Hadir)
    const stats = [
      { label: 'TOTAL HADIR', val: `${item.count} Hari`, color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
      { label: 'TOTAL IZIN / SAKIT', val: `${item.izinCount || 0} Hari`, color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
      { label: 'TERAKHIR HADIR', val: item.terakhir || '-', color: '#1e3a8a', bg: '#eff6ff', border: '#bfdbfe' },
    ];

    stats.forEach((st, idx) => {
      const x = 42 + idx * 265;
      const y = 306;
      const w = 246;
      const h = 115;

      drawRoundedRect(ctx, x, y, w, h, 12);
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

    // 6. Baris 3: Progress Bar Visual Masa Magang
    const prog = calcProgress(item.tgl_mulai, item.tgl_selesai);
    if (prog) {
      const px = 42;
      const py = 442;
      const pw = 776;
      const ph = 74;

      drawRoundedRect(ctx, px, py, pw, ph, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`Status: ${prog.status}`, px + 20, py + 28);

      ctx.save();
      ctx.textAlign = 'right';
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`Progres: ${prog.pct}% (${prog.totalDays} hari total • Sisa ${prog.remaining} hari)`, px + pw - 20, py + 28);
      ctx.restore();

      // Track Bar
      drawRoundedRect(ctx, px + 20, py + 42, pw - 40, 14, 7);
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();

      // Fill Bar (Navy-Gold Theme)
      const fillW = Math.max(14, Math.round(((pw - 40) * prog.pct) / 100));
      drawRoundedRect(ctx, px + 20, py + 42, fillW, 14, 7);
      const barGrad = ctx.createLinearGradient(px + 20, 0, px + 20 + fillW, 0);
      barGrad.addColorStop(0, '#0f294a');
      barGrad.addColorStop(1, '#d97706');
      ctx.fillStyle = barGrad;
      ctx.fill();
    }

    // 7. Footer Resmi
    ctx.fillStyle = '#64748b';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Dicetak otomatis melalui Sistem Absensi Magang Imigrasi • ${new Date().toISOString().slice(0, 10)}`, 42, 562);

    const link = document.createElement('a');
    link.download = `KartuProfil_${item.nama.replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
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
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 text-center" onClick={() => toggleSort('count')}>Jumlah Hadir {sortCol === 'count' && (sortDir === 'asc' ? '↑' : '↓')}</th>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('terakhir')}>Terakhir Hadir {sortCol === 'terakhir' && (sortDir === 'asc' ? '↑' : '↓')}</th>
              <th className="px-4 py-3 text-center">Kartu Profil</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Memuat...</td></tr>
            ) : sortedData.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50/60">
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
                <td className="px-4 py-3 text-center font-semibold">{r.count}</td>
                <td className="px-4 py-3">{r.terakhir}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => setProfileItem(r)}
                    className="px-3 py-1 text-xs bg-[#0b1f3a] text-amber-300 border border-amber-500/40 rounded-md hover:bg-[#153460] font-medium shadow-sm"
                  >
                    Lihat Kartu
                  </button>
                </td>
              </tr>
            ))}
            {!loading && sortedData.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Tidak ada data</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Modal Edit Periode */}
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

      {/* Modal Profile Card Individu Bertema Resmi Imigrasi */}
      {profileItem && (() => {
        const prog = calcProgress(profileItem.tgl_mulai, profileItem.tgl_selesai);
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-slate-50 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-300">
              {/* Header Banner Tema Imigrasi (Deep Navy + Gold) */}
              <div className="bg-gradient-to-r from-[#07162c] via-[#0f294a] to-[#1e3a8a] p-6 text-white relative border-b-4 border-amber-400">
                <div className="flex items-center justify-between gap-4">
                  {/* Kiri: Identitas Mahasiswa (Tanpa Lingkaran UK) */}
                  <div className="min-w-0">
                    <span className="inline-block px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest bg-amber-400/20 text-amber-300 border border-amber-400/40 rounded-full mb-1.5">
                      Kartu Profil Peserta Magang
                    </span>
                    <h3 className="text-2xl font-extrabold truncate text-white">{profileItem.nama}</h3>
                    <p className="text-slate-200 text-base truncate mt-0.5">{profileItem.universitas}</p>
                  </div>

                  {/* Kanan Atas: Logo Langsung Tanpa Border Bulat & Teks Diperbesar */}
                  <div className="flex items-center gap-3.5 shrink-0 text-right">
                    <div className="hidden sm:block leading-snug">
                      <div className="text-xs font-extrabold tracking-wider text-amber-400 uppercase">DITJEN IMIGRASI</div>
                      <div className="text-sm font-bold text-white">Kanwil Sulsel</div>
                    </div>
                    <img
                      src="/logo-imigrasi.png"
                      alt="Logo Imigrasi"
                      className="w-16 h-16 object-contain drop-shadow-md"
                    />
                  </div>
                </div>
              </div>

              {/* Body Statistik Kehadiran & Periode Magang */}
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Statistik Kehadiran & Masa Magang
                  </h4>
                  {prog && (
                    <span className={`px-3 py-0.5 text-xs font-bold rounded-full border ${prog.status === 'Selesai Magang' ? 'bg-green-100 text-green-800 border-green-300' : 'bg-amber-50 text-amber-800 border-amber-300'}`}>
                      {prog.status} • {prog.pct}%
                    </span>
                  )}
                </div>

                {/* Grid Kapan Mulai & Berakhir Magang */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 border-l-4 border-l-[#0f294a] shadow-2xs">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">Mulai Magang</div>
                    <div className="text-base font-extrabold text-slate-900 mt-1">
                      {profileItem.tgl_mulai || 'Belum diatur'}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 border-l-4 border-l-amber-500 shadow-2xs">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">Berakhir Magang</div>
                    <div className="text-base font-extrabold text-slate-900 mt-1">
                      {profileItem.tgl_selesai || 'Belum diatur'}
                    </div>
                  </div>
                </div>

                {/* Grid Statistik Kehadiran */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-center shadow-2xs">
                    <div className="text-[11px] font-bold text-emerald-800 uppercase">Total Hadir</div>
                    <div className="text-xl font-extrabold text-emerald-700 mt-1">{profileItem.count} <span className="text-xs font-semibold">Hari</span></div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-center shadow-2xs">
                    <div className="text-[11px] font-bold text-amber-800 uppercase">Total Izin</div>
                    <div className="text-xl font-extrabold text-amber-700 mt-1">{profileItem.izinCount || 0} <span className="text-xs font-semibold">Hari</span></div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-blue-50/90 border border-blue-200 text-center shadow-2xs">
                    <div className="text-[11px] font-bold text-blue-900 uppercase">Terakhir Hadir</div>
                    <div className="text-sm font-extrabold text-blue-900 mt-2">{profileItem.terakhir || '-'}</div>
                  </div>
                </div>

                {/* Progress Bar Masa Magang */}
                {prog && (
                  <div className="bg-white px-4 py-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="flex justify-between text-xs text-slate-700 mb-2 font-semibold">
                      <span>Progres Durasi ({prog.totalDays} hari total)</span>
                      <span className="text-amber-700 font-bold">Sisa {prog.remaining} hari</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#0f294a] to-amber-500 rounded-full"
                        style={{ width: `${prog.pct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setProfileItem(null)}
                  className="px-4 py-2 text-sm border border-slate-300 bg-white rounded-lg text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  Tutup
                </button>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/api/admin/export?tipe=individu&nama=${encodeURIComponent(profileItem.nama)}&univ=${encodeURIComponent(profileItem.universitas)}`}
                    className="px-3.5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold shadow-sm flex items-center"
                  >
                    Unduh CSV
                  </a>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3.5 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-semibold"
                  >
                    Cetak / PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadProfilePng(profileItem)}
                    className="px-3.5 py-2 text-sm bg-[#0b1f3a] text-amber-300 border border-amber-400/50 rounded-lg hover:bg-[#153460] font-semibold shadow-sm"
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