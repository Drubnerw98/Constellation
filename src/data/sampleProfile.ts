import type {
  TasteProfile,
  LibraryItem,
  RecommendationItem,
} from "../types/profile";

export const sampleProfile: TasteProfile = {
  themes: [
    {
      label: "earned sacrifice through sustained commitment",
      weight: 0.95,
      evidence:
        "Vinland Saga's slow conversion from vengeance to atonement; The Leftovers earning catharsis through endurance, not spectacle.",
    },
    {
      label: "accountability without redemption shortcuts",
      weight: 0.88,
      evidence:
        "Inglourious Basterds refusing comfort for its monsters; Disco Elysium making the protagonist face the wreckage he authored.",
    },
    {
      label: "interior collapse rendered as world-building",
      weight: 0.82,
      evidence:
        "Disco Elysium's psyche-as-cast; The Leftovers turning grief into atmosphere; BoJack's depression as set design.",
    },
    {
      label: "violence with moral residue",
      weight: 0.74,
      evidence:
        "Berserk's costs lingering for years; Vinland Saga's pacifism arc; Basterds' uncomfortable triumphalism.",
    },
    {
      label: "found meaning over inherited meaning",
      weight: 0.7,
      evidence:
        "Disco Elysium's fractured identity rebuilding from choices; Vinland Saga's protagonist abandoning the warrior path.",
    },
    {
      label: "institutions failing the people inside them",
      weight: 0.62,
      evidence:
        "Disco Elysium's Revachol; The Leftovers' Mapleton PD and the GR; Wire-adjacent procedural skepticism.",
    },
  ],
  archetypes: [
    {
      label: "burden-carrying protagonist",
      attraction:
        "characters who survive what they did and have to keep walking",
    },
    {
      label: "broken detective",
      attraction:
        "investigators whose own collapse mirrors the case in front of them",
    },
    {
      label: "reluctant pacifist with violent past",
      attraction:
        "warriors who chose to put down the sword and have to defend that choice every day",
    },
    {
      label: "grieving community",
      attraction:
        "ensembles where everyone is processing the same loss in incompatible ways",
    },
  ],
  narrativePrefs: {
    pacing: "slow-burn",
    complexity: "layered",
    tone: ["melancholic", "earnest", "morally serious", "occasionally absurd"],
    endings: "ambiguous but earned, not bleak for its own sake",
  },
  mediaAffinities: [
    {
      format: "anime",
      comfort: 0.9,
      favorites: ["Vinland Saga", "Berserk (1997)", "Mushishi"],
    },
    {
      format: "tv",
      comfort: 0.95,
      favorites: ["The Leftovers", "BoJack Horseman", "True Detective S1"],
    },
    {
      format: "movie",
      comfort: 0.85,
      favorites: ["Inglourious Basterds", "There Will Be Blood", "Zodiac"],
    },
    {
      format: "game",
      comfort: 0.8,
      favorites: ["Disco Elysium", "Pathologic 2", "Outer Wilds"],
    },
    {
      format: "manga",
      comfort: 0.6,
      favorites: ["Vinland Saga", "Berserk", "Vagabond"],
    },
    {
      format: "book",
      comfort: 0.55,
      favorites: ["Blood Meridian", "Stoner"],
    },
  ],
  avoidances: [
    "generic chosen-one plots",
    "unearned redemption arcs",
    "violence-as-spectacle without consequence",
    "quirky-for-quirky's-sake",
  ],
  dislikedTitles: ["Sword Art Online", "The Walking Dead (post S4)"],
};

