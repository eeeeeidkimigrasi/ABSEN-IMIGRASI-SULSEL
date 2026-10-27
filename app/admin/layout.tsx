import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Absensi',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 min-h-screen text-gray-900">
      {children}
    </div>
  );
}
