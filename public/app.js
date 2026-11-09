import { MODULES } from "./phrases.js";
import { scoreLocally, normalize, phraseSimilarity } from "./scorer.js";
import { findSlang } from "./slang.js";
import { SONGS } from "./songs.js";
import { initQuiz } from "./quiz.js";

const $ = (id) => document.getElementById(id);
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const state = {
  mode: "practice",
  // Where you are in each tab: which module or song, and which phrase or line in it.
  // Free talk has no card, so it keeps the practice position for known translations.
  pos: { practice: { group: 0, item: 0 }, songs: { group: 0, item: 0 } },
  listening: false,
  finalText: "",
  alternatives: [],
  confidences: [],
};

// ---------- Practice modules and songs ----------

const inSongs = () => state.mode === "songs";
const groups = () => (inSongs() ? SONGS : MODULES);
const pos = () => state.pos[inSongs() ? "songs" : "practice"];
const currentGroup = () => groups()[pos().group];
const currentPhrases = () => currentGroup().phrases || currentGroup().lines;
const currentPhrase = () => currentPhrases()[pos().item];

function renderModules() {
  $("modules").setAttribute("aria-label", inSongs() ? "Songs" : "Practice modules");
  $("modules").replaceChildren(
    ...groups().map((group, i) => {
      const button = document.createElement("button");
      button.className = `module${i === pos().group ? " active" : ""}`;
      button.setAttribute("role", "tab");
      button.textContent = `${group.icon} ${group.name}`;
      button.onclick = () => selectModule(i);
      return button;
    }),
  );
}

function selectModule(index) {
  pos().group = index;
  pos().item = 0;
  try {
    localStorage.setItem(inSongs() ? "haki-song" : "haki-module", groups()[index].id);
  } catch {}
  renderModules();
  showPhrase();
}

function showPhrase() {
  const p = currentPhrase();
  const count = currentPhrases().length;
  $("target-ar").textContent = p.arabic;
  $("target-tr").textContent = p.transliteration;
  $("target-en").textContent = p.english;
  $("target-focus").textContent = p.focus;
  $("target-note").textContent = p.note || "";
  $("target-note").hidden = !p.note;
  $("target-count").textContent = inSongs()
    ? `Line ${pos().item + 1} / ${count}`
    : `${currentGroup().name} · ${pos().item + 1} / ${count}`;
  $("song-meta").hidden = !inSongs();
  if (inSongs()) {
    $("song-title").textContent = currentGroup().arabicName;
    $("song-about").textContent = currentGroup().about;
  }
  renderLineDots();
  resetOutput();
}

function goTo(item) {
  const count = currentPhrases().length;
  pos().item = (item + count) % count;
  showPhrase();
}

$("prev").onclick = () => goTo(pos().item - 1);
$("next").onclick = () => goTo(pos().item + 1);

// ---------- Song progress ----------

// Best score for each line of each song, kept between visits: { songId: [score, ...] }.
let songScores = {};
try {
  songScores = JSON.parse(localStorage.getItem("haki-song-scores")) || {};
} catch {}

function saveSongScore(score) {
  const best = (songScores[currentGroup().id] ||= []);
  best[pos().item] = Math.max(best[pos().item] ?? 0, score);
  try {
    localStorage.setItem("haki-song-scores", JSON.stringify(songScores));
  } catch {}
}

// One dot per line, colored by your best score on it. Tap a dot to jump to that line.
function renderLineDots() {
  $("line-dots").hidden = !inSongs();
  if (!inSongs()) return;
  const best = songScores[currentGroup().id] || [];
  $("line-dots").replaceChildren(
    ...currentPhrases().map((_, i) => {
      const dot = document.createElement("button");
      dot.className = `dot${i === pos().item ? " active" : ""}`;
      const score = best[i];
      if (score != null) {
        dot.style.background = scoreColor(score);
        dot.style.borderColor = scoreColor(score);
      }
      dot.title = score != null ? `Line ${i + 1}: best ${score}` : `Line ${i + 1}`;
      dot.setAttribute("aria-label", dot.title);
      dot.onclick = () => goTo(i);
      return dot;
    }),
  );
}

function showSongProgress(score) {
  saveSongScore(score);
  renderLineDots();

  const lines = currentPhrases().length;
  const last = pos().item === lines - 1;
  const sung = (songScores[currentGroup().id] || []).filter((s) => s != null);
  const average = Math.round(sung.reduce((a, b) => a + b, 0) / sung.length);

  $("song-next").hidden = false;
  $("song-summary").textContent = last
    ? `Song finished. ${sung.length} of ${lines} lines sung, average best score ${average}.`
    : "";
  $("next-line").textContent = last ? "Start over ↺" : "Next line ›";
}

$("next-line").onclick = () => goTo(pos().item + 1);

// ---------- "Start speaking" ding ----------

let audioContext = null;

