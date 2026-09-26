import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import HistoryEditPage from './page-client';

// Server metadata uses the default language (hr), as settings/page.tsx does; the client heading follows the active locale.
export const metadata: Metadata = {
  title: t('hist_meta_edit_title'),
  description: t('hist_meta_edit_description'),
};

export default function Page(props: { params: Promise<{ id: string }> }) {
  return <HistoryEditPage {...props} />;
}
