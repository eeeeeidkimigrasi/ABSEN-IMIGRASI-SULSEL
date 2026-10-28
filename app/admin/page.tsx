'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HariIniTab } from './HariIniTab';
import { RekapTab } from './RekapTab';
import { RiwayatTab } from './RiwayatTab';
import { IzinTab } from './IzinTab';
import { LogTab } from './LogTab';

type Tab = 'hari-ini' | 'rekap' | 'riwayat' | 'izin' | 'log';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('hari-ini');
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Admin Absensi</h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm transition"
        >
          Keluar
        </button>
      </div>

      <div className="flex border-b mb-6 overflow-x-auto">
        {(['hari-ini', 'rekap', 'riwayat', 'izin', 'log'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.replace('-', ' ').toUpperCase()}
          </button>
        ))}
      </div>

      {tab === 'hari-ini' && <HariIniTab />}
      {tab === 'rekap' && <RekapTab />}
      {tab === 'riwayat' && <RiwayatTab />}
      {tab === 'izin' && <IzinTab />}
      {tab === 'log' && <LogTab />}
    </div>
  );
}
