// Palestinian slang and colloquial words that machine translators get wrong.
// Each entry lists spellings a speech recognizer might produce; matching uses the scorer's normalize().
export const SLANG = [
  { forms: ["يخرب بيتك", "يخرب بيتها", "يخرب بيته"], english: "no way! / you're too much! (affectionate)" },
  { forms: ["يا زلمة", "يا زلمه", "زلمة"], english: "dude / man" },
  { forms: ["هيني جاي", "هيني"], english: "I'm coming / here I am" },
  { forms: ["شو القصة"], english: "what's going on?" },
  { forms: ["ما بعرفش"], english: "I don't know" },
  { forms: ["عن جد"], english: "seriously?" },
  { forms: ["إمبلا", "امبلى"], english: "yes, of course (answering a negative question)" },
  { forms: ["ولا يهمك"], english: "no worries" },
  { forms: ["تسلم إيدك", "تسلم ايدك", "تسلمي ايدك"], english: "bless your hands (thanks for cooking)" },
  { forms: ["يسلمو", "يسلموا"], english: "thanks!" },
  { forms: ["الله يعطيك العافية"], english: "God give you strength (to someone working)" },
  { forms: ["صحتين"], english: "enjoy your meal" },
  { forms: ["مش فاضي", "مش فاضية"], english: "busy (literally 'not free')" },
  { forms: ["نزللي", "نزلي"], english: "lower the price for me" },
  { forms: ["بتفرج", "عم بتفرج"], english: "just looking / browsing" },
  { forms: ["بوخده", "بوخدو", "بوخدها"], english: "I'll take it" },
  { forms: ["زاكي", "زاكية"], english: "tasty, delicious" },
  { forms: ["إشي", "اشي"], english: "thing / something" },
  { forms: ["ولا إشي", "ولا اشي"], english: "nothing at all" },
  { forms: ["هلأ", "هلق", "هسا", "هسه"], english: "now" },
  { forms: ["عالبلد"], english: "to town / downtown" },
  { forms: ["امبارح", "مبارح"], english: "yesterday" },
  { forms: ["دغري"], english: "straight ahead / directly" },
  { forms: ["زحمة"], english: "traffic / crowded" },
  { forms: ["دكانة", "الدكانة"], english: "corner shop" },
  { forms: ["ستي", "سيدي"], english: "grandma / grandpa" },
  { forms: ["أخوي", "اخوي"], english: "my brother (also 'bro')" },
  { forms: ["حبيبي", "حبيبتي"], english: "my dear / buddy" },
  { forms: ["يا عيني"], english: "aww / my dear" },
  { forms: ["جوعان موت"], english: "starving (literally 'hungry to death')" },
  { forms: ["زهقت", "زهقان", "زهقانة"], english: "bored / fed up" },
  { forms: ["مضايق", "مضايقة"], english: "upset / annoyed" },
  { forms: ["مش مصدق", "مش مصدقة"], english: "I can't believe it" },
  { forms: ["يا حرام"], english: "aw, poor thing" },
  { forms: ["الله يسامحك"], english: "oh, come on (mild scolding)" },
  { forms: ["خلص"], english: "enough / done / okay" },
];

// Find slang in a transcript. Longer expressions win over the single words inside them,
// and entries earlier in the list take priority.
export function findSlang(text, normalize, limit = 4) {
  const words = normalize(text).split(" ").filter(Boolean);
  const used = new Set();
  const found = [];

  const entries = SLANG.map((entry) => ({
    ...entry,
    patterns: entry.forms.map((form) => normalize(form).split(" ")),
  }));
  entries.sort((a, b) => Math.max(...b.patterns.map((p) => p.length)) - Math.max(...a.patterns.map((p) => p.length)));

  for (const entry of entries) {
    for (const [f, pattern] of entry.patterns.entries()) {
      for (let i = 0; i + pattern.length <= words.length; i++) {
        const span = pattern.map((_, k) => i + k);
        if (span.some((k) => used.has(k))) continue;
        if (pattern.every((w, k) => words[i + k] === w)) {
          span.forEach((k) => used.add(k));
          found.push({ arabic: entry.forms[f], english: entry.english, at: i });
        }
      }
    }
  }
  // Show them in the order they were spoken.
  return found.sort((a, b) => a.at - b.at).slice(0, limit);
}
