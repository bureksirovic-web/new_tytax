import type { WorkoutLog } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
import { computeACWR } from './acwr';
import { computeVolumeParity } from './volume-parity';
import { getWeekKey, parseLocalDay } from '@/lib/utils';
import { dayCutoff, liveLogs, logVolume } from './sets';
import '@/lib/i18n/packs/requests';

export interface KineticImpactScore {
  score: number; // 0-100
  label: 'poor' | 'fair' | 'good' | 'excellent';
  components: {
    acwrScore: number;      // 0-30 pts: ACWR in optimal zone
    parityScore: number;    // 0-30 pts: movement balance
    consistencyScore: number; // 0-20 pts: training frequency
    volumeScore: number;    // 0-20 pts: weekly volume vs personal average
  };
  /** i18n key for the explanation (G4-31 / spec N5): the UI translates it. */
  explanationKey: KineticExplanationKey;
  /** @deprecated English text kept for older callers; use `explanationKey`. */
  explanation: string;
}

export type KineticExplanationKey = 'ki_no_data' | 'ki_no_recent' | 'ki_excellent' | 'ki_good' | 'ki_fair' | 'ki_poor';

export function computeKineticImpact(
  allLogs: readonly WorkoutLog[] | null | undefined,
  windowDays = 28,
  opts: { now?: Date; lookup?: ExerciseLookup } = {},
): KineticImpactScore {
  const now = opts.now ?? new Date();
  const logs = liveLogs(allLogs ?? []);
  if (logs.length === 0) {
    return {
      score: 0,
      label: 'poor',
      components: {
        acwrScore: 0,
        parityScore: 0,
        consistencyScore: 0,
        volumeScore: 0
      },
      explanationKey: 'ki_no_data',
      explanation: 'No workout data available to calculate a score.'
    };
  }

  // Use recent logs up to windowDays
  const cutoffStr = dayCutoff(now, windowDays);

  const recentLogs = logs.filter(log => log.date >= cutoffStr);
  if (recentLogs.length === 0) {
    return {
      score: 0,
      label: 'poor',
      components: {
        acwrScore: 0,
        parityScore: 0,
        consistencyScore: 0,
        volumeScore: 0
      },
      explanationKey: 'ki_no_recent',
      explanation: 'No recent workout data to calculate a score.'
    };
  }

  // ACWR Score
  const acwrResults = computeACWR(logs);
  let acwrScore = 0;
  if (acwrResults.length > 0) {
    const latestACWR = acwrResults[acwrResults.length - 1];
    const ratio = latestACWR.ratio;

    // 30 pts if ratio 0.8-1.3, scale down for caution/danger/undertrain
    if (ratio >= 0.8 && ratio <= 1.3) {
      acwrScore = 30;
    } else if (ratio < 0.8) {
      acwrScore = Math.max(0, 30 * (ratio / 0.8));
    } else if (ratio <= 1.5) {
      acwrScore = Math.max(0, 30 * (1 - (ratio - 1.3) / 0.2));
    } else {
      acwrScore = Math.max(0, 30 * (1 - (ratio - 1.3) / 0.5)); // danger zone
    }
  }

  // Parity Score
  const parityResults = computeVolumeParity(logs, windowDays, { now, lookup: opts.lookup });
  let sumAbsDelta = 0;
  for (const r of parityResults) {
    sumAbsDelta += Math.abs(r.delta);
  }
  const avgAbsDelta = parityResults.length > 0 ? sumAbsDelta / parityResults.length : 0;
  // Parity score: 30 pts * (1 - average abs(delta)/100)
  const parityScore = Math.max(0, 30 * (1 - avgAbsDelta / 100));

  // Consistency Score
  // Consistency: 20 pts based on workouts per week vs target (3-4/week = full points)
  const weeksMap = new Set<string>();
  recentLogs.forEach(log => weeksMap.add(getWeekKey(parseLocalDay(log.date))));
  const numWeeks = Math.max(1, weeksMap.size);
  const avgWorkoutsPerWeek = recentLogs.length / numWeeks;
  let consistencyScore = 0;
  if (avgWorkoutsPerWeek >= 3) {
    consistencyScore = 20;
  } else {
    consistencyScore = (avgWorkoutsPerWeek / 3) * 20;
  }

  // Volume Score
  // Volume: 20 pts based on current week vs 4-week average
  let currentWeekVolume = 0;
  let fourWeekVolume = 0;
  const currentWeekKey = getWeekKey(now);
  const fourWeeksAgo = dayCutoff(now, 28);

  logs.forEach(log => {
    const vol = logVolume(log);
    if (getWeekKey(parseLocalDay(log.date)) === currentWeekKey) {
      currentWeekVolume += vol;
    }
    if (log.date >= fourWeeksAgo) {
      fourWeekVolume += vol;
    }
  });

  const avg4WeekVolume = fourWeekVolume / 4;
  let volumeScore = 0;
  if (avg4WeekVolume === 0) {
    volumeScore = 10; // Neutral if no history
  } else {
    const volRatio = currentWeekVolume / avg4WeekVolume;
    // 20 points if within 90-110% of 4-week average
    if (volRatio >= 0.9 && volRatio <= 1.1) {
      volumeScore = 20;
    } else if (volRatio < 0.9) {
      volumeScore = Math.max(0, 20 * (volRatio / 0.9));
    } else {
      // Overreaching
      volumeScore = Math.max(0, 20 * (1 - (volRatio - 1.1)));
    }
  }

  // Ensure bounds
  acwrScore = Math.min(30, Math.max(0, acwrScore));
  const parityScoreFinal = Math.min(30, Math.max(0, parityScore));
  consistencyScore = Math.min(20, Math.max(0, consistencyScore));
  volumeScore = Math.min(20, Math.max(0, volumeScore));

  const totalScore = Math.round(acwrScore + parityScoreFinal + consistencyScore + volumeScore);

  let label: 'poor' | 'fair' | 'good' | 'excellent';
  if (totalScore >= 80) label = 'excellent';
  else if (totalScore >= 60) label = 'good';
  else if (totalScore >= 40) label = 'fair';
  else label = 'poor';

  let explanation = '';
  if (label === 'excellent') {
    explanation = 'Training load is balanced and consistent. Movement parity is well-distributed.';
  } else if (label === 'good') {
    explanation = 'Good training quality overall. Review components to reach optimal levels.';
  } else if (label === 'fair') {
    explanation = 'Moderate imbalances or inconsistency detected. Focus on lagging movement patterns.';
  } else {
    explanation = 'Training is suboptimal. Review recovery, consistency, and exercise balance.';
  }

  return {
    score: totalScore,
    label,
    components: {
      acwrScore: Math.round(acwrScore),
      parityScore: Math.round(parityScoreFinal),
      consistencyScore: Math.round(consistencyScore),
      volumeScore: Math.round(volumeScore)
    },
    explanationKey: `ki_${label}`,
    explanation
  };
}
