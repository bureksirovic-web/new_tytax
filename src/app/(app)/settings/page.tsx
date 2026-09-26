import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import SettingsPage from './page-client';

// Server metadata uses the default language (hr); the client heading follows the active locale.
export const metadata: Metadata = {
  title: t('set_title'),
  description: t('set_meta_description'),
};

export default function Page() {
  return <SettingsPage />;
}
