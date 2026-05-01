/** ISO 4217 codes: commonly traded first, then alphabetical. */
const PRIORITY: string[] = [
  "INR",
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CNY",
  "AUD",
  "CAD",
  "CHF",
  "SGD",
  "HKD",
  "AED",
  "SAR",
  "NZD",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "KRW",
  "MXN",
  "THB",
  "IDR",
  "MYR",
  "PHP",
  "TRY",
  "ZAR",
  "BRL",
  "RUB",
  "ILS",
  "CLP",
  "COP",
  "ARS",
  "EGP",
  "PKR",
  "BDT",
  "LKR",
  "NPR",
  "VND",
  "TWD",
  "HUF",
  "CZK",
  "RON",
  "UAH",
  "QAR",
  "KWD",
  "OMR",
  "BHD",
  "JOD",
  "LBP",
  "NGN",
  "KES",
];

const REST_ALPHA = [
  "AFN",
  "ALL",
  "AMD",
  "ANG",
  "AOA",
  "AWG",
  "AZN",
  "BAM",
  "BBD",
  "BDT",
  "BGN",
  "BIF",
  "BMD",
  "BND",
  "BOB",
  "BSD",
  "BTN",
  "BWP",
  "BYN",
  "BZD",
  "CDF",
  "CRC",
  "CUP",
  "CVE",
  "DJF",
  "DOP",
  "DZD",
  "ERN",
  "ETB",
  "FJD",
  "FKP",
  "GEL",
  "GHS",
  "GIP",
  "GMD",
  "GNF",
  "GTQ",
  "GYD",
  "HNL",
  "HRK",
  "HTG",
  "ISK",
  "JMD",
  "KGS",
  "KHR",
  "KMF",
  "KYD",
  "KZT",
  "LAK",
  "LRD",
  "LSL",
  "LYD",
  "MAD",
  "MDL",
  "MGA",
  "MKD",
  "MMK",
  "MNT",
  "MOP",
  "MRU",
  "MUR",
  "MVR",
  "MWK",
  "MZN",
  "NAD",
  "NIO",
  "PAB",
  "PEN",
  "PGK",
  "PYG",
  "RSD",
  "RWF",
  "SBD",
  "SCR",
  "SDG",
  "SHP",
  "SLE",
  "SOS",
  "SRD",
  "SSP",
  "STN",
  "SVC",
  "SZL",
  "TJS",
  "TMT",
  "TND",
  "TOP",
  "TTD",
  "TZS",
  "UGX",
  "UYU",
  "UZS",
  "VES",
  "VUV",
  "WST",
  "XAF",
  "XCD",
  "XOF",
  "XPF",
  "YER",
  "ZMW",
];

function uniqSorted(codes: string[]): string[] {
  const set = new Set<string>();
  for (const c of codes) {
    set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** All currency codes for dropdown: priority block, then rest A–Z (deduped). */
export const CURRENCY_OPTIONS: string[] = (() => {
  const pri = PRIORITY.filter(Boolean);
  const rest = uniqSorted(REST_ALPHA).filter((c) => !PRIORITY.includes(c));
  return [...pri, ...rest];
})();

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * PDF amount only (no symbol/code): document header shows currency; table cells use this.
 */
export function formatAmountPdf(amount: number): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

/**
 * Money string for @react-pdf (Helvetica): no Unicode currency symbols — ₹ (U+20B9) maps to wrong glyphs.
 * INR → "Rs." + en-IN amount; other ISO codes → "CODE amount" via currencyDisplay: "code".
 * Use once for final grand total when header already states currency.
 */
export function formatMoneyPdf(amount: number, currency: string): string {
  const code = (currency || "INR").toUpperCase();
  if (code === "INR") {
    try {
      return `Rs. ${new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)}`;
    } catch {
      return `Rs. ${amount.toFixed(2)}`;
    }
  }
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: code,
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}
