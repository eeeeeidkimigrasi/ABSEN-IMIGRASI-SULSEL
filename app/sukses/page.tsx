'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

function SuksesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const mode = searchParams.get('mode') || 'hadir';
  const nama = searchParams.get('nama');
  const tanggal = searchParams.get('tanggal');
  const jam_masuk = searchParams.get('jam_masuk');
  const jam_keluar = searchParams.get('jam_keluar');
  const jenis = searchParams.get('jenis');

  const judul =
    mode === 'izin'
      ? 'Izin Berhasil Dikirim!'
      : mode === 'pulang'
      ? 'Absen Pulang Berhasil!'
      : 'Absen Hadir Berhasil!';

  return (
    <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
      <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M5 13l4 4L19 7"
          ></path>
        </svg>
      </div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">{judul}</h1>
      <p className="text-gray-600 mb-6">Data Anda telah tersimpan di sistem.</p>

      <div className="bg-gray-50 rounded-lg p-4 text-left space-y-3 mb-6">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Nama</div>
          <div className="font-medium text-gray-900">{nama}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Tanggal</div>
          <div className="font-medium text-gray-900">{tanggal}</div>
        </div>
        {mode === 'izin' ? (
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Jenis Izin</div>
            <div className="font-medium text-gray-900">{jenis}</div>
          </div>
        ) : (
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">
              {mode === 'pulang' ? 'Jam Keluar' : 'Jam Masuk'}
            </div>
            <div className="font-medium text-gray-900">
              {mode === 'pulang' ? jam_keluar : jam_masuk}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => router.push('/')}
        className="w-full py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
      >
        Kembali ke Form
      </button>
    </div>
  );
}

export default function SuksesPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Suspense fallback={<div>Loading...</div>}>
        <SuksesContent />
      </Suspense>
    </main>
  );
}
