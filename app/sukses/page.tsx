'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SuksesContent() {
  const params = useSearchParams();
  const mode = params.get('mode') || 'hadir';
  const nama = params.get('nama') || '-';
  const univParam = params.get('univ') || params.get('universitas') || '';
  const tanggal = params.get('tanggal') || '-';
  const jamMasuk = params.get('jam_masuk');
  const jamKeluar = params.get('jam_keluar');
  const jenis = params.get('jenis');

  const [univ, setUniv] = useState(univParam);

  useEffect(() => {
    if (!univParam) {
      try {
        const saved = localStorage.getItem('absen_last');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.universitas) setUniv(parsed.universitas);
        }
      } catch {}
    } else {
      setUniv(univParam);
    }
  }, [univParam]);

  const isHadir = mode === 'hadir';
  const isPulang = mode === 'pulang';
  const isIzin = mode === 'izin';

  return (
    <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-[#043666] px-6 py-5 text-white border-b-2 border-[#E9C170]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#E9C170] block">
              Bukti Presensi Tercatat
            </span>
            <h2 className="text-lg font-extrabold tracking-tight text-white mt-0.5">
              {isHadir && 'Presensi Kehadiran Berhasil'}
              {isPulang && 'Presensi Kepulangan Berhasil'}
              {isIzin && 'Laporan Izin / Sakit Diterima'}
            </h2>
          </div>
          <span className="shrink-0 px-2.5 py-1 rounded text-[11px] font-extrabold bg-[#E9C170] text-[#04315C] uppercase">
            {isHadir ? 'HADIR' : isPulang ? 'PULANG' : 'IZIN'}
          </span>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 border-l-4 border-l-emerald-700 rounded-r-md flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center font-black text-xs shrink-0">
            ✓
          </div>
          <div className="text-xs leading-relaxed text-emerald-950">
            <p className="font-extrabold uppercase tracking-wider text-emerald-900">
              Data Terverifikasi Sistem
            </p>
            <p className="text-emerald-800 mt-0.5">
              Rekaman presensi Anda telah tersimpan di database Kanwil Sulsel.
            </p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg divide-y divide-slate-200 text-sm mb-6">
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Nama Peserta
            </span>
            <span className="font-extrabold text-slate-900 text-right">{nama}</span>
          </div>

          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Universitas / Instansi
            </span>
            <span className="font-bold text-slate-800 text-right">{univ || '-'}</span>
          </div>

          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Tanggal
            </span>
            <span className="font-bold text-slate-800 text-right">{tanggal}</span>
          </div>

          {isHadir && (
            <div className="px-4 py-3 flex items-center justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Jam Masuk
              </span>
              <span className="inline-block px-2.5 py-0.5 text-xs font-extrabold rounded bg-[#043666] text-[#E9C170]">
                {jamMasuk || '-'} WITA
              </span>
            </div>
          )}

          {isPulang && (
            <div className="px-4 py-3 flex items-center justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Jam Keluar
              </span>
              <span className="inline-block px-2.5 py-0.5 text-xs font-extrabold rounded bg-[#043666] text-[#E9C170]">
                {jamKeluar || '-'} WITA
              </span>
            </div>
          )}

          {isIzin && (
            <div className="px-4 py-3 flex items-center justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Kategori Izin
              </span>
              <span className="inline-block px-2.5 py-0.5 text-xs font-extrabold rounded bg-amber-100 text-amber-900 border border-amber-300">
                {jenis || 'Izin / Sakit'}
              </span>
            </div>
          )}
        </div>

        <Link
          href="/"
          className="block w-full py-3 px-4 bg-[#043666] hover:bg-[#04315C] text-[#E9C170] font-extrabold text-xs uppercase tracking-widest text-center rounded-md shadow-sm border border-[#BD944D]/40 transition-colors"
        >
          Kembali ke Halaman Presensi
        </Link>
      </div>
    </div>
  );
}

export default function SuksesPage() {
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

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <Suspense
          fallback={
            <div className="text-xs font-bold uppercase tracking-widest text-[#043666]">
              Memuat Bukti Presensi...
            </div>
          }
        >
          <SuksesContent />
        </Suspense>
      </main>

      <footer className="bg-[#04315C] text-slate-300 py-3.5 text-center text-xs border-t-2 border-[#BD944D]">
        <div className="max-w-xl mx-auto px-4">
          Direktorat Jenderal Imigrasi Kantor Wilayah Sulawesi Selatan © 2026
        </div>
      </footer>
    </div>
  );
}