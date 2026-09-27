import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { t } from '@/lib/i18n';

vi.mock('next/navigation', async () => (await import('./test-utils')).navigationMock);

describe('history route metadata (refuter1 S3)', () => {
  it('is localized like settings/page.tsx, not hardcoded English', async () => {
    const edit = (await import('@/app/(app)/history/[id]/edit/page')).metadata;
    const detail = (await import('@/app/(app)/history/[id]/page')).metadata;
    const list = (await import('@/app/(app)/history/page')).metadata;
    expect(edit).toEqual({ title: t('hist_meta_edit_title'), description: t('hist_meta_edit_description') });
    expect(detail).toEqual({ title: t('hist_meta_detail_title'), description: t('hist_meta_detail_description') });
    expect(list).toEqual({ title: t('hist_meta_title'), description: t('hist_meta_description') });
    expect(edit.title).toBe('Uredi trening');
  });
});
