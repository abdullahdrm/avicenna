import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLanguage } from '../lib/LanguageContext';

export const LanguageSwitcher = () => {
  const { locale, setLocale } = useLanguage();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, locale === 'en' && styles.active]}
        onPress={() => setLocale('en')}
      >
        <Text style={[styles.text, locale === 'en' && styles.activeText]}>English</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, locale === 'tr' && styles.active]}
        onPress={() => setLocale('tr')}
      >
        <Text style={[styles.text, locale === 'tr' && styles.activeText]}>Türkçe</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  active: {
    backgroundColor: '#2563EB',
  },
  text: {
    color: '#666',
    fontWeight: '500',
  },
  activeText: {
    color: '#fff',
  },
});
