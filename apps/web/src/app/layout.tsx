import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VendaMais - CRM Like Move 360',
  description: 'Sistema de vendas WhatsApp + CRM',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
