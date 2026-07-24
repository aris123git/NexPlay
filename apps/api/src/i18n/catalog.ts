/**
 * Catalogue localisation — langues, devises, continents, fuseaux BF-first.
 */

export const LOCALES = [
  { code: 'fr', name: 'Français', dir: 'ltr', dateFormat: 'dd/MM/yyyy', nativeName: 'Français' },
  { code: 'en', name: 'English', dir: 'ltr', dateFormat: 'MM/dd/yyyy', nativeName: 'English' },
  { code: 'ar', name: 'العربية', dir: 'rtl', dateFormat: 'dd/MM/yyyy', nativeName: 'العربية' },
  { code: 'pt', name: 'Português', dir: 'ltr', dateFormat: 'dd/MM/yyyy', nativeName: 'Português' },
  { code: 'es', name: 'Español', dir: 'ltr', dateFormat: 'dd/MM/yyyy', nativeName: 'Español' },
] as const;

export const CURRENCIES = [
  { code: 'XOF', symbol: 'CFA', name: 'Franc CFA' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'Pound Sterling' },
  { code: 'MAD', symbol: 'MAD', name: 'Dirham marocain' },
  { code: 'NGN', symbol: '₦', name: 'Naira' },
  { code: 'GHS', symbol: 'GH₵', name: 'Cedi' },
] as const;

export const CONTINENTS = [
  { code: 'AF', nameKey: 'continent.af' },
  { code: 'EU', nameKey: 'continent.eu' },
  { code: 'AS', nameKey: 'continent.as' },
  { code: 'NA', nameKey: 'continent.na' },
  { code: 'SA', nameKey: 'continent.sa' },
  { code: 'OC', nameKey: 'continent.oc' },
] as const;

/** Mapping pays → continent (échantillon Afrique + diaspora) */
export const COUNTRY_CONTINENT: Record<string, string> = {
  BF: 'AF', CI: 'AF', SN: 'AF', ML: 'AF', NE: 'AF', TG: 'AF', BJ: 'AF',
  GH: 'AF', NG: 'AF', CM: 'AF', MA: 'AF', TN: 'AF', DZ: 'AF', EG: 'AF',
  ZA: 'AF', KE: 'AF', RW: 'AF', CD: 'AF', GA: 'AF',
  FR: 'EU', BE: 'EU', CH: 'EU', DE: 'EU', ES: 'EU', PT: 'EU', GB: 'EU', IT: 'EU',
  US: 'NA', CA: 'NA', MX: 'NA',
  BR: 'SA', AR: 'SA',
  AE: 'AS', SA: 'AS', IN: 'AS', CN: 'AS', JP: 'AS',
  AU: 'OC', NZ: 'OC',
};

export const TIMEZONES = [
  'Africa/Ouagadougou',
  'Africa/Abidjan',
  'Africa/Dakar',
  'Africa/Lagos',
  'Africa/Casablanca',
  'Europe/Paris',
  'Europe/London',
  'America/New_York',
  'America/Toronto',
  'Asia/Dubai',
  'UTC',
] as const;

export function localeCatalog() {
  return {
    locales: LOCALES,
    currencies: CURRENCIES,
    continents: CONTINENTS,
    timezones: TIMEZONES,
    countryContinent: COUNTRY_CONTINENT,
  };
}

export function resolveContinent(countryCode: string): string {
  return COUNTRY_CONTINENT[countryCode.toUpperCase()] ?? 'AF';
}

export function formatDateForLocale(iso: string | Date, localeCode: string): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const loc = LOCALES.find((l) => l.code === localeCode) ?? LOCALES[0];
  try {
    return new Intl.DateTimeFormat(loc.code, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return d.toISOString();
  }
}
