'use client';

/**
 * Last resort: an error in the root layout itself, which the per-route
 * boundary sits inside and therefore cannot catch.
 *
 * It replaces the whole document, so it has to bring its own <html> and <body>
 * and cannot rely on the app's stylesheet having loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '1.5rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#fafafa',
          color: '#18181b',
        }}
      >
        <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
            StudyMate could not start
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#52525b', marginTop: '0.5rem' }}>
            Your data is safe. This is a failure loading the app itself.
          </p>
          <p
            style={{
              fontSize: '0.75rem', color: '#71717a', background: '#f4f4f5',
              padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
              marginTop: '0.75rem', textAlign: 'left', wordBreak: 'break-word',
            }}
          >
            {error.message || 'No error message was provided.'}
            {error.digest ? ` (reference ${error.digest})` : ''}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: '1.25rem', height: '2.25rem', padding: '0 0.875rem',
              borderRadius: '0.375rem', border: 0, background: '#4f46e5',
              color: '#fff', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
