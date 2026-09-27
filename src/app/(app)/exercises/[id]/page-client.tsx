'use client';
import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { ExerciseDetail } from '../_components/exercise-detail';
import { safeDecodeId } from '../_components/library-params';

export default function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const from = useSearchParams()?.get('from');
  return <ExerciseDetail id={safeDecodeId(id)} from={from} />;
}
