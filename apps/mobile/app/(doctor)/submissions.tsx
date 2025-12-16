import { useFocusEffect, useRouter } from 'expo-router';
import {
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  FileText,
  SlidersHorizontal,
} from 'lucide-react-native';

import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useState } from 'react';
import {
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';


const API_URL = 'http://172.20.10.2:8000/api';

type StatusFilter = 'all' | 'pending' | 'reviewed';
type DateFilter = 'all' | 'today' | 'week' | 'month' | 'year';


const isWithinRange = (dateString: string, range: DateFilter) => {
  if (range === 'all') return true;

  const itemDate = new Date(dateString);
  const now = new Date();

  switch (range) {
    case 'today':
      return (
        itemDate.getDate() === now.getDate() &&
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getFullYear() === now.getFullYear()
      );

    case 'week': {
      const d = new Date();
      d.setDate(now.getDate() - 7);
      return itemDate >= d;
    }

    case 'month': {
      const d = new Date();
      d.setMonth(now.getMonth() - 1);
      return itemDate >= d;
    }

    case 'year': {
      const d = new Date();
      d.setFullYear(now.getFullYear() - 1);
      return itemDate >= d;
    }

    default:
      return true;
  }
};


const Card = ({ children }: any) => (
  <View style={styles.card}>{children}</View>
);

const Badge = ({ status }: { status: 'pending' | 'reviewed' }) => {
  const reviewed = status === 'reviewed';
  return (
    <View
      style={[
        styles.badge,
        reviewed ? styles.badgeReviewed : styles.badgePending,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          reviewed ? styles.textReviewed : styles.textPending,
        ]}
      >
        {reviewed ? 'Reviewed' : 'Under Review'}
      </Text>
    </View>
  );
};


export default function DoctorSubmissions() {
  const params = useLocalSearchParams<{
    filter?: StatusFilter;
    date?: DateFilter;
  }>();
  const router = useRouter();

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
      params.filter === 'pending' || params.filter === 'reviewed'
        ? params.filter
        : 'all'
    );

    const [dateFilter, setDateFilter] = useState<DateFilter>(
      params.date === 'today' ||
      params.date === 'week' ||
      params.date === 'month' ||
      params.date === 'year'
        ? params.date
        : 'all'
    );

  const [dateModalOpen, setDateModalOpen] = useState(false);


  const fetchSubmissions = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);

      const token = await SecureStore.getItemAsync('access_token');
      if (!token) return;

      const res = await fetch(`${API_URL}/doctor/submissions/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;

      const data = await res.json();
      const list = Array.isArray(data) ? data : data.results;

      setSubmissions(
        list.map((item: any) => ({
          id: item.id,
          firstName: item.patient.first_name,
          lastName: item.patient.last_name,
          date: item.created_at,
          status: item.status,
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchSubmissions();
    }, [])
  );
  useFocusEffect(
      useCallback(() => {
        if (
          params.filter === 'pending' ||
          params.filter === 'reviewed' ||
          params.filter === 'all'
        ) {
          setStatusFilter(params.filter);
        }

        if (
          params.date === 'today' ||
          params.date === 'week' ||
          params.date === 'month' ||
          params.date === 'year' ||
          params.date === 'all'
        ) {
          setDateFilter(params.date);
        }
      }, [params.filter, params.date])
    );


  const onRefresh = () => {
    setRefreshing(true);
    fetchSubmissions(true);
  };


  const filtered = submissions.filter((s) => {
    const statusOk =
      statusFilter === 'all' || s.status === statusFilter;

    const dateOk = isWithinRange(s.date, dateFilter);

    return statusOk && dateOk;
  });

  const counts = {
    all: submissions.length,
    pending: submissions.filter((s) => s.status === 'pending').length,
    reviewed: submissions.filter((s) => s.status === 'reviewed').length,
  };


  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Patient Submissions</Text>
          <Text style={styles.headerSubtitle}>
            Review and manage incoming cases
          </Text>
        </View>

        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setDateModalOpen(true)}
        >
          <SlidersHorizontal size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* STATUS FILTER (UNCHANGED) */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(['all', 'pending', 'reviewed'] as StatusFilter[]).map((key) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.filterChip,
                statusFilter === key && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(key)}
            >
              <Text
                style={[
                  styles.filterText,
                  statusFilter === key && styles.filterTextActive,
                ]}
              >
                {key.toUpperCase()} ({counts[key]})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* LIST */}
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.emptyState}>
            <Text>Loading submissions...</Text>
          </View>
        ) : filtered.length ? (
          <View style={styles.list}>
            {filtered.map((item) => (
              <Card key={item.id}>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() =>
                    router.push({
                      pathname: '/submissiondetail',
                      params: { id: item.id },
                    })
                  }
                >
                  <View
                    style={[
                      styles.iconBox,
                      item.status === 'reviewed'
                        ? styles.bgGreen
                        : styles.bgOrange,
                    ]}
                  >
                    {item.status === 'reviewed' ? (
                      <CheckCircle size={20} color="#16a34a" />
                    ) : (
                      <Clock size={20} color="#d97706" />
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.name}>
                        {item.firstName} {item.lastName}
                      </Text>
                      <ChevronRight size={20} color="#9CA3AF" />
                    </View>

                    <View style={styles.dateRow}>
                      <Calendar size={14} color="#6B7280" />
                      <Text style={styles.dateText}>
                        {new Date(item.date).toLocaleDateString()}
                      </Text>
                    </View>

                    <View style={styles.metaRow}>
                      <Text style={styles.noDiagnosis}>
                        No diagnosis yet
                      </Text>
                      <Badge status={item.status} />
                    </View>
                  </View>
                </TouchableOpacity>
              </Card>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <FileText size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No submissions found</Text>
          </View>
        )}
      </ScrollView>

      {/* DATE FILTER MODAL */}
      <Modal
        visible={dateModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDateModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Filter by Date</Text>

            {(['all', 'today', 'week', 'month', 'year'] as DateFilter[]).map(
              (k) => (
                <TouchableOpacity
                  key={k}
                  style={[
                    styles.option,
                    dateFilter === k && styles.optionActive,
                  ]}
                  onPress={() => setDateFilter(k)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      dateFilter === k && styles.optionTextActive,
                    ]}
                  >
                    {k === 'all'
                      ? 'All time'
                      : k === 'today'
                      ? 'Today'
                      : k === 'week'
                      ? 'Last week'
                      : k === 'month'
                      ? 'Last month'
                      : 'Last year'}
                  </Text>
                </TouchableOpacity>
              )
            )}

            <TouchableOpacity
              style={styles.applyBtn}
              onPress={() => setDateModalOpen(false)}
            >
              <Text style={styles.applyText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* -------------------- STYLES -------------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    backgroundColor: '#2563EB',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  headerSubtitle: { color: '#DBEAFE', fontSize: 13 },

  filterBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 10,
    borderRadius: 20,
  },

  filterContainer: {
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTextActive: {
    color: 'white',
  },

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 2,
  },

  row: { padding: 16, flexDirection: 'row', gap: 16 },

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
  },

  name: { fontSize: 16, fontWeight: 'bold' },

  dateRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  dateText: { fontSize: 12, color: '#6B7280' },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },

  noDiagnosis: { color: '#9CA3AF', fontSize: 13 },

  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeReviewed: { backgroundColor: '#DCFCE7' },
  badgePending: { backgroundColor: '#F3F4F6' },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  textReviewed: { color: '#166534' },
  textPending: { color: '#374151' },

  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },

  option: { paddingVertical: 12 },
  optionActive: { backgroundColor: '#EFF6FF', borderRadius: 8 },
  optionText: { fontSize: 15 },
  optionTextActive: { color: '#2563EB', fontWeight: 'bold' },

  applyBtn: {
    backgroundColor: '#2563EB',
    padding: 14,
    borderRadius: 10,
    marginTop: 20,
    alignItems: 'center',
  },
  applyText: { color: 'white', fontWeight: 'bold' },
});