export const sampleLibrary: LibraryItem[] = [
  {
    id: "lib-vinland",
    title: "Vinland Saga",
    mediaType: "anime",
    year: 2019,
    rating: 5,
    source: "library",
    status: "consumed",
    fitNote:
      "Thorfinn's vengeance arc collapses into pacifism over 200+ chapters. The cost of every slain enemy compounds; the manga lets the conversion breathe instead of staging it.",
    tasteTags: [
      "earned sacrifice through sustained commitment",
      "violence with moral residue",
      "found meaning over inherited meaning",
      "burden-carrying protagonist",
      "reluctant pacifist with violent past",
    ],
  },
  {
    id: "lib-disco",
    title: "Disco Elysium",
    mediaType: "game",
    year: 2019,
    rating: 5,
    source: "library",
    status: "consumed",
    fitNote:
      "Harry Du Bois investigates a hanging while his consciousness fragments into competing voices. Revachol is a city of failed revolutions — every interior collapse is also a system collapse.",
    tasteTags: [
      "accountability without redemption shortcuts",
      "interior collapse rendered as world-building",
      "found meaning over inherited meaning",
      "institutions failing the people inside them",
      "broken detective",
    ],
  },
  {
    id: "lib-basterds",
    title: "Inglourious Basterds",
    mediaType: "movie",
    year: 2009,
    rating: 5,
    source: "library",
    status: "consumed",
    fitNote:
      "Tarantino refuses comfort for any of his monsters — the Nazi-killers are also enthusiastic killers, and the climax indicts the audience for cheering.",
    tasteTags: [
      "accountability without redemption shortcuts",
      "violence with moral residue",
    ],
  },
  {
    id: "lib-leftovers",
    title: "The Leftovers",
    mediaType: "tv",
    year: 2014,
    rating: 5,
    source: "library",
    status: "consumed",
    fitNote:
      "Three seasons of grief without explanation. Mapleton's institutions fail, the GR fails, but Kevin Garvey keeps walking — catharsis earned through pure endurance.",
    tasteTags: [
      "earned sacrifice through sustained commitment",
      "interior collapse rendered as world-building",
      "institutions failing the people inside them",
      "grieving community",
    ],
  },
  {
    id: "lib-berserk",
    title: "Berserk",
    mediaType: "manga",
    year: 1989,
    rating: 5,
    source: "library",
    status: "consumed",
    fitNote:
      "Guts carries his sword and his grief through 30+ years of pages. Every kill scars him further; the violence never resolves into peace, only into more carrying.",
    tasteTags: ["violence with moral residue", "burden-carrying protagonist"],
  },
  {
    id: "lib-bojack",
    title: "BoJack Horseman",
    mediaType: "tv",
    year: 2014,
    rating: 5,
    source: "library",
    status: "consumed",
    fitNote:
      "A talking horse's depression rendered as set design — the world bends to his self-loathing. Six seasons making him face the wreckage; no redemption shortcut offered.",
    tasteTags: [
      "interior collapse rendered as world-building",
      "accountability without redemption shortcuts",
    ],
  },
  {
    id: "lib-truedet",
    title: "True Detective S1",
    mediaType: "tv",
    year: 2014,
    rating: 5,
    source: "library",
    status: "consumed",
    fitNote:
      "Cohle and Hart investigate a Louisiana cult while their own marriages and minds collapse. The case is the reflection — the Yellow King's rituals are also their rituals.",
    tasteTags: [
      "broken detective",
      "interior collapse rendered as world-building",
      "institutions failing the people inside them",
    ],
  },
  {
    id: "lib-twbb",
    title: "There Will Be Blood",
    mediaType: "movie",
    year: 2007,
    rating: 5,
    source: "library",
    status: "consumed",
    fitNote:
      "Daniel Plainview's oilman ascent is also his soul's descent. The film refuses to let him repent — there is no redemption, only the wreckage he authored.",
    tasteTags: [
      "accountability without redemption shortcuts",
      "violence with moral residue",
    ],
  },
  {
    id: "lib-zodiac",
    title: "Zodiac",
    mediaType: "movie",
    year: 2007,
    rating: 4,
    source: "library",
    status: "consumed",
    fitNote:
      "A killer who's never caught warps three men's lives. Fincher shows the institution — SFPD, the press — failing them as much as the unsolved case does.",
    tasteTags: [
      "broken detective",
      "institutions failing the people inside them",
    ],
  },
  {
    id: "lib-pathologic",
    title: "Pathologic 2",
    mediaType: "game",
    year: 2019,
    rating: 4,
    source: "library",
    status: "consumed",
    fitNote:
      "A 12-day plague survival sim where you fail your patients more often than you save them. The town is grieving, the systems are collapsing, and the game never lies about it.",
    tasteTags: [
      "interior collapse rendered as world-building",
      "earned sacrifice through sustained commitment",
      "grieving community",
    ],
  },
  {
    id: "lib-outerwilds",
    title: "Outer Wilds",
    mediaType: "game",
    year: 2019,
    rating: 5,
    source: "library",
    status: "consumed",
    fitNote:
      "A 22-minute time loop in a doomed solar system. Meaning isn't given by the universe — you assemble it from the logs of a dead civilization.",
    tasteTags: ["found meaning over inherited meaning"],
  },
  {
    id: "lib-mushishi",
    title: "Mushishi",
    mediaType: "anime",
    year: 2005,
    rating: 4,
    source: "library",
    status: "consumed",
    fitNote:
      "A wandering scholar studies spirit-organisms across 1860s Japan. Each episode is a small encounter with something inhuman; the search itself is the meaning.",
    tasteTags: ["found meaning over inherited meaning"],
  },
  {
    id: "lib-vagabond",
    title: "Vagabond",
    mediaType: "manga",
    year: 1998,
    rating: 5,
    source: "library",
    status: "consumed",
    fitNote:
      "Inoue's adaptation of Musashi rejects the warrior ideal one duel at a time. Every fight makes him more tired; eventually he has to put down the sword and farm.",
    tasteTags: [
      "earned sacrifice through sustained commitment",
      "violence with moral residue",
      "found meaning over inherited meaning",
      "reluctant pacifist with violent past",
    ],
  },
  {
    id: "lib-stoner",
    title: "Stoner",
    mediaType: "book",
    year: 1965,
    rating: 5,
    source: "library",
    status: "consumed",
    fitNote:
      "A Missouri farmer's son becomes an English professor and quietly endures every disappointment of a small life. The novel's case for ordinary endurance as a form of heroism.",
    tasteTags: [
      "earned sacrifice through sustained commitment",
      "interior collapse rendered as world-building",
      "burden-carrying protagonist",
    ],
  },
  {
    id: "lib-bloodmeridian",
    title: "Blood Meridian",
    mediaType: "book",
    year: 1985,
    rating: 4,
    source: "library",
    status: "consumed",
    fitNote:
      "McCarthy's Western refuses to romanticize a single one of its scalp-hunters. The Judge is the violence, and the Judge wins. Accountability without any redemption.",
    tasteTags: [
      "violence with moral residue",
      "accountability without redemption shortcuts",
    ],
  },
];

