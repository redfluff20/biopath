// data.js — Biochemical data for Biopath: TCA Cycle Game

const CYCLE_NODES = [
  {
    id: "oxaloacetate",
    label: "Oxaloacetate",
    abbreviation: "OAA",
    next: "citrate",
    productCard: "citrate",
    cofactorRequired: ["acetyl-coa"],
    yield: null,
    releasesCO2: false
  },
  {
    id: "citrate",
    label: "Citrate",
    abbreviation: "CIT",
    next: "isocitrate",
    productCard: "isocitrate",
    cofactorRequired: null,
    yield: null,
    releasesCO2: false
  },
  {
    id: "isocitrate",
    label: "Isocitrate",
    abbreviation: "ICIT",
    next: "alpha-ketoglutarate",
    productCard: "alpha-ketoglutarate",
    cofactorRequired: ["nad+"],
    yield: { type: "NADH", value: 10 },
    releasesCO2: true
  },
  {
    id: "alpha-ketoglutarate",
    label: "α-Ketoglutarate",
    abbreviation: "AKG",
    next: "succinyl-coa",
    productCard: "succinyl-coa",
    cofactorRequired: ["nad+", "coa"],
    yield: { type: "NADH", value: 10 },
    releasesCO2: true
  },
  {
    id: "succinyl-coa",
    label: "Succinyl-CoA",
    abbreviation: "SCoA",
    next: "succinate",
    productCard: "succinate",
    cofactorRequired: ["gdp"],
    yield: { type: "GTP", value: 5 },
    releasesCO2: false
  },
  {
    id: "succinate",
    label: "Succinate",
    abbreviation: "SUC",
    next: "fumarate",
    productCard: "fumarate",
    cofactorRequired: ["fad"],
    yield: { type: "FADH2", value: 7 },
    releasesCO2: false
  },
  {
    id: "fumarate",
    label: "Fumarate",
    abbreviation: "FUM",
    next: "malate",
    productCard: "malate",
    cofactorRequired: null,
    yield: null,
    releasesCO2: false
  },
  {
    id: "malate",
    label: "Malate",
    abbreviation: "MAL",
    next: "oxaloacetate",
    productCard: "oxaloacetate",
    cofactorRequired: ["nad+"],
    yield: { type: "NADH", value: 10 },
    releasesCO2: false
  }
];

// Card type constants
const CARD_TYPE = {
  PRODUCT: "product",
  COFACTOR: "cofactor"
};

// All unique card definitions
const CARD_DEFINITIONS = {
  // Product cards (the 8 intermediates)
  "citrate":              { id: "citrate",              label: "Citrate",           abbreviation: "CIT",  type: CARD_TYPE.PRODUCT },
  "isocitrate":           { id: "isocitrate",           label: "Isocitrate",        abbreviation: "ICIT", type: CARD_TYPE.PRODUCT },
  "alpha-ketoglutarate":  { id: "alpha-ketoglutarate",  label: "α-Ketoglutarate",   abbreviation: "AKG",  type: CARD_TYPE.PRODUCT },
  "succinyl-coa":         { id: "succinyl-coa",         label: "Succinyl-CoA",      abbreviation: "SCoA", type: CARD_TYPE.PRODUCT },
  "succinate":            { id: "succinate",            label: "Succinate",         abbreviation: "SUC",  type: CARD_TYPE.PRODUCT },
  "fumarate":             { id: "fumarate",             label: "Fumarate",          abbreviation: "FUM",  type: CARD_TYPE.PRODUCT },
  "malate":               { id: "malate",               label: "Malate",            abbreviation: "MAL",  type: CARD_TYPE.PRODUCT },
  "oxaloacetate":         { id: "oxaloacetate",         label: "Oxaloacetate",      abbreviation: "OAA",  type: CARD_TYPE.PRODUCT },

  // Cofactor cards
  "nad+":       { id: "nad+",       label: "NAD⁺",       abbreviation: "NAD⁺",  type: CARD_TYPE.COFACTOR },
  "fad":        { id: "fad",        label: "FAD",         abbreviation: "FAD",   type: CARD_TYPE.COFACTOR },
  "coa":        { id: "coa",        label: "CoA",         abbreviation: "CoA",   type: CARD_TYPE.COFACTOR },
  "gdp":        { id: "gdp",        label: "GDP",         abbreviation: "GDP",   type: CARD_TYPE.COFACTOR },
  "acetyl-coa": { id: "acetyl-coa", label: "Acetyl-CoA",  abbreviation: "AcCoA", type: CARD_TYPE.COFACTOR }
};

// Energy yield display info
const YIELD_INFO = {
  NADH:  { label: "NADH",   color: "#4fc3f7" },
  FADH2: { label: "FADH₂",  color: "#ab47bc" },
  GTP:   { label: "GTP",    color: "#ffd54f" }
};

// Deck weight configuration by difficulty tier
const DECK_WEIGHTS = {
  // Base weights (rotations 1-3) — flatter product distribution, cofactors by demand
  base: {
    productNear:    0.08,   // per-card weight for next 3 products (mild positional bias)
    productFar:     0.04,   // per-card weight for remaining 5 products
    cofactorBase:   0.05,   // per-demand weight for cofactors (NAD+ x3 = 0.15 share)
    junk:           0.08    // noise floor (low)
  },
  // Difficulty escalation thresholds
  escalation: [
    { rotation: 4,  junk: 0.20, handLimit: 5 },
    { rotation: 6,  junk: 0.25, handLimit: 4 },
    { rotation: 8,  junk: 0.25, handLimit: 4 },
    { rotation: 10, junk: 0.30, handLimit: 3 }
  ]
};

// Multiplier thresholds
const MULTIPLIER_THRESHOLDS = [
  { minCombo: 0,  multiplier: 1.0 },
  { minCombo: 3,  multiplier: 1.5 },
  { minCombo: 6,  multiplier: 2.0 },
  { minCombo: 9,  multiplier: 2.5 },
  { minCombo: 12, multiplier: 3.0 }
];

// Deck size
const DECK_SIZE = 60;

// Turn events — random bonuses that appear on certain turns
const TURN_EVENTS = {
  enzyme_boost: {
    id: "enzyme_boost",
    name: "Enzyme Boost",
    description: "Next advance yields 2x points",
    icon: "E"
  },
  cofactor_wave: {
    id: "cofactor_wave",
    name: "Cofactor Wave",
    description: "Draft shows only cofactors",
    icon: "C"
  },
  product_wave: {
    id: "product_wave",
    name: "Product Wave",
    description: "Draft shows only products",
    icon: "P"
  },
  combo_shield: {
    id: "combo_shield",
    name: "Combo Shield",
    description: "Combo protected for 3 turns",
    icon: "S"
  },
  hand_refresh: {
    id: "hand_refresh",
    name: "Hand Refresh",
    description: "Discard hand and redraw 5",
    icon: "R"
  },
  insight: {
    id: "insight",
    name: "Metabolic Insight",
    description: "Peek at top 8 cards in deck",
    icon: "I"
  }
};

const TURN_EVENT_IDS = Object.keys(TURN_EVENTS);
const TURN_EVENT_COUNT = 12; // number of events per 80-turn game
const MAX_TURNS = 80;
