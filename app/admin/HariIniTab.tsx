'use client';

import { useState, useEffect } from 'react';

export function HariIniTab() {
  const [data, setData] = useState<{ hadir: any[]; izin: any[]; belum: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/data?tipe=summary')
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center text-xs font-bold uppercase tracking-widest text-[#043666]">
        Memuat Data Presensi Hari Ini...
      </div>
    );
  }
  if (!data) return null;

  const belumPulang = data.hadir.filter((h) => !h.jam_keluar);

  return (
    <div className="space-y-8">
      {/* Ringkasan Statistik Hari Ini */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-50 border border-slate-200 border-l-4 border-l-[#043666] rounded-lg p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Sudah Hadir</p>
          <p className="text-2xl font-black text-[#043666] mt-1">{data.hadir.length}</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 border-l-4 border-l-[#BD944D] rounded-lg p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Belum Pulang</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{belumPulang.length}</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 border-l-4 border-l-amber-600 rounded-lg p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Izin / Sakit</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{data.izin.length}</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 border-l-4 border-l-slate-400 rounded-lg p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Belum Absen</p>
          <p className="text-2xl font-black text-slate-700 mt-1">{data.belum.length}</p>
        </div>
      </div>

      {/* Tabel Sudah Hadir */}
      <section className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <div className="bg-[#043666] px-5 py-3.5 border-b-2 border-[#E9C170] flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-white">
            Daftar Kehadiran Hari Ini
          </h2>
          <span className="px-2.5 py-0.5 text-[11px] font-extrabold rounded bg-[#E9C170] text-[#04315C]">
            {data.hadir.length} Peserta
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase text-[11px] font-extrabold tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Nama Peserta</th>
                <th className="px-5 py-3.5">Universitas / Instansi</th>
                <th className="px-5 py-3.5">Jam Masuk</th>
                <th className="px-5 py-3.5">Jam Keluar</th>
                <th className="px-5 py-3.5">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {data.hadir.map((h, i) => (
                <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-slate-900">{h.nama}</td>
                  <td className="px-5 py-3.5 text-slate-700">{h.universitas}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-block px-2.5 py-1 text-xs font-bold rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {String(h.jam_masuk).slice(0, 5)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {h.jam_keluar ? (
                      <span className="inline-block px-2.5 py-1 text-xs font-bold rounded bg-slate-100 text-slate-800 border border-slate-300">
                        {String(h.jam_keluar).slice(0, 5)}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-amber-700">Belum Pulang</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{h.keterangan || '-'}</td>
                </tr>
              ))}
              {data.hadir.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-xs font-medium text-slate-400">
                    Belum ada peserta yang tercatat hadir hari ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Seksi Belum Pulang */}
      <section className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-4 bg-[#BD944D] rounded-sm inline-block"></span>
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#043666]">
              Peserta Belum Absen Pulang
            </h2>
          </div>
          <span className="px-2.5 py-0.5 text-[11px] font-bold rounded bg-slate-200 text-slate-800">
            {belumPulang.length} Orang
          </span>
        </div>
        <div className="p-5">
          {belumPulang.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {belumPulang.map((b, i) => (
                <div
                  key={i}
                  className="p-3.5 border border-slate-200 border-l-4 border-l-[#043666] rounded-md bg-slate-50/60 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 truncate">{b.nama}</div>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase truncate mt-0.5">
                      {b.universitas}
                    </div>
                  </div>
                  <span className="shrink-0 px-2.5 py-1 text-[11px] font-bold rounded bg-[#043666] text-[#E9C170]">
                    Masuk {String(b.jam_masuk).slice(0, 5)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-xs font-medium text-slate-400 py-4">
              Tidak ada peserta yang menunggu absen pulang.
            </div>
          )}
        </div>
      </section>

      {/* Tabel Izin / Sakit */}
      <section className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-4 bg-amber-600 rounded-sm inline-block"></span>
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#043666]">
              Daftar Izin / Sakit Hari Ini
            </h2>
          </div>
          <span className="px-2.5 py-0.5 text-[11px] font-bold rounded bg-amber-100 text-amber-900">
            {data.izin.length} Peserta
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase text-[11px] font-extrabold tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Nama Peserta</th>
                <th className="px-5 py-3.5">Universitas / Instansi</th>
                <th className="px-5 py-3.5">Kategori</th>
                <th className="px-5 py-3.5">Keterangan</th>
                <th className="px-5 py-3.5">Dokumen Surat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {data.izin.map((iz, i) => (
                <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-slate-900">{iz.nama}</td>
                  <td className="px-5 py-3.5 text-slate-700">{iz.universitas}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-block px-2.5 py-0.5 text-xs font-bold rounded bg-amber-50 text-amber-800 border border-amber-200">
                      {iz.jenis}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{iz.keterangan || '-'}</td>
                  <td className="px-5 py-3.5">
                    {iz.link_surat ? (
                      <a
                        href={iz.link_surat}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-3 py-1 text-xs font-bold text-[#043666] bg-slate-100 hover:bg-[#043666] hover:text-white rounded transition-colors"
                      >
                        Lihat Surat
                      </a>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {data.izin.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-xs font-medium text-slate-400">
                    Tidak ada laporan izin atau sakit hari ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Seksi Belum Absen */}
      <section className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-4 bg-slate-400 rounded-sm inline-block"></span>
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Belum Melakukan Presensi
            </h2>
          </div>
          <span className="px-2.5 py-0.5 text-[11px] font-bold rounded bg-slate-200 text-slate-800">
            {data.belum.length} Orang
          </span>
        </div>
        <div className="p-5">
          {data.belum.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {data.belum.map((b, i) => (
                <div
                  key={i}
                  className="p-3.5 border border-slate-200 rounded-md bg-slate-50/40 flex flex-col justify-center"
                >
                  <div className="font-bold text-sm text-slate-800">{b.nama}</div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase mt-0.5">
                    {b.universitas}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-xs font-medium text-slate-400 py-4">
              Seluruh peserta magang aktif telah melakukan presensi hari ini.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}