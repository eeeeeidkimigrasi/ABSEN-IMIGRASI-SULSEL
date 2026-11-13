'use client';

import { useState, useEffect, useCallback } from 'react';

export function LogTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/data?tipe=log')
      .then((res) => res.json())
      .then((d) => {
        setLogs(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#043666]">
            Riwayat Aktivitas Administrator
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Menampilkan 50 perubahan data terakhir pada sistem database (otomatis dibersihkan setelah 90 hari).
          </p>
        </div>
        <a
          href="/api/admin/export?tipe=log"
          className="px-4 py-2 bg-[#043666] hover:bg-[#04315C] text-[#E9C170] font-bold text-xs uppercase tracking-wider rounded-md shadow-sm transition-colors"
        >
          Ekspor CSV Log
        </a>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <div className="bg-[#043666] px-5 py-3.5 border-b-2 border-[#E9C170] flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-white">
            Log Perubahan Data Presensi & Izin
          </h2>
          <span className="px-2.5 py-0.5 text-[11px] font-extrabold rounded bg-[#E9C170] text-[#04315C]">
            {logs.length} Aktivitas
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase text-[11px] font-extrabold tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Waktu (WITA)</th>
                <th className="px-5 py-3.5">Aksi</th>
                <th className="px-5 py-3.5">Tabel</th>
                <th className="px-5 py-3.5">Data Sebelum</th>
                <th className="px-5 py-3.5">Data Sesudah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-xs font-bold uppercase tracking-widest text-[#043666]">
                    Memuat Log Aktivitas...
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 align-top transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs font-medium text-slate-600">
                      {new Date(log.waktu).toLocaleString('id-ID')}
                    </td>
                    <td className="px-5 py-3.5 font-bold uppercase text-xs whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold border ${
                          String(log.aksi).includes('tambah') || String(log.aksi).includes('backfill')
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : String(log.aksi).includes('edit')
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-red-50 text-red-800 border-red-200'
                        }`}
                      >
                        {log.aksi}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-900 uppercase text-xs">{log.tabel}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-600 max-w-xs break-words">
                      {log.sebelum ? JSON.stringify(log.sebelum) : '-'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-600 max-w-xs break-words">
                      {log.sesudah ? JSON.stringify(log.sesudah) : '-'}
                    </td>
                  </tr>
                ))
              )}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-xs font-medium text-slate-400">
                    Belum ada riwayat perubahan data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}