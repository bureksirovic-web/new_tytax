import SessionEditorPage from './page-client';

export const metadata = {
  title: 'Program session',
};

export default function Page(props: {
  params: Promise<{ id: string; sessionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <SessionEditorPage {...props} />;
}
