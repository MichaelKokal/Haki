# Haki · حكي

**Practice speaking Palestinian Arabic out loud and get instant feedback.**

Tap the mic and say a phrase. Haki shows your Arabic as you speak, translates it into English live, scores your pronunciation, and tells you exactly which sounds to work on. Tap **Listen** to hear how it should sound in a natural Arabic voice.

*Haki* (حكي) means "talk" or "speech" in Levantine Arabic.

## Features

- **Live speech-to-text:** your Arabic appears word by word as you speak.
- **Live English translation,** with Palestinian slang explained underneath (يخرب بيتك → "no way!", إمبلا → "yes, of course").
- **Pronunciation score (0–100)** with a word-by-word breakdown: green for good, amber for close, red for missed.
- **Targeted tips** for the sounds English speakers struggle with: ح, ع, خ, غ, ص, ط, ض, and ق said as a glottal stop.
- **Listen and Slow playback** in a natural neural voice (woman's or man's), not a robotic one.
- **79 everyday phrases in 9 modules:** Greetings, Slang, Everyday, People, Places, Food & drink, Vacation, School, Shopping.
- **Real spoken dialect, not formal Arabic:** biddi, mish, ma baʿrifsh, hād/hāy, ishi, zāki, hayni jāy…
- **Four dialects:** Palestinian (default), Jordanian, Lebanese, Syrian.
- **Free talk mode** to say anything and see it translated.
- **Completely free:** no accounts or API keys.

## Getting started

You need [Node.js](https://nodejs.org) 22 or newer and **Chrome or Edge**. Firefox and Safari don't support live speech recognition.

```bash
git clone https://github.com/MichaelKokal/Haki.git
cd Haki
npm install
npm start
```

Then open **http://localhost:3000** and allow microphone access when asked.

## How it works

| Piece | How |
|---|---|
| Speech recognition | The browser's built-in Web Speech API, set to the chosen dialect (`ar-PS`, `ar-JO`, `ar-LB`, `ar-SY`). |
| Pronunciation scoring | Runs in the browser ([`scorer.js`](public/scorer.js)). It normalizes spelling variants, aligns what was heard against the target phrase letter by letter with a weighted edit distance, and maps specific swaps (ح→ه, dropped ع, ص→س, ق→ك…) to tips. |
| Translation | Practice phrases use hand-written English. Anything else goes to Google Translate's free endpoint, with MyMemory as a backup. A slang list ([`slang.js`](public/slang.js)) adds explanations that machine translation misses. |
| Voice playback | Microsoft Edge's neural voices via [`msedge-tts`](https://www.npmjs.com/package/msedge-tts). There's no Palestinian voice, so it uses the closest one, Jordanian. Phrases are spelled for the voice the way they're actually said (أهوة for قهوة) so it sounds colloquial. |

## Project structure

```
server.js           Express server: static files, /api/translate, /api/speak
public/
  index.html        Page layout
  app.js            Mic, live transcript, translation, playback, results
  scorer.js         Pronunciation scoring and tips
  phrases.js        Practice modules and phrases
  slang.js          Slang dictionary and matcher
  styles.css        Styles (light and dark mode)
```

## Adding phrases

Add an entry to a module in [`public/phrases.js`](public/phrases.js):

```js
{
  arabic: "بدي قهوة سادة",          // shown on screen and used for scoring
  say: "بدّي أهوة سادة",            // optional: spelling for the voice
  transliteration: "biddi ʾahwe sāda",
  english: "I'd like a black coffee",
  focus: "ق → glottal stop, long ā", // the sounds to listen for
  note: "Sāda = no sugar.",          // optional usage note
}
```

## Limitations

- The score reflects what the speech recognizer understood, not the raw audio. It's a good measure of whether a listener would understand you, but it can't judge fine details like a slightly off vowel.
- Machine translation of free-talk slang can be literal. The slang hints help fill the gap.
- The Google Translate and Edge voice endpoints are free but unofficial, so they could change. Haki falls back to MyMemory and the browser's built-in voice if they fail.