// Must be called from the click itself so the browser allows audio.
function unlockAudio() {
  audioContext ||= new AudioContext();
  audioContext.resume();
}

function ding() {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  for (const [freq, level] of [[880, 0.25], [1760, 0.08]]) {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain).connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.onclick = () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
    if (state.listening) stopListening();
    state.mode = tab.dataset.mode;
    const quiz = state.mode === "quiz";
    $("target-card").hidden = state.mode === "free" || quiz;
    $("quiz-card").hidden = !quiz;
    $("mic-wrap").hidden = quiz;
    $("live-card").hidden = quiz;
    renderModules();
    showPhrase();
  };
});

// ---------- Listen: natural Arabic voice ----------

const player = new Audio();
let playingButton = null;

player.onended = player.onpause = () => playingButton?.classList.remove("playing");

// The server renders speech with a natural neural voice; the browser's own voice is a fallback.
async function speak(text, { slow = false, button = null } = {}) {
  if (!text) return;
  playingButton?.classList.remove("playing");
  playingButton = button;
  button?.classList.add("playing");

  const params = new URLSearchParams({
    text,
    dialect: $("dialect").value,
    gender: $("voice").value,
    slow: slow ? "1" : "0",
  });
  player.src = `/api/speak?${params}`;
  try {
    await player.play();
  } catch {
    button?.classList.remove("playing");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = $("dialect").value;
    utterance.rate = slow ? 0.6 : 0.85;
    speechSynthesis.speak(utterance);
  }
}

const phraseAudioText = () => currentPhrase().say || currentPhrase().arabic;

$("listen").onclick = (e) => speak(phraseAudioText(), { button: e.currentTarget });
$("listen-slow").onclick = (e) => speak(phraseAudioText(), { slow: true, button: e.currentTarget });
$("listen-corrected").onclick = (e) => speak(phraseAudioText(), { button: e.currentTarget });
$("listen-corrected-slow").onclick = (e) => speak(phraseAudioText(), { slow: true, button: e.currentTarget });

try {
  $("voice").value = localStorage.getItem("haki-voice") || "female";
} catch {}
$("voice").onchange = () => {
  try {
    localStorage.setItem("haki-voice", $("voice").value);
  } catch {}
};

// ---------- Speech recognition ----------

let recognition = null;

if (!SpeechRecognition) {
  $("unsupported").hidden = false;
  $("mic").disabled = true;
} else {
  $("mic").onclick = () => (state.listening ? stopListening() : startListening());
}

function startListening() {
  resetOutput();
  unlockAudio();
  recognition = new SpeechRecognition();
  recognition.lang = $("dialect").value;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  // Ding once the mic is actually live, so the cue means "speak now".
  recognition.onstart = () => {
    ding();
    showMicHint("Listening… tap again when you're done");
  };

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        state.finalText += result[0].transcript + " ";
        state.confidences.push(result[0].confidence);
        for (let a = 1; a < result.length; a++) state.alternatives.push(result[a].transcript);
      } else {
        interim += result[0].transcript;
      }
    }
    renderArabic(state.finalText, interim);
    renderSlang(state.finalText + interim);
    scheduleTranslation((state.finalText + interim).trim());
  };

  recognition.onerror = (event) => {
    if (event.error === "not-allowed") showMicHint("Microphone access was blocked. Allow it in the address bar.");
    else if (event.error === "no-speech") showMicHint("Didn't catch anything. Try again a bit louder.");
    else if (event.error === "language-not-supported") showMicHint("This dialect isn't supported by your browser. Try Lebanese or Jordanian.");
    else showMicHint(`Speech error: ${event.error}`);
  };

  // Chrome ends a session after a pause; treat that as the user finishing.
  recognition.onend = () => {
    if (state.listening) finishListening();
  };

  recognition.start();
  state.listening = true;
  $("mic").classList.add("listening");
  $("mic").setAttribute("aria-label", "Stop");
  showMicHint("Get ready…");
}

function stopListening() {
  recognition?.stop(); // onend fires and calls finishListening
}

function finishListening() {
  state.listening = false;
  $("mic").classList.remove("listening");
  $("mic").setAttribute("aria-label", "Start speaking");
  showMicHint("Tap and speak");

  const heard = state.finalText.trim();
  if (!heard) return;
  scheduleTranslation(heard, 0);
  assess(heard);
}

function showMicHint(text) {
  $("mic-hint").textContent = text;
}

function renderArabic(finalText, interim) {
  const el = $("live-ar");
  el.textContent = finalText;
  if (interim) {
    const span = document.createElement("span");
    span.className = "interim";
    span.textContent = interim;
    el.append(span);
  }
}

// ---------- Live translation ----------

let translateTimer = null;
let translateController = null;
let lastTranslated = "";

