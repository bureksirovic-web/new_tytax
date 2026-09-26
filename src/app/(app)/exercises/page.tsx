import { Suspense } from 'react';
import type { Metadata } from 'next';
import ExercisesPage from './page-client';

// Static metadata is not localised (server side has no locale); hr is the default language.
export const metadata: Metadata = {
  title: 'Vježbe',
};

export default function Page() {
  // useSearchParams (filter state in the URL) needs a Suspense boundary.
  return (
    <Suspense>
      <ExercisesPage />
    </Suspense>
  );
}
