'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { api } from '@/lib/utils';
import { formatPhoneDisplay } from '@vendamais/shared';
import { Search } from 'lucide-react';
import type { Contact } from '@vendamais/shared';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<(Contact & { deals?: any[] })[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  function handleSearchChange(value: string) {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 350);
  }

  useEffect(() => {
    const params = debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : '';
    api<{ data: any[] }>(`/contacts${params}`)
      .then((res) => setContacts(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debouncedSearch]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contatos</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar contatos..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium">Nome</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Telefone</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Evento</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Cidade</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Tags</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
            ) : contacts.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum contato encontrado</td></tr>
            ) : (
              contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/contacts/${contact.id}`} className="text-primary hover:underline font-medium">
                      {contact.name || 'Sem nome'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">{formatPhoneDisplay(contact.phone)}</td>
                  <td className="px-4 py-3 text-sm">{contact.event_type || '-'}</td>
                  <td className="px-4 py-3 text-sm">{contact.city || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {(contact.tags || []).map((tag) => (
                        <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
