import express from "express";
import path from "node:path";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(import.meta.dirname, "public");

const app = express();
app.use(express.json({ limit: "64kb" }));
app.use(express.static(PUBLIC_DIR));

// Vercel serves public/ from its CDN but sends "/" to this server, so serve the page explicitly.
// The process.cwd() path lets Vercel bundle the file; if it's still missing, use the CDN copy.
app.get("/", (req, res) =>
  res.sendFile(path.join(process.cwd(), "public", "index.html"), (error) => {
    if (error) res.redirect("/index.html");
  }),
);

// Natural (neural) voices from Microsoft Edge's read-aloud service. There is no Palestinian
// voice, so Palestinian uses the Jordanian ones, the closest accent available.
const VOICES = {
  "ar-PS": { female: "ar-JO-SanaNeural", male: "ar-JO-TaimNeural" },
  "ar-JO": { female: "ar-JO-SanaNeural", male: "ar-JO-TaimNeural" },
  "ar-LB": { female: "ar-LB-LaylaNeural", male: "ar-LB-RamiNeural" },
  "ar-SY": { female: "ar-SY-AmanyNeural", male: "ar-SY-LaithNeural" },
};

// ---------- Listen: natural Arabic voice ----------

const audioCache = new Map();

async function synthesize(text, voice, rate) {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = await tts.toStream(text, { rate });
    const chunks = [];
    for await (const chunk of audioStream) chunks.push(chunk);
    return Buffer.concat(chunks);
  } finally {
    tts.close();
  }
}

app.get("/api/speak", async (req, res) => {
  const text = String(req.query.text || "").trim().slice(0, 200);
  if (!text) return res.status(400).end();
  const voices = VOICES[req.query.dialect] || VOICES["ar-PS"];
  const voice = req.query.gender === "male" ? voices.male : voices.female;
  const slow = req.query.slow === "1";
  // Song lines are delivered slower than speech, closer to how they're sung.
  const song = req.query.song === "1";
  const rate = song ? (slow ? 0.6 : 0.8) : slow ? 0.7 : 0.95;

  const key = `${voice}|${rate}|${text}`;
  try {
    if (!audioCache.has(key)) audioCache.set(key, await synthesize(text, voice, rate));
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(audioCache.get(key));
  } catch (error) {
    console.error("speak:", error.message);
    res.status(502).end();
  }
});

// ---------- Translation: Google Translate, falling back to MyMemory ----------

const translationCache = new Map();

async function translate(arabic) {
  if (translationCache.has(arabic)) return translationCache.get(arabic);
  let english;
  try {
    english = await translateGoogle(arabic);
  } catch (googleError) {
    console.error("translate (google):", googleError.message);
    try {
      english = await translateMyMemory(arabic);
    } catch (memoryError) {
      throw new Error(`Google: ${googleError.message}; MyMemory: ${memoryError.message}`);
    }
  }
  translationCache.set(arabic, english);
  return english;
}

// Google Translate's free web endpoint (unofficial, no key). Handles colloquial Arabic better than MyMemory.
async function translateGoogle(arabic) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.search = new URLSearchParams({ client: "gtx", sl: "ar", tl: "en", dt: "t", q: arabic });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return data[0].map((segment) => segment[0]).join("");
}

async function translateMyMemory(arabic) {
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", arabic);
  url.searchParams.set("langpair", "ar|en");
  // An email raises MyMemory's free daily limit from ~5,000 to ~50,000 characters.
  if (process.env.MYMEMORY_EMAIL) url.searchParams.set("de", process.env.MYMEMORY_EMAIL);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const status = Number(data.responseStatus);
  if (status !== 200) throw new Error(data.responseDetails || `MyMemory status ${status}`);

  // MyMemory's top pick is sometimes a bad crowd-sourced entry. Trust an exact, rated match;
  // otherwise use its machine translation, which is far more reliable for short phrases.
  const matches = data.matches || [];
  const trusted = matches.find((m) => Number(m.match) === 1 && Number(m.quality) > 0);
  const machine = matches.find((m) => m["created-by"] === "MT!");
  return (trusted || machine)?.translation || data.responseData.translatedText;
}

app.post("/api/translate", async (req, res) => {
  const arabic = String(req.body?.arabic || "").trim().slice(0, 500);
  if (!arabic) return res.status(400).end();

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  try {
    res.end(await translate(arabic));
  } catch (error) {
    console.error("translate:", error.message);
    res.status(502).end(`Translation unavailable (${error.message})`);
  }
});

app.listen(PORT, () => {
  console.log(`Haki is running at http://localhost:${PORT}`);
});
