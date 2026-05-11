import { useFocusEffect, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import {
  Activity,
  AlertCircle,
  FileText,
  LogOut,
  Pencil,
  Pill,
  Ruler,
  Settings,
  Weight
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../../lib/LanguageContext';

const API_URL = 'http://172.20.10.2:8000/api';

const Card = ({ children, style }: any) => (
  <View style={[styles.card, style]}>{children}</View>
);

const InfoRow = ({ label, value, icon: Icon, isLast }: any) => (
  <View style={[styles.infoRow, isLast && { borderBottomWidth: 0 }]}>
    <View style={styles.labelContainer}>
      {Icon && <Icon size={16} color="#6B7280" style={{ marginRight: 8 }} />}
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
    <Text style={styles.infoValue}>{value || '-'}</Text>
  </View>
);

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  
  const [stats, setStats] = useState({
    uploads: 0,
    reports: 0,
    days: 0, 
  });

  const [userProfile, setUserProfile] = useState({
    name: 'Loading...',
    email: '',
    avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    gender: 'Not set',
    age: '',
    height: '',
    weight: '',
    skinType: '',
    allergies: '',
    conditions: 'None',
    medications: 'None',
  });

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (!token) {
        router.replace('/login');
        return;
      }

      const userJson = await SecureStore.getItemAsync('user');
      let baseInfo = {};
      if (userJson) {
        const user = JSON.parse(userJson);
        const fName = user.first_name || '';
        const lName = user.last_name || '';
        const displayName = `${fName} ${lName}`.trim() || user.username || 'User';
        baseInfo = {
          name: displayName || 'User',
          email: user.email || '',
        };
      }

      const headers = { 'Authorization': `Bearer ${token}` };

      const profileRes = await fetch(`${API_URL}/profile/`, { headers });

      if (profileRes.ok) {
        const data = await profileRes.json();
        console.log("profile res",data);

        setUserProfile(prev => ({
          ...prev,
          ...baseInfo,
          age: data.age,
          height: data.height,
          weight: data.weight,
          skinType: data.skin_type,
          allergies: data.allergies, 
          gender: data.gender,
          conditions: data.medical_conditions,
          medications: data.medications,
        }));
        
        setStats(prev => ({ ...prev, days: data.stats.days_since_joined+1, uploads: data.stats.total_submissions, reports: data.stats.reviewed_submissions }));
        
      }

    } catch (error) {
      console.error("Failed to load profile data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      await SecureStore.deleteItemAsync('user');
      router.replace('/login'); 
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not log out");
    }
  };

  const getGenderDisplay = (genderValue: string) => {
    const genderMap: { [key: string]: string } = {
      'female': t('questionnaireScreen.female'),
      'male': t('questionnaireScreen.male'),
    };
    return genderMap[genderValue?.toLowerCase()] || genderValue || '-';
  };

  const getSkinTypeDisplay = (skinTypeValue: string) => {
    const skinTypeMap: { [key: string]: string } = {
      'normal': t('questionnaireScreen.normal'),
      'dry': t('questionnaireScreen.dry'),
      'oily': t('questionnaireScreen.oily'),
      'combination': t('questionnaireScreen.combination'),
      'sensitive': t('questionnaireScreen.sensitive'),
    };
    return skinTypeMap[skinTypeValue?.toLowerCase()] || skinTypeValue || '-';
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {justifyContent:'center', alignItems:'center'}]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        
        <View style={styles.headerProfile}>
           <View style={styles.topBar}>
             <Text style={styles.headerTitle}>{t('profileScreen.myProfile')}</Text>
             <TouchableOpacity 
                style={styles.settingsBtn} 
                onPress={() => router.push('/settings')}
                >
               <Settings size={24} color="white" />
             </TouchableOpacity>
           </View>
           
           <View style={styles.profileRow}>
              <View style={styles.avatarContainer}>
                 <Image 
                   source={{ uri: userProfile.avatar }} 
                   style={styles.avatar}
                 />
              </View>
              <View style={{ flex: 1 }}>
                 <Text style={styles.name}>{userProfile.name}</Text>
                 <Text style={styles.email}>{userProfile.email}</Text>
                  <TouchableOpacity 
                     style={styles.editBtn}
                     onPress={() => router.push('/edit-profile')}
                     >
                     <Pencil size={12} color="white" />
                     <Text style={styles.editBtnText}>{t('profileScreen.editProfile')}</Text>
                   </TouchableOpacity>
              </View>
           </View>

           <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                 <Text style={styles.statValue}>{stats.uploads}</Text>
                 <Text style={styles.statLabel}>{t('profileScreen.personalDetails').toUpperCase()}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statItem}>
                 <Text style={styles.statValue}>{stats.reports}</Text>
                 <Text style={styles.statLabel}>{t('profileScreen.medicalProfile').split('&')[0].trim().toUpperCase()}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statItem}>
                 <Text style={styles.statValue}>{stats.days}</Text>
                 <Text style={styles.statLabel}>{t('profileScreen.days').toUpperCase()}</Text>
              </View>
           </View>
        </View>

        <View style={styles.body}>
           
           <Text style={styles.sectionTitle}>{t('profileScreen.personalDetails')}</Text>
           <Card style={styles.infoCard}>
              <InfoRow label={t('profileScreen.gender')} value={getGenderDisplay(userProfile.gender)} />
              <InfoRow label={t('profileScreen.age')} value={userProfile.age ? `${userProfile.age} ${t('profileScreen.years')}` : '-'} isLast />
           </Card>

           <Text style={styles.sectionTitle}>{t('profileScreen.bodyMeasurements')}</Text>
           <Card style={styles.infoCard}>
              <InfoRow icon={Ruler} label={t('profileScreen.height')} value={userProfile.height ? `${userProfile.height} ${t('profileScreen.cm')}` : '-'} />
              <InfoRow icon={Weight} label={t('profileScreen.weight')} value={userProfile.weight ? `${userProfile.weight} ${t('profileScreen.kg')}` : '-'} isLast />
           </Card>

           <Text style={styles.sectionTitle}>{t('profileScreen.medicalProfile')}</Text>
           <Card style={styles.infoCard}>
              <InfoRow icon={Activity} label={t('profileScreen.skinType')} value={getSkinTypeDisplay(userProfile.skinType)} />
              <InfoRow 
                icon={AlertCircle} 
                label={t('profileScreen.allergies')} 
                value={userProfile.allergies} 
              />
              <InfoRow icon={FileText} label={t('profileScreen.conditions')} value={userProfile.conditions} />
              <InfoRow icon={Pill} label={t('profileScreen.medications')} value={userProfile.medications} isLast />
           </Card>

           <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <LogOut size={18} color="#DC2626" />
              <Text style={styles.logoutText}>{t('profileScreen.signOut')}</Text>
           </TouchableOpacity>
           
           <Text style={styles.version}>{t('profileScreen.version')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { flex: 1 },

  headerProfile: { backgroundColor: '#2563EB', padding: 24, paddingTop: 10, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingBottom: 30 },
  topBar: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 24, position: 'relative' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  settingsBtn: { position: 'absolute', right: 0, padding: 4 },
  
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  avatarContainer: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)', overflow: 'hidden', backgroundColor: '#E5E7EB' },
  avatar: { width: '100%', height: '100%' },
  name: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  email: { color: '#DBEAFE', fontSize: 14, marginBottom: 8 },
  
  editBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', gap: 6 },
  editBtnText: { color: 'white', fontSize: 12, fontWeight: '600' },

  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 8 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  statLabel: { fontSize: 10, color: '#BFDBFE', fontWeight: 'bold', marginTop: 2 },
  divider: { width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.3)' },

  body: { padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 12, marginTop: 4, textTransform: 'uppercase' },
  
  card: { backgroundColor: 'white', borderRadius: 16, shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, overflow: 'hidden', marginBottom: 24 },
  infoCard: { paddingHorizontal: 20, paddingVertical: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  labelContainer: { flexDirection: 'row', alignItems: 'center' },
  infoLabel: { color: '#6B7280', fontSize: 15 },
  infoValue: { color: '#111827', fontWeight: '500', fontSize: 15, maxWidth: '60%', textAlign: 'right' },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2', borderRadius: 12, marginBottom: 24, marginTop: 8 },
  logoutText: { color: '#DC2626', fontWeight: 'bold', marginLeft: 8 },
  version: { textAlign: 'center', color: '#9CA3AF', fontSize: 12 }
});