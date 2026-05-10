import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, ChevronRight, FileText, HelpCircle, Lock, LogOut, Moon } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../lib/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { usePatientTheme } from '../lib/PatientThemeContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { darkMode, setDarkMode, colors } = usePatientTheme();
  const [notifications, setNotifications] = useState(true);

  const SettingItem = ({ icon: Icon, label, type = 'link', value, onToggle }: any) => (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={type === 'link' ? () => {} : undefined}
      activeOpacity={type === 'link' ? 0.7 : 1}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.iconBox, { backgroundColor: colors.surfaceAlt }]}>
          <Icon size={20} color={colors.mutedText} />
        </View>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      </View>

      {type === 'toggle' ? (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="white"
        />
      ) : (
        <ChevronRight size={20} color={colors.faintText} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('settingsScreen.settings')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={[styles.sectionHeader, { color: colors.mutedText }]}>{t('settingsScreen.preferences')}</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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

        <Text style={[styles.sectionHeader, { color: colors.mutedText }]}>{t('settingsScreen.language')}</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ padding: 16 }}>
            <LanguageSwitcher />
          </View>
        </View>

        <Text style={[styles.sectionHeader, { color: colors.mutedText }]}>{t('settingsScreen.support')}</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingItem icon={HelpCircle} label={t('settingsScreen.helpCenter')} />
          <SettingItem icon={Lock} label={t('settingsScreen.privacyPolicy')} />
          <SettingItem icon={FileText} label={t('settingsScreen.termsOfService')} />
        </View>

        <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: colors.dangerSoft, borderColor: colors.dangerBorder }]} onPress={() => router.replace('/login')}>
          <LogOut size={20} color={colors.dangerText} />
          <Text style={[styles.logoutText, { color: colors.dangerText }]}>{t('settingsScreen.signOut')}</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: colors.faintText }]}>{t('settingsScreen.version')}</Text>
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
