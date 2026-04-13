'use client';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center max-w-md px-6">
        <div className="text-4xl mb-4">&#9888;</div>
        <h2 className="text-xl font-bold mb-2">Erro ao carregar</h2>
        <p className="text-muted-foreground mb-6">
          Nao foi possivel carregar esta pagina. Verifique sua conexao e tente novamente.
        </p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
