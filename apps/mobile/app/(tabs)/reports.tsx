import { useFocusEffect } from 'expo-router';
import { AlertCircle, CheckCircle, ChevronRight, Clock, Download, FileText } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SkinAnalysis {
  id: number;
  image: string | null;
  body_part: string;
  status: 'analyzed' | 'review';
  prediction: string | null;
  confidence: number;
  formatted_date: string;
}

const Card = ({ children, style }: any) => (
  <View style={[styles.card, style]}>{children}</View>
);

const Badge = ({ status }: { status: string }) => {
  const isAnalyzed = status === 'analyzed';
  return (
    <View style={[styles.badge, isAnalyzed ? styles.badgeSuccess : styles.badgePending]}>
      <Text style={[styles.badgeText, isAnalyzed ? styles.textSuccess : styles.textPending]}>
        {isAnalyzed ? 'Analyzed' : 'Under Review'}
      </Text>
    </View>
  );
};

export default function ReportsScreen() {
  const [reports, setReports] = useState<SkinAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'analyzed' | 'review'>('all');
  const [selectedReport, setSelectedReport] = useState<number | null>(null);


  const BASE_URL = 'http://10.149.24.43:8000';
  const API_URL = `${BASE_URL}/api/skin-analysis/`;

  const fetchReports = async () => {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("Failed to fetch reports");
      const json = await response.json();
      setReports(json);
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

  const getImageUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${BASE_URL}${path}`;
  };

  const filteredReports = reports.filter((report) => {
    if (filter === 'all') return true;
    return report.status === filter;
  });

  const counts = {
    all: reports.length,
    analyzed: reports.filter(r => r.status === 'analyzed').length,
    review: reports.filter(r => r.status === 'review').length,
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Medical Reports</Text>
        <Text style={styles.headerSubtitle}>View and manage your analysis history</Text>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          <TouchableOpacity 
            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All ({counts.all})</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterChip, filter === 'analyzed' && styles.filterChipActive]}
            onPress={() => setFilter('analyzed')}
          >
            <Text style={[styles.filterText, filter === 'analyzed' && styles.filterTextActive]}>Analyzed ({counts.analyzed})</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterChip, filter === 'review' && styles.filterChipActive]}
            onPress={() => setFilter('review')}
          >
            <Text style={[styles.filterText, filter === 'review' && styles.filterTextActive]}>Under Review ({counts.review})</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />
        }
      >
        {loading && !refreshing ? (
          <View style={{ marginTop: 50 }}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : filteredReports.length > 0 ? (
          <View style={styles.list}>
            {filteredReports.map((report) => (
              <Card key={report.id} style={styles.reportCard}>
                
                <TouchableOpacity 
                   activeOpacity={0.7}
                   onPress={() => setSelectedReport(selectedReport === report.id ? null : report.id)}
                   style={styles.reportRow}
                >
                   <View style={[styles.iconBox, report.status === 'analyzed' ? styles.bgGreen : styles.bgOrange]}>
                      {report.image ? (
                        <Image 
                          source = {{ uri: getImageUrl(report.image) }} 
                          style={styles.thumbnail} 
                          resizeMode="cover"
                        />
                      ) : (
                        report.status === 'analyzed' 
                          ? <CheckCircle size={20} color="#16a34a" /> 
                          : <Clock size={20} color="#d97706" />
                      )}
                   </View>

                   <View style={{ flex: 1 }}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.reportTitle}>{report.body_part}</Text>
                        <ChevronRight 
                          size={20} 
                          color="#9CA3AF" 
                          style={selectedReport === report.id && {transform: [{rotate: '90deg'}]}} 
                        />
                      </View>
                      <Text style={styles.reportDate}>{report.formatted_date}</Text>
                      <Badge status={report.status} />
                   </View>
                </TouchableOpacity>
      
                {selectedReport === report.id && (
                   <View style={styles.details}>
                      <View style={[styles.statusBox, report.status === 'analyzed' ? styles.statusBoxGreen : styles.statusBoxOrange]}>
                        <AlertCircle size={16} color={report.status === 'analyzed' ? '#166534' : '#92400E'} />
                        <Text style={[styles.statusText, report.status === 'analyzed' ? styles.textSuccess : styles.textOrange]}>
                          {report.status === 'analyzed' 
                            ? 'Analysis complete. Confidence: ' + (report.confidence * 100).toFixed(0) + '%'
                            : 'This report is currently being reviewed by the system.'}
                        </Text>
                      </View>

                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>FINDINGS</Text>
                        <Text style={styles.detailText}>
                          {report.prediction ? report.prediction : "No specific diagnosis returned yet."}
                        </Text>
                      </View>

                      {report.status === 'analyzed' && (
                        <TouchableOpacity 
                          style={styles.downloadBtn}
                          onPress={() => Alert.alert("Coming Soon", "PDF generation will be added in a future update!")}
                        >
                           <Download size={16} color="#374151" />
                           <Text style={styles.downloadText}>Download Full Report (PDF)</Text>
                        </TouchableOpacity>
                      )}
                   </View>
                )}
              </Card>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <FileText size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No reports found</Text>
            <Text style={styles.emptyText}>Upload a photo to see it here.</Text>
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
  thumbnail: { width: '100%', height: '100%' },
  bgGreen: { backgroundColor: '#DCFCE7' },
  bgOrange: { backgroundColor: '#FEF3C7' },
  
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
  
  statusBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 16, gap: 8 },
  statusBoxGreen: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#DCFCE7' },
  statusBoxOrange: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FEF3C7' },
  statusText: { fontSize: 13, flex: 1 },
  textOrange: { color: '#92400E' },

  detailItem: { marginBottom: 16 },
  detailLabel: { fontSize: 10, fontWeight: 'bold', color: '#9CA3AF', marginBottom: 4, letterSpacing: 0.5 },
  detailText: { color: '#1F2937', fontSize: 14, lineHeight: 20 },
  
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, backgroundColor: 'white' },
  downloadText: { marginLeft: 8, fontWeight: '600', color: '#374151', fontSize: 14 },

  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  emptyText: { color: '#6B7280' },
});