// Well-known traditional and folk songs, broken into lines to practice one at a time.
// Lines use the same shape as practice phrases, so the scorer grades them the same way.
// `say` is the line fully vowelled the way it's sung, so the voice doesn't guess formal-Arabic
// vowels. ق is written as a glottal stop, and commas mark where a singer takes a breath.
export const SONGS = [
  {
    id: "zarif-al-tul",
    name: "Ya Zarif al-Tul",
    arabicName: "يا ظريف الطول",
    about: "Traditional Palestinian folk song",
    icon: "🎵",
    lines: [
      { arabic: "يا ظريف الطول وقف تقلك", say: "يا ظَرِيف الطُّول، وَئِّف تَأُلَّك", transliteration: "ya ẓarīf iṭ-ṭūl waʾʾif taʾullak", english: "Oh tall and graceful one, stop so I can tell you", focus: "ẓ (ظ), heavy ṭ (ط), ق → glottal stop" },
      { arabic: "رايح عالغربة وبلادك أحسنلك", say: "رايِح عَالغُرْبَة، وِبْلادَك أَحْسَنْلَك", transliteration: "rāyiḥ ʿal-ghurba w-blādak aḥsanlak", english: "You're leaving for abroad, but your homeland is better for you", focus: "ḥ (ح), ʿ (ع), gh (غ)" },
      { arabic: "خايف يا ظريف تروح وتتملك", say: "خايِف يا ظَرِيف، تْرُوح وِتِتْمَلَّك", transliteration: "khāyif ya ẓarīf trūḥ w-titmallak", english: "I'm afraid, graceful one, you'll go and settle there", focus: "kh (خ), ẓ (ظ), doubled ll" },
      { arabic: "وتعاشر الغير وتنساني أنا", say: "وِتْعاشِر الغَير، وِتِنْسانِي أَنا", transliteration: "w-tʿāshir il-ghēr w-tinsāni ana", english: "And spend your days with others and forget me", focus: "ʿ (ع), gh (غ)" },
    ],
  },
  {
    id: "dalona",
    name: "Dal'ona",
    arabicName: "على دلعونا",
    about: "Traditional Levantine dabke song",
    icon: "💃",
    lines: [
      { arabic: "على دلعونا على دلعونا", say: "عَلَى دَلْعُونا، عَلَى دَلْعُونا", transliteration: "ʿala dalʿōna ʿala dalʿōna", english: "Ala dal'ona, ala dal'ona", focus: "ʿ (ع) twice in each word pair", note: "The refrain everyone sings along to at a dabke. Dalʿōna has no fixed meaning." },
      { arabic: "هوا الشمالي غير اللونا", say: "هَوا الشَّمالِي، غَيَّر اللُّونا", transliteration: "hawa sh-shamāli ghayyar il-lōna", english: "The north wind changed the colors", focus: "gh (غ), doubled yy" },
      { arabic: "راحوا الحبايب ما ودعونا", say: "راحُوا الحَبايِب، ما وَدَّعُونا", transliteration: "rāḥu l-ḥabāyib ma waddaʿūna", english: "Our loved ones left without saying goodbye", focus: "ḥ (ح), ʿ (ع), doubled dd" },
    ],
  },
  {
    id: "yamma-mweil",
    name: "Yamma Mweil al-Hawa",
    arabicName: "يما مويل الهوا",
    about: "Traditional Palestinian folk song",
    icon: "🗡️",
    lines: [
      { arabic: "يما مويل الهوا يما مويليا", say: "يَمَّا مْوَيْل الهَوا، يَمَّا مْوَيْلِيَّا", transliteration: "yamma mwēl il-hawa yamma mwēliyya", english: "Oh mother, the little song of love", focus: "doubled mm, long ē", note: "Mwēl is a small mawwāl, a sung lament." },
      { arabic: "ضرب الخناجر ولا حكم النذل فيا", say: "ضَرْب الخَناجِر، وَلا حُكْم النَّدِل فِيَّا", transliteration: "ḍarb il-khanājir wala ḥukm in-nadil fiyya", english: "Better the stab of daggers than a coward ruling over me", focus: "ḍ (ض), kh (خ), ḥ (ح)", note: "A famous line of defiance." },
    ],
  },
  {
    id: "hal-asmar",
    name: "Hal-Asmar il-Lon",
    arabicName: "هالأسمر اللون",
    about: "Traditional Levantine folk song",
    icon: "🌾",
    lines: [
      { arabic: "هالأسمر اللون هالأسمراني", say: "هالأَسْمَر اللُّون، هالأَسْمَرانِي", transliteration: "hal-asmar il-lōn hal-asmarāni", english: "This dark one, this tan one", focus: "rolled r, long ā" },
      { arabic: "تعبان يا قلبي هواه رماني", say: "تَعْبان يا أَلْبِي، هَواه رَمانِي", transliteration: "taʿbān ya ʾalbi hawāh ramāni", english: "My heart is worn out, loving him knocked me down", focus: "ʿ (ع), ق → glottal stop" },
    ],
  },
  {
    id: "zuruni",
    name: "Zuruni",
    arabicName: "زوروني كل سنة مرة",
    about: "Classic by Sayed Darwish, famously sung by Fairuz",
    icon: "🕊️",
    lines: [
      { arabic: "زوروني كل سنة مرة", say: "زُورُونِي كُلّ سَنَة مَرَّة", transliteration: "zūrūni kull sane marra", english: "Visit me once a year", focus: "long ū, doubled ll and rr" },
      { arabic: "حرام تنسوني بالمرة", say: "حَرام تِنْسُونِي بِالمَرَّة", transliteration: "ḥarām tinsūni bil-marra", english: "It would be wrong to forget me completely", focus: "ḥ (ح), doubled rr" },
    ],
  },
];
