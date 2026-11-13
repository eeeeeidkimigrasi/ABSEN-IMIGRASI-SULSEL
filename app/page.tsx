'use client';

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

type FormData = {
  nama: string;
  universitas: string;
  jam_masuk: string;
  jam_keluar: string;
  keterangan: string;
  jenis: string;
  link_surat: string;
  tgl_mulai: string;
  tgl_selesai: string;
  izin_mulai: string;
  izin_selesai: string;
};

type Mode = 'hadir' | 'pulang' | 'izin' | 'rekap';

export default function AbsenPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('hadir');
  const todayWita = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

  const [form, setForm] = useState<FormData>({
    nama: '',
    universitas: '',
    jam_masuk: '',
    jam_keluar: '',
    keterangan: '',
    jenis: 'Sakit',
    link_surat: '',
    tgl_mulai: '',
    tgl_selesai: '',
    izin_mulai: todayWita,
    izin_selesai: todayWita,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [spModal, setSpModal] = useState<'none' | 'sp2' | 'sp3'>('none');

  const [rekapResult, setRekapResult] = useState<any>(null);
  const [hideLibur, setHideLibur] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('absen_last');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.nama) setForm((f) => ({ ...f, nama: data.nama }));
        if (data.universitas) setForm((f) => ({ ...f, universitas: data.universitas }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;
    setForm((f) => ({
      ...f,
      jam_masuk: mode === 'hadir' ? currentTime : f.jam_masuk,
      jam_keluar: mode === 'pulang' ? currentTime : f.jam_keluar,
    }));
  }, [mode]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((f) => {
      const updated = { ...f, [name]: value };
      if (name === 'izin_mulai' && updated.izin_selesai < value) {
        updated.izin_selesai = value;
      }
      return updated;
    });
    setError(null);
    setStatusMsg(null);
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

  const downloadMyCsv = (item: any) => {
    const escCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      let s = String(val).trim();
      if (/^[=+-@\t\r]/.test(s)) s = "'" + s;
      if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    };

    let csv = '\uFEFFTANGGAL,HARI,NAMA,UNIVERSITAS,STATUS,JAM MASUK,JAM KELUAR,KETERANGAN\n';
    (item.calendar || []).forEach((c: any) => {
      const stLabel = c.status === 'IZIN' && c.jenis_izin ? `IZIN (${c.jenis_izin})` : c.status;
      csv += `${c.tanggal},${c.hari},${escCsv(item.nama)},${escCsv(item.universitas)},${escCsv(stLabel)},${c.jam_masuk},${c.jam_keluar},${escCsv(c.keterangan)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Rekap_Kehadiran_${item.nama.replace(/\s+/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadMyPng = async (item: any) => {
    const scale = 2;
    const W = 920;
    const H = 640;
    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);

    const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
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

    const fitText = (text: string, maxWidth: number): string => {
      if (ctx.measureText(text).width <= maxWidth) return text;
      let t = text;
      while (t.length > 0 && ctx.measureText(t + '...').width > maxWidth) {
        t = t.slice(0, -1);
      }
      return t + '...';
    };

    ctx.fillStyle = '#F4F6F8';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    ctx.fillStyle = '#043666';
    ctx.fillRect(0, 0, W, 156);
    ctx.fillStyle = '#E9C170';
    ctx.fillRect(0, 156, W, 6);

    drawRoundedRect(44, 24, 340, 24, 4);
    ctx.fillStyle = '#04315C';
    ctx.fill();
    ctx.strokeStyle = 'rgba(233, 193, 112, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#E9C170';
    ctx.font = 'bold 10.5px sans-serif';
    ctx.fillText('KARTU PROFIL & REKAPITULASI PESERTA MAGANG', 54, 40);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(fitText(String(item.nama || '-'), 520), 44, 86);

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '600 15px sans-serif';
    ctx.fillText(fitText(String(item.universitas || '-'), 520), 44, 114);

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

    await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, 792, 34, 84, 84);
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = '/logo-imigrasi.png';
    });

    const periodBoxes = [
      { label: 'TANGGAL MULAI MAGANG', val: item.tgl_mulai || 'Belum diatur', accent: '#043666' },
      { label: 'TANGGAL BERAKHIR MAGANG', val: item.tgl_selesai || 'Belum diatur', accent: '#BD944D' },
    ];

    periodBoxes.forEach((pb, idx) => {
      const x = 44 + idx * 424;
      const y = 188;
      const w = 408;
      const h = 98;
      drawRoundedRect(x, y, w, h, 10);
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
      drawRoundedRect(x, y, w, h, 10);
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

    const prog = calcProgress(item.tgl_mulai, item.tgl_selesai);
    const px = 44;
    const py = 444;
    const pw = 832;
    const ph = 92;

    drawRoundedRect(px, py, pw, ph, 10);
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
      ctx.fillText(`Progres Durasi: ${prog.pct}% (${prog.totalDays} hari kalender | Sisa ${prog.remaining} hari)`, px + pw - 22, py + 32);
      ctx.restore();
      drawRoundedRect(px + 22, py + 50, pw - 44, 16, 8);
      ctx.fillStyle = '#E2E8F0';
      ctx.fill();
      const fillW = Math.max(16, Math.round(((pw - 44) * prog.pct) / 100));
      drawRoundedRect(px + 22, py + 50, fillW, 16, 8);
      ctx.fillStyle = '#043666';
      ctx.fill();
    } else {
      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('Periode tanggal mulai dan berakhir magang belum diatur pada sistem.', px + 22, py + 52);
    }

    ctx.fillStyle = '#04315C';
    ctx.fillRect(0, H - 54, W, 54);
    ctx.fillStyle = '#BD944D';
    ctx.fillRect(0, H - 54, W, 3);

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '12px sans-serif';
    ctx.fillText('Dokumen Resmi Sistem Presensi Magang — Kanwil Ditjen Imigrasi Sulawesi Selatan', 44, H - 22);
    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#E9C170';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`Dicetak: ${todayWita}`, W - 44, H - 22);
    ctx.restore();

    const link = document.createElement('a');
    link.download = `KartuProfil_${item.nama.replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const printMyPdf = (item: any) => {
    const prog = calcProgress(item.tgl_mulai, item.tgl_selesai);
    const originUrl = window.location.origin;
    const rowsForPrint = [...(item.calendar || [])]
      .filter((c) => (hideLibur ? c.status !== 'LIBUR' : true))
      .reverse();

    const esc = (s: any) =>
      String(s ?? '-')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const sp = item.spCount || 0;
    const spText = sp === 0 ? 'Tertib (Tanpa SP)' : sp === 1 ? 'SP-1' : sp === 2 ? 'SP-2' : 'SP-3 (Terblokir)';

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
            <td><span style="display:inline-block;padding:2px 7px;font-size:9.5px;font-weight:800;border-radius:4px;${badgeStyle}">${esc(statusLabel)}</span></td>
            <td style="text-align:center;font-weight:700;">${esc(c.jam_masuk)}</td>
            <td style="text-align:center;font-weight:700;">${esc(c.jam_keluar)}${tapBadge}</td>
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
    @page { size: A4 portrait; margin: 0mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0F172A; background: #FFFFFF; margin: 0; padding: 0; font-size: 11px; line-height: 1.45; }
    .no-print-bar { background: #043666; color: #FFFFFF; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #E9C170; margin-bottom: 18px; }
    .no-print-bar button { background: #E9C170; color: #04315C; border: none; padding: 8px 16px; font-weight: 800; font-size: 12px; border-radius: 6px; cursor: pointer; text-transform: uppercase; }
    .page-wrap { max-width: 190mm; margin: 0 auto; padding: 14mm; }
    .kop-header { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #043666; padding-bottom: 12px; margin-bottom: 4px; }
    .kop-header img { width: 64px; height: 64px; object-fit: contain; }
    .kop-text .kementerian { font-size: 11px; font-weight: 800; color: #043666; letter-spacing: 0.08em; text-transform: uppercase; }
    .kop-text .instansi { font-size: 16px; font-weight: 900; color: #0F172A; margin-top: 2px; text-transform: uppercase; }
    .kop-text .sub { font-size: 11px; color: #475569; margin-top: 2px; }
    .kop-gold-line { height: 2px; background: #BD944D; margin-bottom: 16px; }
    .judul-dokumen { text-align: center; margin-bottom: 16px; }
    .judul-dokumen h1 { font-size: 14px; font-weight: 900; color: #043666; margin: 0; text-transform: uppercase; }
    .judul-dokumen p { font-size: 10.5px; color: #64748B; margin: 3px 0 0 0; }
    .identitas-box { border: 1px solid #CBD5E1; border-left: 4px solid #043666; border-radius: 6px; padding: 12px 16px; background: #F8FAFC; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 14px; }
    .identitas-item { display: flex; font-size: 11px; }
    .identitas-label { width: 125px; font-weight: 700; color: #475569; flex-shrink: 0; }
    .identitas-val { font-weight: 800; color: #0F172A; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
    .stat-card { border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px 12px; text-align: center; background: #FFFFFF; }
    .stat-card .lbl { font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #64748B; }
    .stat-card .val { font-size: 18px; font-weight: 900; margin-top: 4px; }
    table.Attendance { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    table.Attendance thead { display: table-header-group; }
    table.Attendance tr { page-break-inside: avoid; }
    table.Attendance th { background: #043666; color: #FFFFFF; font-weight: 800; text-transform: uppercase; font-size: 9.5px; padding: 8px; border: 1px solid #043666; text-align: left; }
    table.Attendance td { padding: 6.5px 8px; border: 1px solid #CBD5E1; vertical-align: middle; }
    .ttd-wrap { margin-top: 28px; display: flex; justify-content: space-between; page-break-inside: avoid; font-size: 11px; }
    .ttd-box { width: 220px; text-align: center; }
    .ttd-space { height: 64px; }
    @media print { .no-print-bar { display: none !important; } .page-wrap { max-width: 100%; padding: 14mm; } }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div><strong>Pratinjau Cetak PDF Resmi</strong> — Pilih <em>"Save as PDF"</em> pada jendela cetak browser. (Nama pejabat penandatangan di bawah dapat diklik & diketik langsung).</div>
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
      <p>Tanggal Cetak Dokumen: ${esc(todayWita)}</p>
    </div>
    <div class="identitas-box">
      <div class="identitas-item"><span class="identitas-label">Nama Lengkap</span><span class="identitas-val">: ${esc(item.nama)}</span></div>
      <div class="identitas-item"><span class="identitas-label">Mulai Magang</span><span class="identitas-val">: ${esc(item.tgl_mulai || 'Belum diatur')}</span></div>
      <div class="identitas-item"><span class="identitas-label">Universitas / Instansi</span><span class="identitas-val">: ${esc(item.universitas)}</span></div>
      <div class="identitas-item"><span class="identitas-label">Berakhir Magang</span><span class="identitas-val">: ${esc(item.tgl_selesai || 'Belum diatur')}</span></div>
      <div class="identitas-item"><span class="identitas-label">Status Kedisiplinan</span><span class="identitas-val">: ${esc(spText)}</span></div>
      <div class="identitas-item"><span class="identitas-label">Progres Durasi</span><span class="identitas-val">: ${prog ? `${prog.status} (${prog.pct}% — Sisa ${prog.remaining} hari)` : '-'}</span></div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="lbl">Total Hadir</div><div class="val" style="color:#043666;">${item.count || 0} Hari</div></div>
      <div class="stat-card" style="background:#FFFBEB;border-color:#FDE68A;"><div class="lbl" style="color:#92400E;">Total Izin / Sakit</div><div class="val" style="color:#B45309;">${item.izinCount || 0} Hari</div></div>
      <div class="stat-card" style="background:#FEF2F2;border-color:#FECACA;"><div class="lbl" style="color:#991B1B;">Tidak Hadir (Alpha)</div><div class="val" style="color:#B91C1C;">${item.alphaCount || 0} Hari</div></div>
      <div class="stat-card"><div class="lbl">Terakhir Hadir</div><div class="val" style="color:#0F172A;font-size:15px;margin-top:7px;">${esc(item.terakhir || '-')}</div></div>
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
      <tbody>${tableRowsHtml}</tbody>
    </table>
    <div class="ttd-wrap">
      <div class="ttd-box">
        <div>Peserta Magang,</div>
        <div class="ttd-space"></div>
        <div style="font-weight:800;text-decoration:underline;">${esc(item.nama)}</div>
        <div style="color:#475569;font-size:10px;margin-top:2px;">${esc(item.universitas)}</div>
      </div>
      <div class="ttd-box" style="text-align:left;width:210px;">
        <div contenteditable="true" style="outline:none;">Mengetahui</div>
        <div contenteditable="true" style="outline:none;line-height:1.35;">Ketua Tim Kepegawaian<br/>dan Kerja Sama</div>
        <div class="ttd-space"></div>
        <div contenteditable="true" style="font-weight:700;outline:none;">( ................................................ )</div>
      </div>
    </div>
  </div>
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 350); };</script>
</body>
</html>`;

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Pop-up diblokir oleh browser. Izinkan pop-up untuk mengunduh PDF.');
      return;
    }
    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  const handleSubmit = async (e: FormEvent | any, konfirmasi_baru?: boolean, ack_sp2?: boolean) => {
    if (e && e.preventDefault) e.preventDefault();
    setError(null);
    setStatusMsg(null);
    setLoading(true);

    if (mode === 'rekap') {
      try {
        const res = await fetch(
          `/api/rekap-peserta?nama=${encodeURIComponent(form.nama)}&univ=${encodeURIComponent(form.universitas)}`
        );
        const data = await res.json();
        setLoading(false);
        if (!res.ok || data.error) {
          setRekapResult(null);
          setError(data.error || 'Data peserta tidak ditemukan.');
          return;
        }
        try {
          localStorage.setItem('absen_last', JSON.stringify({ nama: form.nama, universitas: form.universitas }));
        } catch {}
        setRekapResult(data);
      } catch {
        setLoading(false);
        setError('Gagal menghubungi server. Periksa koneksi internet Anda.');
      }
      return;
    }

    if (mode === 'hadir' || mode === 'pulang') {
      let lat: number, lng: number, accuracy: number;
      try {
        const pos: any = await new Promise((res, rej) => {
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        accuracy = pos.coords.accuracy;
      } catch {
        setLoading(false);
        setError('Lokasi tidak terbaca. Pastikan izin akses lokasi (GPS) diaktifkan pada browser Anda.');
        return;
      }

      try {
        const payload: any = {
          mode,
          nama: form.nama,
          universitas: form.universitas,
          keterangan: form.keterangan,
          lat,
          lng,
          akurasi_gps: accuracy,
          konfirmasi_baru,
          ack_sp2,
          tgl_mulai: form.tgl_mulai,
          tgl_selesai: form.tgl_selesai,
        };
        if (mode === 'hadir') payload.jam_masuk = form.jam_masuk;
        if (mode === 'pulang') payload.jam_keluar = form.jam_keluar;

        const res = await fetch('/api/absen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (data.status === 'sp3_blocked') {
          setLoading(false);
          setSpModal('sp3');
          return;
        }

        if (data.status === 'sp2_warning') {
          setLoading(false);
          setSpModal('sp2');
          return;
        }

        if (data.status === 'sudah_hadir_hari_ini') {
          setLoading(false);
          setStatusMsg(`Presensi hadir Anda sudah tercatat hari ini (Jam Masuk: ${data.jam_masuk || '-'}).`);
          return;
        }

        if (data.status === 'belum_hadir') {
          setLoading(false);
          setError('Anda belum melakukan presensi hadir hari ini. Silakan hubungi pembimbing.');
          return;
        }

        if (data.status === 'sudah_pulang') {
          setLoading(false);
          setStatusMsg(`Presensi pulang Anda sudah tercatat hari ini (Jam Keluar: ${data.jam_keluar}).`);
          return;
        }

        if (data.status === 'jam_tidak_valid') {
          setLoading(false);
          setError('Jam keluar tidak boleh lebih awal dari jam masuk yang tersimpan.');
          return;
        }

        if (data.status === 'nama_baru') {
          setLoading(false);
          setShowConfirm(true);
          return;
        }

        if (!res.ok || data.ok === false) {
          setLoading(false);
          setError(data.error || 'Terjadi kesalahan saat memproses data.');
          return;
        }

        try {
          localStorage.setItem('absen_last', JSON.stringify({ nama: form.nama, universitas: form.universitas }));
        } catch {}

        setForm((f) => ({ ...f, keterangan: '' }));
        if (mode === 'hadir') {
          router.push(`/sukses?mode=hadir&nama=${encodeURIComponent(data.nama)}&univ=${encodeURIComponent(form.universitas)}&tanggal=${data.tanggal}&jam_masuk=${data.jam_masuk}`);
        } else {
          router.push(`/sukses?mode=pulang&nama=${encodeURIComponent(data.nama)}&univ=${encodeURIComponent(form.universitas)}&tanggal=${data.tanggal}&jam_keluar=${data.jam_keluar}`);
        }
      } catch {
        setLoading(false);
        setError('Gagal menghubungi server. Periksa koneksi internet Anda dan coba lagi.');
      }
    } else {
      try {
        const res = await fetch('/api/izin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nama: form.nama,
            universitas: form.universitas,
            jenis: form.jenis,
            keterangan: form.keterangan,
            link_surat: form.link_surat,
            konfirmasi_baru,
            tgl_mulai: form.tgl_mulai,
            tgl_selesai: form.tgl_selesai,
            izin_mulai: form.izin_mulai,
            izin_selesai: form.izin_selesai,
          }),
        });
        const data = await res.json();

        if (data.status === 'sudah_hadir') {
          setLoading(false);
          setStatusMsg('Anda sudah tercatat hadir hari ini, pengajuan izin tidak dapat diproses.');
          return;
        }
        if (data.status === 'sudah_izin') {
          setLoading(false);
          setStatusMsg('Laporan izin Anda untuk hari ini sudah tercatat di sistem.');
          return;
        }
        if (data.status === 'nama_baru') {
          setLoading(false);
          setShowConfirm(true);
          return;
        }

        if (!res.ok || data.ok === false) {
          setLoading(false);
          setError(data.error || 'Terjadi kesalahan saat mengirim laporan izin.');
          return;
        }

        try {
          localStorage.setItem('absen_last', JSON.stringify({ nama: form.nama, universitas: form.universitas }));
        } catch {}

        setForm((f) => ({ ...f, keterangan: '', link_surat: '' }));
        router.push(`/sukses?mode=izin&nama=${encodeURIComponent(data.nama)}&univ=${encodeURIComponent(form.universitas)}&tanggal=${encodeURIComponent(data.tanggal)}&jenis=${data.jenis}`);
      } catch {
        setLoading(false);
        setError('Gagal menghubungi server. Periksa koneksi internet Anda dan coba lagi.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8] flex flex-col justify-between font-sans text-slate-900 selection:bg-[#043666] selection:text-[#E9C170]">
      <header className="bg-[#043666] border-b-4 border-[#E9C170] text-white shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/logo-imigrasi.png"
              alt="Logo Imigrasi"
              className="w-11 h-11 object-contain shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="leading-tight">
              <p className="text-[10px] font-bold tracking-[0.14em] text-[#E9C170] uppercase">
                Kementerian Imigrasi dan Pemasyarakatan
              </p>
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white mt-0.5">
                Direktorat Jenderal Imigrasi Kanwil Sulsel
              </h1>
            </div>
          </div>
          <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-[#04315C] text-[#E9C170] border border-[#BD944D]/50 shrink-0">
            Portal Presensi
          </span>
        </div>
      </header>

      {/* POP-UP SP-2 */}
      {spModal === 'sp2' && (
        <div className="fixed inset-0 bg-slate-950/75 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border-2 border-amber-500 overflow-hidden">
            <div className="bg-[#043666] px-6 py-4 text-white border-b-4 border-amber-400 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-amber-300 block">
                  Peringatan Kepatuhan Presensi
                </span>
                <h3 className="text-base font-extrabold tracking-tight text-white mt-0.5">
                  SURAT PERINGATAN KE-2 (SP-2)
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded text-[10px] font-black bg-amber-400 text-slate-900 uppercase">
                2 / 3 PELANGGARAN
              </span>
            </div>

            <div className="p-6 text-sm text-slate-800 space-y-4">
              <div className="p-3.5 bg-amber-50 border border-amber-300 border-l-4 border-l-amber-600 rounded-r-md text-xs text-amber-950 leading-relaxed">
                <p className="font-extrabold uppercase text-amber-900 mb-1">
                  Terdeteksi 2x Tidak Absen Pulang
                </p>
                Sistem mencatat peserta atas nama <strong className="underline">{form.nama}</strong> sudah <strong>2 kali</strong> mengabaikan kewajiban Presensi Kepulangan.
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Status Saat Ini:</span>
                  <span className="font-extrabold text-amber-700">SP-2 (Peringatan Terakhir)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Sisa Toleransi Sistem:</span>
                  <span className="font-extrabold text-red-600">1 Kali Lagi</span>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Ini adalah <strong>kesempatan terakhir</strong>. Apabila Anda kembali tidak melakukan presensi pulang untuk ke-3 kalinya, maka pada presensi berikutnya akses akun Anda akan <strong>diblokir otomatis (SP-3)</strong>.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSpModal('none');
                  handleSubmit(null, false, true);
                }}
                className="w-full py-3 px-4 bg-[#043666] hover:bg-[#04315C] text-[#E9C170] font-extrabold text-xs uppercase tracking-widest rounded-md shadow-sm transition-colors"
              >
                Saya Mengerti & Lanjutkan Presensi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP SP-3 */}
      {spModal === 'sp3' && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border-2 border-red-700 overflow-hidden">
            <div className="bg-red-800 px-6 py-4 text-white border-b-4 border-[#E9C170] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#E9C170] block">
                  Sistem Pengawasan Disiplin Magang
                </span>
                <h3 className="text-base font-extrabold tracking-tight text-white mt-0.5">
                  AKSES PRESENSI TERBLOKIR (SP-3)
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded text-[10px] font-black bg-[#E9C170] text-red-950 uppercase">
                TERBLOKIR
              </span>
            </div>

            <div className="p-6 text-sm text-slate-800 space-y-4">
              <div className="p-3.5 bg-red-50 border border-red-200 border-l-4 border-l-red-700 rounded-r-md text-xs text-red-950 leading-relaxed">
                <p className="font-extrabold uppercase text-red-800 mb-1">
                  Batas Maksimal Pelanggaran Tercapai (3x)
                </p>
                Peserta atas nama <strong className="underline">{form.nama}</strong> tercatat telah <strong>3 kali</strong> tidak melakukan Presensi Kepulangan mandiri.
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Status Sanksi:</span>
                  <span className="font-extrabold text-red-700">SP-3 • Terblokir</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Tindak Lanjut:</span>
                  <span className="font-bold text-slate-900">Wajib Pembukaan Blokir oleh Admin</span>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Akses presensi atas nama Anda telah dikunci oleh sistem Kanwil Ditjen Imigrasi Sulawesi Selatan. Silakan hubungi <strong>Administrator / Pembimbing Magang</strong> untuk membuka blokir pada Dashboard Admin.
              </p>

              <button
                type="button"
                onClick={() => setSpModal('none')}
                className="w-full py-3 px-4 bg-red-800 hover:bg-red-900 text-white font-extrabold text-xs uppercase tracking-widest rounded-md shadow-sm transition-colors"
              >
                Tutup Peringatan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Peserta Magang Baru */}
      {showConfirm && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#043666] px-6 py-4 border-b-2 border-[#E9C170]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#E9C170] block">
                Verifikasi Data Peserta
              </span>
              <h2 className="text-lg font-extrabold text-white mt-0.5">
                Konfirmasi Peserta Magang Baru
              </h2>
            </div>

            <div className="p-6">
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Data atas nama <strong className="text-slate-900">{form.nama}</strong> dari{' '}
                <strong className="text-slate-900">{form.universitas}</strong> belum terdaftar di database. Apabila Anda peserta baru, lengkapi periode masa magang Anda di bawah ini:
              </p>

              <div className="bg-slate-50 border-l-4 border-[#043666] p-3.5 rounded-r-lg mb-5 text-xs space-y-1 text-slate-700">
                <div>
                  <span className="font-semibold text-slate-500 uppercase tracking-wider">Nama: </span>
                  <span className="font-bold text-slate-900">{form.nama}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 uppercase tracking-wider">Instansi/Kampus: </span>
                  <span className="font-bold text-slate-900">{form.universitas}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6 text-left">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Mulai Magang
                  </label>
                  <input
                    name="tgl_mulai"
                    type="date"
                    required
                    value={form.tgl_mulai}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Selesai Magang
                  </label>
                  <input
                    name="tgl_selesai"
                    type="date"
                    required
                    value={form.tgl_selesai}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666]"
                  />
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 px-4 border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs uppercase tracking-wider rounded-md transition-colors"
                >
                  Periksa Kembali
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!form.tgl_mulai || !form.tgl_selesai) {
                      alert('Mohon isi Tanggal Mulai dan Tanggal Selesai magang terlebih dahulu.');
                      return;
                    }
                    if (form.tgl_selesai < form.tgl_mulai) {
                      alert('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
                      return;
                    }
                    setShowConfirm(false);
                    handleSubmit(null, true);
                  }}
                  className="flex-1 py-2.5 px-4 bg-[#043666] hover:bg-[#04315C] text-[#E9C170] font-extrabold text-xs uppercase tracking-wider rounded-md shadow-sm transition-colors"
                >
                  Konfirmasi & Kirim
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className={`w-full ${mode === 'rekap' && rekapResult ? 'max-w-2xl' : 'max-w-md'} bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all`}>
          <div className="bg-[#043666] px-6 py-5 text-white border-b-2 border-[#E9C170]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#E9C170] block">
                  Sistem Presensi Digital
                </span>
                <h2 className="text-lg font-extrabold tracking-tight text-white mt-0.5">
                  {mode === 'hadir' && 'Presensi Kehadiran (Pagi)'}
                  {mode === 'pulang' && 'Presensi Kepulangan (Sore)'}
                  {mode === 'izin' && 'Formulir Izin / Sakit'}
                  {mode === 'rekap' && 'Cek & Unduh Rekap Kehadiran'}
                </h2>
              </div>
              <div className="text-right">
                <span className="inline-block px-2.5 py-1 rounded text-[11px] font-extrabold bg-[#E9C170] text-[#04315C]">
                  {mode === 'hadir' ? 'HADIR' : mode === 'pulang' ? 'PULANG' : mode === 'izin' ? 'IZIN' : 'REKAP'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1.5 rounded-lg border border-slate-200 mb-6">
              {(['hadir', 'pulang', 'izin', 'rekap'] as Mode[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setMode(item);
                    setError(null);
                    setStatusMsg(null);
                  }}
                  className={`py-2 rounded-md font-extrabold text-[11px] uppercase tracking-wider transition-all ${
                    mode === item
                      ? 'bg-[#043666] text-[#E9C170] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                  }`}
                >
                  {item === 'hadir' ? 'Hadir' : item === 'pulang' ? 'Pulang' : item === 'izin' ? 'Izin' : 'Rekap Saya'}
                </button>
              ))}
            </div>

            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border-l-4 border-red-600 text-red-800 rounded-r-md text-xs font-medium leading-relaxed">
                {error}
              </div>
            )}
            {statusMsg && (
              <div className="mb-5 p-3.5 bg-amber-50 border-l-4 border-[#BD944D] text-amber-900 rounded-r-md text-xs font-medium leading-relaxed">
                {statusMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Nama Lengkap Peserta
                </label>
                <input
                  name="nama"
                  type="text"
                  maxLength={80}
                  required
                  value={form.nama}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-md text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666] transition-colors"
                  placeholder="Masukkan nama lengkap sesuai identitas"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Universitas / Instansi Asal
                </label>
                <input
                  name="universitas"
                  type="text"
                  maxLength={80}
                  required
                  value={form.universitas}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-md text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666] transition-colors"
                  placeholder="Contoh: Universitas Hasanuddin"
                  disabled={loading}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Gunakan nama lengkap perguruan tinggi atau sekolah (tanpa singkatan).
                </p>
              </div>

              {mode === 'hadir' && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Jam Masuk
                    </label>
                    <input
                      name="jam_masuk"
                      type="time"
                      required
                      value={form.jam_masuk}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-md text-sm font-semibold focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666]"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Keterangan / Catatan <span className="text-slate-400 font-normal normal-case">(Opsional)</span>
                    </label>
                    <input
                      name="keterangan"
                      type="text"
                      maxLength={100}
                      value={form.keterangan}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-md text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666]"
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              {mode === 'pulang' && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Jam Keluar
                    </label>
                    <input
                      name="jam_keluar"
                      type="time"
                      required
                      value={form.jam_keluar}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-md text-sm font-semibold focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666]"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Keterangan Tambahan <span className="text-slate-400 font-normal normal-case">(Opsional)</span>
                    </label>
                    <input
                      name="keterangan"
                      type="text"
                      maxLength={100}
                      value={form.keterangan}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-md text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666]"
                      placeholder="Jika diisi, akan memperbarui catatan pagi"
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              {mode === 'izin' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                        Dari Tanggal
                      </label>
                      <input
                        name="izin_mulai"
                        type="date"
                        required
                        value={form.izin_mulai}
                        onChange={handleChange}
                        className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-md text-sm font-medium focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666]"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                        Sampai Tanggal
                      </label>
                      <input
                        name="izin_selesai"
                        type="date"
                        required
                        min={form.izin_mulai}
                        value={form.izin_selesai}
                        onChange={handleChange}
                        className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-md text-sm font-medium focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666]"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 -mt-2">
                    Jika izin beberapa hari, hari libur (Jumat–Minggu) otomatis dilewati.
                  </p>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Kategori Ketidakhadiran
                    </label>
                    <select
                      name="jenis"
                      value={form.jenis}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-md text-sm font-medium focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666]"
                      disabled={loading}
                    >
                      <option value="Sakit">Sakit</option>
                      <option value="Izin">Izin Keperluan Akademik / Pribadi</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Alasan / Keterangan Detail
                    </label>
                    <input
                      name="keterangan"
                      type="text"
                      maxLength={85}
                      value={form.keterangan}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-md text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666]"
                      placeholder="Jelaskan alasan izin secara singkat"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Tautan Surat Bukti (Google Drive)
                    </label>
                    <input
                      name="link_surat"
                      type="url"
                      maxLength={300}
                      value={form.link_surat}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-md text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#043666] focus:ring-1 focus:ring-[#043666]"
                      placeholder="https://drive.google.com/..."
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-[#043666] hover:bg-[#04315C] active:bg-[#032546] text-[#E9C170] font-extrabold text-xs uppercase tracking-widest rounded-md shadow-sm border border-[#BD944D]/40 transition-colors disabled:opacity-50"
                >
                  {loading
                    ? 'Memproses Data...'
                    : mode === 'hadir'
                    ? 'Kirim Presensi Hadir'
                    : mode === 'pulang'
                    ? 'Kirim Presensi Pulang'
                    : mode === 'izin'
                    ? 'Kirim Laporan Izin'
                    : 'Tampilkan Rekap Kehadiran Saya'}
                </button>
              </div>
            </form>

            {/* Hasil Rekap Mandiri Peserta */}
            {mode === 'rekap' && rekapResult && (
              <div className="mt-6 pt-6 border-t-2 border-slate-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                  <div>
                    <div className="text-xs font-extrabold text-[#043666] uppercase">
                      {rekapResult.nama}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {rekapResult.universitas} • Periode: {rekapResult.tgl_mulai || '-'} s/d {rekapResult.tgl_selesai || '-'}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-[10px] font-extrabold uppercase rounded border ${
                      (rekapResult.spCount || 0) === 0
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-red-50 text-red-800 border-red-300'
                    }`}
                  >
                    {(rekapResult.spCount || 0) === 0 ? 'Tertib (Tanpa SP)' : `Status: SP-${Math.min(3, rekapResult.spCount)}`}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Hadir</div>
                    <div className="text-base font-black text-[#043666] mt-0.5">{rekapResult.count} Hari</div>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-center">
                    <div className="text-[10px] font-bold text-amber-800 uppercase">Izin / Sakit</div>
                    <div className="text-base font-black text-amber-800 mt-0.5">{rekapResult.izinCount} Hari</div>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50/70 border border-red-200 text-center">
                    <div className="text-[10px] font-bold text-red-700 uppercase">Tidak Hadir</div>
                    <div className="text-base font-black text-red-700 mt-0.5">{rekapResult.alphaCount} Hari</div>
                  </div>
                </div>

                {/* Tombol Unduh Mandiri (CSV, PDF, PNG) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => downloadMyCsv(rekapResult)}
                    className="py-2 px-3 text-[11px] font-extrabold uppercase tracking-wider bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-md transition-colors"
                  >
                    Unduh CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => printMyPdf(rekapResult)}
                    className="py-2 px-3 text-[11px] font-extrabold uppercase tracking-wider bg-slate-800 hover:bg-slate-900 text-white rounded-md transition-colors"
                  >
                    Cetak / Unduh PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadMyPng(rekapResult)}
                    className="py-2 px-3 text-[11px] font-extrabold uppercase tracking-wider bg-[#043666] hover:bg-[#04315C] text-[#E9C170] rounded-md shadow-sm transition-colors"
                  >
                    Unduh Kartu PNG
                  </button>
                </div>

                {/* Tabel Kalender Harian Peserta */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase text-[#043666]">
                      Rincian Kehadiran Harian
                    </span>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hideLibur}
                        onChange={(e) => setHideLibur(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#043666] rounded"
                      />
                      Sembunyikan Libur
                    </label>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-extrabold border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="px-3 py-2">Tanggal</th>
                          <th className="px-3 py-2">Hari</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Masuk</th>
                          <th className="px-3 py-2">Keluar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {(rekapResult.calendar || [])
                          .filter((c: any) => (hideLibur ? c.status !== 'LIBUR' : true))
                          .map((c: any, idx: number) => (
                            <tr
                              key={idx}
                              className={
                                c.status === 'LIBUR'
                                  ? 'bg-slate-50/70 text-slate-400'
                                  : c.status === 'TIDAK_HADIR'
                                  ? 'bg-red-50/40'
                                  : ''
                              }
                            >
                              <td className="px-3 py-2 font-semibold whitespace-nowrap">{c.tanggal}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{c.hari}</td>
                              <td className="px-3 py-2 whitespace-nowrap font-bold">
                                {c.status === 'HADIR' ? (
                                  <span className="text-emerald-700">Hadir</span>
                                ) : c.status === 'IZIN' ? (
                                  <span className="text-amber-700">{c.jenis_izin || 'Izin'}</span>
                                ) : c.status === 'TIDAK_HADIR' ? (
                                  <span className="text-red-700">Tidak Hadir</span>
                                ) : c.status === 'BELUM_ABSEN' ? (
                                  <span className="text-amber-700">Belum Absen</span>
                                ) : (
                                  <span className="text-slate-400">Libur</span>
                                )}
                              </td>
                              <td className="px-3 py-2">{c.jam_masuk}</td>
                              <td className="px-3 py-2">{c.jam_keluar}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Verifikasi Koordinat GPS Aktif</span>
              <span className="font-bold text-[#043666]">Kanwil Sulsel</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-[#04315C] text-slate-300 py-3.5 text-center text-xs border-t-2 border-[#BD944D]">
        <div className="max-w-xl mx-auto px-4">
          Direktorat Jenderal Imigrasi Kantor Wilayah Sulawesi Selatan © 2026
        </div>
      </footer>
    </div>
  );
}