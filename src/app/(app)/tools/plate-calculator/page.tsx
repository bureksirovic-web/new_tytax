import PlateCalculatorPage from './page-client';
import { TOOLS_STRINGS } from '@/components/tools/tools-strings';

// Server metadata uses the app's default locale (en); the page body follows the user's locale.
export const metadata = {
  title: TOOLS_STRINGS.en.plate_title,
  description: TOOLS_STRINGS.en.plate_meta_desc,
};

export default function Page() {
  return <PlateCalculatorPage />;
}
