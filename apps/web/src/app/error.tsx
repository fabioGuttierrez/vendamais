'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-6">
        <div className="text-5xl mb-4">&#9888;</div>
        <h1 className="text-2xl font-bold mb-2">Algo deu errado</h1>
        <p className="text-muted-foreground mb-6">
          Ocorreu um erro inesperado. Tente novamente ou entre em contato com o suporte se o problema persistir.
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
