import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import {
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Clock,
  Download,
  FileText,
  RefreshCw
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
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
import { useLanguage } from '../../lib/LanguageContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BASE_URL = 'http://10.239.178.43:8000';
const API_URL = `${BASE_URL}/api/patient/reports/`;

interface MedicalReport {
  id: number;
  status: 'pending' | 'reviewed';
  place: string;
  doctor_name: string;
  diagnosis: string | null;
  doctor_comment: string;
  medications: string[];
  visit_required: boolean;
  date: string;
  timeline_images: { image: string, date: string }[];
}

const Card = ({ children, style }: any) => (
  <View style={[styles.card, style]}>{children}</View>
);

export default function ReportsScreen() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'reviewed' | 'pending' | 'followups'>('all');
  const [selectedReport, setSelectedReport] = useState<number | null>(null);
  const [reports, setReports] = useState<MedicalReport[]>([]);

  const fetchReports = async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      const response = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
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

  const toggleExpand = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedReport(selectedReport === id ? null : id);
  };

  const filteredReports = reports.filter((report) => {
    if (filter === 'all') return true;
    if (filter === 'reviewed') return report.status === 'reviewed';
    if (filter === 'pending') return report.status === 'pending';
    if (filter === 'followups') return report.timeline_images && report.timeline_images.length > 1;
    return true;
  });

  const counts = {
    all: reports.length,
    reviewed: reports.filter(r => r.status === 'reviewed').length,
    pending: reports.filter(r => r.status === 'pending').length,
    followups: reports.filter(r => r.timeline_images && r.timeline_images.length > 1).length,
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('reportsScreen.title')}</Text>
        <Text style={styles.headerSubtitle}>{t('reportsScreen.subtitle')}</Text>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          <TouchableOpacity 
            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>{t('reportsScreen.all')} ({counts.all})</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterChip, filter === 'reviewed' && styles.filterChipActive]}
            onPress={() => setFilter('reviewed')}
          >
            <Text style={[styles.filterText, filter === 'reviewed' && styles.filterTextActive]}>{t('reportsScreen.completed')} ({counts.reviewed})</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterChip, filter === 'pending' && styles.filterChipActive]}
            onPress={() => setFilter('pending')}
          >
            <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>{t('reportsScreen.pending')} ({counts.pending})</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterChip, filter === 'followups' && styles.filterChipActive]}
            onPress={() => setFilter('followups')}
          >
            <Text style={[styles.filterText, filter === 'followups' && styles.filterTextActive]}>{t('reportsScreen.followUps')} ({counts.followups})</Text>
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
        ) : filteredReports.length > 0 ? (
          <View style={styles.list}>
            {filteredReports.map((report) => {
              const isPending = report.status === 'pending';
              const isFollowUp = report.timeline_images && report.timeline_images.length > 1;

              return (
                <Card key={report.id} style={styles.reportCard}>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => toggleExpand(report.id)} style={styles.reportRow}>
                     <View style={[styles.iconBox, isPending ? styles.bgOrange : (isFollowUp ? styles.bgBlue : styles.bgGreen)]}>
                        {isPending ? <Clock size={24} color="#D97706" /> : (isFollowUp ? <RefreshCw size={24} color="#2563EB" /> : <FileText size={24} color="#166534" />)}
                     </View>

                     <View style={{ flex: 1 }}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.reportTitle}>{report.place}</Text>
                          <ChevronRight size={20} color="#9CA3AF" style={selectedReport === report.id && {transform: [{rotate: '90deg'}]}} />
                        </View>
                        <Text style={styles.reportDate}>{isPending ? t('reportsScreen.underReview') : report.doctor_name}</Text>
                        
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

                  {selectedReport === report.id && (
                     <View style={styles.details}>
                        
                        {report.timeline_images && report.timeline_images.length > 0 && (
                           <View style={styles.detailItem}>
                             <Text style={styles.detailLabel}>{t('reportsScreen.progressTimeline')}</Text>
                             <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 8}}>
                                {report.timeline_images.map((img, idx) => (
                                   <View key={idx} style={{marginRight: 12, alignItems: 'center'}}>
                                      <Image 
                                        source={{uri: img.image}} 
                                        style={{width: 80, height: 80, borderRadius: 8, backgroundColor: '#E5E7EB'}} 
                                      />
                                      <Text style={{fontSize: 10, color: '#6B7280', marginTop: 4, fontWeight: 'bold'}}>{img.date}</Text>
                                   </View>
                                ))}
                             </ScrollView>
                           </View>
                        )}

                        {isPending ? (
                            <View style={styles.pendingBox}>
                                <Clock size={32} color="#D97706" style={{marginBottom: 8}}/>
                                <Text style={styles.pendingTitle}>{t('reportsScreen.analysisInProgress')}</Text>
                                <Text style={styles.pendingText}>{t('reportsScreen.assignedDoctor')}</Text>
                            </View>
                        ) : (
                            <>
                                <View style={[styles.statusBox, styles.statusBoxGreen]}>
                                   <CheckCircle size={16} color="#166534" />
                                   <Text style={[styles.statusText, styles.textSuccess]}>{t('reportsScreen.diagnosedBy')} {report.doctor_name}</Text>
                                </View>

                                <View style={styles.detailItem}>
                                  <Text style={styles.detailLabel}>{t('reportsScreen.officialDiagnosis')}</Text>
                                  <Text style={styles.detailText}>{report.diagnosis}</Text>
                                </View>

                                {report.doctor_comment && (
                                  <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>{t('reportsScreen.doctorNotes')}</Text>
                                    <Text style={[styles.detailText, { fontStyle: 'italic' }]}>"{report.doctor_comment}"</Text>
                                  </View>
                                )}

                                {report.medications && report.medications.length > 0 && (
                                   <View style={styles.detailItem}>
                                     <Text style={[styles.detailLabel, { color: '#D97706' }]}>{t('reportsScreen.medications')}</Text>
                                     {report.medications.map((med, index) => (
                                        <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                           <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#D97706', marginRight: 8 }} />
                                           <Text style={styles.detailText}>{med}</Text>
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

                                <TouchableOpacity style={styles.downloadBtn} onPress={() => Alert.alert(t('reportsScreen.comingSoon'), t('reportsScreen.pdfDownload'))}>
                                   <Download size={16} color="#374151" />
                                   <Text style={styles.downloadText}>{t('reportsScreen.downloadPrescription')}</Text>
                                </TouchableOpacity>
                            </>
                        )}
                     </View>
                  )}
                </Card>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <FileText size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>{t('reportsScreen.noReports')}</Text>
            <Text style={styles.emptyText}>{t('reportsScreen.uploadPhoto')}</Text>
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
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, backgroundColor: 'white' },
  downloadText: { marginLeft: 8, fontWeight: '600', color: '#374151', fontSize: 14 },
  alertBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#FECACA' },
  alertText: { color: '#B91C1C', fontWeight: 'bold', flex: 1 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  emptyText: { color: '#6B7280' },
});
