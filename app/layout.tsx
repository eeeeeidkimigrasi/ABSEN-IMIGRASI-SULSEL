import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Absen Mahasiswa Magang',
  description: 'Web absen sederhana mahasiswa magang',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}