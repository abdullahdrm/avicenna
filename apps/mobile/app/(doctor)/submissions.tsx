import { useRouter } from 'expo-router';
import { Calendar, Clock, ChevronRight,CheckCircle, FileText } from 'lucide-react-native';

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Card = ({ children, style }: any) => (
  <View style={[styles.card, style]}>{children}</View>
);

const Badge = ({ status }: { status: 'pending' | 'reviewed' }) => {
  const isReviewed = status === 'reviewed';
  return (
    <View style={[styles.badge, isReviewed ? styles.badgeReviewed : styles.badgePending]}>
      <Text
        style={[
          styles.badgeText,
          isReviewed ? styles.textReviewed : styles.textPending,
        ]}
      >
        {isReviewed ? 'Completed' : 'Under Review'}
      </Text>
    </View>
  );
};

export default function DoctorSubmissions() {
  const router = useRouter();

  const submissions = [
    { id: 1, patient: 'Şevval Özay', date: 'Nov 23, 2025', status: 'pending' as const, disease: null },
    { id: 2, patient: 'Zeynep Sude Doğan', date: 'Nov 23, 2025', status: 'reviewed' as const, disease: 'Eczema' },
    { id: 3, patient: 'Ali Emre Cihangir', date: 'Nov 22, 2025', status: 'pending' as const, disease: null },
    { id: 4, patient: 'Hande Güneş', date: 'Nov 20, 2025', status: 'reviewed' as const, disease: 'Rosacea' },
  ];

  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('all');

  const filtered = submissions.filter((item) => {
    if (filter === 'all') return true;
    return item.status === filter;
  });

  const counts = {
    all: submissions.length,
    pending: submissions.filter((s) => s.status === 'pending').length,
    reviewed: submissions.filter((s) => s.status === 'reviewed').length,
  };

  return (
    <SafeAreaView style={styles.container}>
    
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Patient Submissions</Text>
        <Text style={styles.headerSubtitle}>
          Review and manage incoming cases
        </Text>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20 }}
        >
          <TouchableOpacity
            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
            onPress={() => setFilter('all')}
          >
            <Text
              style={[
                styles.filterText,
                filter === 'all' && styles.filterTextActive,
              ]}
            >
              All ({counts.all})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filter === 'pending' && styles.filterChipActive]}
            onPress={() => setFilter('pending')}
          >
            <Text
              style={[
                styles.filterText,
                filter === 'pending' && styles.filterTextActive,
              ]}
            >
              Pending ({counts.pending})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filter === 'reviewed' && styles.filterChipActive]}
            onPress={() => setFilter('reviewed')}
          >
            <Text
              style={[
                styles.filterText,
                filter === 'reviewed' && styles.filterTextActive,
              ]}
            >
              Reviewed ({counts.reviewed})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {filtered.length > 0 ? (
          <View style={styles.list}>
            {filtered.map((item) => {
              const isReviewed = item.status === 'reviewed';
              return (
                <Card key={item.id} style={styles.submissionCard}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => router.push('/submissiondetail')}
                    style={styles.submissionRow}
                  >
                    <View
                      style={[
                        styles.iconBox,
                        item.status === "reviewed" ? styles.bgGreen : styles.bgOrange,
                      ]}
                    >
                      {item.status === "reviewed" ? (
                        <CheckCircle size={20} color="#16a34a" />
                      ) : (
                        <Clock size={20} color="#d97706" />
                      )}
                    </View>


                    <View style={{ flex: 1 }}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.patientName}>{item.patient}</Text>
                        <ChevronRight size={20} color="#9CA3AF" />
                      </View>

                      <View style={styles.dateRow}>
                        <Calendar size={14} color="#6B7280" />
                        <Text style={styles.dateText}>{item.date}</Text>
                      </View>

                      <View style={styles.metaRow}>
                        {item.disease ? (
                          <Text style={styles.diseaseText}>{item.disease}</Text>
                        ) : (
                          <Text style={styles.noDiseaseText}>No diagnosis yet</Text>
                        )}
                        <Badge status={item.status} />
                      </View>
                    </View>
                  </TouchableOpacity>
                </Card>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <FileText size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No submissions found</Text>
            <Text style={styles.emptyText}>
              There are no submissions in this category.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

//  STYLES
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    backgroundColor: '#2563EB',
    padding: 24,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    color: '#DBEAFE',
    marginTop: 4,
    fontSize: 13,
  },

  filterContainer: {
    backgroundColor: 'white',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTextActive: {
    color: 'white',
  },

  content: { flex: 1 },
  list: { padding: 20, gap: 16 },

  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  submissionCard: {
    overflow: 'hidden',
  },
  submissionRow: {
    padding: 16,
    flexDirection: 'row',
    gap: 16,
  },

  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgGreen: { backgroundColor: '#DCFCE7' },
  bgOrange: { backgroundColor: '#FEF3C7' },

  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  patientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#6B7280',
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
  },
  diseaseText: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '500',
    flex: 1,
  },
  noDiseaseText: {
    fontSize: 13,
    color: '#9CA3AF',
    flex: 1,
  },

  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeReviewed: {
    backgroundColor: '#DCFCE7',
  },
  badgePending: {
    backgroundColor: '#F3F4F6',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  textReviewed: {
    color: '#166534',
  },
  textPending: {
    color: '#374151',
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  emptyText: {
    color: '#6B7280',
  },
});
