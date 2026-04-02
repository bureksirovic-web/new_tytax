import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
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
        404
      </h2>
      <p style={{
        color: '#9ca3af',
        fontSize: '0.875rem',
        textAlign: 'center',
        maxWidth: '24rem',
        marginBottom: '1.5rem',
      }}>
        Page not found
      </p>
      <Link
        href="/dashboard"
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#4a7c3f',
          color: '#f9fafb',
          borderRadius: '4px',
          textDecoration: 'none',
          fontSize: '0.875rem',
          fontWeight: 500,
        }}
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
