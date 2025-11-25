import { useRouter } from 'expo-router';
import { Activity, AlertCircle, FileText, LogOut, Pencil, Pill, Ruler, Settings, Weight } from 'lucide-react-native';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Card = ({ children, style }: any) => (
  <View style={[styles.card, style]}>{children}</View>
);

const InfoRow = ({ label, value, icon: Icon, isLast }: any) => (
  <View style={[styles.infoRow, isLast && { borderBottomWidth: 0 }]}>
    <View style={styles.labelContainer}>
      {Icon && <Icon size={16} color="#6B7280" style={{ marginRight: 8 }} />}
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

export default function ProfileScreen() {
  const router = useRouter();
  const userProfile = {
    name: 'ee',
    email: 'ee',
    avatar: '',
    gender: 'Female',
    age: 28,
    height: 175,
    weight: 70,
    skinType: 'Combination',
    allergies: ['Penicillin', 'Peanuts'],
    conditions: 'None',
    medications: 'Vitamin D',
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        
        <View style={styles.headerProfile}>
           <View style={styles.topBar}>
             <Text style={styles.headerTitle}>My Profile</Text>
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
                     <Text style={styles.editBtnText}>Edit Profile</Text>
                   </TouchableOpacity>
              </View>
           </View>
           <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                 <Text style={styles.statValue}>12</Text>
                 <Text style={styles.statLabel}>UPLOADS</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statItem}>
                 <Text style={styles.statValue}>8</Text>
                 <Text style={styles.statLabel}>REPORTS</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statItem}>
                 <Text style={styles.statValue}>45</Text>
                 <Text style={styles.statLabel}>DAYS</Text>
              </View>
           </View>
        </View>

        <View style={styles.body}>
           
           <Text style={styles.sectionTitle}>Personal Details</Text>
           <Card style={styles.infoCard}>
              <InfoRow label="Gender" value={userProfile.gender} />
              <InfoRow label="Age" value={`${userProfile.age} years`} isLast />
           </Card>
           <Text style={styles.sectionTitle}>Body Measurements</Text>
           <Card style={styles.infoCard}>
              <InfoRow icon={Ruler} label="Height" value={`${userProfile.height} cm`} />
              <InfoRow icon={Weight} label="Weight" value={`${userProfile.weight} kg`} isLast />
           </Card>
           <Text style={styles.sectionTitle}>Medical & Skin Profile</Text>
           <Card style={styles.infoCard}>
              <InfoRow icon={Activity} label="Skin Type" value={userProfile.skinType} />
              <InfoRow 
                icon={AlertCircle} 
                label="Allergies" 
                value={userProfile.allergies.join(', ') || 'None'} 
              />
              <InfoRow icon={FileText} label="Conditions" value={userProfile.conditions} />
              <InfoRow icon={Pill} label="Medications" value={userProfile.medications} isLast />
           </Card>
           <TouchableOpacity style={styles.logoutBtn} onPress={() => router.replace('/login')}>
              <LogOut size={18} color="#DC2626" />
              <Text style={styles.logoutText}>Sign Out</Text>
           </TouchableOpacity>
           
           <Text style={styles.version}>Version 1.0.0</Text>
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