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

  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [holForm, setHolForm] = useState({ tanggal: '', tanggal_selesai: '', keterangan: '' });
  const [savingHoliday, setSavingHoliday] = useState(false);

  const loadHolidays = () => {
    setLoadingHolidays(true);
    fetch('/api/admin/data?tipe=libur')
      .then((res) => res.json())
      .then((d) => {
        setHolidays(Array.isArray(d) ? d : []);
        setLoadingHolidays(false);
      })
      .catch(() => setLoadingHolidays(false));
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holForm.tanggal) return;
    setSavingHoliday(true);
    try {
      const res = await fetch('/api/admin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_holiday',
          tanggal: holForm.tanggal,
          tanggal_selesai: holForm.tanggal_selesai || holForm.tanggal,
          keterangan: holForm.keterangan || 'Hari Libur Nasional',
        }),
      });
      const result = await res.json();
      if (res.ok && result.ok) {
        setHolForm({ tanggal: '', tanggal_selesai: '', keterangan: '' });
        loadHolidays();
        loadRekap();
      } else {
        alert(result.error || 'Gagal menyimpan hari libur.');
      }
    } catch {
      alert('Gagal menghubungi server.');
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (tanggal: string) => {
    const ok = window.confirm(`Hapus tanggal merah / libur ${tanggal}?`);
    if (!ok) return;
    try {
      const res = await fetch('/api/admin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_holiday', tanggal }),
      });
      if (res.ok) {
        loadHolidays();
        loadRekap();
      }
    } catch {}
  };

  const [ttdJabatan, setTtdJabatan] = useState('Pembimbing / Pejabat Berwenang,');
  const [ttdNama, setTtdNama] = useState('');
  const [ttdNip, setTtdNip] = useState('Kanwil Ditjen Imigrasi Sulawesi Selatan');

  useEffect(() => {
    try {
      const savedTtd = localStorage.getItem('rekap_ttd_pejabat');
      if (savedTtd) {
        const parsed = JSON.parse(savedTtd);
        if (parsed.jabatan !== undefined) setTtdJabatan(parsed.jabatan);
        if (parsed.nama !== undefined) setTtdNama(parsed.nama);
        if (parsed.nip !== undefined) setTtdNip(parsed.nip);
      }
    } catch {}
  }, []);

  const updateTtdConfig = (field: 'jabatan' | 'nama' | 'nip', val: string) => {
    const next = {
      jabatan: field === 'jabatan' ? val : ttdJabatan,
      nama: field === 'nama' ? val : ttdNama,
      nip: field === 'nip' ? val : ttdNip,
    };
    if (field === 'jabatan') setTtdJabatan(val);
    if (field === 'nama') setTtdNama(val);
    if (field === 'nip') setTtdNip(val);
    try {
      localStorage.setItem('rekap_ttd_pejabat', JSON.stringify(next));
    } catch {}
  };

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

  const fitText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 0 && ctx.measureText(t + '...').width > maxWidth) {
      t = t.slice(0, -1);
    }
    return t + '...';
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

  // Unduh Kartu Profil PNG Resolusi Tinggi (2x Retina Scale - Rapi & Tajam)
  const downloadProfilePng = async (item: any) => {
    const scale = 2;
    const W = 920;
    const H = 640;
    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);

    // Latar belakang utama
    ctx.fillStyle = '#F4F6F8';
    ctx.fillRect(0, 0, W, H);

    // Bingkai luar tipis
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    // Header Wisdom Blue (#043666)
    ctx.fillStyle = '#043666';
    ctx.fillRect(0, 0, W, 156);

    // Aksen garis Dignity Gold (#E9C170)
    ctx.fillStyle = '#E9C170';
    ctx.fillRect(0, 156, W, 6);

    // Badge judul di kiri atas
    drawRoundedRect(ctx, 44, 24, 340, 24, 4);
    ctx.fillStyle = '#04315C';
    ctx.fill();
    ctx.strokeStyle = 'rgba(233, 193, 112, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#E9C170';
    ctx.font = 'bold 10.5px sans-serif';
    ctx.fillText('KARTU PROFIL & REKAPITULASI PESERTA MAGANG', 54, 40);

    // Nama Peserta (anti-overflow)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px sans-serif';
    const safeNama = fitText(ctx, String(item.nama || '-'), 520);
    ctx.fillText(safeNama, 44, 86);

    // Universitas (anti-overflow)
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '600 15px sans-serif';
    const safeUniv = fitText(ctx, String(item.universitas || '-'), 520);
    ctx.fillText(safeUniv, 44, 114);

    // Status Kedisiplinan di Header
    const sp = item.spCount || 0;
    const spLabel =
      sp === 0
        ? 'STATUS DISIPLIN: TERTIB (TANPA SP)'
        : sp === 1
        ? 'STATUS DISIPLIN: PERINGATAN SP-1'
        : sp === 2
        ? 'STATUS DISIPLIN: PERINGATAN SP-2'
        : 'STATUS DISIPLIN: SP-3 (TERBLOKIR)';

    ctx.fillStyle = sp === 0 ? '#86EFAC' : '#FCA5A5';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(spLabel, 44, 138);

    // Teks Instansi Kanan Atas
    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#E9C170';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('KEMENTERIAN IMIGRASI DAN PEMASYARAKATAN', 776, 54);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14.5px sans-serif';
    ctx.fillText('DITJEN IMIGRASI KANWIL SULSEL', 776, 76);
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '12px sans-serif';
    ctx.fillText('Sistem Presensi Digital Peserta Magang', 776, 98);
    ctx.restore();

    const drawLogo = () =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.drawImage(img, 792, 34, 84, 84);
          resolve();
        };
        img.onerror = () => {
          drawFallbackEmblem(ctx, 834, 76, 38);
          resolve();
        };
        img.src = '/logo-imigrasi.png';
      });

    await drawLogo();

    // 2 Kotak Periode Magang
    const periodBoxes = [
      { label: 'TANGGAL MULAI MAGANG', val: item.tgl_mulai || 'Belum diatur', accent: '#043666' },
      { label: 'TANGGAL BERAKHIR MAGANG', val: item.tgl_selesai || 'Belum diatur', accent: '#BD944D' },
    ];

    periodBoxes.forEach((pb, idx) => {
      const x = 44 + idx * 424;
      const y = 188;
      const w = 408;
      const h = 98;

      drawRoundedRect(ctx, x, y, w, h, 10);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#CBD5E1';
      ctx.stroke();

      ctx.fillStyle = pb.accent;
      ctx.fillRect(x, y + 12, 5, h - 24);

      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(pb.label, x + 22, y + 36);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(String(pb.val), x + 22, y + 72);
    });

    // 4 Kotak Statistik Utama
    const stats = [
      { label: 'TOTAL HADIR', val: `${item.count || 0} Hari`, color: '#043666', bg: '#FFFFFF', border: '#CBD5E1' },
      { label: 'IZIN / SAKIT', val: `${item.izinCount || 0} Hari`, color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
      { label: 'TIDAK HADIR (ALPHA)', val: `${item.alphaCount || 0} Hari`, color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
      { label: 'TERAKHIR HADIR', val: item.terakhir || '-', color: '#04315C', bg: '#FFFFFF', border: '#CBD5E1' },
    ];

    stats.forEach((st, idx) => {
      const x = 44 + idx * 212;
      const y = 308;
      const w = 196;
      const h = 114;

      drawRoundedRect(ctx, x, y, w, h, 10);
      ctx.fillStyle = st.bg;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = st.border;
      ctx.stroke();

      ctx.fillStyle = '#475569';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(st.label, x + 18, y + 38);

      ctx.fillStyle = st.color;
      ctx.font = 'bold 23px sans-serif';
      ctx.fillText(String(st.val), x + 18, y + 80);
    });

    // Bar Progres Masa Magang
    const prog = calcProgress(item.tgl_mulai, item.tgl_selesai);
    const px = 44;
    const py = 444;
    const pw = 832;
    const ph = 92;

    drawRoundedRect(ctx, px, py, pw, ph, 10);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (prog) {
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`Status Pelaksanaan: ${prog.status}`, px + 22, py + 32);

      ctx.save();
      ctx.textAlign = 'right';
      ctx.fillStyle = '#043666';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(
        `Progres Durasi: ${prog.pct}% (${prog.totalDays} hari kalender | Sisa ${prog.remaining} hari)`,
        px + pw - 22,
        py + 32
      );
      ctx.restore();

      drawRoundedRect(ctx, px + 22, py + 50, pw - 44, 16, 8);
      ctx.fillStyle = '#E2E8F0';
      ctx.fill();

      const fillW = Math.max(16, Math.round(((pw - 44) * prog.pct) / 100));
      drawRoundedRect(ctx, px + 22, py + 50, fillW, 16, 8);
      ctx.fillStyle = '#043666';
      ctx.fill();
    } else {
      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('Periode tanggal mulai dan berakhir magang belum diatur pada sistem.', px + 22, py + 52);
    }

    // Footer bawah
    ctx.fillStyle = '#04315C';
    ctx.fillRect(0, H - 54, W, 54);
    ctx.fillStyle = '#BD944D';
    ctx.fillRect(0, H - 54, W, 3);

    const todayStr = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '12px sans-serif';
    ctx.fillText(
      `Dokumen Resmi Sistem Presensi Magang — Kanwil Ditjen Imigrasi Sulawesi Selatan`,
      44,
      H - 22
    );

    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#E9C170';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`Dicetak: ${todayStr}`, W - 44, H - 22);
    ctx.restore();

    const link = document.createElement('a');
    link.download = `KartuProfil_${item.nama.replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Cetak / Simpan PDF Resmi (A4 Multi-Halaman dengan Seluruh Tabel Daftar Hadir)
  const printFullPdfReport = (item: any, calList: any[]) => {
    if (loadingCalendar) {
      alert('Mohon tunggu sejenak, daftar kehadiran sedang dimuat...');
      return;
    }

    const prog = calcProgress(item.tgl_mulai, item.tgl_selesai);
    const todayStr = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
    const originUrl = window.location.origin;

    // Urutkan dari tanggal paling awal ke terbaru untuk laporan cetak resmi
    const rowsForPrint = [...calList]
      .filter((c) => (hideLibur ? c.status !== 'LIBUR' : true))
      .reverse();

    const esc = (s: any) =>
      String(s ?? '-')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const sp = item.spCount || 0;
    const spText =
      sp === 0 ? 'Tertib (Tanpa SP)' : sp === 1 ? 'SP-1' : sp === 2 ? 'SP-2' : 'SP-3 (Terblokir)';

    const tableRowsHtml = rowsForPrint
      .map((c, i) => {
        let badgeStyle = 'background:#F1F5F9;color:#475569;border:1px solid #CBD5E1;';
        let statusLabel = c.status;

        if (c.status === 'HADIR') {
          badgeStyle = 'background:#DCFCE7;color:#166534;border:1px solid #86EFAC;';
          statusLabel = 'HADIR';
        } else if (c.status === 'IZIN') {
          badgeStyle = 'background:#FEF3C7;color:#92400E;border:1px solid #FDE68A;';
          statusLabel = c.jenis_izin ? `IZIN (${c.jenis_izin.toUpperCase()})` : 'IZIN';
        } else if (c.status === 'TIDAK_HADIR') {
          badgeStyle = 'background:#FEE2E2;color:#991B1B;border:1px solid #FCA5A5;';
          statusLabel = 'TIDAK HADIR';
        } else if (c.status === 'BELUM_ABSEN') {
          badgeStyle = 'background:#FEF9C3;color:#854D0E;border:1px solid #FDE047;';
          statusLabel = 'BELUM ABSEN';
        } else if (c.status === 'LIBUR') {
          badgeStyle = 'background:#F1F5F9;color:#64748B;border:1px solid #E2E8F0;';
          statusLabel = 'LIBUR';
        }

        const tapBadge = c.tidak_absen_pulang
          ? `<span style="display:inline-block;margin-left:5px;padding:1px 5px;font-size:8.5px;font-weight:800;border-radius:3px;background:#FEE2E2;color:#991B1B;border:1px solid #FCA5A5;">TIDAK ABSEN PULANG</span>`
          : '';

        const rowBg =
          c.status === 'LIBUR'
            ? 'background:#F8FAFC;color:#64748B;'
            : c.status === 'TIDAK_HADIR'
            ? 'background:#FEF2F2;'
            : i % 2 === 1
            ? 'background:#F8FAFC;'
            : 'background:#FFFFFF;';

        return `
          <tr style="${rowBg}">
            <td style="text-align:center;font-weight:600;">${i + 1}</td>
            <td style="font-weight:700;white-space:nowrap;">${esc(c.tanggal)}</td>
            <td style="white-space:nowrap;">${esc(c.hari)}</td>
            <td>
              <span style="display:inline-block;padding:2px 7px;font-size:9.5px;font-weight:800;border-radius:4px;${badgeStyle}">
                ${esc(statusLabel)}
              </span>
            </td>
            <td style="text-align:center;font-weight:700;">${esc(c.jam_masuk)}</td>
            <td style="text-align:center;font-weight:700;">
              ${esc(c.jam_keluar)}${tapBadge}
            </td>
            <td>${esc(c.keterangan)}</td>
          </tr>
        `;
      })
      .join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Laporan_Kehadiran_${esc(item.nama.replace(/\s+/g, '_'))}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.45;
    }
    .no-print-bar {
      background: #043666;
      color: #FFFFFF;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 3px solid #E9C170;
      margin-bottom: 18px;
    }
    .no-print-bar button {
      background: #E9C170;
      color: #04315C;
      border: none;
      padding: 8px 16px;
      font-weight: 800;
      font-size: 12px;
      border-radius: 6px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .page-wrap {
      max-width: 190mm;
      margin: 0 auto;
    }
    .kop-header {
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 3px solid #043666;
      padding-bottom: 12px;
      margin-bottom: 4px;
    }
    .kop-header img {
      width: 64px;
      height: 64px;
      object-fit: contain;
    }
    .kop-text {
      flex: 1;
    }
    .kop-text .kementerian {
      font-size: 11px;
      font-weight: 800;
      color: #043666;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .kop-text .instansi {
      font-size: 16px;
      font-weight: 900;
      color: #0F172A;
      margin-top: 2px;
      text-transform: uppercase;
    }
    .kop-text .sub {
      font-size: 11px;
      color: #475569;
      margin-top: 2px;
    }
    .kop-gold-line {
      height: 2px;
      background: #BD944D;
      margin-bottom: 16px;
    }
    .judul-dokumen {
      text-align: center;
      margin-bottom: 16px;
    }
    .judul-dokumen h1 {
      font-size: 14px;
      font-weight: 900;
      color: #043666;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .judul-dokumen p {
      font-size: 10.5px;
      color: #64748B;
      margin: 3px 0 0 0;
    }
    .identitas-box {
      border: 1px solid #CBD5E1;
      border-left: 4px solid #043666;
      border-radius: 6px;
      padding: 12px 16px;
      background: #F8FAFC;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 24px;
      margin-bottom: 14px;
    }
    .identitas-item {
      display: flex;
      font-size: 11px;
    }
    .identitas-label {
      width: 125px;
      font-weight: 700;
      color: #475569;
      flex-shrink: 0;
    }
    .identitas-val {
      font-weight: 800;
      color: #0F172A;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }
    .stat-card {
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 10px 12px;
      text-align: center;
      background: #FFFFFF;
    }
    .stat-card .lbl {
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      color: #64748B;
    }
    .stat-card .val {
      font-size: 18px;
      font-weight: 900;
      margin-top: 4px;
    }
    table.Attendance {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    table.Attendance thead {
      display: table-header-group;
    }
    table.Attendance tr {
      page-break-inside: avoid;
    }
    table.Attendance th {
      background: #043666;
      color: #FFFFFF;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 9.5px;
      letter-spacing: 0.05em;
      padding: 8px 8px;
      border: 1px solid #043666;
      text-align: left;
    }
    table.Attendance td {
      padding: 6.5px 8px;
      border: 1px solid #CBD5E1;
      vertical-align: middle;
    }
    .ttd-wrap {
      margin-top: 28px;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
      font-size: 11px;
    }
    .ttd-box {
      width: 220px;
      text-align: center;
    }
    .ttd-space {
      height: 64px;
    }
    @media print {
      .no-print-bar {
        display: none !important;
      }
      .page-wrap {
        max-width: 100%;
        padding: 14mm 14mm 16mm 14mm;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div>
      <strong>Pratinjau Cetak PDF Resmi</strong> — Pilih tujuan <em>"Save as PDF" / "Simpan sebagai PDF"</em> pada jendela cetak browser Anda.
    </div>
    <button onclick="window.print()">Cetak / Simpan PDF</button>
  </div>

  <div class="page-wrap">
    <div class="kop-header">
      <img src="${originUrl}/logo-imigrasi.png" alt="Logo Imigrasi" onerror="this.style.display='none'" />
      <div class="kop-text">
        <div class="kementerian">Kementerian Imigrasi dan Pemasyarakatan Republik Indonesia</div>
        <div class="instansi">Direktorat Jenderal Imigrasi — Kantor Wilayah Sulawesi Selatan</div>
        <div class="sub">Laporan Resmi Rekapitulasi & Rincian Presensi Harian Peserta Magang</div>
      </div>
    </div>
    <div class="kop-gold-line"></div>

    <div class="judul-dokumen">
      <h1>Rekapitulasi Kehadiran Peserta Magang</h1>
      <p>Tanggal Cetak Dokumen: ${esc(todayStr)}</p>
    </div>

    <div class="identitas-box">
      <div class="identitas-item">
        <span class="identitas-label">Nama Lengkap</span>
        <span class="identitas-val">: ${esc(item.nama)}</span>
      </div>
      <div class="identitas-item">
        <span class="identitas-label">Mulai Magang</span>
        <span class="identitas-val">: ${esc(item.tgl_mulai || 'Belum diatur')}</span>
      </div>
      <div class="identitas-item">
        <span class="identitas-label">Universitas / Instansi</span>
        <span class="identitas-val">: ${esc(item.universitas)}</span>
      </div>
      <div class="identitas-item">
        <span class="identitas-label">Berakhir Magang</span>
        <span class="identitas-val">: ${esc(item.tgl_selesai || 'Belum diatur')}</span>
      </div>
      <div class="identitas-item">
        <span class="identitas-label">Status Kedisiplinan</span>
        <span class="identitas-val">: ${esc(spText)}</span>
      </div>
      <div class="identitas-item">
        <span class="identitas-label">Progres Durasi</span>
        <span class="identitas-val">: ${prog ? `${prog.status} (${prog.pct}% — Sisa ${prog.remaining} hari)` : '-'}</span>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="lbl">Total Hadir</div>
        <div class="val" style="color:#043666;">${item.count || 0} Hari</div>
      </div>
      <div class="stat-card" style="background:#FFFBEB;border-color:#FDE68A;">
        <div class="lbl" style="color:#92400E;">Total Izin / Sakit</div>
        <div class="val" style="color:#B45309;">${item.izinCount || 0} Hari</div>
      </div>
      <div class="stat-card" style="background:#FEF2F2;border-color:#FECACA;">
        <div class="lbl" style="color:#991B1B;">Tidak Hadir (Alpha)</div>
        <div class="val" style="color:#B91C1C;">${item.alphaCount || 0} Hari</div>
      </div>
      <div class="stat-card">
        <div class="lbl">Terakhir Hadir</div>
        <div class="val" style="color:#0F172A;font-size:15px;margin-top:7px;">${esc(item.terakhir || '-')}</div>
      </div>
    </div>

    <table class="Attendance">
      <thead>
        <tr>
          <th style="width:34px;text-align:center;">No</th>
          <th style="width:88px;">Tanggal</th>
          <th style="width:68px;">Hari</th>
          <th style="width:115px;">Status</th>
          <th style="width:72px;text-align:center;">Jam Masuk</th>
          <th style="width:120px;text-align:center;">Jam Keluar</th>
          <th>Keterangan</th>
        </tr>
      </thead>
      <tbody>
        ${
          tableRowsHtml ||
          `<tr><td colspan="7" style="text-align:center;padding:20px;color:#64748B;">Tidak ada rincian tanggal untuk ditampilkan.</td></tr>`
        }
      </tbody>
    </table>

    <div class="ttd-wrap">
      <div class="ttd-box">
        <div>Peserta Magang,</div>
        <div class="ttd-space"></div>
        <div style="font-weight:800;text-decoration:underline;">${esc(item.nama)}</div>
        <div style="color:#475569;font-size:10px;margin-top:2px;">${esc(item.universitas)}</div>
      </div>
      <div class="ttd-box">
        <div>Makassar, <span contenteditable="true" style="outline:none;">${esc(todayStr)}</span><br/><span contenteditable="true" style="outline:none;">${esc(ttdJabatan || 'Pembimbing / Pejabat Berwenang,')}</span></div>
        <div class="ttd-space"></div>
        <div contenteditable="true" style="font-weight:800;text-decoration:underline;outline:none;">${esc(ttdNama.trim() ? ttdNama.trim() : '( ................................................ )')}</div>
        <div contenteditable="true" style="color:#475569;font-size:10px;margin-top:2px;outline:none;">${esc(ttdNip || 'Kanwil Ditjen Imigrasi Sulawesi Selatan')}</div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`;

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Pop-up diblokir oleh browser. Izinkan pop-up pada situs ini untuk mencetak laporan PDF.');
      return;
    }
    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const todayWita = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
              setHolForm({ tanggal: todayWita, tanggal_selesai: todayWita, keterangan: '' });
              setHolidayModalOpen(true);
              loadHolidays();
            }}
            className="px-3.5 py-2 bg-white hover:bg-slate-100 text-[#043666] border border-[#043666] font-bold text-xs uppercase tracking-wider rounded-md shadow-sm transition-colors"
          >
            Kelola Hari Libur
          </button>
          <a
            href={`/api/admin/export?tipe=rekap&q=${encodeURIComponent(search)}&active=${activeOnly}`}
            className="px-4 py-2 bg-[#043666] hover:bg-[#04315C] text-[#E9C170] font-bold text-xs uppercase tracking-wider rounded-md shadow-sm transition-colors"
          >
            Ekspor CSV
          </a>
        </div>
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

      {holidayModalOpen && (
        <div className="fixed inset-0 bg-slate-950/75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[88vh]">
            <div className="bg-[#043666] px-6 py-4 border-b-2 border-[#E9C170] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#E9C170] block">
                  Kalender Kerja Kanwil Sulsel
                </span>
                <h3 className="text-base font-extrabold text-white mt-0.5">
                  Kelola Hari Libur Nasional & Cuti Bersama
                </h3>
              </div>
              <span className="px-2.5 py-0.5 text-[11px] font-extrabold rounded bg-[#E9C170] text-[#04315C]">
                {holidays.length} Tanggal
              </span>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <form onSubmit={handleAddHoliday} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#043666]">
                  + Tambah Tanggal Merah / Cuti Bersama
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                      Dari Tanggal
                    </label>
                    <input
                      type="date"
                      required
                      value={holForm.tanggal}
                      onChange={(e) =>
                        setHolForm((f) => ({
                          ...f,
                          tanggal: e.target.value,
                          tanggal_selesai: f.tanggal_selesai < e.target.value ? e.target.value : f.tanggal_selesai,
                        }))
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:border-[#043666]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                      Sampai Tanggal
                    </label>
                    <input
                      type="date"
                      required
                      min={holForm.tanggal}
                      value={holForm.tanggal_selesai}
                      onChange={(e) => setHolForm({ ...holForm, tanggal_selesai: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:border-[#043666]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                    Nama Hari Libur / Keterangan
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    placeholder="Contoh: Libur Nasional / Cuti Bersama"
                    value={holForm.keterangan}
                    onChange={(e) => setHolForm({ ...holForm, keterangan: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:border-[#043666]"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingHoliday}
                    className="px-4 py-1.5 bg-[#043666] hover:bg-[#04315C] text-[#E9C170] font-bold text-xs uppercase tracking-wider rounded shadow-sm disabled:opacity-50"
                  >
                    {savingHoliday ? 'Menyimpan...' : 'Simpan Hari Libur'}
                  </button>
                </div>
              </form>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  Daftar Tanggal Merah Terdaftar (Selain Jumat–Minggu)
                </div>
                <div className="max-h-52 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-extrabold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="px-3.5 py-2">Tanggal</th>
                        <th className="px-3.5 py-2">Hari</th>
                        <th className="px-3.5 py-2">Keterangan</th>
                        <th className="px-3.5 py-2 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {loadingHolidays ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-slate-400 font-bold">
                            Memuat daftar hari libur...
                          </td>
                        </tr>
                      ) : (
                        holidays.map((h, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3.5 py-2 font-bold text-slate-900 whitespace-nowrap">{h.tanggal}</td>
                            <td className="px-3.5 py-2 text-slate-600 whitespace-nowrap">{h.hari}</td>
                            <td className="px-3.5 py-2 text-slate-800">{h.keterangan}</td>
                            <td className="px-3.5 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteHoliday(h.tanggal)}
                                className="px-2 py-0.5 text-[10px] font-bold uppercase bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-700 hover:text-white"
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                      {!loadingHolidays && holidays.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                            Belum ada tanggal merah tambahan. (Jumat, Sabtu, dan Minggu sudah otomatis libur).
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setHolidayModalOpen(false)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-slate-300 bg-white rounded-md text-slate-700 hover:bg-slate-100"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

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

                <div className="px-5 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 shrink-0">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#043666] mb-2">
                    Pengaturan Penandatangan Cetak PDF (Otomatis Tersimpan)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                        Jabatan Penandatangan
                      </label>
                      <input
                        type="text"
                        value={ttdJabatan}
                        onChange={(e) => updateTtdConfig('jabatan', e.target.value)}
                        placeholder="Pembimbing / Pejabat Berwenang,"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:border-[#043666]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                        Nama Pejabat / Pembimbing
                      </label>
                      <input
                        type="text"
                        value={ttdNama}
                        onChange={(e) => updateTtdConfig('nama', e.target.value)}
                        placeholder="Kosongkan jika ingin titik-titik (...)"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:border-[#043666]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                        NIP / Baris Bawah Tanda Tangan
                      </label>
                      <input
                        type="text"
                        value={ttdNip}
                        onChange={(e) => updateTtdConfig('nip', e.target.value)}
                        placeholder="NIP. ... / Kanwil Ditjen Imigrasi Sulsel"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:border-[#043666]"
                      />
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
                      onClick={() => printFullPdfReport(profileItem, calendarData)}
                      className="px-3.5 py-2 text-xs font-bold uppercase tracking-wider bg-slate-800 text-white rounded-md hover:bg-slate-900"
                    >
                      Cetak / PDF Lengkap
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