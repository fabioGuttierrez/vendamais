import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'VendaMais - CRM Like Move 360',
  description: 'Sistema de vendas WhatsApp + CRM',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        {children}
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      </body>
    </html>
  );
}
