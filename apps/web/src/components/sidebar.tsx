'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Kanban,
  CalendarClock,
  BarChart3,
  Bot,
  Settings,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contatos', icon: Users },
  { href: '/conversations', label: 'Conversas', icon: MessageSquare },
  { href: '/pipeline', label: 'Pipeline', icon: Kanban },
  { href: '/follow-ups', label: 'Follow-ups', icon: CalendarClock },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/bot-config', label: 'Config Bot', icon: Bot },
  { href: '/settings', label: 'Configurações', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r h-screen sticky top-0 flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold text-primary">VendaMais</h1>
        <p className="text-xs text-muted-foreground">Like Move 360</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t text-xs text-muted-foreground">
        VendaMais v0.1.0
      </div>
    </aside>
  );
}
