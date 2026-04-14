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
  CalendarDays,
  BarChart3,
  Bot,
  Settings,
  Package,
  GraduationCap,
  X,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contatos', icon: Users },
  { href: '/conversations', label: 'Conversas', icon: MessageSquare },
  { href: '/pipeline', label: 'Pipeline', icon: Kanban },
  { href: '/follow-ups', label: 'Follow-ups', icon: CalendarClock },
  { href: '/reservations', label: 'Reservas', icon: CalendarDays },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/products', label: 'Produtos', icon: Package },
  { href: '/bot-config', label: 'Config Bot', icon: Bot },
  { href: '/training', label: 'Treinamento', icon: GraduationCap },
  { href: '/settings', label: 'Configurações', icon: Settings },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'w-64 bg-white border-r flex flex-col',
        // Mobile: fixed overlay that slides in/out
        'fixed inset-y-0 left-0 z-30 h-full transition-transform duration-200',
        open ? 'translate-x-0' : '-translate-x-full',
        // Desktop: always visible as sticky sidebar
        'md:relative md:translate-x-0 md:h-screen md:sticky md:top-0',
      )}
    >
      <div className="p-6 border-b flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">VendaMais</h1>
          <p className="text-xs text-muted-foreground">Like Move 360</p>
        </div>
        <button
          onClick={onClose}
          className="md:hidden text-muted-foreground hover:text-foreground"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
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
