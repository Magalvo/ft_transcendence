import { en } from '../shared/i18n.en';
import { fr } from '../shared/i18n.fr';
import { pt } from '../shared/i18n.pt';

const dictionaries = {
  en,
  fr,
  pt,
} as const;

export type Locale = keyof typeof dictionaries;
export type TranslationKey = keyof typeof en;

type TranslationParams = Record<string, string | number>;
type Listener = () => void;
type DateLike = Date | number | string;

const DEFAULT_LOCALE: Locale = 'en';
const STORAGE_KEY = 'app_locale';

function isLocale(value: string | null): value is Locale {
  return value === 'en' || value === 'fr' || value === 'pt';
}

function resolveBrowserLocale(): Locale {
  const browserLocale = navigator.language.toLowerCase();
  if (browserLocale.startsWith('fr')) return 'fr';
  return browserLocale.startsWith('pt') ? 'pt' : DEFAULT_LOCALE;
}

function toDate(value: DateLike): Date {
  return value instanceof Date ? value : new Date(value);
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

class I18nService {
  private currentLocale: Locale = DEFAULT_LOCALE;
  private listeners = new Set<Listener>();

  public init(): void {
    const persisted = this.getPersistedLocale();
    this.currentLocale = persisted ?? resolveBrowserLocale();
    this.applyDocumentMetadata();
  }

  public getLocale(): Locale {
    return this.currentLocale;
  }

  public getIntlLocale(): string {
    switch (this.currentLocale) {
      case 'fr':
        return 'fr-FR';
      case 'pt':
        return 'pt-PT';
      default:
        return 'en-US';
    }
  }

  public setLocale(locale: Locale): void {
    if (locale === this.currentLocale) return;

    this.currentLocale = locale;

    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Ignore storage errors and keep locale in memory.
    }

    this.applyDocumentMetadata();
    this.emitChange();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public t(key: TranslationKey, params?: TranslationParams): string {
    const localized =
      dictionaries[this.currentLocale][key] ??
      dictionaries[DEFAULT_LOCALE][key] ??
      key;

    return interpolate(localized, params);
  }

  public formatDate(
    value: DateLike,
    options?: Intl.DateTimeFormatOptions
  ): string {
    return new Intl.DateTimeFormat(this.getIntlLocale(), options).format(
      toDate(value)
    );
  }

  public formatTime(
    value: DateLike,
    options?: Intl.DateTimeFormatOptions
  ): string {
    return new Intl.DateTimeFormat(this.getIntlLocale(), {
      hour: '2-digit',
      minute: '2-digit',
      ...options,
    }).format(toDate(value));
  }

  public formatDateTime(
    value: DateLike,
    options?: Intl.DateTimeFormatOptions
  ): string {
    return new Intl.DateTimeFormat(this.getIntlLocale(), {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...options,
    }).format(toDate(value));
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }

  private getPersistedLocale(): Locale | null {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return isLocale(value) ? value : null;
    } catch {
      return null;
    }
  }

  private applyDocumentMetadata(): void {
    document.documentElement.lang = this.currentLocale;
    document.title = this.t('app.title');
  }
}

export const i18n = new I18nService();
export const availableLocales: Locale[] = ['en', 'pt', 'fr'];
const localeNativeLabels: Record<Locale, string> = {
  en: 'English',
  fr: 'Francais',
  pt: 'Portugues',
};

export const getLocaleLabel = (locale: Locale): string =>
  localeNativeLabels[locale];
export const t = (key: TranslationKey, params?: TranslationParams): string =>
  i18n.t(key, params);
export const formatDate = (
  value: DateLike,
  options?: Intl.DateTimeFormatOptions
): string => i18n.formatDate(value, options);
export const formatTime = (
  value: DateLike,
  options?: Intl.DateTimeFormatOptions
): string => i18n.formatTime(value, options);
export const formatDateTime = (
  value: DateLike,
  options?: Intl.DateTimeFormatOptions
): string => i18n.formatDateTime(value, options);