export const sampleRecommendations: RecommendationItem[] = [
  {
    id: "rec-redrising",
    title: "Red Rising",
    mediaType: "book",
    year: 2014,
    matchScore: 0.86,
    tasteTags: [
      "earned sacrifice through sustained commitment",
      "burden-carrying protagonist",
    ],
    status: "saved",
    rating: null,
    explanation:
      "A class-revenge arc that earns every advance through real cost. Darrow's choices compound across seven books, each step pushed back to the constraint you respond to: the price has to be paid in full.",
  },
  {
    id: "rec-pluto",
    title: "Pluto",
    mediaType: "manga",
    year: 2003,
    matchScore: 0.91,
    tasteTags: [
      "violence with moral residue",
      "accountability without redemption shortcuts",
    ],
    status: "plan_to",
    rating: null,
    explanation:
      "Urasawa treats every mechanical death as a moral debit. Pacifist robots inherit the violence they refused, and the manga refuses to let any of them off the hook for surviving.",
  },
  {
    id: "rec-monster",
    title: "Monster",
    mediaType: "anime",
    year: 2004,
    matchScore: 0.93,
    tasteTags: [
      "accountability without redemption shortcuts",
      "broken detective",
    ],
    status: "saved",
    rating: null,
    explanation:
      "Dr. Tenma saves one child whose adult choices destroy thousands. A 74-episode meditation on whether good intent earns absolution when the consequence cascade is total.",
  },
  {
    id: "rec-mindhunter",
    title: "Mindhunter",
    mediaType: "tv",
    year: 2017,
    matchScore: 0.84,
    tasteTags: [
      "broken detective",
      "institutions failing the people inside them",
    ],
    status: "rated",
    rating: 4,
    explanation:
      "Two profilers build a methodology by sitting across the table from killers. The work warps them as fast as it informs them — exactly the slow institutional grind you reach for.",
  },
  {
    id: "rec-killing",
    title: "A Hidden Life",
    mediaType: "movie",
    year: 2019,
    matchScore: 0.87,
    tasteTags: [
      "earned sacrifice through sustained commitment",
      "found meaning over inherited meaning",
    ],
    status: "saved",
    rating: null,
    explanation:
      "A farmer refuses Hitler's oath knowing it costs him everything. Malick stages quiet conviction as the only resistance that matters when the institution is total.",
  },
  {
    id: "rec-kentucky",
    title: "Kentucky Route Zero",
    mediaType: "game",
    year: 2013,
    matchScore: 0.81,
    tasteTags: [
      "interior collapse rendered as world-building",
      "institutions failing the people inside them",
    ],
    status: "plan_to",
    rating: null,
    explanation:
      "Magical realism through hollowed-out Appalachia, where the underground highway is built out of debt and disappearance. The geography itself is the story of the system failing.",
  },
  {
    id: "rec-stalker",
    title: "Stalker",
    mediaType: "movie",
    year: 1979,
    matchScore: 0.78,
    tasteTags: [
      "interior collapse rendered as world-building",
      "found meaning over inherited meaning",
    ],
    status: "saved",
    rating: null,
    explanation:
      "Tarkovsky's pilgrimage into the Zone. Guides sell clients on a wish-granting room they themselves are too ruined by faith to enter. Religious feeling and despair, indistinguishable.",
  },
  {
    id: "rec-roadside",
    title: "Roadside Picnic",
    mediaType: "book",
    year: 1972,
    matchScore: 0.75,
    tasteTags: [
      "institutions failing the people inside them",
      "found meaning over inherited meaning",
    ],
    status: "plan_to",
    rating: null,
    explanation:
      "The novella that became Stalker. Aliens passed through and left debris that warps reality; a black market and a state both fail to contain it. Ambiguity all the way down.",
  },
  {
    id: "rec-wire",
    title: "The Wire",
    mediaType: "tv",
    year: 2002,
    matchScore: 0.92,
    tasteTags: [
      "institutions failing the people inside them",
      "broken detective",
    ],
    status: "saved",
    rating: null,
    explanation:
      "Five seasons, five institutions — police, dock, school, paper, hall — each one failing every individual who tries to act in good faith inside it. The pattern at its most rigorous.",
  },
  {
    id: "rec-killers",
    title: "Killers of the Flower Moon",
    mediaType: "movie",
    year: 2023,
    matchScore: 0.83,
    tasteTags: [
      "accountability without redemption shortcuts",
      "violence with moral residue",
    ],
    status: "saved",
    rating: null,
    explanation:
      "Scorsese uses a marriage as the lens for a systematic genocide. The camera refuses to look away from the slow corruption of love into complicity.",
  },
];
