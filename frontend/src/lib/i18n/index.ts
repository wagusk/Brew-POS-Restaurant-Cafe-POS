import { en, TranslationKey } from './en';
import { id } from './id';

export type { TranslationKey };
export { en, id };

export type Locale = 'en' | 'id';

const LOCALE_KEY = 'brewpos_locale';

export function getStoredLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_KEY);
  if (stored === 'en' || stored === 'id') return stored;
  return 'en';
}

export function setStoredLocale(locale: Locale): void {
  localStorage.setItem(LOCALE_KEY, locale);
}

export function t(key: TranslationKey, locale?: Locale): string {
  const loc = locale || getStoredLocale();
  const dict = loc === 'id' ? id : en;
  const val = dict[key] || en[key] || key;
  return typeof val === 'string' ? val : String(val);
}
