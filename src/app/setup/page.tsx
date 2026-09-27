import type { Metadata } from 'next';
import { SetupView } from './setup-view';

export const metadata: Metadata = {
  title: 'TYTAX — postavljanje profila',
};

/**
 * Family-profiles setup link (`/setup#p=<base64url(JSON)>`): the fragment
 * never reaches the server. See PLAN-family-profiles.md, Piece 1.
 */
export default function SetupPage() {
  return <SetupView />;
}
