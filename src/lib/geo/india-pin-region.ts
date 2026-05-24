/** India PIN first two digits → state/UT (postal zone). See India Post sorting districts. */
const INDIA_PIN_PREFIX_STATE: Record<string, string> = {
  "11": "Delhi",
  "12": "Haryana",
  "13": "Haryana",
  "14": "Punjab",
  "15": "Punjab",
  "16": "Chandigarh",
  "17": "Himachal Pradesh",
  "18": "Jammu and Kashmir",
  "19": "Jammu and Kashmir",
  "20": "Uttar Pradesh",
  "21": "Uttar Pradesh",
  "22": "Uttar Pradesh",
  "23": "Uttar Pradesh",
  "24": "Uttar Pradesh",
  "25": "Uttar Pradesh",
  "26": "Uttar Pradesh",
  "27": "Uttar Pradesh",
  "28": "Uttar Pradesh",
  "30": "Rajasthan",
  "31": "Rajasthan",
  "32": "Rajasthan",
  "33": "Rajasthan",
  "34": "Rajasthan",
  "36": "Gujarat",
  "37": "Gujarat",
  "38": "Gujarat",
  "39": "Gujarat",
  "40": "Maharashtra",
  "41": "Maharashtra",
  "42": "Maharashtra",
  "43": "Maharashtra",
  "44": "Maharashtra",
  "45": "Madhya Pradesh",
  "46": "Madhya Pradesh",
  "47": "Madhya Pradesh",
  "48": "Madhya Pradesh",
  "49": "Chhattisgarh",
  "50": "Telangana",
  "51": "Andhra Pradesh",
  "52": "Andhra Pradesh",
  "53": "Andhra Pradesh",
  "56": "Karnataka",
  "57": "Karnataka",
  "58": "Karnataka",
  "59": "Karnataka",
  "60": "Tamil Nadu",
  "61": "Tamil Nadu",
  "62": "Tamil Nadu",
  "63": "Tamil Nadu",
  "64": "Tamil Nadu",
  "65": "Tamil Nadu",
  "66": "Tamil Nadu",
  "67": "Kerala",
  "68": "Kerala",
  "69": "Kerala",
  "70": "West Bengal",
  "71": "West Bengal",
  "72": "West Bengal",
  "73": "West Bengal",
  "74": "West Bengal",
  "75": "Odisha",
  "76": "Odisha",
  "77": "Odisha",
  "78": "Assam",
  "79": "Arunachal Pradesh",
  "80": "Bihar",
  "81": "Bihar",
  "82": "Bihar",
  "83": "Bihar",
  "84": "Bihar",
  "85": "Jharkhand",
};

function normalizeIndiaStateName(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return "";
  if (s === "delhi" || s.includes("nct") || s === "new delhi") return "delhi";
  if (s === "gurugram" || s === "gurgaon") return "haryana";
  if (s === "orissa") return "odisha";
  if (s === "uttaranchal") return "uttarakhand";
  if (s === "pondicherry" || s === "puducherry") return "puducherry";
  return s.replace(/\s+/g, " ");
}

/** Dataset / API placeholders — not real locality names. */
export function sanitizeIndiaLocalityField(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  const lower = v.toLowerCase();
  if (
    lower === "na" ||
    lower === "n/a" ||
    lower === "null" ||
    lower === "-" ||
    lower === "—" ||
    lower === "none" ||
    lower === "not applicable"
  ) {
    return "";
  }
  return v;
}

export function expectedIndiaStateFromPin(pin: string): string | null {
  const digits = pin.replace(/\D/g, "");
  if (digits.length !== 6) return null;
  return INDIA_PIN_PREFIX_STATE[digits.slice(0, 2)] ?? null;
}

function defaultCityForIndiaState(state: string, pin: string): string {
  if (state === "Delhi") return "New Delhi";
  if (state === "Chandigarh") return "Chandigarh";
  const p3 = pin.slice(0, 3);
  if (state === "Maharashtra" && p3 === "400") return "Mumbai";
  if (state === "Karnataka" && p3 === "560") return "Bengaluru";
  if (state === "Tamil Nadu" && p3 === "600") return "Chennai";
  if (state === "Telangana" && p3 === "500") return "Hyderabad";
  if (state === "West Bengal" && p3 === "700") return "Kolkata";
  return state;
}

/** Reconcile API city/state with India Post PIN prefix rules. */
export function reconcileIndiaPinLookup(
  pin: string,
  raw: { city: string; state: string },
): { city: string; state: string } | null {
  const city = sanitizeIndiaLocalityField(raw.city);
  const state = sanitizeIndiaLocalityField(raw.state) || raw.state.trim();
  if (!city && !state) return null;

  const expected = expectedIndiaStateFromPin(pin);
  if (!expected) {
    if (!city || !state) return null;
    return { city, state };
  }

  const expectedNorm = normalizeIndiaStateName(expected);
  const gotNorm = normalizeIndiaStateName(state);

  if (gotNorm !== expectedNorm) {
    return {
      city: defaultCityForIndiaState(expected, pin),
      state: expected,
    };
  }

  let finalCity = city;
  if (expected === "Delhi") {
    const cityNorm = city.toLowerCase();
    if (
      cityNorm.includes("gurgaon") ||
      cityNorm.includes("gurugram") ||
      cityNorm.includes("haryana")
    ) {
      finalCity = "New Delhi";
    }
  }

  if (!finalCity) {
    finalCity = defaultCityForIndiaState(expected, pin);
  }

  return { city: finalCity, state: expected };
}

export function indiaPinPrefixFallback(pin: string): { city: string; state: string } | null {
  const expected = expectedIndiaStateFromPin(pin);
  if (!expected) return null;
  return {
    city: defaultCityForIndiaState(expected, pin),
    state: expected,
  };
}

export function indiaStateMatchesPin(pin: string, state: string): boolean {
  const expected = expectedIndiaStateFromPin(pin);
  if (!expected) return true;
  return normalizeIndiaStateName(expected) === normalizeIndiaStateName(state);
}
