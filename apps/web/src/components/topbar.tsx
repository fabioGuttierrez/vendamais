'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export function Topbar() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="text-sm text-muted-foreground">
        CRM - Painel de Vendas
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </button>
    </header>
  );
}
