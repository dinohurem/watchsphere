/** Country calling codes shown as "flag + code" in the dealer number form. */
export interface DialCountry {
  iso: string
  name: string
  code: string
}

export const DIAL_COUNTRIES: DialCountry[] = [
  { iso: 'HK', name: 'Hong Kong', code: '+852' },
  { iso: 'CN', name: 'China', code: '+86' },
  { iso: 'SG', name: 'Singapore', code: '+65' },
  { iso: 'JP', name: 'Japan', code: '+81' },
  { iso: 'KR', name: 'South Korea', code: '+82' },
  { iso: 'TW', name: 'Taiwan', code: '+886' },
  { iso: 'TH', name: 'Thailand', code: '+66' },
  { iso: 'MY', name: 'Malaysia', code: '+60' },
  { iso: 'ID', name: 'Indonesia', code: '+62' },
  { iso: 'PH', name: 'Philippines', code: '+63' },
  { iso: 'VN', name: 'Vietnam', code: '+84' },
  { iso: 'IN', name: 'India', code: '+91' },
  { iso: 'AE', name: 'UAE', code: '+971' },
  { iso: 'SA', name: 'Saudi Arabia', code: '+966' },
  { iso: 'QA', name: 'Qatar', code: '+974' },
  { iso: 'KW', name: 'Kuwait', code: '+965' },
  { iso: 'IL', name: 'Israel', code: '+972' },
  { iso: 'TR', name: 'Turkey', code: '+90' },
  { iso: 'DE', name: 'Germany', code: '+49' },
  { iso: 'CH', name: 'Switzerland', code: '+41' },
  { iso: 'AT', name: 'Austria', code: '+43' },
  { iso: 'GB', name: 'UK', code: '+44' },
  { iso: 'IE', name: 'Ireland', code: '+353' },
  { iso: 'FR', name: 'France', code: '+33' },
  { iso: 'IT', name: 'Italy', code: '+39' },
  { iso: 'ES', name: 'Spain', code: '+34' },
  { iso: 'PT', name: 'Portugal', code: '+351' },
  { iso: 'NL', name: 'Netherlands', code: '+31' },
  { iso: 'BE', name: 'Belgium', code: '+32' },
  { iso: 'LU', name: 'Luxembourg', code: '+352' },
  { iso: 'MC', name: 'Monaco', code: '+377' },
  { iso: 'LI', name: 'Liechtenstein', code: '+423' },
  { iso: 'DK', name: 'Denmark', code: '+45' },
  { iso: 'SE', name: 'Sweden', code: '+46' },
  { iso: 'NO', name: 'Norway', code: '+47' },
  { iso: 'FI', name: 'Finland', code: '+358' },
  { iso: 'PL', name: 'Poland', code: '+48' },
  { iso: 'CZ', name: 'Czechia', code: '+420' },
  { iso: 'HU', name: 'Hungary', code: '+36' },
  { iso: 'RO', name: 'Romania', code: '+40' },
  { iso: 'BG', name: 'Bulgaria', code: '+359' },
  { iso: 'GR', name: 'Greece', code: '+30' },
  { iso: 'HR', name: 'Croatia', code: '+385' },
  { iso: 'RS', name: 'Serbia', code: '+381' },
  { iso: 'BA', name: 'Bosnia and Herzegovina', code: '+387' },
  { iso: 'SI', name: 'Slovenia', code: '+386' },
  { iso: 'UA', name: 'Ukraine', code: '+380' },
  { iso: 'RU', name: 'Russia', code: '+7' },
  { iso: 'US', name: 'United States', code: '+1' },
  { iso: 'CA', name: 'Canada', code: '+1' },
  { iso: 'MX', name: 'Mexico', code: '+52' },
  { iso: 'BR', name: 'Brazil', code: '+55' },
  { iso: 'AR', name: 'Argentina', code: '+54' },
  { iso: 'AU', name: 'Australia', code: '+61' },
  { iso: 'NZ', name: 'New Zealand', code: '+64' },
  { iso: 'ZA', name: 'South Africa', code: '+27' },
  { iso: 'EG', name: 'Egypt', code: '+20' },
  { iso: 'NG', name: 'Nigeria', code: '+234' },
]

export function flagEmoji(iso: string): string {
  return iso.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

export function dialLabel(c: DialCountry): string {
  return `${flagEmoji(c.iso)} ${c.code} ${c.name}`
}
