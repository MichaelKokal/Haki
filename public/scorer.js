// Free, offline pronunciation scoring: compare what the recognizer heard against the target phrase
// and turn letter-level differences into tips about the sounds English speakers usually miss.

// Letters that are pronounced the same in Levantine speech, or that recognizers spell interchangeably.
const SAME_SOUND = [["ق", "ء", "ا"]];

export function normalize(text) {
  return text
    .replace(/[ً-ٰٟـ]/g, "") // diacritics and tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى(?=\s|$|[؟،?!.])/g, "ا") // final ى is said "a": إمبلى = إمبلا
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ث/g, "ت") // Levantine: كثير → كتير
    .replace(/ذ/g, "د")
    .replace(/[^ء-ي\s]/g, " ") // punctuation, Latin, digits
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/ا$/, "ه")) // بكرا / بكرة
    .join(" ");
}

function substitutionCost(a, b) {
  if (a === b) return 0;
  if (SAME_SOUND.some((group) => group.includes(a) && group.includes(b))) return 0.2;
  return 1;
}

// Weighted edit distance with a backtrace, so we know which letters were swapped or dropped.
function align(target, heard) {
  const t = [...target];
  const h = [...heard];
  const d = Array.from({ length: t.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j++) d[0][j] = j;

  for (let i = 1; i <= t.length; i++) {
    for (let j = 1; j <= h.length; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + substitutionCost(t[i - 1], h[j - 1]),
      );
    }
  }

  const ops = [];
  let i = t.length;
  let j = h.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + substitutionCost(t[i - 1], h[j - 1])) {
      if (t[i - 1] !== h[j - 1]) ops.push({ type: "sub", t: t[i - 1], h: h[j - 1] });
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ type: "del", t: t[i - 1] });
      i--;
    } else {
      ops.push({ type: "ins", h: h[j - 1] });
      j--;
    }
  }

  const longest = Math.max(t.length, h.length) || 1;
  return { similarity: Math.max(0, 1 - d[t.length][h.length] / longest), ops };
}

// How closely two Arabic phrases match (0-1), ignoring spelling variants and word breaks.
export function phraseSimilarity(a, b) {
  return align(normalize(a).replace(/ /g, ""), normalize(b).replace(/ /g, "")).similarity;
}

// ---------- Sound diagnoses ----------

const EMPHATICS = {
  ص: ["ṣ (ص)", "s", ["س"]],
  ط: ["ṭ (ط)", "t", ["ت"]],
  ض: ["ḍ (ض)", "d", ["د"]],
  ظ: ["ẓ (ظ)", "z", ["ز", "د"]],
};

const SOUNDS = {
  ha: {
    note: "ḥ sounded like plain h",
    tip: "ḥ (ح) came out like an English h. Tighten the back of your throat and push air through it: a raspy, breathy h, like fogging a window but harsher.",
  },
  ain: {
    note: "ʿ was dropped",
    tip: "ʿ (ع) was missing or too soft. It's a voiced squeeze deep in the throat. Say \"ah\" while tightening your throat, as if you're about to gag.",
  },
  kh: {
    note: "kh needs more scrape",
    tip: "kh (خ) needs more friction: the scrape at the back of the mouth, like the \"ch\" in Scottish \"loch\" or German \"Bach\".",
  },
  gh: {
    note: "gh sounded off",
    tip: "gh (غ) is a gargled r, like the French r. Bring the back of your tongue close to the soft palate and voice it.",
  },
  qaf: {
    note: "ق said as k",
    tip: "In city Palestinian (and most Levantine) speech, ق is a glottal stop, the catch in \"uh-oh\": \"ʾahwe\", not \"kahwe\". Villagers do say k, but the glottal stop is the safe default.",
  },
  long: {
    note: "long vowel too short",
    tip: "A long vowel got cut short. Hold ā, ī, and ū about twice as long as a short vowel.",
  },
};

function diagnose(op) {
  if (op.type === "sub") {
    const pair = op.t + op.h;
    if (pair === "حه" || pair === "حخ") return SOUNDS.ha;
    if (op.t === "ع") return SOUNDS.ain;
    if (op.t === "خ" && "كهح".includes(op.h)) return SOUNDS.kh;
    if (op.t === "غ") return SOUNDS.gh;
    if (pair === "قك") return SOUNDS.qaf;
    const emphatic = EMPHATICS[op.t];
    if (emphatic && emphatic[2].includes(op.h)) {
      const [name, plain] = emphatic;
      return {
        note: `${name.split(" ")[0]} sounded like ${plain}`,
        tip: `${name} sounded like a plain ${plain}. It's a "heavy" consonant: pull your tongue back, drop your jaw slightly, and let the vowels around it darken.`,
      };
    }
  }
  if (op.type === "del") {
    if (op.t === "ع") return SOUNDS.ain;
    if (op.t === "ح") return SOUNDS.ha;
    if ("اوي".includes(op.t)) return SOUNDS.long;
  }
  return null;
}

