import { Suspense } from 'react';
import type { Metadata } from 'next';
import ExerciseDetailPage from './page-client';

type Props = { params: Promise<{ id: string }> };

// The catalog is client-side and lazy; the server does not load it just for a title.
export const metadata: Metadata = {
  title: 'Vježba',
};

export default function Page(props: Props) {
  return (
    <Suspense>
      <ExerciseDetailPage {...props} />
    </Suspense>
  );
}
