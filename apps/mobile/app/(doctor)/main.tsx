import { useFocusEffect, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Bell, ClipboardList, FileText, Stethoscope } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = 'http://10.239.178.43:8000/api';

const Card = ({ children, style }: any) => (
  <View style={[styles.card, style]}>
    {children}
  </View>
);

const Badge = ({ text, color = '#EFF6FF', textColor = '#2563EB' }: any) => (
  <View style={[styles.badge, { backgroundColor: color }]}>
    <Text style={[styles.badgeText, { color: textColor }]}>{text}</Text>
  </View>
);

const StatCard = ({ value, label }: any) => (
  <View style={styles.statCard}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);


export default function DoctorHomeScreen() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async (isRefresh = false) => {
        try {
           if (!isRefresh) setLoading(true);
  
           const token = await SecureStore.getItemAsync('access_token');
           if (!token) return;
  
           const response = await fetch(`${API_URL}/doctor/dashboard/`, {
              headers: { Authorization: `Bearer ${token}` },
           });
  
           if (!response.ok) return;
  
           const data = await response.json();
           const list = Array.isArray(data) ? data : data.results;
  
           setDashboard(data); 
           } catch (error) {
              console.error('Failed to load dashboard', error);
           } finally {
              setLoading(false);
              setRefreshing(false);
           }
        };
        useFocusEffect(
              useCallback(() => {
                fetchDashboard();
              }, [])
            );
        const onRefresh = () => {
        setRefreshing(true);
        fetchDashboard(true);
      };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 20 }}>

        {loading ? (
          <View style={styles.emptyState}>
                               <Text>Loading profile...</Text>
                             </View>
                           ):( <>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello Dr. {dashboard?.doctor?.first_name} {dashboard?.doctor?.last_name}</Text>
            <Text style={styles.subGreeting}>Review and manage patients</Text>
          </View>
          <TouchableOpacity style={styles.bellButton}>
            <Bell size={24} color="#374151" />
            <View style={styles.redDot} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            value={dashboard?.stats.pending_submissions ?? '-'}
            label="Pending Submissions"
          />
          <StatCard
            value={dashboard?.stats?.completed_submissions ?? '-'}
            label="Completed Reviews"
          />
          <StatCard
            value={dashboard?.stats?.patients_count ?? '-'}
            label="Patients"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.bigActionBtn, { backgroundColor: '#2563EB' }]}
              onPress={() => router.push({
                pathname: '/(doctor)/submissions',
                params: { date: 'today' , filter: 'all'},})}
            >
              <ClipboardList color="white" size={28} />
              <Text style={styles.bigActionText}>Today's Submissions</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.bigActionBtn, { backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB' }]}
              onPress={() => router.push({pathname: '/(doctor)/submissions', params: { filter: 'pending', date:'all'},})}
            >
              <FileText color="#374151" size={28} />
              <Text style={[styles.bigActionText, { color: '#374151' }]}>Pending Submissions</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Latest Submission</Text>

            <TouchableOpacity onPress={() => router.push({
                pathname: '/(doctor)/submissions',
                params: { date: 'all' , filter: 'all'},})}>
              <Text style={styles.linkText}>View All</Text>
            </TouchableOpacity>
          </View>

          {dashboard?.recent_cases?.length === 0 && (
            <Text style={{ color: '#6B7280' }}>No recent submissions</Text>
          )}

          {dashboard?.recent_cases?.map((c: any) => (
            <TouchableOpacity
              key={c.id}
              activeOpacity={0.7}
              onPress={() => router.push({pathname: '/submissiondetail',
                      params: { id: c.id },})}
            >
              <Card
                style={{
                  marginBottom: 10,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View style={styles.iconBoxLarge}>
                  <Stethoscope size={20} color="#2563EB" />
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.itemTitle}>{c.patient_name}</Text>
                </View>

                <Badge
                  text={c.status === 'pending' ? 'Pending Review' : 'Completed'}
                  color={c.status === 'pending' ? '#FEF3C7' : '#DCFCE7'}
                  textColor={c.status === 'pending' ? '#B45309' : '#166534'}
                />
              </Card>
            </TouchableOpacity>
          ))}
        </View>

      </>
      )}
          
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollView: { flex: 1 },

  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  subGreeting: { fontSize: 14, color: '#6B7280' },

  bellButton: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    position: 'relative',
  },
  redDot: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, backgroundColor: '#EF4444', borderRadius: 4,
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 24,
    marginTop: 10,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },

  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  linkText: { color: '#2563EB', fontSize: 14, fontWeight: '500' },

  actionRow: { flexDirection: 'row', gap: 12 },
  bigActionBtn: {
    flex: 1,
    height: 100,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  bigActionText: { color: 'white', fontWeight: '600', marginTop: 8 },

  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  iconBox: {
    padding: 10,
    borderRadius: 10,
  },
  iconBoxLarge: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    gap: 12,
  },
  submissionRow: {
    padding: 16,
    flexDirection: 'row',
    gap: 16,
  },

  notifItem: { padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' },
  borderTop: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  notifText: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
  notifTime: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB' },

  itemTitle: { fontSize: 16, fontWeight: '500', color: '#111827' },

  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
});
