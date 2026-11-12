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
  const [unblockingKey, setUnblockingKey] = useState<string | null>(null);

  const [profileItem, setProfileItem] = useState<any | null>(null);
  const [calendarData, setCalendarData] = useState<any[]>([]);
  const [indivMeta, setIndivMeta] = useState<{ missing_past_workdays: number; auto_count: number; first_real_date: string }>({
    missing_past_workdays: 0,
    auto_count: 0,
    first_real_date: '',
  });
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [processingAuto, setProcessingAuto] = useState(false);
  const [hideLibur, setHideLibur] = useState(false);

  const loadRekap = () => {
    setLoading(true);
    fetch(`/api/admin/data?tipe=rekap&q=${encodeURIComponent(search)}&active=${activeOnly}`)
      .then((res) => res.json())
      .then((d) => {
        const arr = Array.isArray(d) ? d : [];
        setData(arr);
        setLoading(false);
        setProfileItem((prev: any) => {
          if (!prev) return null;
          const updated = arr.find((x: any) => x.nama === prev.nama && x.universitas === prev.universitas);
          return updated || prev;
        });
      });
  };

  useEffect(() => {
    loadRekap();
  }, [search, activeOnly]);

  const fetchIndividuDetail = (nama: string, universitas: string) => {
    setLoadingCalendar(true);
    fetch(`/api/admin/data?tipe=individu&nama=${encodeURIComponent(nama)}&univ=${encodeURIComponent(universitas)}`)
      .then((res) => res.json())
      .then((d) => {
        setCalendarData(d.calendar || []);
        setIndivMeta({
          missing_past_workdays: d.missing_past_workdays || 0,
          auto_count: d.auto_count || 0,
          first_real_date: d.first_real_date || '',
        });
        setLoadingCalendar(false);
      })
      .catch(() => {
        setLoadingCalendar(false);
      });
  };

  const openProfileModal = (r: any) => {
    setProfileItem(r);
    setCalendarData([]);
    setIndivMeta({ missing_past_workdays: 0, auto_count: 0, first_real_date: '' });
    fetchIndividuDetail(r.nama, r.universitas);
  };

  const handleBackfillPast = async () => {
    if (!profileItem) return;
    const ok = window.confirm(
      `Isi otomatis ${indivMeta.missing_past_workdays} hari kerja masa lalu (Senin-Kamis sebelum ${indivMeta.first_real_date}) untuk ${profileItem.nama} dengan jam hadir 07:15 - 16:05?`
    );
    if (!ok) return;

    setProcessingAuto(true);
    try {
      const res = await fetch('/api/admin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'backfill_past',
          nama: profileItem.nama,
          universitas: profileItem.universitas,
        }),
      });
      const result = await res.json();
      if (res.ok && result.ok) {
        fetchIndividuDetail(profileItem.nama, profileItem.universitas);
        loadRekap();
      } else {
        alert(result.error || 'Gagal mengisi kehadiran masa lalu.');
      }
    } catch {
      alert('Gagal menghubungi server.');
    } finally {
      setProcessingAuto(false);
    }
  };

  const handleUndoBackfill = async () => {
    if (!profileItem) return;
    const ok = window.confirm(
      `Batalkan dan hapus seluruh ${indivMeta.auto_count} baris kehadiran otomatis (Pra-Sistem) untuk ${profileItem.nama}?\n\n(Data absensi asli peserta tidak akan terhapus)`
    );
    if (!ok) return;

    setProcessingAuto(true);
    try {
      const res = await fetch('/api/admin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'undo_backfill',
          nama: profileItem.nama,
          universitas: profileItem.universitas,
        }),
      });
      const result = await res.json();
      if (res.ok && result.ok) {
        fetchIndividuDetail(profileItem.nama, profileItem.universitas);
        loadRekap();
      } else {
        alert(result.error || 'Gagal membatalkan isi otomatis.');
      }
    } catch {
      alert('Gagal menghubungi server.');
    } finally {
      setProcessingAuto(false);
    }
  };

  const handleUnblockSp = async (r: any) => {
    const ok = window.confirm(`Buka blokir SP-3 dan reset catatan pelanggaran untuk ${r.nama}?`);
    if (!ok) return;
    const key = `${r.nama}|${r.universitas}`;
    setUnblockingKey(key);
    try {
      const res = await fetch('/api/admin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unblock_sp', nama: r.nama, universitas: r.universitas }),
      });
      const result = await res.json();
      if (res.ok && result.ok) {
        loadRekap();
      } else {
        alert(result.error || 'Gagal membuka blokir.');
      }
    } catch {
      alert('Gagal menghubungi server.');
    } finally {
      setUnblockingKey(null);
    }
  };

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

    ctx.fillStyle = '#F4F6F8';
    ctx.fillRect(0, 0, 860, 600);

    ctx.fillStyle = '#043666';
    ctx.fillRect(0, 0, 860, 150);

    ctx.fillStyle = '#E9C170';
    ctx.fillRect(0, 150, 860, 6);

    ctx.fillStyle = '#E9C170';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('KARTU PROFIL & REKAPITULASI KEHADIRAN MAGANG', 42, 42);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(item.nama, 42, 82);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '16px sans-serif';
    ctx.fillText(item.universitas, 42, 114);

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

    const stats = [
      { label: 'TOTAL HADIR', val: `${item.count} Hari`, color: '#043666', bg: '#F8FAFC', border: '#CBD5E1' },
      { label: 'IZIN / SAKIT', val: `${item.izinCount || 0} Hari`, color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
      { label: 'TIDAK HADIR', val: `${item.alphaCount || 0} Hari`, color: '#991B1B', bg: '#FEF2F2', border: '#FECACA' },
      { label: 'TERAKHIR HADIR', val: item.terakhir || '-', color: '#04315C', bg: '#F8FAFC', border: '#CBD5E1' },
    ];

    stats.forEach((st, idx) => {
      const x = 42 + idx * 197;
      const y = 306;
      const w = 185;
      const h = 115;

      drawRoundedRect(ctx, x, y, w, h, 10);
      ctx.fillStyle = st.bg;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = st.border;
      ctx.stroke();

      ctx.fillStyle = '#475569';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(st.label, x + 16, y + 38);

      ctx.fillStyle = st.color;
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(String(st.val), x + 16, y + 80);
    });

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

    ctx.fillStyle = '#64748B';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Dicetak melalui Sistem Presensi Magang Ditjen Imigrasi Kanwil Sulsel | ${new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)}`, 42, 562);

    const link = document.createElement('a');
    link.download = `KartuProfil_${item.nama.replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="space-y-6">
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
                sortedData.map((r, i) => {
                  const sp = r.spCount || 0;
                  const rowKey = `${r.nama}|${r.universitas}`;
                  return (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-900">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{r.nama}</span>
                          {sp === 1 && (
                            <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded bg-amber-100 text-amber-900 border border-amber-300">
                              SP-1
                            </span>
                          )}
                          {sp === 2 && (
                            <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded bg-orange-100 text-orange-900 border border-orange-300">
                              SP-2
                            </span>
                          )}
                          {sp >= 3 && (
                            <>
                              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded bg-red-100 text-red-800 border border-red-300">
                                SP-3 • Terblokir
                              </span>
                              <button
                                type="button"
                                disabled={unblockingKey === rowKey}
                                onClick={() => handleUnblockSp(r)}
                                className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded bg-[#043666] hover:bg-[#04315C] text-[#E9C170] shadow-sm transition-colors disabled:opacity-50"
                              >
                                {unblockingKey === rowKey ? 'Memproses...' : 'Buka Blokir'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
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
                          onClick={() => openProfileModal(r)}
                          className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-[#043666] hover:bg-[#04315C] text-[#E9C170] rounded shadow-sm transition-colors"
                        >
                          Lihat Kartu
                        </button>
                      </td>
                    </tr>
                  );
                })
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

      {/* Modal Kartu Profil Individu + Tabel Kalender Kehadiran Harian */}
      {profileItem &&
        (() => {
          const prog = calcProgress(profileItem.tgl_mulai, profileItem.tgl_selesai);
          const filteredCalendar = hideLibur
            ? calendarData.filter((c) => c.status !== 'LIBUR')
            : calendarData;

          return (
            <div className="fixed inset-0 bg-slate-950/75 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-[#F4F6F8] rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-300 my-auto max-h-[92vh] flex flex-col">
                <div className="bg-[#043666] p-5 sm:p-6 text-white border-b-4 border-[#E9C170] shrink-0">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className="inline-block px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-[#04315C] text-[#E9C170] border border-[#BD944D]/50 rounded mb-1.5">
                        Kartu Profil & Rincian Kalender Magang
                      </span>
                      <h3 className="text-xl sm:text-2xl font-extrabold truncate text-white">{profileItem.nama}</h3>
                      <p className="text-slate-200 text-xs sm:text-sm truncate mt-0.5">{profileItem.universitas}</p>
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
                        className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
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
                      <div className="text-sm sm:text-base font-extrabold text-slate-900 mt-1">
                        {profileItem.tgl_mulai || 'Belum diatur'}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg bg-white border border-slate-200 border-l-4 border-l-[#BD944D]">
                      <div className="text-[11px] font-bold text-slate-500 uppercase">Berakhir Magang</div>
                      <div className="text-sm sm:text-base font-extrabold text-slate-900 mt-1">
                        {profileItem.tgl_selesai || 'Belum diatur'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-white border border-slate-200 text-center">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Total Hadir</div>
                      <div className="text-lg font-black text-[#043666] mt-1">
                        {profileItem.count} <span className="text-xs font-semibold">Hari</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-slate-200 text-center">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Izin / Sakit</div>
                      <div className="text-lg font-black text-amber-700 mt-1">
                        {profileItem.izinCount || 0} <span className="text-xs font-semibold">Hari</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-red-50/60 border border-red-200 text-center">
                      <div className="text-[10px] font-bold text-red-700 uppercase">Tidak Hadir</div>
                      <div className="text-lg font-black text-red-700 mt-1">
                        {profileItem.alphaCount || 0} <span className="text-xs font-semibold">Hari</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-slate-200 text-center">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Terakhir Hadir</div>
                      <div className="text-xs sm:text-sm font-extrabold text-slate-900 mt-2">
                        {profileItem.terakhir || '-'}
                      </div>
                    </div>
                  </div>

                  {prog && (
                    <div className="bg-white px-4 py-3 rounded-lg border border-slate-200">
                      <div className="flex justify-between text-xs text-slate-700 mb-1.5 font-bold">
                        <span>Progres Durasi ({prog.totalDays} hari kalender)</span>
                        <span className="text-[#043666]">Sisa {prog.remaining} hari</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#043666] rounded-full"
                          style={{ width: `${prog.pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Panel Tombol Isi Otomatis Masa Lalu & Batalkan Isi Otomatis */}
                  {(indivMeta.missing_past_workdays > 0 || indivMeta.auto_count > 0) && (
                    <div className="bg-amber-50/90 border border-amber-300 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-amber-950 max-w-md">
                        <span className="font-extrabold uppercase tracking-wider block text-[#043666]">
                          Sinkronisasi Kehadiran Pra-Sistem (07:15 – 16:05)
                        </span>
                        {indivMeta.missing_past_workdays > 0 ? (
                          <span>
                            Terdapat <strong>{indivMeta.missing_past_workdays} hari kerja</strong> (Senin–Kamis) sebelum{' '}
                            <strong>{indivMeta.first_real_date}</strong> yang belum terisi di database.
                          </span>
                        ) : (
                          <span>
                            Tercatat <strong>{indivMeta.auto_count} hari kerja</strong> masa lalu yang telah diisi otomatis (Pra-Sistem).
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {indivMeta.missing_past_workdays > 0 && (
                          <button
                            type="button"
                            disabled={processingAuto}
                            onClick={handleBackfillPast}
                            className="px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider bg-[#043666] hover:bg-[#04315C] text-[#E9C170] rounded shadow-sm transition-colors disabled:opacity-50"
                          >
                            {processingAuto ? 'Memproses...' : `+ Isi Otomatis Masa Lalu (${indivMeta.missing_past_workdays} Hari)`}
                          </button>
                        )}
                        {indivMeta.auto_count > 0 && (
                          <button
                            type="button"
                            disabled={processingAuto}
                            onClick={handleUndoBackfill}
                            className="px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider bg-red-700 hover:bg-red-800 text-white rounded shadow-sm transition-colors disabled:opacity-50"
                          >
                            {processingAuto ? 'Memproses...' : `Batalkan Isi Otomatis (${indivMeta.auto_count} Hari)`}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tabel Rincian Kalender Harian */}
                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="text-xs font-extrabold uppercase tracking-wider text-[#043666]">
                          Daftar Kehadiran Harian (Senin–Kamis Kerja, Jumat–Minggu Libur)
                        </span>
                      </div>
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={hideLibur}
                          onChange={(e) => setHideLibur(e.target.checked)}
                          className="w-3.5 h-3.5 accent-[#043666] rounded"
                        />
                        Sembunyikan Hari Libur
                      </label>
                    </div>

                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-200 sticky top-0">
                          <tr>
                            <th className="px-3.5 py-2.5">Tanggal</th>
                            <th className="px-3.5 py-2.5">Hari</th>
                            <th className="px-3.5 py-2.5">Status</th>
                            <th className="px-3.5 py-2.5">Jam Masuk</th>
                            <th className="px-3.5 py-2.5">Jam Keluar</th>
                            <th className="px-3.5 py-2.5">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-800">
                          {loadingCalendar ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center font-bold text-[#043666] uppercase tracking-wider">
                                Menyusun Kalender Kehadiran...
                              </td>
                            </tr>
                          ) : (
                            filteredCalendar.map((c, idx) => (
                              <tr
                                key={idx}
                                className={
                                  c.status === 'LIBUR'
                                    ? 'bg-slate-50/70 text-slate-400'
                                    : c.status === 'TIDAK_HADIR'
                                    ? 'bg-red-50/30 hover:bg-red-50/60'
                                    : 'hover:bg-slate-50'
                                }
                              >
                                <td className="px-3.5 py-2 font-semibold whitespace-nowrap">{c.tanggal}</td>
                                <td className="px-3.5 py-2 whitespace-nowrap">{c.hari}</td>
                                <td className="px-3.5 py-2 whitespace-nowrap">
                                  {c.status === 'HADIR' && (
                                    <span className="inline-block px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      Hadir
                                    </span>
                                  )}
                                  {c.status === 'IZIN' && (
                                    <span className="inline-block px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-amber-100 text-amber-900 border border-amber-300">
                                      {c.jenis_izin || 'Izin'}
                                    </span>
                                  )}
                                  {c.status === 'BELUM_ABSEN' && (
                                    <span className="inline-block px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-amber-50 text-amber-800 border border-amber-300">
                                      Belum Absen
                                    </span>
                                  )}
                                  {c.status === 'TIDAK_HADIR' && (
                                    <span className="inline-block px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-red-100 text-red-800 border border-red-300">
                                      Tidak Hadir
                                    </span>
                                  )}
                                  {c.status === 'LIBUR' && (
                                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-200 text-slate-600">
                                      Libur
                                    </span>
                                  )}
                                </td>
                                <td className="px-3.5 py-2 font-semibold">{c.jam_masuk}</td>
                                <td className="px-3.5 py-2">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="font-semibold">{c.jam_keluar}</span>
                                    {c.tidak_absen_pulang && (
                                      <span className="inline-block px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded bg-red-100 text-red-800 border border-red-300">
                                        Tidak Absen Pulang
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3.5 py-2">{c.keterangan}</td>
                              </tr>
                            ))
                          )}
                          {!loadingCalendar && filteredCalendar.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                                Tidak ada data tanggal untuk ditampilkan.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="px-5 sm:px-6 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
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
                      Unduh CSV Lengkap
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