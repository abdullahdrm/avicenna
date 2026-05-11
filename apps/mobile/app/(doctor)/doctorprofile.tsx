import { useFocusEffect, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { LogOut } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = 'http://172.20.10.2:8000/api';


const Card = ({ children, style }: any) => (
  <View style={[styles.card, style]}>{children}</View>
);


export default function DoctorProfileScreen() {
  const router = useRouter();

  const [doctorInfo, setDoctorInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);


  const formatDays = (days?: string[]) => {
    if (!days || days.length === 0) return '-';

    const map: Record<string, string> = {
      mon: 'Mon',
      tue: 'Tue',
      wed: 'Wed',
      thu: 'Thu',
      fri: 'Fri',
      sat: 'Sat',
      sun: 'Sun',
    };

    return days.map(d => map[d] ?? d).join(' – ');
  };


  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync('access_token');
          await SecureStore.deleteItemAsync('refresh_token');
          router.replace('/login');
        },
      },
    ]);
  };


  const fetchProfile = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);

      const token = await SecureStore.getItemAsync('access_token');
      if (!token) return;

      const res = await fetch(`${API_URL}/doctor/profile/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status !== 200) {
        console.error(`API returned status ${res.status}`);
        return;
      }

      const data = await res.json();
      setDoctorInfo(data);
    } catch (e) {
      console.error('Profile fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile(true);
  };


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {loading ? (
          <View style={styles.emptyState}>
            <Text>Loading profile...</Text>
          </View>
        ) : (
          <>
            <View style={styles.headerProfile}>
              <View style={styles.profileRow}>
                <View style={styles.avatarContainer}>
                  <Image style={styles.avatar} />
                </View>
                <View>
                  <Text style={styles.name}>
                    {doctorInfo?.user?.first_name} {doctorInfo?.user?.last_name}
                  </Text>
                  <Text style={styles.email}>{doctorInfo?.user?.email}</Text>
                </View>
              </View>

              <View style={styles.statsContainer}>
                <Stat value={doctorInfo?.stats?.patients_count ?? 0} label="PATIENTS" />
                <View style={styles.divider} />
                <Stat value={doctorInfo?.stats?.submissions_reviewed ?? 0} label="REVIEWED" />
                <View style={styles.divider} />
                <Stat value={doctorInfo?.stats?.active_days ?? 0} label="DAYS" />
              </View>
            </View>

            <View style={styles.body}>
              <Card style={styles.infoCard}>
                <Text style={styles.sectionTitle}>Professional Details</Text>
                <InfoRow label="Experience" value={`${doctorInfo?.experience_years} years`} />
                <InfoRow label="City" value={doctorInfo?.city} />
                <InfoRow label="Hospital" value={doctorInfo?.hospital} last />
              </Card>

              <Card style={styles.infoCard}>
                <View style={styles.prefHeader}>
                  <Text style={styles.sectionTitle}>Preferences</Text>
                  <TouchableOpacity onPress={() => setEditOpen(true)}>
                    <Text style={styles.editText}>Edit</Text>
                  </TouchableOpacity>
                </View>

                <InfoRow
                  label="Allowed Days"
                  value={formatDays(doctorInfo?.allowed_days)}
                />
                <InfoRow
                  label="Max / Day"
                  value={doctorInfo?.max_submissions_per_day}
                  last
                />
              </Card>

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <LogOut size={18} color="#DC2626" />
                <Text style={styles.logoutText}>Sign Out</Text>
              </TouchableOpacity>

              <Text style={styles.version}>Version 1.0.0</Text>
            </View>
          </>
        )}

        <EditProfileModal
          visible={editOpen}
          onClose={() => setEditOpen(false)}
          allowed_days={doctorInfo?.allowed_days}
          max_submissions_per_day={doctorInfo?.max_submissions_per_day}
          onSaved={fetchProfile}
        />
      </ScrollView>
    </SafeAreaView>
  );
}



const Stat = ({ value, label }: any) => (
  <View style={{ alignItems: 'center' }}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const InfoRow = ({ label, value, last }: any) => (
  <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value ?? '-'}</Text>
  </View>
);



const EditProfileModal = ({
  visible,
  onClose,
  allowed_days,
  max_submissions_per_day,
  onSaved,
}: any) => {
  const [newAllowedDays, setNewAllowedDays] = useState('');
  const [newMaxSubmission, setNewMaxSubmission] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNewAllowedDays(allowed_days ?? '');
    setNewMaxSubmission(max_submissions_per_day ?? '');
  }, [allowed_days, max_submissions_per_day]);

 const saveChanges = async () => {
    if (!newAllowedDays || !newMaxSubmission) {
      Alert.alert('Error', 'Both fields are required');
      return;
    }

    const dayMap: { [key: string]: string } = {
        'monday': 'mon',
        'tuesday': 'tue',
        'wednesday': 'wed',
        'thursday': 'thu',
        'friday': 'fri',
        'saturday': 'sat',
        'sunday': 'sun'
    };

    const rawDays = newAllowedDays
        .split(',')
        .map(d => d.trim().toLowerCase())
        .filter(d => d.length > 0);

    const validDays = [];
    for (const day of rawDays) {
        if (dayMap[day]) {
            validDays.push(dayMap[day]);
        } else if (Object.values(dayMap).includes(day)) {
            validDays.push(day);
        } else {
            Alert.alert("Invalid Day", `"${day}" is not a valid day. Please check spelling.`);
            return;
        }
    }

    try {
      setSaving(true);
      const token = await SecureStore.getItemAsync('access_token');
      if (!token) return;

      const res = await fetch(`${API_URL}/doctor/profile/`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allowed_days: validDays,
          max_submissions_per_day: newMaxSubmission,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.log("Update Error:", errText);
        throw new Error("Failed to update");
      }

      onSaved();
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.modal}>
          <Text style={modalStyles.title}>Edit Profile</Text>

          <Text style={modalStyles.label}>Allowed Days</Text>
          <TextInput
            value={newAllowedDays}
            onChangeText={setNewAllowedDays}
            style={modalStyles.input}
          />

          <Text style={modalStyles.label}>Max Submission / Day</Text>
          <TextInput
            value={newMaxSubmission}
            onChangeText={setNewMaxSubmission}
            style={modalStyles.input}
          />

          <View style={modalStyles.actions}>
            <TouchableOpacity onPress={onClose}>
              <Text style={modalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={modalStyles.saveBtn} onPress={saveChanges}>
              <Text style={modalStyles.saveText}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};



const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { flex: 1 },
  
  
  headerProfile: { 
    backgroundColor: '#2c88e4ff', 
    padding: 24, 
    paddingTop: 10, 
    borderBottomLeftRadius: 24, 
    borderBottomRightRadius: 24, 
    paddingBottom: 40 
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 24 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  avatarContainer: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)', overflow: 'hidden', backgroundColor: '#E5E7EB' },
  avatar: { width: '100%', height: '100%' },
  name: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  email: { color: '#DBEAFE', fontSize: 14, marginBottom: 8 },
  tag: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  tagText: { color: 'white', fontSize: 12, fontWeight: 'bold' },

 
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  statLabel: { fontSize: 10, color: '#BFDBFE', fontWeight: 'bold', marginTop: 2 },
  divider: { width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.3)' },


  body: { padding: 20, marginTop: -20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 12 },

  card: { backgroundColor: 'white', borderRadius: 16, shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, overflow: 'hidden' },
  infoCard: { padding: 20, marginBottom: 24 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoLabel: { color: '#6B7280' },
  infoValue: { color: '#111827', fontWeight: '500' },

  settingsSection: { marginBottom: 24 },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  borderTop: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  iconBox: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 8 },
  settingLabel: { fontSize: 16, color: '#111827', fontWeight: '500' },
  settingSub: { fontSize: 12, color: '#9CA3AF' },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2', borderRadius: 12, marginBottom: 24 },
  logoutText: { color: '#DC2626', fontWeight: 'bold', marginLeft: 8 },
  version: { textAlign: 'center', color: '#9CA3AF', fontSize: 12 },

  prefHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  editText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    gap: 12,
  },

});


const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  cancelText: {
    color: '#6B7280',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  saveText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

