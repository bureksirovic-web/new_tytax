import HistoryDetailPage from './page-client';

export const metadata = {
  title: 'Workout Detail',
  description: 'Detailed breakdown of a past workout',
};

export default function Page(props: { params: Promise<{ id: string }> }) {
  return <HistoryDetailPage {...props} />;
}
