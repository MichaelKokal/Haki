// Listening quiz: hear a phrase without seeing it, then pick what it means.
import { MODULES } from "./phrases.js";

const $ = (id) => document.getElementById(id);
const CHOICES = 4;

const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Every phrase, tagged with the module it came from so wrong answers can come from the same topic.
const ALL = MODULES.flatMap((m) => m.phrases.map((phrase) => ({ phrase, moduleId: m.id })));

export function initQuiz({ speak }) {
  const quiz = {
    moduleId: "all",
    deck: [], // phrases left to ask before reshuffling, so nothing repeats too soon
    question: null,
    answered: false,
    correct: 0,
    asked: 0,
    streak: 0,
    best: 0,
  };

  try {
    quiz.best = Number(localStorage.getItem("haki-quiz-best")) || 0;
    const saved = localStorage.getItem("haki-quiz-module");
    if (saved === "all" || MODULES.some((m) => m.id === saved)) quiz.moduleId = saved;
  } catch {}

  const pool = () => (quiz.moduleId === "all" ? ALL : ALL.filter((p) => p.moduleId === quiz.moduleId));
  const audioText = () => quiz.question.phrase.say || quiz.question.phrase.arabic;

  function renderModules() {
    const options = [{ id: "all", icon: "🎲", name: "All phrases" }, ...MODULES];
    $("quiz-modules").replaceChildren(
      ...options.map((m) => {
        const button = document.createElement("button");
        button.className = `module${m.id === quiz.moduleId ? " active" : ""}`;
        button.setAttribute("role", "tab");
        button.textContent = `${m.icon} ${m.name}`;
        button.onclick = () => {
          quiz.moduleId = m.id;
          quiz.deck = [];
          try {
            localStorage.setItem("haki-quiz-module", m.id);
          } catch {}
          renderModules();
          nextQuestion({ autoplay: true });
        };
        return button;
      }),
    );
  }

  // Wrong answers: other meanings from the same topic first, then from anywhere, never a duplicate.
  function pickChoices(answer) {
    const used = new Set([answer.phrase.english]);
    const take = (candidates) => {
      const picked = [];
      for (const c of shuffle(candidates)) {
        if (used.has(c.phrase.english)) continue;
        used.add(c.phrase.english);
        picked.push(c.phrase.english);
      }
      return picked;
    };
    const sameTopic = take(ALL.filter((p) => p.moduleId === answer.moduleId));
    const others = take(ALL.filter((p) => p.moduleId !== answer.moduleId));
    const wrong = [...sameTopic, ...others].slice(0, CHOICES - 1);
    return shuffle([answer.phrase.english, ...wrong]);
  }

  function nextQuestion({ autoplay = false } = {}) {
    if (!quiz.deck.length) {
      quiz.deck = shuffle(pool());
      // Don't start a fresh round with the phrase that was just asked.
      if (quiz.deck.length > 1 && quiz.deck[0].phrase === quiz.question?.phrase) quiz.deck.push(quiz.deck.shift());
    }
    quiz.question = quiz.deck.shift();
    quiz.answered = false;

    $("quiz-choices").replaceChildren(
      ...pickChoices(quiz.question).map((english, i) => {
        const button = document.createElement("button");
        button.className = "choice";
        button.dataset.english = english;
        button.innerHTML = '<span class="choice-key"></span><span class="choice-text"></span>';
        button.querySelector(".choice-key").textContent = i + 1;
        button.querySelector(".choice-text").textContent = english;
        button.onclick = () => answer(button);
        return button;
      }),
    );
    $("quiz-reveal").hidden = true;
    $("quiz-next").hidden = true;
    $("quiz-prompt").textContent = "What does it mean?";
    renderScore();
    if (autoplay) speak(audioText(), { button: $("quiz-play") });
  }

  function answer(button) {
    if (quiz.answered) return;
    quiz.answered = true;
    quiz.asked++;

    const right = button.dataset.english === quiz.question.phrase.english;
    if (right) {
      quiz.correct++;
      quiz.streak++;
      if (quiz.streak > quiz.best) {
        quiz.best = quiz.streak;
        try {
          localStorage.setItem("haki-quiz-best", quiz.best);
        } catch {}
      }
    } else {
      quiz.streak = 0;
    }

    for (const choice of $("quiz-choices").children) {
      choice.disabled = true;
      if (choice.dataset.english === quiz.question.phrase.english) choice.classList.add("right");
      else if (choice === button) choice.classList.add("wrong");
    }

    const p = quiz.question.phrase;
    $("quiz-prompt").textContent = right ? "Right!" : "Not quite. Here's what it was:";
    $("quiz-ar").textContent = p.arabic;
    $("quiz-tr").textContent = p.transliteration;
    $("quiz-en").textContent = p.english;
    $("quiz-note").textContent = p.note || "";
    $("quiz-note").hidden = !p.note;
    $("quiz-reveal").hidden = false;
    $("quiz-next").hidden = false;
    $("quiz-next").focus();
    renderScore();
  }

  function renderScore() {
    const parts = [`${quiz.correct} / ${quiz.asked} correct`];
    if (quiz.streak >= 2) parts.push(`🔥 ${quiz.streak} in a row`);
    if (quiz.best) parts.push(`best streak ${quiz.best}`);
    $("quiz-score").textContent = parts.join(" · ");
  }

  $("quiz-play").onclick = (e) => speak(audioText(), { button: e.currentTarget });
  $("quiz-slow").onclick = (e) => speak(audioText(), { slow: true, button: e.currentTarget });
  $("quiz-next").onclick = () => nextQuestion({ autoplay: true });

  // Keys 1–4 answer, Enter goes to the next question.
  document.addEventListener("keydown", (e) => {
    if ($("quiz-card").hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.("select, input, textarea")) return;
    const n = Number(e.key);
    if (!quiz.answered && n >= 1 && n <= CHOICES) {
      $("quiz-choices").children[n - 1]?.click();
    } else if (quiz.answered && e.key === "Enter" && e.target === document.body) {
      nextQuestion({ autoplay: true });
    }
  });

  renderModules();
  nextQuestion();
}
