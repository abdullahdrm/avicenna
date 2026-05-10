import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';
import en from '../locales/en.json';
import tr from '../locales/tr.json';

const i18n = new I18n();

i18n.translations = {
  en,
  tr,
};

const deviceLocale = Localization.getLocales()[0]?.languageCode || 'en';
i18n.locale = ['tr', 'en'].includes(deviceLocale) ? deviceLocale : 'en';
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

export default i18n;
