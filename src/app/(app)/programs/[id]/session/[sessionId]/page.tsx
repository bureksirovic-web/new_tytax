import SessionEditorPage from './page-client';

export const metadata = {
  title: 'Program session',
};

export default function Page(props: { params: Promise<{ id: string; sessionId: string }> }) {
  return <SessionEditorPage {...props} />;
}
