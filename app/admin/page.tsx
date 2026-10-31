'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HariIniTab } from './HariIniTab';
import { RekapTab } from './RekapTab';
import { RiwayatTab } from './RiwayatTab';
import { IzinTab } from './IzinTab';
import { LogTab } from './LogTab';

type Tab = 'hariini' | 'rekap' | 'riwayat' | 'izin' | 'log';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('hariini');
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    router.push('/admin/login');
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8] flex flex-col font-sans text-slate-900 selection:bg-[#043666] selection:text-[#E9C170]">
      {/* Header Resmi dengan Palet Wisdom Blue (#043666) & Dignity Gold (#E9C170) */}
      <header className="bg-[#043666] text-white shadow-sm border-b-4 border-[#E9C170]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src="/logo-imigrasi.png"
              alt="Logo Imigrasi"
              className="w-12 h-12 object-contain shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="leading-tight">
              <p className="text-[11px] font-bold tracking-[0.14em] text-[#E9C170] uppercase">
                Kementerian Imigrasi dan Pemasyarakatan
              </p>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white mt-0.5">
                Direktorat Jenderal Imigrasi Kanwil Sulsel
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-[#04315C] rounded text-[#E9C170] border border-[#BD944D]/50">
              Administrator Aktif
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-red-700 hover:bg-red-800 text-white rounded-md shadow-sm transition-colors"
            >
              Keluar
            </button>
          </div>
        </div>

        {/* Bilah Navigasi Tab dengan Shade Wisdom Blue (#04315C) */}
        <div className="bg-[#04315C] border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto gap-2 py-2.5">
            {[
              { id: 'hariini', label: 'Hari Ini' },
              { id: 'rekap', label: 'Rekap & Profil' },
              { id: 'riwayat', label: 'Riwayat Kehadiran' },
              { id: 'izin', label: 'Data Izin / Sakit' },
              { id: 'log', label: 'Log Aktivitas' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as Tab)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all shrink-0 ${
                  tab === item.id
                    ? 'bg-[#E9C170] text-[#04315C] shadow-sm font-extrabold'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Konten Utama Dashboard */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/90 p-5 sm:p-7">
          {tab === 'hariini' && <HariIniTab />}
          {tab === 'rekap' && <RekapTab />}
          {tab === 'riwayat' && <RiwayatTab />}
          {tab === 'izin' && <IzinTab />}
          {tab === 'log' && <LogTab />}
        </div>
      </main>

      {/* Footer Resmi */}
      <footer className="bg-[#04315C] text-slate-300 py-4 text-center text-xs border-t-2 border-[#BD944D]">
        <div className="max-w-7xl mx-auto px-4">
          Direktorat Jenderal Imigrasi Kantor Wilayah Sulawesi Selatan © 2026
        </div>
      </footer>
    </div>
  );
}