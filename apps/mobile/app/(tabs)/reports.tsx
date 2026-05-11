import * as Print from 'expo-print';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import {
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Clock,
  Download,
  FileText,
  RefreshCw
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressComparison } from '../../components/ProgressComparison';
import { useLanguage } from '../../lib/LanguageContext';
import {
  compareMetrics,
  normalizeLesionMetrics,
} from '../../lib/metricsComparison';
import { usePatientTheme } from '../../lib/PatientThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BASE_URL = 'http://172.20.10.2:8000';
const API_URL = `${BASE_URL}/api/patient/reports/`;

interface MedicalReport {
  id: number;
  submission_id?: number | string;
  skin_analysis_id?: number | string;
  image?: string | null;
  status: 'pending' | 'reviewed';
  place: string;
  doctor_name: string;
  diagnosis: string | null;
  doctor_comment: string;
  medications: string[];
  visit_required: boolean;
  date: string;
  timeline_images: TimelineImage[];
  metrics?: {
    lesion_count: number;
    extra: {
      lesion_area_ratio: number;
      estimated_gags_score: number;
      inflammation_intensity_score: number;
    };
  };
}

interface ReportGroup {
  id: string;
  reports: MedicalReport[];
  timeline_images: TimelineImage[];
}

interface TimelineImage {
  id?: number | string;
  submission_id?: number | string;
  skin_analysis_id?: number | string;
  image: string;
  date: string;
}

const Card = ({ children, style }: any) => (
  <View style={[styles.card, style]}>{children}</View>
);

const getReportTime = (report: MedicalReport) => new Date(report.date).getTime() || 0;

const getTimelineImageTime = (image: TimelineImage) =>
  new Date(image.date).getTime() || 0;

const getSortedReportsNewestFirst = (reports: MedicalReport[]) => {
  return [...reports].sort((a, b) => getReportTime(b) - getReportTime(a));
};

const getSortedReportsOldestFirst = (reports: MedicalReport[]) => {
  return [...reports].sort((a, b) => getReportTime(a) - getReportTime(b));
};

const getSortedTimelineImages = (report: MedicalReport) => {
  return [...(report.timeline_images || [])].sort((a, b) => {
    return getTimelineImageTime(a) - getTimelineImageTime(b);
  });
};

const getGroupedReports = (reports: MedicalReport[]): ReportGroup[] => {
  const groups: ReportGroup[] = [];

  const getTimelineKey = (item: TimelineImage) => `${item.image}|${item.date}`;

  reports.forEach((report) => {
    const reportTimeline = getSortedTimelineImages(report);

    if (reportTimeline.length === 0) {
      groups.push({
        id: `report-${report.id}`,
        reports: [report],
        timeline_images: [],
      });
      return;
    }

    const reportTimelineKeys = new Set(reportTimeline.map(getTimelineKey));
    const existing = groups.find((group) =>
      group.timeline_images.some((item) => reportTimelineKeys.has(getTimelineKey(item))),
    );

    if (existing) {
      existing.reports.push(report);
      const mergedTimeline = [...existing.timeline_images];
      reportTimeline.forEach((item) => {
        if (!mergedTimeline.some((existingItem) => getTimelineKey(existingItem) === getTimelineKey(item))) {
          mergedTimeline.push(item);
        }
      });
      existing.timeline_images = [...mergedTimeline].sort((a, b) => getTimelineImageTime(a) - getTimelineImageTime(b));
      return;
    }

    groups.push({
      id: reportTimeline.map(getTimelineKey).join('::'),
      reports: [report],
      timeline_images: reportTimeline,
    });
  });

  return groups
    .map((group) => ({
      ...group,
      id: group.timeline_images.length
        ? group.timeline_images.map(getTimelineKey).join('::')
        : group.id,
      reports: getSortedReportsNewestFirst(group.reports),
    }))
    .sort((a, b) => getReportTime(b.reports[0]) - getReportTime(a.reports[0]));
};

