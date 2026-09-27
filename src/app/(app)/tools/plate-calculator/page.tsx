import PlateCalculatorPage from './page-client';
import { t } from '@/lib/i18n/dictionaries';

// Server metadata uses the app's default locale (en); the page body follows the user's locale.
export const metadata = {
  title: t('plate_title', 'en'),
  description: t('plate_meta_desc', 'en'),
};

export default function Page() {
  return <PlateCalculatorPage />;
}
