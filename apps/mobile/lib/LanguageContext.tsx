import React, { createContext, useState, useContext, ReactNode } from 'react';
import I18n from './i18n';

interface LanguageContextType {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string, defaultValue?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState(I18n.locale);

  const setLocale = (newLocale: string) => {
    I18n.locale = newLocale;
    setLocaleState(newLocale);
  };

  const t = (key: string, defaultValue?: string): string => {
    return I18n.t(key, { defaultValue: defaultValue || key });
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