export default function ReportsScreen() {
  const { t } = useLanguage();
  const { colors } = usePatientTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'reviewed' | 'pending' | 'followups'>('all');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [activeTimelineByGroup, setActiveTimelineByGroup] = useState<Record<string, number>>({});
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [downloadingReportId, setDownloadingReportId] = useState<number | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const getImageUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${BASE_URL}${path}`;
  };

  const getSecureImageUrl = (path: string | null) => {
    const imageUrl = getImageUrl(path);
    if (!imageUrl || !authToken) return imageUrl;
    const separator = imageUrl.includes('?') ? '&' : '?';
    return `${imageUrl}${separator}token=${authToken}`;
  };

  const generateReportPDF = async (report: MedicalReport) => {
    try {
      setDownloadingReportId(report.id);

      const htmlContent = `
        <html>
          <head>
            <meta charset="UTF-8" />
            <style>
              * { margin: 0; padding: 0; }
              body { font-family: 'Arial', sans-serif; padding: 20px; color: #333; }
              .header { border-bottom: 2px solid #2563EB; padding-bottom: 10px; margin-bottom: 20px; }
              .title { font-size: 24px; font-weight: bold; color: #2563EB; margin-bottom: 5px; }
              .subtitle { font-size: 14px; color: #666; }
              .section { margin-bottom: 15px; }
              .section-title { font-size: 16px; font-weight: bold; color: #111827; margin-bottom: 8px; border-bottom: 1px solid #E5E7EB; padding-bottom: 5px; }
              .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #F3F4F6; }
              .detail-label { font-weight: bold; color: #6B7280; width: 40%; }
              .detail-value { color: #111827; }
              .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
              .stat-box { border: 1px solid #E5E7EB; padding: 10px; border-radius: 5px; }
              .stat-label { font-size: 12px; color: #6B7280; }
              .stat-value { font-size: 18px; font-weight: bold; color: #2563EB; }
              .medications { background: #F9FAFB; padding: 10px; border-radius: 5px; }
              .med-item { padding: 5px 0; color: #111827; }
              .alert { background: #FEF2F2; border-left: 4px solid #DC2626; padding: 10px; margin-top: 10px; }
              .alert-text { color: #B91C1C; font-weight: bold; }
              .generated-date { text-align: right; font-size: 12px; color: #9CA3AF; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">Medical Report</div>
              <div class="subtitle">${report.place}</div>
            </div>

            <div class="section">
              <div class="section-title">Doctor Information</div>
              <div class="detail-row">
                <span class="detail-label">Doctor:</span>
                <span class="detail-value">${report.doctor_name}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${report.date}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Status:</span>
                <span class="detail-value">${report.status === 'reviewed' ? 'Diagnosis Ready' : 'Under Review'}</span>
              </div>
            </div>

            ${report.diagnosis ? `
            <div class="section">
              <div class="section-title">Official Diagnosis</div>
              <div style="padding: 10px; background: #F9FAFB; border-radius: 5px;">
                ${report.diagnosis}
              </div>
            </div>
            ` : ''}

            ${report.metrics ? `
            <div class="section">
              <div class="section-title">Analysis Metrics</div>
              <div class="stats-grid">
                <div class="stat-box">
                  <div class="stat-label">Lesion Count</div>
                  <div class="stat-value">${report.metrics?.lesion_count ?? 12}</div>
                </div>
                <div class="stat-box">
                  <div class="stat-label">Affected Area</div>
                  <div class="stat-value">${report.metrics?.extra?.lesion_area_ratio ? (report.metrics.extra.lesion_area_ratio * 100).toFixed(2) : '0.45'}%</div>
                </div>
                <div class="stat-box">
                  <div class="stat-label">Est. GAGS Score</div>
                  <div class="stat-value">${report.metrics?.extra?.estimated_gags_score ?? 8}</div>
                </div>
                <div class="stat-box">
                  <div class="stat-label">Inflammation</div>
                  <div class="stat-value">${report.metrics?.extra?.inflammation_intensity_score ? (report.metrics.extra.inflammation_intensity_score * 100).toFixed(2) : '18.2'}%</div>
                </div>
              </div>
            </div>
            ` : ''}

            ${report.doctor_comment ? `
            <div class="section">
              <div class="section-title">Doctor Notes</div>
              <div style="padding: 10px; background: #FFFBEB; border-radius: 5px; border-left: 4px solid #D97706;">
                <i>"${report.doctor_comment}"</i>
              </div>
            </div>
            ` : ''}

            ${report.medications && report.medications.length > 0 ? `
            <div class="section">
              <div class="section-title">Medications</div>
              <div class="medications">
                ${report.medications.map(med => `<div class="med-item">• ${med}</div>`).join('')}
              </div>
            </div>
            ` : ''}

            ${report.visit_required ? `
            <div class="alert">
              <div class="alert-text">⚠️ Doctor recommends an in-person visit</div>
            </div>
            ` : ''}

            <div class="generated-date">Generated on: ${new Date().toLocaleString()}</div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Report from ${report.place}`,
      });

      setDownloadingReportId(null);
    } catch (error) {
      console.error('PDF Generation Error:', error);
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
      setDownloadingReportId(null);
    }
  };

  const fetchReports = async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      setAuthToken(token);
      const response = await fetch(API_URL, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const json = await response.json();
        if (Array.isArray(json)) {
            setReports(json);
        } else if (json.results) {
            setReports(json.results);
        } else {
            setReports([]);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchReports();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  const groupedReports = useMemo(() => getGroupedReports(reports), [reports]);

  const getActiveTimelineIndex = (group: ReportGroup) => {
    const activeIndex = activeTimelineByGroup[group.id];
    if (typeof activeIndex === 'number') return activeIndex;
    return Math.max(group.timeline_images.length - 1, 0);
  };

  const getTimelineReport = (group: ReportGroup, image: TimelineImage, index: number): MedicalReport | null => {
    const explicitMatch = group.reports.find((report) =>
      (image.submission_id && String(report.submission_id) === String(image.submission_id)) ||
      (image.skin_analysis_id && String(report.skin_analysis_id) === String(image.skin_analysis_id)) ||
      (image.id && String(report.submission_id) === String(image.id)) ||
      (report.image && report.image === image.image)
    );

    if (explicitMatch) return explicitMatch;

    const reportsOldestFirst = getSortedReportsOldestFirst(group.reports);
    if (index < reportsOldestFirst.length) return reportsOldestFirst[index];
    return null;
  };

  const getActiveReport = (group: ReportGroup) => {
    const activeIndex = getActiveTimelineIndex(group);
    const activeImage = group.timeline_images[activeIndex];
    if (!activeImage) return group.reports[0] || null;
    return getTimelineReport(group, activeImage, activeIndex);
  };

  const getSummaryReport = (group: ReportGroup) => {
    return group.reports[0] || null;
  };

  const hasReviewedReport = (group: ReportGroup) => {
    return group.reports.some((report) => report.status === 'reviewed');
  };

  const hasPendingReport = (group: ReportGroup) => {
    return (
      group.reports.some((report) => report.status === 'pending') ||
      group.timeline_images.length > group.reports.length
    );
  };

  const getGroupProgressComparison = (group: ReportGroup, activeReport: MedicalReport | null) => {
    if (!activeReport) return null;

    const currentMetrics = normalizeLesionMetrics(activeReport.metrics);
    if (!currentMetrics) return null;

    const timelineReports = group.timeline_images
      .map((image, index) => getTimelineReport(group, image, index))
      .filter((report): report is MedicalReport => Boolean(report))
      .filter((report, index, orderedReports) =>
        orderedReports.findIndex((item) => item.id === report.id) === index,
      );
    const orderedReports = timelineReports.length > 0
      ? timelineReports
      : getSortedReportsOldestFirst(group.reports);
    const activeIndex = orderedReports.findIndex((report) => report.id === activeReport.id);

    if (activeIndex <= 0) return compareMetrics(currentMetrics, null);

    const previousMetrics = normalizeLesionMetrics(orderedReports[activeIndex - 1].metrics);
    return compareMetrics(currentMetrics, previousMetrics);
  };

  const selectTimelineReport = (group: ReportGroup, index: number) => {
    setActiveTimelineByGroup((prev) => ({
      ...prev,
      [group.id]: index,
    }));
  };

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedGroup(selectedGroup === id ? null : id);
  };

  const filteredGroups = groupedReports.filter((group) => {
    const isFollowUp = group.timeline_images.length > 1 || group.reports.length > 1;
    if (filter === 'all') return true;
    if (filter === 'reviewed') return hasReviewedReport(group);
    if (filter === 'pending') return hasPendingReport(group);
    if (filter === 'followups') return isFollowUp;
    return true;
  });

  const counts = {
    all: groupedReports.length,
    reviewed: groupedReports.filter(hasReviewedReport).length,
    pending: groupedReports.filter(hasPendingReport).length,
    followups: groupedReports.filter(group => group.timeline_images.length > 1 || group.reports.length > 1).length,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('reportsScreen.title')}</Text>
        <Text style={styles.headerSubtitle}>{t('reportsScreen.subtitle')}</Text>
      </View>

      <View style={[styles.filterContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          <TouchableOpacity
            style={[styles.filterChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, filter === 'all' && styles.filterChipActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, { color: colors.mutedText }, filter === 'all' && styles.filterTextActive]}>{t('reportsScreen.all')} ({counts.all})</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, filter === 'reviewed' && styles.filterChipActive]}
            onPress={() => setFilter('reviewed')}
          >
            <Text style={[styles.filterText, { color: colors.mutedText }, filter === 'reviewed' && styles.filterTextActive]}>{t('reportsScreen.completed')} ({counts.reviewed})</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, filter === 'pending' && styles.filterChipActive]}
            onPress={() => setFilter('pending')}
          >
            <Text style={[styles.filterText, { color: colors.mutedText }, filter === 'pending' && styles.filterTextActive]}>{t('reportsScreen.pending')} ({counts.pending})</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, filter === 'followups' && styles.filterChipActive]}
            onPress={() => setFilter('followups')}
          >
            <Text style={[styles.filterText, { color: colors.mutedText }, filter === 'followups' && styles.filterTextActive]}>{t('reportsScreen.followUps')} ({counts.followups})</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
      >
        {loading && !refreshing ? (
          <View style={{ marginTop: 50 }}><ActivityIndicator size="large" color="#2563EB" /></View>
        ) : filteredGroups.length > 0 ? (
          <View style={styles.list}>
            {filteredGroups.map((group) => {
              const report = getActiveReport(group);
              const summaryReport = getSummaryReport(group);
              if (!summaryReport) return null;
              const isPending = !report || report.status === 'pending';
              const isFollowUp = group.timeline_images.length > 1 || group.reports.length > 1;
              const timelineImages = group.timeline_images;
              const progressComparison = getGroupProgressComparison(group, report);

              return (
                <Card key={group.id} style={[styles.reportCard, { backgroundColor: colors.surface }]}>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => toggleExpand(group.id)} style={styles.reportRow}>
                     <View style={[styles.iconBox, isPending ? styles.bgOrange : (isFollowUp ? styles.bgBlue : styles.bgGreen)]}>
                        {isPending ? <Clock size={24} color="#D97706" /> : (isFollowUp ? <RefreshCw size={24} color="#2563EB" /> : <FileText size={24} color="#166534" />)}
                     </View>

                     <View style={{ flex: 1 }}>
                        <View style={styles.rowBetween}>
                          <Text style={[styles.reportTitle, { color: colors.text }]}>{summaryReport.place}</Text>
                          <ChevronRight size={20} color="#9CA3AF" style={selectedGroup === group.id && {transform: [{rotate: '90deg'}]}} />
                        </View>
                        <Text style={[styles.reportDate, { color: colors.mutedText }]}>{isPending ? t('reportsScreen.underReview') : report.doctor_name}</Text>

                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            <View style={[styles.badge, isPending ? styles.badgePending : styles.badgeSuccess]}>
                               <Text style={[styles.badgeText, isPending ? styles.textPending : styles.textSuccess]}>
                                 {isPending ? t('reportsScreen.underReview') : t('reportsScreen.diagnosisReady')}
                               </Text>
                            </View>
                            {isFollowUp && (
                                <View style={[styles.badge, { backgroundColor: '#DBEAFE' }]}>
                                    <Text style={[styles.badgeText, { color: '#1E40AF' }]}>{t('reportsScreen.progressed')}</Text>
                                </View>
                            )}
                        </View>
                     </View>
                  </TouchableOpacity>

                  {selectedGroup === group.id && (
                     <View style={[styles.details, { backgroundColor: colors.surfaceAlt, borderTopColor: colors.border }]}>

                        {timelineImages.length > 0 && (
                           <View style={styles.detailItem}>
                             <Text style={[styles.detailLabel, { color: colors.faintText }]}>{t('reportsScreen.progressTimeline')}</Text>
                             <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 8}}>
                                {timelineImages.map((img, idx) => {
                                  const timelineReport = getTimelineReport(group, img, idx);
                                  const activeTimelineIndex = getActiveTimelineIndex(group);
                                  return (
                                    <TouchableOpacity
                                      key={`${img.image}-${img.date}-${idx}`}
                                      onPress={() => selectTimelineReport(group, idx)}
                                      style={[
                                        styles.timelineItem,
                                        activeTimelineIndex === idx && styles.timelineItemActive,
                                      ]}
                                    >
                                      <Image
                                        source={{uri: getSecureImageUrl(img.image) || undefined}}
                                        style={{width: 80, height: 80, borderRadius: 8, backgroundColor: '#E5E7EB'}}
                                      />
                                      <Text style={{fontSize: 10, color: colors.mutedText, marginTop: 4, fontWeight: 'bold'}}>{img.date}</Text>
                                      {timelineReport?.status === 'reviewed' && (
                                        <View style={styles.timelineCheck}>
                                          <CheckCircle size={14} color="#16a34a" fill="white" />
                                        </View>
                                      )}
                                    </TouchableOpacity>
                                  );
                                })}
                             </ScrollView>
                           </View>
                        )}

                        {progressComparison && (
                          <View style={styles.detailItem}>
                            <Text style={[styles.detailLabel, { color: colors.faintText }]}>PROGRESS TRACKER</Text>
                            <ProgressComparison comparison={progressComparison} showDetails />
                          </View>
                        )}

                        {isPending ? (
                            <View style={styles.pendingBox}>
                                <Clock size={32} color="#D97706" style={{marginBottom: 8}}/>
                                <Text style={styles.pendingTitle}>{t('reportsScreen.analysisInProgress')}</Text>
                                <Text style={styles.pendingText}>{t('reportsScreen.assignedDoctor')}</Text>
                            </View>
                        ) : report ? (
                            <>
                                <View style={[styles.statusBox, styles.statusBoxGreen]}>
                                   <CheckCircle size={16} color="#166534" />
                                   <Text style={[styles.statusText, styles.textSuccess]}>{t('reportsScreen.diagnosedBy')} {report.doctor_name}</Text>
                                </View>

                                <View style={styles.detailItem}>
                                  <Text style={[styles.detailLabel, { color: colors.faintText }]}>{t('reportsScreen.officialDiagnosis')}</Text>
                                  <Text style={[styles.detailText, { color: colors.text }]}>{report.diagnosis}</Text>
                                </View>
                                <View style={styles.detailItem}>
                                  <Text style={[styles.detailLabel, { color: colors.faintText }]}>ANALYSIS</Text>
                                  <View style={[styles.statsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                    <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                                      <Text style={[styles.statLabel, { color: colors.mutedText }]}>Lesion Count</Text>
                                      <Text style={[styles.statValue, { color: colors.text }]}>
                                        {report.metrics?.lesion_count ?? 12}
                                      </Text>
                                    </View>
                                    <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                                      <Text style={[styles.statLabel, { color: colors.mutedText }]}>Affected Area</Text>
                                      <Text style={[styles.statValue, { color: colors.text }]}>
                                        {report.metrics?.extra?.lesion_area_ratio
                                          ? (report.metrics.extra.lesion_area_ratio * 100).toFixed(2)
                                          : '0.45'}%
                                      </Text>
                                    </View>
                                    <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                                      <Text style={[styles.statLabel, { color: colors.mutedText }]}>Inflammation Intensity</Text>
                                      <Text style={[styles.statValue, { color: colors.text }]}>
                                        {report.metrics?.extra?.inflammation_intensity_score
                                          ? (report.metrics.extra.inflammation_intensity_score * 100).toFixed(1)
                                          : '18.2'}%
                                      </Text>
                                    </View>
                                    <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                                      <Text style={[styles.statLabel, { color: colors.mutedText }]}>Est. GAGS Score</Text>
                                      <Text style={[styles.statValue, { color: colors.text }]}>
                                        {report.metrics?.extra?.estimated_gags_score ?? 8}
                                      </Text>
                                    </View>
                                  </View>
                                </View>

                                {report.doctor_comment && (
                                  <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>{t('reportsScreen.doctorNotes')}</Text>
                                    <Text style={[styles.detailText, { fontStyle: 'italic', color: colors.text }]}>{report.doctor_comment}</Text>
                                  </View>
                                )}

                                {report.medications && report.medications.length > 0 && (
                                   <View style={styles.detailItem}>
                                     <Text style={[styles.detailLabel, { color: '#D97706' }]}>{t('reportsScreen.medications')}</Text>
                                     {report.medications.map((med, index) => (
                                        <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                           <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#D97706', marginRight: 8 }} />
                                           <Text style={[styles.detailText, { color: colors.text }]}>{med}</Text>
                                        </View>
                                     ))}
                                   </View>
                                )}

                                {report.visit_required && (
                                  <View style={styles.alertBox}>
                                      <AlertCircle size={20} color="#DC2626" />
                                      <Text style={styles.alertText}>{t('reportsScreen.visitRequired')}</Text>
                                  </View>
                                )}

                                <TouchableOpacity
                                  style={[styles.downloadBtn, { backgroundColor: colors.surface, borderColor: colors.border }, downloadingReportId === report.id && styles.downloadBtnDisabled]}
                                  onPress={() => generateReportPDF(report)}
                                  disabled={downloadingReportId === report.id}
                                >
                                   {downloadingReportId === report.id ? (
                                     <ActivityIndicator size="small" color="#374151" />
                                   ) : (
                                     <Download size={16} color={colors.text} />
                                   )}
                                   <Text style={[styles.downloadText, { color: colors.text }]}>
                                     {downloadingReportId === report.id ? 'Generating...' : t('reportsScreen.downloadPrescription')}
                                   </Text>
                                </TouchableOpacity>
                            </>
                        ) : null}
                     </View>
                  )}
                </Card>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <FileText size={48} color={colors.faintText} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('reportsScreen.noReports')}</Text>
            <Text style={[styles.emptyText, { color: colors.mutedText }]}>{t('reportsScreen.uploadPhoto')}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#2563EB', padding: 24, paddingBottom: 24 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  headerSubtitle: { color: '#DBEAFE', marginTop: 4 },
  filterContainer: { backgroundColor: 'white', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', marginRight: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  filterChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: 'white' },
  content: { flex: 1 },
  list: { padding: 20, gap: 16 },
  card: { backgroundColor: 'white', borderRadius: 12, shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  reportCard: { overflow: 'hidden' },
  reportRow: { padding: 16, flexDirection: 'row', gap: 16 },
  iconBox: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bgGreen: { backgroundColor: '#DCFCE7' },
  bgOrange: { backgroundColor: '#FEF3C7' },
  bgBlue: { backgroundColor: '#EFF6FF' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reportTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  reportDate: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeSuccess: { backgroundColor: '#DCFCE7' },
  badgePending: { backgroundColor: '#F3F4F6' },
  badgeText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  textSuccess: { color: '#166534' },
  textPending: { color: '#374151' },
  details: { backgroundColor: '#F9FAFB', padding: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  pendingBox: { alignItems: 'center', padding: 20, backgroundColor: '#FFFBEB', borderRadius: 12 },
  pendingTitle: { fontSize: 16, fontWeight: 'bold', color: '#92400E', marginBottom: 8 },
  pendingText: { textAlign: 'center', color: '#B45309', fontSize: 14, lineHeight: 20 },
  statusBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 16, gap: 8 },
  statusBoxGreen: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#DCFCE7' },
  statusText: { fontSize: 13, flex: 1 },
  detailItem: { marginBottom: 16 },
  detailLabel: { fontSize: 10, fontWeight: 'bold', color: '#9CA3AF', marginBottom: 4, letterSpacing: 0.5 },
  detailText: { color: '#1F2937', fontSize: 14, lineHeight: 20 },
  timelineItem: { marginRight: 12, alignItems: 'center', padding: 4, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  timelineItemActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  timelineCheck: { position: 'absolute', top: 0, right: 0, backgroundColor: 'white', borderRadius: 8 },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, backgroundColor: 'white' },
  downloadBtnDisabled: { opacity: 0.6 },
  downloadText: { marginLeft: 8, fontWeight: '600', color: '#374151', fontSize: 14 },
  alertBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#FECACA' },
  alertText: { color: '#B91C1C', fontWeight: 'bold', flex: 1 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  emptyText: { color: '#6B7280' },
  statsContainer: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12, marginTop: 8,borderWidth: 1,borderColor: '#E5E7EB',},
  statRow: { flexDirection: 'row',justifyContent: 'space-between',paddingVertical: 4,borderBottomWidth: 1,borderBottomColor: '#F3F4F6',},
  statLabel: { fontSize: 13, color: '#6B7280',},
  statValue: { fontSize: 13, fontWeight: '700', color: '#111827',},
});
