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
    tasteTags: [
      "violence with moral residue",
      "burden-carrying protagonist",
    ],
  },
  {
    id: "lib-bojack",
    title: "BoJack Horseman",
    mediaType: "tv",
    year: 2014,
    rating: 5,
    source: "library",
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
    tasteTags: [
      "found meaning over inherited meaning",
      "interior collapse rendered as world-building",
    ],
  },
  {
    id: "lib-mushishi",
    title: "Mushishi",
    mediaType: "anime",
    year: 2005,
    rating: 4,
    source: "library",
    tasteTags: [
      "found meaning over inherited meaning",
      "interior collapse rendered as world-building",
    ],
  },
  {
    id: "lib-vagabond",
    title: "Vagabond",
    mediaType: "manga",
    year: 1998,
    rating: 5,
    source: "library",
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
  },
];
