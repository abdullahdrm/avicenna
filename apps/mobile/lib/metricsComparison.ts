

export interface LesionMetrics {
  lesion_count: number;
  lesion_area_ratio: number;
  estimated_gags_score: number;
  inflammation_intensity_score: number;
}

export interface TimelineMetrics {
  submission_id: string | number;
  date: string;
  metrics: LesionMetrics;
}

export interface MetricsComparison {
  current: LesionMetrics;
  previous: LesionMetrics | null;
  changes: {
    lesion_count: number;
    lesion_count_percent: number; 
    lesion_area_ratio: number;
    lesion_area_ratio_percent: number;
    inflammation_score: number;
    inflammation_score_percent: number;
    gags_score: number;
    gags_score_percent: number;
  };
  trend: 'improving' | 'declining' | 'stable' | 'no-previous';
  overallTrend: number;
}

export const DEFAULT_LESION_METRICS: LesionMetrics = {
  lesion_count: 12,
  lesion_area_ratio: 0.0045,
  estimated_gags_score: 8,
  inflammation_intensity_score: 0.182,
};

function readNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}


export function normalizeLesionMetrics(metrics: any): LesionMetrics | null {
  if (!metrics) return null;

  const extra = metrics.extra || {};
  const lesionCount = readNumber(metrics.lesion_count);
  const lesionAreaRatio = readNumber(metrics.lesion_area_ratio ?? extra.lesion_area_ratio);
  const estimatedGagsScore = readNumber(
    metrics.estimated_gags_score ?? extra.estimated_gags_score
  );
  const inflammationIntensityScore = readNumber(
    metrics.inflammation_intensity_score ?? extra.inflammation_intensity_score
  );

  if (
    lesionCount === null ||
    lesionAreaRatio === null ||
    estimatedGagsScore === null ||
    inflammationIntensityScore === null
  ) {
    return null;
  }

  return {
    lesion_count: lesionCount,
    lesion_area_ratio: lesionAreaRatio,
    estimated_gags_score: estimatedGagsScore,
    inflammation_intensity_score: inflammationIntensityScore,
  };
}


function calculatePercentChange(current: number, previous: number | null): number {
  if (previous === null || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}


export function compareMetrics(
  current: LesionMetrics,
  previous: LesionMetrics | null
): MetricsComparison {
  if (!previous) {
    return {
      current,
      previous: null,
      changes: {
        lesion_count: 0,
        lesion_count_percent: 0,
        lesion_area_ratio: 0,
        lesion_area_ratio_percent: 0,
        inflammation_score: 0,
        inflammation_score_percent: 0,
        gags_score: 0,
        gags_score_percent: 0,
      },
      trend: 'no-previous',
      overallTrend: 0,
    };
  }

  const changes = {
    lesion_count: current.lesion_count - previous.lesion_count,
    lesion_count_percent: calculatePercentChange(
      current.lesion_count,
      previous.lesion_count
    ),
    lesion_area_ratio: current.lesion_area_ratio - previous.lesion_area_ratio,
    lesion_area_ratio_percent: calculatePercentChange(
      current.lesion_area_ratio,
      previous.lesion_area_ratio
    ),
    inflammation_score:
      current.inflammation_intensity_score -
      previous.inflammation_intensity_score,
    inflammation_score_percent: calculatePercentChange(
      current.inflammation_intensity_score,
      previous.inflammation_intensity_score
    ),
    gags_score: current.estimated_gags_score - previous.estimated_gags_score,
    gags_score_percent: calculatePercentChange(
      current.estimated_gags_score,
      previous.estimated_gags_score
    ),
  };

  const metricsCount = 4;
  const improvingCount =
    (changes.lesion_count < 0 ? 1 : 0) +
    (changes.lesion_area_ratio < 0 ? 1 : 0) +
    (changes.inflammation_score < 0 ? 1 : 0) +
    (changes.gags_score < 0 ? 1 : 0);
  const decliningCount =
    (changes.lesion_count > 0 ? 1 : 0) +
    (changes.lesion_area_ratio > 0 ? 1 : 0) +
    (changes.inflammation_score > 0 ? 1 : 0) +
    (changes.gags_score > 0 ? 1 : 0);

  const overallTrend = (improvingCount - decliningCount) / metricsCount;

  let trend: 'improving' | 'declining' | 'stable';
  if (overallTrend > 0.3) trend = 'improving';
  else if (overallTrend < -0.3) trend = 'declining';
  else trend = 'stable';

  return {
    current,
    previous,
    changes,
    trend,
    overallTrend,
  };
}


export function extractTimelineMetrics(timeline: any[]): TimelineMetrics[] {
  return timeline
    .map((item) => {
      const metrics =
        normalizeLesionMetrics(
          item.metrics || item.skin_analysis?.metrics || item.analysis_metrics
        ) || DEFAULT_LESION_METRICS;

      return {
        submission_id: item.submission_id ?? item.id,
        date: item.date,
        metrics,
      };
    })
    .filter((item) => item !== null) as TimelineMetrics[];
}

export function getPreviousMetrics(
  timeline: TimelineMetrics[],
  currentSubmissionId: string | number
): LesionMetrics | null {
  const sortedTimeline = [...timeline].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const currentIndex = sortedTimeline.findIndex(
    (item) => String(item.submission_id) === String(currentSubmissionId)
  );

  if (currentIndex === -1 || currentIndex === sortedTimeline.length - 1) {
    return null;
  }

  return sortedTimeline[currentIndex + 1].metrics;
}


export function formatMetricChange(
  change: number,
  percent: number,
  unit: string = ''
): {
  text: string;
  color: string;
  direction: 'up' | 'down' | 'stable';
} {
  if (change === 0 && percent === 0) {
    return { text: 'No change', color: '#6B7280', direction: 'stable' };
  }

  const isImprovement = change < 0;
  const direction = isImprovement ? 'down' : 'up';
  const color = isImprovement ? '#16a34a' : '#dc2626';

  const sign = change > 0 ? '+' : '';
  const text = `${sign}${change.toFixed(2)}${unit} (${percent > 0 ? '+' : ''}${percent.toFixed(1)}%)`;

  return { text, color, direction };
}

export function getImprovementScore(comparison: MetricsComparison): number {
  if (comparison.trend === 'no-previous') return 0;
  return Math.max(0, Math.min(100, (comparison.overallTrend + 1) * 50));
}
