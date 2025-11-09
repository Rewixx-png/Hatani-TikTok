export function escapeHTML(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const countryCodes = {
    'AU': 'Australia', 'AT': 'Austria', 'AZ': 'Azerbaijan', 'AL': 'Albania', 'DZ': 'Algeria', 'AE': 'UAE', 'AR': 'Argentina',
    'AM': 'Armenia', 'BD': 'Bangladesh', 'BY': 'Belarus', 'BE': 'Belgium', 'BG': 'Bulgaria', 'BR': 'Brazil', 'GB': 'United Kingdom',
    'HU': 'Hungary', 'VE': 'Venezuela', 'VN': 'Vietnam', 'DE': 'Germany', 'GR': 'Greece', 'GE': 'Georgia', 'DK': 'Denmark',
    'EG': 'Egypt', 'IL': 'Israel', 'IN': 'India', 'ID': 'Indonesia', 'IQ': 'Iraq', 'IR': 'Iran', 'IE': 'Ireland', 'ES': 'Spain',
    'IT': 'Italy', 'KZ': 'Kazakhstan', 'KH': 'Cambodia', 'CA': 'Canada', 'QA': 'Qatar', 'CY': 'Cyprus', 'KG': 'Kyrgyzstan',
    'CN': 'China', 'CO': 'Colombia', 'KW': 'Kuwait', 'LV': 'Latvia', 'LB': 'Lebanon', 'LT': 'Lithuania', 'MY': 'Malaysia',
    'MA': 'Morocco', 'MX': 'Mexico', 'MD': 'Moldova', 'MN': 'Mongolia', 'MM': 'Myanmar', 'NP': 'Nepal', 'NL': 'Netherlands',
    'NZ': 'New Zealand', 'NO': 'Norway', 'OM': 'Oman', 'PK': 'Pakistan', 'PE': 'Peru', 'PL': 'Poland', 'PT': 'Portugal',
    'PR': 'Puerto Rico', 'KR': 'South Korea', 'RU': 'Russia', 'RO': 'Romania', 'SA': 'Saudi Arabia', 'RS': 'Serbia',
    'SG': 'Singapore', 'SK': 'Slovakia', 'SI': 'Slovenia', 'US': 'USA', 'TH': 'Thailand', 'TW': 'Taiwan', 'TR': 'Turkey',
    'UZ': 'Uzbekistan', 'UA': 'Ukraine', 'UY': 'Uruguay', 'PH': 'Philippines', 'FI': 'Finland', 'FR': 'France', 'HR': 'Croatia',
    'CZ': 'Czech Republic', 'CL': 'Chile', 'CH': 'Switzerland', 'SE': 'Sweden', 'LK': 'Sri Lanka', 'EC': 'Ecuador',
    'EE': 'Estonia', 'ZA': 'South Africa', 'JP': 'Japan'
};

export function getCountryName(code) {
    if (!code) return 'N/A';
    return countryCodes[code.toUpperCase()] || code.toUpperCase();
}

export function formatK(num) {
    if (typeof num !== 'number') return '0';
    if (num < 1000) return num.toString();
    if (num < 1000000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'm';
}

export const formatTimestamp = (unixTime) => {
    if(!unixTime) return 'N/A';
    const d = new Date(unixTime * 1000);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};
