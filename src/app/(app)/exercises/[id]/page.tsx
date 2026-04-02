import ExerciseDetailPage from './page-client';
import type { Metadata } from 'next';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: id,
    description: 'Exercise details, muscle impact, and progression info',
  };
}

export default function Page(props: Props) {
  return <ExerciseDetailPage {...props} />;
}
