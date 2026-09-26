import HistoryEditPage from './page-client';

export const metadata = {
  title: 'Edit Workout',
  description: 'Edit a finished workout',
};

export default function Page(props: { params: Promise<{ id: string }> }) {
  return <HistoryEditPage {...props} />;
}
