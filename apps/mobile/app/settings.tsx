import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, ChevronRight, FileText, HelpCircle, Lock, LogOut, Moon } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../lib/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const SettingItem = ({ icon: Icon, label, type = 'link', value, onToggle }: any) => (
    <TouchableOpacity 
      style={styles.row} 
      onPress={type === 'link' ? () => {} : undefined} 
      activeOpacity={type === 'link' ? 0.7 : 1}
    >
      <View style={styles.rowLeft}>
        <View style={styles.iconBox}>
          <Icon size={20} color="#4B5563" />
        </View>
        <Text style={styles.label}>{label}</Text>
      </View>
      
      {type === 'toggle' ? (
        <Switch 
          value={value} 
          onValueChange={onToggle}
          trackColor={{ false: '#E5E7EB', true: '#2563EB' }}
          thumbColor="white"
        />
      ) : (
        <ChevronRight size={20} color="#9CA3AF" />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settingsScreen.settings')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionHeader}>{t('settingsScreen.preferences')}</Text>
        <View style={styles.section}>
          <SettingItem 
            icon={Bell} 
            label={t('settingsScreen.pushNotifications')} 
            type="toggle" 
            value={notifications} 
            onToggle={setNotifications} 
          />
          <SettingItem 
            icon={Moon} 
            label={t('settingsScreen.darkMode')} 
            type="toggle" 
            value={darkMode} 
            onToggle={setDarkMode} 
          />
        </View>

        <Text style={styles.sectionHeader}>{t('settingsScreen.language')}</Text>
        <View style={styles.section}>
          <View style={{ padding: 16 }}>
            <LanguageSwitcher />
          </View>
        </View>

        <Text style={styles.sectionHeader}>{t('settingsScreen.support')}</Text>
        <View style={styles.section}>
          <SettingItem icon={HelpCircle} label={t('settingsScreen.helpCenter')} />
          <SettingItem icon={Lock} label={t('settingsScreen.privacyPolicy')} />
          <SettingItem icon={FileText} label={t('settingsScreen.termsOfService')} />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => router.replace('/login')}>
          <LogOut size={20} color="#DC2626" />
          <Text style={styles.logoutText}>{t('settingsScreen.signOut')}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>{t('settingsScreen.version')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  content: { padding: 20 },
  sectionHeader: { fontSize: 14, fontWeight: 'bold', color: '#6B7280', marginBottom: 12, marginTop: 8, textTransform: 'uppercase' },
  section: { backgroundColor: 'white', borderRadius: 16, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: '#F3F4F6' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 16, color: '#111827', fontWeight: '500' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#FEF2F2', borderRadius: 12, borderWidth: 1, borderColor: '#FEE2E2', marginTop: 12 },
  logoutText: { color: '#DC2626', fontWeight: 'bold', marginLeft: 8 },
  version: { textAlign: 'center', color: '#9CA3AF', marginTop: 24, fontSize: 12 }
});