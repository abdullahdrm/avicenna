import { AlertCircle, CheckCircle, ChevronRight, Clock, Download, FileText } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Card = ({ children, style }: any) => (
  <View style={[styles.card, style]}>{children}</View>
);

const Badge = ({ status }: any) => {
  const isCompleted = status === 'completed';
  return (
    <View style={[styles.badge, isCompleted ? styles.badgeSuccess : styles.badgePending]}>
      <Text style={[styles.badgeText, isCompleted ? styles.textSuccess : styles.textPending]}>
        {isCompleted ? 'Completed' : 'Under Review'}
      </Text>
    </View>
  );
};

export default function ReportsScreen() {
  const [filter, setFilter] = useState<'all' | 'completed' | 'under-review'>('all');
  const [selectedReport, setSelectedReport] = useState<number | null>(null);

  const allReports = [
    { id: 1, date: 'Nov 15, 2025', area: 'Forehead', status: 'completed', aiScore: 85, severity: 'low', findings: 'Mild acne, no scarring.' },
    { id: 2, date: 'Nov 10, 2025', area: 'Left Cheek', status: 'under-review', aiScore: 72, severity: 'moderate', findings: 'Pending doctor review.' },
    { id: 3, date: 'Nov 05, 2025', area: 'Right Arm', status: 'completed', aiScore: 92, severity: 'low', findings: 'Healthy skin, minor dryness.' },
    { id: 4, date: 'Oct 28, 2025', area: 'Back', status: 'under-review', aiScore: 60, severity: 'high', findings: 'Requires detailed analysis.' },
  ];

  const filteredReports = allReports.filter((report) => {
    if (filter === 'all') return true;
    return report.status === filter;
  });

  const counts = {
    all: allReports.length,
    completed: allReports.filter(r => r.status === 'completed').length,
    review: allReports.filter(r => r.status === 'under-review').length,
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
            style={[styles.filterChip, filter === 'completed' && styles.filterChipActive]}
            onPress={() => setFilter('completed')}
          >
            <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>Completed ({counts.completed})</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterChip, filter === 'under-review' && styles.filterChipActive]}
            onPress={() => setFilter('under-review')}
          >
            <Text style={[styles.filterText, filter === 'under-review' && styles.filterTextActive]}>Under Review ({counts.review})</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {filteredReports.length > 0 ? (
          <View style={styles.list}>
            {filteredReports.map((report) => (
              <Card key={report.id} style={styles.reportCard}>
                <TouchableOpacity 
                   activeOpacity={0.7}
                   onPress={() => setSelectedReport(selectedReport === report.id ? null : report.id)}
                   style={styles.reportRow}
                >
                   <View style={[styles.iconBox, report.status === 'completed' ? styles.bgGreen : styles.bgOrange]}>
                      {report.status === 'completed' ? <CheckCircle size={20} color="#16a34a" /> : <Clock size={20} color="#d97706" />}
                   </View>
                   <View style={{ flex: 1 }}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.reportTitle}>{report.area}</Text>
                        <ChevronRight size={20} color="#9CA3AF" style={selectedReport === report.id && {transform: [{rotate: '90deg'}]}} />
                      </View>
                      <Text style={styles.reportDate}>{report.date}</Text>
                      <Badge status={report.status} />
                   </View>
                </TouchableOpacity>
      
                {selectedReport === report.id && (
                   <View style={styles.details}>
                      <View style={[styles.statusBox, report.status === 'completed' ? styles.statusBoxGreen : styles.statusBoxOrange]}>
                        <AlertCircle size={16} color={report.status === 'completed' ? '#166534' : '#92400E'} />
                        <Text style={[styles.statusText, report.status === 'completed' ? styles.textSuccess : styles.textOrange]}>
                          {report.status === 'completed' 
                            ? 'Analysis complete. Reviewed by Dr. .' 
                            : 'This report is currently being reviewed by a dermatologist.'}
                        </Text>
                      </View>

                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>FINDINGS</Text>
                        <Text style={styles.detailText}>{report.findings}</Text>
                      </View>

                     {/* <View style={styles.statsRow}>
                         <View style={styles.statBox}>
                            <Text style={styles.detailLabel}>AI SCORE</Text>
                            <Text style={styles.scoreText}>{report.aiScore}%</Text>
                         </View>
                         <View style={styles.statBox}>
                            <Text style={styles.detailLabel}>SEVERITY</Text>
                            <Text style={[styles.severityText, { color: report.severity === 'high' ? '#DC2626' : '#1F2937' }]}>
                              {report.severity}
                            </Text>
                         </View>
                      </View> */}
                      
                      {report.status === 'completed' && (
                        <TouchableOpacity style={styles.downloadBtn}>
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
            <Text style={styles.emptyText}>There are no reports in this category.</Text>
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
  iconBox: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
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
  
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: 'white', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  scoreText: { fontSize: 20, fontWeight: 'bold', color: '#2563EB', marginTop: 4 },
  severityText: { fontSize: 20, fontWeight: 'bold', textTransform: 'capitalize', marginTop: 4 },
  
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, backgroundColor: 'white' },
  downloadText: { marginLeft: 8, fontWeight: '600', color: '#374151', fontSize: 14 },

  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  emptyText: { color: '#6B7280' },
});