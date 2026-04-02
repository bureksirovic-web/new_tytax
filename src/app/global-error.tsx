'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body style={{
        margin: 0,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: '#0a0f1a',
        color: '#f9fafb',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <h2 style={{
          fontFamily: "'Oswald', 'Arial Narrow', sans-serif",
          fontSize: '1.5rem',
          textTransform: 'uppercase',
          color: '#fcd34d',
          marginBottom: '0.5rem',
        }}>
          Something went wrong
        </h2>
        <p style={{
          color: '#9ca3af',
          fontSize: '0.875rem',
          textAlign: 'center',
          maxWidth: '24rem',
          marginBottom: '0.5rem',
        }}>
          {error.message || 'An unexpected error occurred.'}
        </p>
        {error.digest && (
          <p style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            color: '#6b7280',
            fontSize: '0.75rem',
            marginBottom: '1.5rem',
          }}>
            Error digest: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#4a7c3f',
            color: '#f9fafb',
            border: 'none',
            borderRadius: '4px',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
