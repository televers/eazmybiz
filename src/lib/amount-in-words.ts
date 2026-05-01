/** Amount in words for quotation footer (INR uses Indian numbering; others: generic English + code). */

const ones = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below1000(n: number): string {
  let s = "";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h > 0) s += `${ones[h]} Hundred`;
  if (rest === 0) return s.trim();
  if (s) s += " ";
  if (rest < 20) s += ones[rest];
  else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    s += tens[t];
    if (o) s += ` ${ones[o]}`;
  }
  return s.trim();
}

function indianGroup(n: number, divisor: number, label: string): { words: string; rem: number } {
  const v = Math.floor(n / divisor);
  const rem = n % divisor;
  if (v === 0) return { words: "", rem };
  return { words: `${below1000(v)} ${label}`, rem };
}

/** Integer 0 .. 99_99_99_999 → words (Indian lakhs/crores). */
export function numberToWordsIndian(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n === 0) return "Zero";

  let num = Math.floor(n);
  const parts: string[] = [];

  const cr = indianGroup(num, 10000000, "Crore");
  num = cr.rem;
  if (cr.words) parts.push(cr.words);

  const la = indianGroup(num, 100000, "Lakh");
  num = la.rem;
  if (la.words) parts.push(la.words);

  const th = indianGroup(num, 1000, "Thousand");
  num = th.rem;
  if (th.words) parts.push(th.words);

  if (num > 0) parts.push(below1000(num));

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function amountInWordsInr(amount: number): string {
  if (!Number.isFinite(amount)) return "";
  const rupees = Math.floor(amount + 1e-9);
  const paise = Math.round((amount - rupees) * 100);
  let w = numberToWordsIndian(rupees) + " Rupees";
  if (paise > 0) {
    w += " and " + numberToWordsIndian(paise) + " Paise";
  }
  return (w + " Only").toUpperCase();
}

function below1000Western(n: number): string {
  return below1000(n);
}

function numberToWordsWestern(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n === 0) return "Zero";
  const billions = Math.floor(n / 1_000_000_000);
  let r = n % 1_000_000_000;
  const millions = Math.floor(r / 1_000_000);
  r %= 1_000_000;
  const thousands = Math.floor(r / 1000);
  r %= 1000;
  const parts: string[] = [];
  if (billions) parts.push(`${below1000Western(billions)} Billion`);
  if (millions) parts.push(`${below1000Western(millions)} Million`);
  if (thousands) parts.push(`${below1000Western(thousands)} Thousand`);
  if (r) parts.push(below1000Western(r));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** Quotation PDF / print: INR in Indian words; other ISO codes use Western words + code. */
export function amountInWordsForCurrency(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) return "";
  const c = (currency || "INR").toUpperCase();
  if (c === "INR") return amountInWordsInr(amount);
  const main = Math.floor(Math.abs(amount) + 1e-9);
  const frac = Math.round((Math.abs(amount) - main) * 100);
  let w = numberToWordsWestern(main);
  if (frac) w += ` and ${numberToWordsWestern(frac)} Cents`;
  return `${w} ${c} Only`.toUpperCase();
}
