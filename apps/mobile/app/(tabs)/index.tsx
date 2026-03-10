import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Bell, Calendar, CheckCircle, FileText, Upload } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SkinAnalysis {
  id: number;
  image: string | null; 
  body_part: string;
  status: string;
  prediction: string | null;
  confidence: number;
  formatted_date: string;
}

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

export default function HomeScreen() {
  const router = useRouter();

  const [reports, setReports] = useState<SkinAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysJoined, setDaysJoined] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const BASE_URL = 'http://10.109.124.43:8000';
  const API_URL = `${BASE_URL}/api/skin-analysis/`;
  const PROFILE_URL = `${BASE_URL}/api/profile/`;

  const fetchProfile = async () => {
  try {
      const token = await SecureStore.getItemAsync('access_token');
      if (!token) return;

      const response = await fetch(PROFILE_URL, {
          headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
          const data = await response.json();
          if (data.date_joined) {
            const joined = new Date(data.date_joined);
            const now = new Date();
            joined.setHours(0, 0, 0, 0);
            now.setHours(0, 0, 0, 0);
            const diffTime = now.getTime() - joined.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
            setDaysJoined(diffDays); 
          }
      }
  } catch (error) {
      console.error("Failed to fetch profile:", error);
  }
};

  const fetchReports = async () => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('access_token');
      const response = await fetch(API_URL, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (!response.ok) {
        setLoading(false);
        return;
      }
      
      const json = await response.json();
      let data = [];
      if (Array.isArray(json)) {
        data = json;
      } else if (json.results) {
        data = json.results;
      }
      setReports(data);

    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setLoading(false);
    }
  };
  const fetchSavedNotifications = async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (!token) return;

      const response = await fetch(`${BASE_URL}/api/notifications/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        let notifsArray = [];
        if (Array.isArray(data)) {
          notifsArray = data;
        } else if (data && data.results) {
          notifsArray = data.results;
        }
        const formattedNotifs = notifsArray.map((n: any) => ({
          id: n.id,
          text: n.message,
          time: 'Recently' 
        }));
        
        setNotifications(formattedNotifs);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  useEffect(() => {
    fetchReports();
    fetchProfile(); 
    fetchSavedNotifications();
  }, []);

  const getUserIdFromToken = async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (token) {
        const payloadBase64 = token.split('.')[1];
        const decodedPayload = JSON.parse(atob(payloadBase64));
        setUserId(decodedPayload.user_id);
      }
    } catch (error) {
      console.error("Error decoding token:", error);
    }
  };

  useEffect(() => {
    getUserIdFromToken();
  }, []);
  useEffect(() => {
    if (!userId) return;
    const wsUrl = `ws://10.109.124.43:8000/ws/notifications/${userId}/`;
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      console.log('Live WebSocket Connected!');
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('NEW LIVE MESSAGE:', data.message);
      setNotifications(prev => [
        { id: Date.now(), text: data.message, time: 'Just now' },
        ...prev
      ]);
    };

    return () => {
      ws.close();
    };
  }, [userId]);
  const getImageUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path; 
    return `${BASE_URL}${path}`;
  };


  const analyzedCount = reports.filter(r => {
    const s = r.status?.toLowerCase() || '';
    return s === 'analyzed' || s === 'review' || s === 'reviewed';
  }).length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 20 }}>
        
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back</Text>
            <Text style={styles.subGreeting}>Track your skin health</Text>
          </View>
          <TouchableOpacity style={styles.bellButton}>
            <Bell size={24} color="#374151" />
            <View style={styles.redDot} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <StatCard value={reports.length.toString()} label="Uploads" />
          <StatCard value={analyzedCount.toString()} label="Analyzed" />
          <StatCard value={daysJoined.toString()} label="Days Active" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.bigActionBtn, { backgroundColor: '#2563EB' }]}
              onPress={() => router.push('/upload')}
            >
              <Upload color="white" size={28} />
              <Text style={styles.bigActionText}>Upload Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.bigActionBtn, { backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB' }]}
              onPress={() => router.push('/reports')}
            >
              <FileText color="#374151" size={28} />
              <Text style={[styles.bigActionText, { color: '#374151' }]}>View Reports</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Updates</Text>
            {notifications.length > 0 && (
               <Badge text={`${notifications.length} NEW`} color="#DBEAFE" textColor="#1E40AF" />
            )}
          </View>
          
          <Card>
            {notifications.length === 0 ? (
              <View style={styles.emptyUpdates}>
                <CheckCircle size={24} color="#9CA3AF" style={{ marginBottom: 3 }} />
                <Text style={styles.emptyText}>You're all caught up!</Text>
              </View>
            ) : (
              notifications.map((n, i) => (
                <View key={n.id} style={[styles.notifItem, i !== 0 && styles.borderTop]}>
                  <View style={styles.unreadDot} />
                  <View>
                    <Text style={styles.notifText}>{n.text}</Text>
                    <Text style={styles.notifTime}>{n.time}</Text>
                  </View>
                </View>
              ))
            )}
          </Card>
        </View>

        <View style={styles.section}>
           <View style={styles.sectionHeader}>
             <Text style={styles.sectionTitle}>Recent History</Text>
             <TouchableOpacity onPress={fetchReports}>
                <Text style={styles.linkText}>Refresh</Text>
             </TouchableOpacity>
           </View>
           
           {loading ? (
             <ActivityIndicator size="large" color="#2563EB" />
           ) : (
             reports.length === 0 ? (
               <View style={{ padding: 20, alignItems: 'center' }}>
                 <Text style={{color: '#6B7280', textAlign: 'center'}}>
                    No reports found.{'\n'}
                    Upload a photo to get started!
                 </Text>
               </View>
             ) : (
               reports.slice(0, 10).map(report => (
                 <Card key={report.id} style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                   
                   <View style={styles.imagePlaceholder}>
                      {report.image ? (
                        <Image 
                          source={{ uri: getImageUrl(report.image) }} 
                          style={{ width: 48, height: 48, borderRadius: 8 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <FileText size={20} color="#9CA3AF"/>
                      )}
                   </View>

                   <View style={{ flex: 1, marginLeft: 12 }}>
                     <Text style={styles.itemTitle}>
                        {report.body_part} <Text style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 'normal' }}>#{report.id}</Text>
                     </Text>
                     
                     <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                       <Calendar size={12} color="#6B7280" />
                       <Text style={styles.itemDate}>{report.formatted_date}</Text>
                     </View>
                   </View>

                   <Badge 
                     text={report.status} 
                     color={report.status?.toLowerCase() === 'analyzed' ? '#DCFCE7' : '#F3F4F6'}
                     textColor={report.status?.toLowerCase() === 'analyzed' ? '#166534' : '#374151'}
                   />
                 </Card>
               ))
             )
           )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollView: { flex: 1 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 },
  btnPrimary: { backgroundColor: '#2563EB' },
  btnOutline: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB' },
  btnText: { fontSize: 14, fontWeight: '600' },
  textWhite: { color: 'white' },
  textPrimary: { color: '#2563EB' },
  header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  subGreeting: { fontSize: 14, color: '#6B7280' },
  bellButton: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 20, position: 'relative' },
  redDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, backgroundColor: '#EF4444', borderRadius: 4 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 24, marginTop: 10, gap: 12 },
  statCard: { flex: 1, backgroundColor: 'white', padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  linkText: { color: '#2563EB', fontSize: 14, fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 12 },
  bigActionBtn: { flex: 1, height: 100, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 4 },
  bigActionText: { color: 'white', fontWeight: '600', marginTop: 8 },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  notifItem: { padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' },
  borderTop: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  iconBox: { padding: 10, borderRadius: 10 },
  bgBlue: { backgroundColor: '#EFF6FF' },
  bgGreen: { backgroundColor: '#DCFCE7' },
  notifText: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
  notifTime: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB' },
  imagePlaceholder: { width: 48, height: 48, backgroundColor: '#F3F4F6', borderRadius: 8, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  itemTitle: { fontSize: 16, fontWeight: '500', color: '#111827' },
  itemDate: { fontSize: 12, color: '#6B7280', marginLeft: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  emptyUpdates: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#9CA3AF', fontSize: 14 },
});