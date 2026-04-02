import ExerciseAnalyticsPage from './page-client';

export const metadata = {
  title: 'Exercise Analytics',
  description: 'Per-exercise e1RM progression and PR tracking',
};

export default function Page(props: { params: Promise<{ exerciseId: string }> }) {
  return <ExerciseAnalyticsPage {...props} />;
}