// ---------- Word matching ----------

// Match each target word, in order, to the heard word that fits it best. Recognizers sometimes
// split one word into two, so two neighboring heard words joined together are also tried.
function matchWords(targetWords, heardWords) {
  const results = [];
  let cursor = 0;

  for (const word of targetWords) {
    let best = { similarity: 0, ops: [], used: 0, at: cursor };
    for (let j = cursor; j < Math.min(heardWords.length, cursor + 3); j++) {
      for (const span of [1, 2]) {
        if (j + span > heardWords.length) continue;
        const candidate = heardWords.slice(j, j + span).join("");
        const result = align(word, candidate);
        if (result.similarity > best.similarity) best = { ...result, used: span, at: j };
      }
    }
    if (best.similarity >= 0.4) {
      results.push({ word, ...best, skipped: heardWords.slice(cursor, best.at) });
      cursor = best.at + best.used;
    } else {
      // Too far off to count as a match, but the letter differences can still explain why.
      results.push({ word, similarity: best.similarity, ops: best.similarity >= 0.25 ? best.ops : [], skipped: [] });
    }
  }
  return { results, leftover: heardWords.slice(cursor) };
}

function verdictFor(score) {
  if (score >= 90) return "Excellent, that sounded natural.";
  if (score >= 75) return "Clear and understandable, with small slips.";
  if (score >= 55) return "Understandable, but a few sounds need work.";
  if (score >= 30) return "Several key sounds got lost. Try it slower.";
  return "The recognizer didn't catch this one. Listen again and try it slowly.";
}

function scoreAgainst(phrase, heard, confidence) {
  const targetWords = normalize(phrase.arabic).split(" ");
  const heardWords = normalize(heard).split(" ").filter(Boolean);
  const { results, leftover } = matchWords(targetWords, heardWords);

  const wordScore = results.reduce((sum, r) => sum + r.similarity, 0) / results.length;
  const wholeScore = align(targetWords.join(""), heardWords.join("")).similarity;
  let combined = 0.65 * wordScore + 0.35 * wholeScore;
  // Low recognizer confidence means the words matched but didn't sound clean.
  if (confidence) combined *= 0.85 + 0.15 * confidence;

  return { score: Math.round(combined * 100), results, leftover };
}

export function scoreLocally({ phrase, heard, alternatives = [], confidence = null }) {
  // A matching alternative guess still counts, with a small penalty for not being the top guess.
  let best = scoreAgainst(phrase, heard, confidence);
  for (const alt of alternatives) {
    const scored = scoreAgainst(phrase, alt, confidence);
    scored.score = Math.round(scored.score * 0.9);
    if (scored.score > best.score) best = scored;
  }

  const originalWords = phrase.arabic.replace(/[؟،?!.]/g, "").split(/\s+/).filter(Boolean);
  const translitWords = phrase.transliteration.replace(/[?,!.]/g, "").split(/\s+/);
  const sameLength = translitWords.length === originalWords.length;

  const tips = [];
  const words = best.results.map((r, i) => {
    const found = r.ops.map(diagnose).filter(Boolean);
    for (const f of found) if (!tips.includes(f.tip)) tips.push(f.tip);

    let status = "close";
    if (r.similarity < 0.5) status = "missed";
    else if (r.similarity >= 0.85 && !found.length) status = "good";

    let note = found[0]?.note || "";
    if (!note && status === "missed") note = "not recognized";
    if (!note && status === "close") note = "slightly off";

    return {
      arabic: originalWords[i] || r.word,
      transliteration: sameLength ? translitWords[i] : "",
      status,
      note,
    };
  });

  for (const extra of best.leftover.slice(0, 3)) {
    words.push({ arabic: extra, transliteration: "", status: "extra", note: "extra word" });
  }

  if (words.some((w) => w.status === "missed") && tips.length < 3) {
    tips.push("Some words weren't recognized at all. Slow down and say each syllable clearly. Tap \"Hear it\" first if it's available.");
  }
  if (best.score < 90 && tips.length < 3) {
    tips.push(`For this phrase, focus on: ${phrase.focus}.`);
  }
  if (confidence && confidence < 0.6 && tips.length < 4) {
    tips.push("The recognizer wasn't confident. Speak a little louder and closer to the mic.");
  }

  return {
    score: best.score,
    verdict: verdictFor(best.score),
    words,
    tips: tips.slice(0, 4),
    corrected_arabic: phrase.arabic,
    corrected_transliteration: phrase.transliteration,
  };
}
