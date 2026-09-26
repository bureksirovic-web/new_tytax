import ProgramDetailPage from './page-client';

export const metadata = {
  title: 'Program',
};

export default function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ProgramDetailPage {...props} />;
}
