import { Suspense } from 'react';
import { NotConfiguredAlert } from './auth-alert';
import { LoginShell } from './login-shell';
import { LoginForm } from './login-form';

// useSearchParams() in LoginForm needs a Suspense boundary for static rendering;
// Next renders that subtree on the client only, so the not-configured banner
// sits outside it and ships in the prerendered HTML.
export default function LoginPage() {
  return (
    <LoginShell>
      <NotConfiguredAlert />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </LoginShell>
  );
}
