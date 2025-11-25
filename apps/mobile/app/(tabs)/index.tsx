import { useRouter } from 'expo-router';
import { Activity, Bell, Calendar, FileText, MessageSquare, Upload } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Card = ({ children, style }: any) => (
  <View style={[styles.card, style]}>
    {children}
  </View>
);

const Button = ({ onPress, title, icon, variant = 'primary' }: any) => {
  const isPrimary = variant === 'primary';
  return (
    <TouchableOpacity 
      style={[styles.button, isPrimary ? styles.btnPrimary : styles.btnOutline]} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
      <Text style={[styles.btnText, isPrimary ? styles.textWhite : styles.textPrimary]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

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

  const notifications = [
    { id: 1, type: 'report', message: 'Analysis report ready', time: '2h ago', unread: true },
    { id: 2, type: 'doctor', message: 'Dr. replied', time: '1d ago', unread: true },
  ];

  const recentSubmissions = [
    { id: 1, date: 'Nov 15', area: 'Forehead', status: 'Analyzed' },
    { id: 2, date: 'Nov 10', area: 'Left Cheek', status: 'Under Review' },
  ];

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
          <StatCard value="12" label="Uploads" />
          <StatCard value="8" label="Reports" />
          <StatCard value="45" label="Days" />
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
            <Badge text="2 NEW" color="#DBEAFE" textColor="#1E40AF" />
          </View>
          <Card>
            {notifications.map((n, i) => (
              <View key={n.id} style={[styles.notifItem, i !== 0 && styles.borderTop]}>
                <View style={[styles.iconBox, n.type === 'report' ? styles.bgBlue : styles.bgGreen]}>
                  {n.type === 'report' ? 
                    <Activity size={18} color="#2563EB" /> : 
                    <MessageSquare size={18} color="#16A34A" />
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifText}>{n.message}</Text>
                  <Text style={styles.notifTime}>{n.time}</Text>
                </View>
                {n.unread && <View style={styles.unreadDot} />}
              </View>
            ))}
          </Card>
        </View>

        <View style={styles.section}>
           <View style={styles.sectionHeader}>
             <Text style={styles.sectionTitle}>Recent Submissions</Text>
             <TouchableOpacity onPress={() => router.push('/reports')}>
                <Text style={styles.linkText}>View All</Text>
             </TouchableOpacity>
           </View>
           
           {recentSubmissions.map(sub => (
             <Card key={sub.id} style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', padding: 12 }}>
               <View style={styles.imagePlaceholder}>
                  <FileText size={20} color="#9CA3AF"/>
               </View>
               <View style={{ flex: 1, marginLeft: 12 }}>
                 <Text style={styles.itemTitle}>{sub.area}</Text>
                 <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                   <Calendar size={12} color="#6B7280" />
                   <Text style={styles.itemDate}>{sub.date}</Text>
                 </View>
               </View>
               <Badge 
                 text={sub.status} 
                 color={sub.status === 'Analyzed' ? '#DCFCE7' : '#F3F4F6'}
                 textColor={sub.status === 'Analyzed' ? '#166534' : '#374151'}
               />
             </Card>
           ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  btnPrimary: {
    backgroundColor: '#2563EB',
  },
  btnOutline: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  textWhite: {
    color: 'white',
  },
  textPrimary: {
    color: '#2563EB',
  },

  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subGreeting: {
    fontSize: 14,
    color: '#6B7280',
  },
  bellButton: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    position: 'relative',
  },
  redDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    backgroundColor: '#EF4444',
    borderRadius: 4,
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
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  linkText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
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
  bigActionText: {
    color: 'white',
    fontWeight: '600',
    marginTop: 8,
  },
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
  notifItem: {
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  iconBox: {
    padding: 10,
    borderRadius: 10,
  },
  bgBlue: { backgroundColor: '#EFF6FF' },
  bgGreen: { backgroundColor: '#DCFCE7' },
  notifText: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  notifTime: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  imagePlaceholder: {
    width: 48,
    height: 48,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  itemDate: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});