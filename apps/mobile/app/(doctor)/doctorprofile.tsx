import { Bell, ChevronRight, HelpCircle, Languages, LogOut, Shield, Stethoscope, User } from 'lucide-react-native';
import React from 'react';
import { Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


const Card = ({ children, style }: any) => (
  <View style={[styles.card, style]}>{children}</View>
);


export default function DoctorProfileScreen() {
  const doctorInfo = { 
    name: 'Dr. İsim Soyisim',
    email: 'doctor@email.com',
    specialization: 'Dermatology'
  };

  const settingsItems = [
    { icon: Bell, label: 'Notifications', type: 'switch', value: true },
    { icon: Languages, label: 'Language', type: 'link', sub: 'English' },
    { icon: Shield, label: 'Privacy & Security', type: 'link' },
    { icon: HelpCircle, label: 'Help & Support', type: 'link' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Profile */}
        <View style={styles.headerProfile}>
           
           <View style={styles.profileRow}>
              <View style={styles.avatarContainer}>
                 <Image style={styles.avatar} />
              </View>
              <View>
                 <Text style={styles.name}>{doctorInfo.name}</Text>
                 <Text style={styles.email}>{doctorInfo.email}</Text>
                 <View style={styles.tag}>
                   <Text style={styles.tagText}>{doctorInfo.specialization}</Text>
                 </View>
              </View>
           </View>

           {/* Stats */}
           <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                 <Text style={styles.statValue}>156</Text>
                 <Text style={styles.statLabel}>PATIENTS</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statItem}>
                 <Text style={styles.statValue}>568</Text>
                 <Text style={styles.statLabel}>SUBMISSION REVIEWED</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statItem}>
                 <Text style={styles.statValue}>196</Text>
                 <Text style={styles.statLabel}>DAYS</Text>
              </View>
           </View>
        </View>

        <View style={styles.body}>
           
           {/* Details */}
           <Card style={styles.infoCard}>
              <Text style={styles.sectionTitle}>Professional Details</Text>
              <View style={styles.infoRow}>
                 <Text style={styles.infoLabel}>Experience</Text>
                 <Text style={styles.infoValue}>12 years</Text>
              </View>
              <View style={styles.infoRow}>
                 <Text style={styles.infoLabel}>License No</Text>
                 <Text style={styles.infoValue}>DR-458203</Text>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                 <Text style={styles.infoLabel}>City</Text>
                 <Text style={styles.infoValue}>Ankara</Text>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                 <Text style={styles.infoLabel}>Hospital</Text>
                 <Text style={styles.infoValue}>Bilkent Şehir Hastanesi</Text>
              </View>
           </Card>
          
          {/* Preferences */}
          <Card style={styles.infoCard}>
            <View style={styles.prefHeader}>
              <Text style={styles.sectionTitle}>Preferences</Text>

              <TouchableOpacity>
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Allowed Submission Days</Text>
              <Text style={styles.infoValue}>Mon – Fri</Text>
            </View>

            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoLabel}>Max Submissions / Day</Text>
              <Text style={styles.infoValue}>25</Text>
            </View>
          </Card>

           {/* Settings */}
           <View style={styles.settingsSection}>
              <Text style={[styles.sectionTitle, { paddingHorizontal: 4 }]}>Settings</Text>
              <Card>
                 {settingsItems.map((item, index) => {
                    const Icon = item.icon;
                    return (
                       <View key={index} style={[styles.settingRow, index !== 0 && styles.borderTop]}>
                          <View style={styles.iconBox}>
                             <Icon size={20} color="#4B5563" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.settingLabel}>{item.label}</Text>
                            {item.sub && <Text style={styles.settingSub}>{item.sub}</Text>}
                          </View>
                          
                          {item.type === 'switch' ? (
                             <Switch value={item.value} trackColor={{true: '#2563EB', false: '#E5E7EB'}} thumbColor="white" />
                          ) : (
                             <ChevronRight size={20} color="#9CA3AF" />
                          )}
                       </View>
                    );
                 })}
              </Card>
           </View>

           {/* Logout */}
           <TouchableOpacity style={styles.logoutBtn}>
              <LogOut size={18} color="#DC2626" />
              <Text style={styles.logoutText}>Sign Out</Text>
           </TouchableOpacity>
           
           <Text style={styles.version}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// STYLES
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


});
