const FLAGS: Record<string, string> = {
  BF: '🇧🇫',
  CI: '🇨🇮',
  SN: '🇸🇳',
  ML: '🇲🇱',
  NE: '🇳🇪',
  TG: '🇹🇬',
  GH: '🇬🇭',
  NG: '🇳🇬',
  FR: '🇫🇷',
  US: '🇺🇸',
  GB: '🇬🇧',
  CA: '🇨🇦',
  MA: '🇲🇦',
  CM: '🇨🇲',
};

export function flag(countryCode?: string | null): string {
  if (!countryCode) return '🌍';
  return FLAGS[countryCode.toUpperCase()] ?? '🌍';
}

const AVATAR_EMOJI: Record<string, string> = {
  lion: '🦁',
  eagle: '🦅',
  baobab: '🌳',
  mask: '🎭',
  drum: '🥁',
  sun: '☀️',
  falcon: '🕊️',
  shield: '🛡️',
};

export function avatarGlyph(avatarUrl?: string | null, fallback = '?'): string {
  if (!avatarUrl) return fallback.slice(0, 1).toUpperCase();
  if (avatarUrl.startsWith('preset://')) {
    const key = avatarUrl.replace('preset://', '');
    return AVATAR_EMOJI[key] ?? fallback.slice(0, 1).toUpperCase();
  }
  return fallback.slice(0, 1).toUpperCase();
}
