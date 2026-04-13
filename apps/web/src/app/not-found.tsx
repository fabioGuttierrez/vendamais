import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-6">
        <div className="text-6xl font-bold text-muted-foreground mb-4">404</div>
        <h1 className="text-2xl font-bold mb-2">Pagina nao encontrada</h1>
        <p className="text-muted-foreground mb-6">
          A pagina que voce esta procurando nao existe ou foi movida.
        </p>
        <Link
          href="/dashboard"
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 inline-block"
        >
          Voltar ao painel
        </Link>
      </div>
    </div>
  );
}
