'use client';
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';
import { useLocale } from '@/components/providers';

export default function Loading() {
  const { t } = useLocale();
  return (
    <div className="space-y-4 p-4" role="status" aria-busy="true">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton className="h-8 w-48" />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