// Wait for a short pause in speech so we don't send a request for every syllable.
function scheduleTranslation(arabic, delay = 700) {
  clearTimeout(translateTimer);
  translateTimer = setTimeout(() => translate(arabic), delay);
}

// If the speaker said one of the practice phrases, use its hand-written English
// instead of a machine guess. Checks the current phrase first, then every module and song.
function knownTranslation(arabic) {
  const candidates = [
    ...(state.mode !== "free" ? [currentPhrase()] : []),
    ...MODULES.flatMap((m) => m.phrases),
    ...SONGS.flatMap((s) => s.lines),
  ];
  for (const phrase of candidates) {
    if (phraseSimilarity(phrase.arabic, arabic) >= 0.85) return phrase.english;
  }
  return null;
}

function renderSlang(arabic) {
  const hints = findSlang(arabic, normalize);
  $("slang-hints").hidden = !hints.length;
  $("slang-hints").replaceChildren(
    ...hints.map((hint) => {
      const row = document.createElement("div");
      row.className = "slang";
      row.innerHTML = '<span class="slang-ar" lang="ar"></span><span class="slang-en"></span>';
      row.querySelector(".slang-ar").textContent = hint.arabic;
      row.querySelector(".slang-en").textContent = hint.english;
      return row;
    }),
  );
}

async function translate(arabic) {
  if (!arabic || arabic === lastTranslated) return;
  lastTranslated = arabic;
  translateController?.abort();
  const el = $("live-en");

  const known = knownTranslation(arabic);
  if (known) {
    el.textContent = known;
    return;
  }

  translateController = new AbortController();

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arabic, dialect: $("dialect").value }),
      signal: translateController.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      el.textContent = text;
    }
  } catch (error) {
    if (error.name !== "AbortError") el.innerHTML = '<span class="placeholder">Translation unavailable</span>';
  }
}

// ---------- Pronunciation assessment ----------

function assess(heard) {
  $("result").hidden = false;
  $("result-body").hidden = true;
  $("result-note").hidden = true;

  const confidences = state.confidences.filter((c) => c > 0);
  const confidence = confidences.length
    ? +(confidences.reduce((a, b) => a + b, 0) / confidences.length).toFixed(2)
    : null;

  // Scoring compares against a target phrase, so free talk shows the translation only.
  if (state.mode === "free") {
    $("result-note").hidden = false;
    return;
  }
  const assessment = scoreLocally({ phrase: currentPhrase(), heard, alternatives: state.alternatives, confidence });
  renderAssessment({ ...assessment, heard });
  if (inSongs()) showSongProgress(Math.max(0, Math.min(100, assessment.score)));
}

function scoreColor(score) {
  if (score >= 75) return "var(--good)";
  if (score >= 50) return "var(--close)";
  return "var(--missed)";
}

function renderAssessment(data) {
  $("result-body").hidden = false;

  const score = Math.max(0, Math.min(100, data.score));
  $("score").textContent = score;
  const ring = $("ring-fg");
  ring.style.stroke = scoreColor(score);
  requestAnimationFrame(() => (ring.style.strokeDashoffset = 326.7 * (1 - score / 100)));

  $("verdict").textContent = data.verdict;
  $("heard-tr").textContent = data.heard;

  $("words").replaceChildren(
    ...data.words.map((w) => {
      const chip = document.createElement("div");
      chip.className = `word ${w.status}`;
      chip.title = w.note;
      chip.innerHTML = `<span class="ar" lang="ar"></span><span class="tr"></span>${w.note ? '<span class="note"></span>' : ""}`;
      chip.querySelector(".ar").textContent = w.arabic;
      chip.querySelector(".tr").textContent = w.transliteration;
      if (w.note) chip.querySelector(".note").textContent = w.note;
      return chip;
    }),
  );

  $("tips").replaceChildren(
    ...data.tips.map((tip) => {
      const li = document.createElement("li");
      li.textContent = tip;
      return li;
    }),
  );

  $("corrected-ar").textContent = data.corrected_arabic;
  $("corrected-tr").textContent = data.corrected_transliteration;
}

// ---------- Reset ----------

function resetOutput() {
  state.finalText = "";
  state.alternatives = [];
  state.confidences = [];
  lastTranslated = "";
  translateController?.abort();
  $("live-ar").innerHTML = '<span class="placeholder">…</span>';
  $("live-en").innerHTML = '<span class="placeholder">Translation appears here as you speak</span>';
  $("slang-hints").hidden = true;
  $("result").hidden = true;
  $("song-next").hidden = true;
}

try {
  const savedModule = MODULES.findIndex((m) => m.id === localStorage.getItem("haki-module"));
  if (savedModule >= 0) state.pos.practice.group = savedModule;
  const savedSong = SONGS.findIndex((s) => s.id === localStorage.getItem("haki-song"));
  if (savedSong >= 0) state.pos.songs.group = savedSong;
} catch {}

renderModules();
showPhrase();
initQuiz({ speak });
