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
    <div>
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-gray-500">50 Perubahan Terakhir pada Data Admin</p>
        <a
          href="/api/admin/export?tipe=log"
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
        >
          Ekspor CSV Log
        </a>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Aksi</th>
              <th className="px-4 py-3">Tabel</th>
              <th className="px-4 py-3">Sheets OK</th>
              <th className="px-4 py-3">Sebelum</th>
              <th className="px-4 py-3">Sesudah</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  Memuat...
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                    {new Date(log.waktu).toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3 font-semibold uppercase text-xs">
                    <span
                      className={`px-2 py-1 rounded ${
                        log.aksi === 'tambah'
                          ? 'bg-green-100 text-green-800'
                          : log.aksi === 'edit'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {log.aksi}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{log.tabel}</td>
                  <td className="px-4 py-3">
                    {log.sheets_ok ? (
                      <span className="text-green-600 font-medium">Ya</span>
                    ) : (
                      <span className="text-red-600 font-medium">Tidak</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 max-w-xs truncate">
                    {log.sebelum ? JSON.stringify(log.sebelum) : '-'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 max-w-xs truncate">
                    {log.sesudah ? JSON.stringify(log.sesudah) : '-'}
                  </td>
                </tr>
              ))
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  Belum ada log perubahan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
