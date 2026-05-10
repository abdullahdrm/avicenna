import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Calendar, CheckCircle, FileText, Upload } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../../lib/LanguageContext';
import { usePatientTheme } from '../../lib/PatientThemeContext';

const formatTimeAgo = (dateString: string) => {
  if (!dateString) return 'Recently';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

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

const StatCard = ({ value, label, colors }: any) => (
  <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
    <Text style={[styles.statLabel, { color: colors.mutedText }]}>{label}</Text>
  </View>
);
const ProgressTracker = ({ status, t, colors }: { status: string; t: any; colors: any }) => {
  const currentStatus = status?.toLowerCase() || 'pending';

  const stages = [
    { id: 'uploaded', label: t('homeScreen.uploaded') },
    { id: 'analyzing', label: t('homeScreen.analyzing') },
    { id: 'reviewed', label: t('homeScreen.reviewed') }
  ];

  const getStageIndex = () => {
    if (currentStatus === 'reviewed' || currentStatus === 'completed') return 2;
    if (currentStatus === 'analyzed' || currentStatus === 'analyzing' || currentStatus === 'review') return 1;
    return 0;
  };

  const currentIndex = getStageIndex();

  return (
    <View style={styles.trackerContainer}>
      {stages.map((stage, index) => {
        const isCompleted = index <= currentIndex;
        const isLast = index === stages.length - 1;

        return (
          <View key={stage.id} style={styles.stageWrapper}>
            <View style={styles.stageBlock}>
              <View style={[
                styles.circle,
                isCompleted ? styles.circleActive : styles.circleInactive
              ]}>
                {isCompleted && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={[
                styles.stageText,
                isCompleted ? styles.textActive : styles.textInactive,
                { color: isCompleted ? colors.text : colors.faintText }
              ]}>
                {stage.label}
              </Text>
            </View>
            {!isLast && (
              <View style={[
                styles.line,
                index < currentIndex ? styles.lineActive : styles.lineInactive
              ]} />
            )}
          </View>
        );
      })}
    </View>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = usePatientTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  const [reports, setReports] = useState<SkinAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysJoined, setDaysJoined] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsSectionY, setNotificationsSectionY] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const BASE_URL = 'http://10.136.227.43:8000';
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
          time: formatTimeAgo(n.created_at),
          isRead: n.is_read,
          submissionId: n.submission
        }));

        setNotifications(formattedNotifs);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  const getUserIdFromToken = async (token: string) => {
    try {
      if (token) {
        const payloadBase64 = token.split('.')[1];
        const decodedPayload = JSON.parse(atob(payloadBase64));
        return decodedPayload.user_id;
      }
    } catch (error) {
      console.error("Error decoding token:", error);
    }
    return null;
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const token = await SecureStore.getItemAsync('access_token');

        if (!token) return;

        setAuthToken(token);

        const userIdFromToken = await getUserIdFromToken(token);
        if (userIdFromToken) {
          setUserId(userIdFromToken);
        }

        await Promise.all([
          fetchReports(),
          fetchProfile(),
          fetchSavedNotifications()
        ]);
      } catch (error) {
        console.error("Error initializing app:", error);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const wsUrl = `ws://10.136.227.43:8000/ws/notifications/${userId}/`;
    const ws = new WebSocket(wsUrl);
    let wsConnected = false;

    ws.onopen = () => {
      console.log('Live WebSocket Connected!');
      wsConnected = true;
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('NEW LIVE MESSAGE:', data.message);
      setNotifications(prev => [
        { id: Date.now(), text: data.message, time: 'Just now', isRead: false, submissionId: data.submission },
        ...prev
      ]);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected, falling back to polling');
      wsConnected = false;
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      wsConnected = false;
    };

    const pollInterval = setInterval(async () => {
      if (!wsConnected) {
        console.log('Polling for new notifications...');
        fetchSavedNotifications();
      }
    }, 10000);

    return () => {
      clearInterval(pollInterval);
      ws.close();
    };
  }, [userId]);
  const getImageUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${BASE_URL}${path}`;
  };
  const handleReadNotification = async (notifId: number, submissionId: number) => {
    setNotifications(prev =>
      prev.map(n => n.id === notifId ? { ...n, isRead: true } : n)
    );

    if (submissionId) {
      router.push(`/report/view/${submissionId}`);
    }

    try {
      const token = await SecureStore.getItemAsync('access_token');
      await fetch(`${BASE_URL}/api/notifications/${notifId}/read/`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error("Failed to mark read on backend:", error);
    }
  };


  const analyzedCount = reports.filter(r => {
    const s = r.status?.toLowerCase() || '';
    return s === 'analyzed' || s === 'review' || s === 'reviewed';
  }).length;
  const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;

  const scrollToNotifications = () => {
    scrollViewRef.current?.scrollTo({
      y: Math.max(notificationsSectionY - 12, 0),
      animated: true,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView ref={scrollViewRef} style={styles.scrollView} contentContainerStyle={{ paddingBottom: 20 }}>

        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View>
            <Text style={[styles.greeting, { color: colors.text }]}>{t('homeScreen.welcomeBack')}</Text>
            <Text style={[styles.subGreeting, { color: colors.mutedText }]}>{t('homeScreen.trackSkinHealth')}</Text>
          </View>
        
        </View>

        <View style={styles.statsRow}>
          <StatCard value={reports.length.toString()} label={t('homeScreen.uploads')} colors={colors} />
          <StatCard value={analyzedCount.toString()} label={t('homeScreen.analyzed')} colors={colors} />
          <StatCard value={daysJoined.toString()} label={t('homeScreen.daysActive')} colors={colors} />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('homeScreen.quickActions')}</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.bigActionBtn, { backgroundColor: '#2563EB' }]}
              onPress={() => router.push('/upload')}
            >
              <Upload color="white" size={28} />
              <Text style={styles.bigActionText}>{t('homeScreen.uploadPhoto')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bigActionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => router.push('/reports')}
            >
              <FileText color={colors.text} size={28} />
              <Text style={[styles.bigActionText, { color: colors.text }]}>{t('homeScreen.viewReports')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={styles.section}
          onLayout={(event) => setNotificationsSectionY(event.nativeEvent.layout.y)}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('homeScreen.notifications')}</Text>
            {unreadNotificationsCount > 0 && (
               <Badge text={`${unreadNotificationsCount} ${t('homeScreen.new')}`} color="#DBEAFE" textColor="#1E40AF" />
            )}
          </View>

          <Card style={{ backgroundColor: colors.surface }}>
            {notifications.length === 0 ? (
              <View style={styles.emptyUpdates}>
                <CheckCircle size={24} color={colors.faintText} style={{ marginBottom: 3 }} />
                <Text style={[styles.emptyText, { color: colors.faintText }]}>{t('homeScreen.youAreCaughtUp')}</Text>
              </View>
            ) : (
              notifications.slice(0, 3).map((n, i) => (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.notifItem, i !== 0 && styles.borderTop, { borderTopColor: colors.border }]}
                  onPress={() => handleReadNotification(n.id, n.submissionId)}
                  activeOpacity={0.7}
                >
                  {!n.isRead && <View style={styles.unreadDot} />}

                  <View style={{ marginLeft: n.isRead ? 20 : 0 }}>
                    <Text style={[styles.notifText, { color: colors.text }]}>{n.text}</Text>
                    <Text style={[styles.notifTime, { color: colors.faintText }]}>{n.time}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </Card>
        </View>

        <View style={styles.section}>
           <View style={styles.sectionHeader}>
             <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('homeScreen.recentHistory')}</Text>
             <TouchableOpacity onPress={fetchReports}>
                <Text style={styles.linkText}>{t('homeScreen.refresh')}</Text>
             </TouchableOpacity>
           </View>

           {loading ? (
             <ActivityIndicator size="large" color="#2563EB" />
           ) : (
             reports.length === 0 ? (
               <View style={{ padding: 20, alignItems: 'center' }}>
                 <Text style={{color: colors.mutedText, textAlign: 'center'}}>
                    {t('homeScreen.noReportsFound')}{'\n'}
                    {t('homeScreen.getStarted')}
                 </Text>
               </View>
             ) : (
               reports.slice(0, 3).map(report => (
                 <Card key={report.id} style={{ marginBottom: 10, padding: 12, backgroundColor: colors.surface }}>
                   <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                     <View style={[styles.imagePlaceholder, { backgroundColor: colors.surfaceAlt }]}>
                        {report.image && authToken ? (
                          <Image
                            source={{
                              uri: `${getImageUrl(report.image)}?token=${authToken}`
                            }}
                            style={{ width: 48, height: 48, borderRadius: 8 }}
                            resizeMode="cover"
                          />
                        ) : (
                          <FileText size={20} color={colors.faintText}/>
                        )}
                     </View>

                     <View style={{ flex: 1, marginLeft: 12 }}>
                       <Text style={[styles.itemTitle, { color: colors.text }]}>
                          {report.body_part} <Text style={{ fontSize: 12, color: colors.faintText, fontWeight: 'normal' }}>#{report.id}</Text>
                       </Text>

                       <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                         <Calendar size={12} color={colors.mutedText} />
                         <Text style={[styles.itemDate, { color: colors.mutedText }]}>{report.formatted_date}</Text>
                       </View>
                     </View>
                   </View>

                   <View style={{ marginTop: 10 }}>
                     <ProgressTracker status={report.status} t={t} colors={colors} />
                   </View>

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
  trackerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15, marginBottom: 5, paddingHorizontal: 5 },
  stageWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stageBlock: { alignItems: 'center', width: 70 },
  circle: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 6, zIndex: 2 },
  circleActive: { backgroundColor: '#2563EB' },
  circleInactive: { backgroundColor: '#E5E7EB' },
  checkMark: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  stageText: { fontSize: 11, textAlign: 'center' },
  textActive: { color: '#1F2937', fontWeight: '600' },
  textInactive: { color: '#9CA3AF' },
  line: { flex: 1, height: 2, position: 'relative', top: -10, marginHorizontal: -20, zIndex: 1 },
  lineActive: { backgroundColor: '#2563EB' },
  lineInactive: { backgroundColor: '#E5E7EB' },
});
