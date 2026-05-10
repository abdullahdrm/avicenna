import * as SecureStore from 'expo-secure-store';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

const PATIENT_DARK_MODE_KEY = 'patient_dark_mode';

type PatientThemeMode = 'light' | 'dark';

type PatientThemeColors = {
  mode: PatientThemeMode;
  isDark: boolean;
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  mutedText: string;
  faintText: string;
  primary: string;
  primarySoft: string;
  dangerSoft: string;
  dangerBorder: string;
  dangerText: string;
  shadow: string;
};

interface PatientThemeContextType {
  darkMode: boolean;
  setDarkMode: (enabled: boolean) => void;
  colors: PatientThemeColors;
}

const lightColors: PatientThemeColors = {
  mode: 'light',
  isDark: false,
  background: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F4F6',
  border: '#F3F4F6',
  text: '#111827',
  mutedText: '#6B7280',
  faintText: '#9CA3AF',
  primary: '#2563EB',
  primarySoft: '#EFF6FF',
  dangerSoft: '#FEF2F2',
  dangerBorder: '#FEE2E2',
  dangerText: '#DC2626',
  shadow: '#000000',
};

const darkColors: PatientThemeColors = {
  mode: 'dark',
  isDark: true,
  background: '#0F172A',
  surface: '#111827',
  surfaceAlt: '#1F2937',
  border: '#374151',
  text: '#F9FAFB',
  mutedText: '#CBD5E1',
  faintText: '#94A3B8',
  primary: '#60A5FA',
  primarySoft: '#1E3A8A',
  dangerSoft: '#3B1117',
  dangerBorder: '#7F1D1D',
  dangerText: '#FCA5A5',
  shadow: '#000000',
};

const PatientThemeContext = createContext<PatientThemeContextType | undefined>(undefined);

export const PatientThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [darkMode, setDarkModeState] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedValue = await SecureStore.getItemAsync(PATIENT_DARK_MODE_KEY);
        setDarkModeState(savedValue === 'true');
      } catch (error) {
        console.error('Failed to load patient theme:', error);
      }
    };

    loadTheme();
  }, []);

  const setDarkMode = (enabled: boolean) => {
    setDarkModeState(enabled);
    SecureStore.setItemAsync(PATIENT_DARK_MODE_KEY, String(enabled)).catch((error) => {
      console.error('Failed to save patient theme:', error);
    });
  };

  const value = useMemo(
    () => ({
      darkMode,
      setDarkMode,
      colors: darkMode ? darkColors : lightColors,
    }),
    [darkMode]
  );

  return (
    <PatientThemeContext.Provider value={value}>
      {children}
    </PatientThemeContext.Provider>
  );
};

export const usePatientTheme = () => {
  const context = useContext(PatientThemeContext);
  if (!context) {
    throw new Error('usePatientTheme must be used within a PatientThemeProvider');
  }
  return context;
};
