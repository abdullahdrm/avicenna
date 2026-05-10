import { TrendingDown, TrendingUp } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MetricsComparison, formatMetricChange, getImprovementScore } from '../lib/metricsComparison';

export type DiseaseType = 'acne' | 'psoriasis' | 'eczema' | 'fungal';

interface ProgressComparisonProps {
  comparison: MetricsComparison;
  showDetails?: boolean;
  diseaseType?: DiseaseType;
}

export const diseaseMetricLabels: Record<
  DiseaseType,
  {
    lesion: string;
    area: string;
    inflammation: string;
    severity: string;
    lesionUnit: string;
    severityUnit: string;
  }
> = {
  acne: {
    lesion: 'Lesion Count',
    area: 'Affected Area',
    inflammation: 'Inflammation',
    severity: 'GAGS Score',
    lesionUnit: ' lesions',
    severityUnit: ' points',
  },
  psoriasis: {
    lesion: 'Plaque Count',
    area: 'Affected Area',
    inflammation: 'Redness / Scaling',
    severity: 'Psoriasis Severity',
    lesionUnit: ' plaques',
    severityUnit: ' points',
  },
  eczema: {
    lesion: 'Patch Count',
    area: 'Affected Area',
    inflammation: 'Irritation Level',
    severity: 'Eczema Severity',
    lesionUnit: ' patches',
    severityUnit: ' points',
  },
  fungal: {
    lesion: 'Infection Spots',
    area: 'Affected Area',
    inflammation: 'Redness / Irritation',
    severity: 'Fungal Severity',
    lesionUnit: ' spots',
    severityUnit: ' points',
  },
};

export const getDiseaseTypeFromPrediction = (
  prediction?: string | null,
): DiseaseType => {
  const normalizedPrediction = prediction?.toLowerCase() || '';

  if (normalizedPrediction.includes('psoriasis')) return 'psoriasis';
  if (normalizedPrediction.includes('eczema')) return 'eczema';
  if (
    normalizedPrediction.includes('fungal') ||
    normalizedPrediction.includes('ringworm') ||
    normalizedPrediction.includes('tinea')
  ) {
    return 'fungal';
  }

  return 'acne';
};

export const ProgressComparison: React.FC<ProgressComparisonProps> = ({
  comparison,
  showDetails = true,
  diseaseType = 'acne',
}) => {
  if (comparison.trend === 'no-previous') {
    return (
      <View style={styles.container}>
        <Text style={styles.noDataText}>
          This is your first submission. Future submissions will show progress.
        </Text>
      </View>
    );
  }

  const improvementScore = getImprovementScore(comparison);
  const trendIcon = comparison.trend === 'improving' ? TrendingDown : TrendingUp;
  const TrendIcon = trendIcon;

  const trendColor =
    comparison.trend === 'improving'
      ? '#16a34a'
      : comparison.trend === 'declining'
      ? '#dc2626'
      : '#6B7280';

  const labels = diseaseMetricLabels[diseaseType];

  const lesionCountChange = formatMetricChange(
    comparison.changes.lesion_count,
    comparison.changes.lesion_count_percent,
    labels.lesionUnit
  );

  const areaRatioChange = formatMetricChange(
    comparison.changes.lesion_area_ratio * 100,
    comparison.changes.lesion_area_ratio_percent,
    '%'
  );

  const inflammationChange = formatMetricChange(
    comparison.changes.inflammation_score * 100,
    comparison.changes.inflammation_score_percent,
    '%'
  );

  const severityChange = formatMetricChange(
    comparison.changes.gags_score,
    comparison.changes.gags_score_percent,
    labels.severityUnit
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.trendBadge}>
          <TrendIcon size={20} color={trendColor} />
          <Text style={[styles.trendText, { color: trendColor }]}>
            {comparison.trend === 'improving'
              ? 'Improving'
              : comparison.trend === 'declining'
              ? 'Declining'
              : 'Stable'}
          </Text>
        </View>

        <View style={styles.scoreCircle}>
          <Text style={styles.scoreText}>{improvementScore.toFixed(0)}%</Text>
          <Text style={styles.scoreLabel}>Progress</Text>
        </View>
      </View>

      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${improvementScore}%`,
              backgroundColor: trendColor,
            },
          ]}
        />
      </View>

      {showDetails && (
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{labels.lesion}</Text>
            <Text style={[styles.detailValue, { color: lesionCountChange.color }]}>
              {lesionCountChange.text}
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{labels.area}</Text>
            <Text style={[styles.detailValue, { color: areaRatioChange.color }]}>
              {areaRatioChange.text}
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{labels.inflammation}</Text>
            <Text style={[styles.detailValue, { color: inflammationChange.color }]}>
              {inflammationChange.text}
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{labels.severity}</Text>
            <Text style={[styles.detailValue, { color: severityChange.color }]}>
              {severityChange.text}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  trendText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scoreCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  scoreLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  detailsContainer: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    maxWidth: '55%',
  },
  separator: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  noDataText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
