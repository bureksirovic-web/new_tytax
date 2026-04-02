import ProgramDetailPage from './page-client';

export const metadata = {
  title: 'Program Detail',
  description: 'View and manage a training program',
};

export default function Page(props: { params: Promise<{ id: string }> }) {
  return <ProgramDetailPage {...props} />;
}
