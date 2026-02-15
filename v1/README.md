# Biopath — A Biochemistry Chain Game

A minimal, addictive browser game built around the Krebs (TCA) cycle. Inspired by Atomas. The player manages a card draw and pre-loading strategy to advance through the cycle's eight intermediates, scoring energy currency (NADH, FADH₂, GTP) with combo multipliers for clean sequential execution.

---

## Concept Summary

- **Board**: The eight TCA intermediates displayed as fixed nodes in a circle, always visible. The ring rotates so the current node is always at the top.
- **Mechanic**: Draw one card per turn. Place it at the current node to advance, or place it ahead to pre-load future steps. Manage your hand under pressure.
- **Score**: Cumulative energy yield — NADH worth most, FADH₂ and GTP less. Consecutive correct advances build a multiplier that decays if you stall.
- **Loop**: The cycle escalates over time. Variance comes from card draw and pre-load risk. Player chases a personal best score measured in rotations survived and energy produced.

---

## File Structure

```
krebs/
├── index.html         # Entry point, game canvas and layout
├── style.css          # Visual design — minimal, dark, scientific aesthetic
├── game.js            # Core game logic
├── data.js            # Biochemical data: nodes, transitions, card definitions
└── README.md
```

---

## Data Model (`data.js`)

Define the cycle as a directed graph of eight nodes. Each node has:

```js
{
  id: "citrate",
  label: "Citrate",
  abbreviation: "CIT",
  next: "isocitrate",
  productCard: "isocitrate",          // card that must be played to advance FROM this node
  cofactorRequired: null,             // cofactor card(s) also required at this step (nullable)
  yield: null,                        // energy produced on successful transition (nullable)
  releasesCO2: false                  // whether this transition releases CO₂ (for UI)
}
```

### Advancement Rule

To advance from node N, the player must play the **product card** — the molecule that the reaction produces. This is consistent across all eight steps. At certain transitions, a **cofactor card** must also be played (on the same node, in a prior or same turn) before the step completes.

### The Eight Nodes

| # | From | To | Product Card | Cofactor Required | Yield | CO₂ Released |
|---|------|----|-------------|-------------------|-------|--------------|
| 1 | Oxaloacetate (OAA) | Citrate (CIT) | Citrate | Acetyl-CoA | — | No |
| 2 | Citrate (CIT) | Isocitrate (ICIT) | Isocitrate | — | — | No |
| 3 | Isocitrate (ICIT) | α-Ketoglutarate (AKG) | α-Ketoglutarate | NAD⁺ | NADH | Yes |
| 4 | α-Ketoglutarate (AKG) | Succinyl-CoA (SCoA) | Succinyl-CoA | NAD⁺, CoA | NADH | Yes |
| 5 | Succinyl-CoA (SCoA) | Succinate (SUC) | Succinate | GDP | GTP | No |
| 6 | Succinate (SUC) | Fumarate (FUM) | Fumarate | FAD | FADH₂ | No |
| 7 | Fumarate (FUM) | Malate (MAL) | Malate | — | — | No |
| 8 | Malate (MAL) | Oxaloacetate (OAA) | Oxaloacetate | NAD⁺ | NADH | No |

**Note:** Step 4 (AKG → SCoA) requires **two** cofactor cards (NAD⁺ and CoA) in addition to the product card. This is the hardest transition in the cycle and the most rewarding to hit cleanly.

### Card Types

- **Product cards**: The eight intermediates. Playing the correct product on the current (or a future) node is the core action.
- **Cofactor cards**: NAD⁺, FAD, CoA, GDP, Acetyl-CoA. Required at specific transitions. Must be placed on the correct node before or during the turn the product card is played.
- **Wild card** (rare): Advances any one step. Preserves combo count but does not increment it. No cofactor requirement.

---

## Game Logic (`game.js`)

### State

```js
state = {
  currentNode: 0,           // index into cycle (0–7)
  hand: [],                  // current cards in hand (max 5, shrinks at higher rotations)
  deck: [],                  // shuffled draw pile
  preloaded: {},             // map of nodeIndex → [cards placed ahead]
  score: 0,
  combo: 0,                  // consecutive correct advances
  stalledTurns: 0,           // turns since last successful advance (see exemptions)
  rotations: 0,              // full cycle completions
  multiplier: 1.0,           // increases with combo, decays on stall
  handLimit: 5,              // current max hand size (decreases with difficulty)
  energyTally: {             // running count by type
    NADH: 0,
    FADH2: 0,
    GTP: 0
  }
}
```

### Core Loop

1. **Draw phase**: If `hand.length < handLimit`, draw 1 card from the deck. If hand is already at the limit, **skip the draw** — no card is drawn this turn. This creates urgency to play or pre-load cards rather than hoarding.
2. **Action phase**: Player does ONE of the following:
   - **Play a card on the current node** — if it's the correct product card (and required cofactors are satisfied), advance the cycle.
   - **Pre-load a card on a future node** — place it ahead. It stays there until the cycle reaches that node. If it's wrong when the cycle arrives, it's discarded (wasted).
   - **Play a cofactor on a node** — satisfies part of a multi-card transition requirement. Does not advance the cycle by itself.
   - **Discard a card** — remove a card from hand. Costs the turn. Resets combo to 0.
3. **Resolution**:
   - **Correct advance**: Add `yield.value × multiplier` to score. Increment combo. Reset `stalledTurns` to 0. Advance `currentNode`. If `currentNode` wraps to 0, increment rotations and apply difficulty escalation.
   - **Failed placement on current node** (wrong card): Card is discarded. Reset combo to 0. Multiplier is **not** instantly reset — it decays naturally via the stall mechanic. This is punishing enough without being catastrophic.
   - **Pre-load**: No immediate score. No combo change. Increment `stalledTurns`.
   - **Cofactor placement on current node**: No immediate score. No combo change. **Does not increment `stalledTurns`** — staging cofactors for the current transition is correct play and should not be penalized. (Cofactors pre-loaded on *future* nodes do increment `stalledTurns`, as these are speculative plays.)
   - **Discard**: No score. Reset combo to 0. Multiplier decays naturally (not instant-reset).
4. **Multiplier decay**: If `stalledTurns >= 2`, reduce multiplier by 0.5× (floor of 1.0×). This penalizes idle play without immediately destroying a run.
5. **Pre-load check**: When advancing to a new node, check `preloaded[nodeIndex]`. If the correct product card is there (and cofactors are satisfied), auto-advance — this counts as a combo step and feels great. Multiple consecutive auto-advances chain.
6. **Repeat from step 1.**

### Hand Overflow Rule

The hand limit begins at 5. If a player starts a turn at the hand limit, the draw is simply skipped. No forced discard, no choice — you just don't draw. This keeps the turn structure clean and creates natural pressure to keep the hand moving. Holding cards is a cost.

### Multi-Card Transitions

Some nodes require cofactor cards in addition to the product card. The cofactor(s) must be present on the node (pre-loaded or played in a prior turn on that node) before the product card completes the advance. The player can stage cofactors across multiple turns.

Example — Step 4 (AKG → Succinyl-CoA):
- Turn N: Play CoA on AKG node (cofactor staged, no stall penalty — it's the current node)
- Turn N+1: Play NAD⁺ on AKG node (cofactor staged, no stall penalty)
- Turn N+2: Play Succinyl-CoA on AKG node → all requirements met → advance

Or, if pre-loaded:
- Earlier turns: Pre-load CoA and NAD⁺ on the AKG node (stall ticks apply — speculative placement)
- When cycle arrives at AKG with Succinyl-CoA in hand → instant advance

### Deck Composition

The deck is built with explicit weights to ensure playability without removing tension.

**Product cards (~40% of deck):**
- Next step's product card: **15%**
- Step +2 product card: **10%**
- Step +3 product card: **8%**
- All other product cards (steps +4 through +7): **7% total**, split evenly. These are pre-load material for future rotations or junk to manage.

**Cofactor cards (~35% of deck):**
- Cofactors needed in the next 3 steps: **25%**, distributed proportionally to demand (NAD⁺ appears more often because it's required at 3 of 8 transitions)
- Other cofactors: **10%**

**Wild cards (~10% of deck):**
- Flat rate. Not weighted by position.

**Junk buffer (~15% of deck):**
- Product cards for distant steps and duplicate cofactors not needed soon. This is the noise floor — forces discard decisions and hand management.

**Deck recycling**: When the deck is exhausted, all previously discarded cards are reshuffled into a new deck. Cards currently in hand or pre-loaded on nodes are NOT included. This means the deck composition shifts over time based on what's been consumed vs. discarded.

**Deck rebuilding on rotation**: After each full rotation, the deck is rebuilt from scratch using the current position as the new reference point for weighting. Previously discarded cards are mixed back in. This prevents the deck from degenerating over long runs.

### Difficulty Escalation

The game escalates over rotations to create a natural difficulty curve and give runs an arc. Without this, sessions plateau and end from boredom rather than challenge.

| Rotation | Change |
|----------|--------|
| 1–3      | Baseline. Hand limit 5. Standard deck weights. |
| 4–5      | Junk buffer increases from 15% → 20%. Slightly harder draws. |
| 6–7      | Hand limit shrinks to 4. Junk buffer at 25%. |
| 8–9      | Wild card rate drops from 10% → 5%. |
| 10+      | Hand limit shrinks to 3. Junk buffer at 30%. Wild cards at 3%. This is survival mode. |

The game does not have a hard game-over state. But at rotation 10+, the compounding pressure of a 3-card hand, scarce wilds, and a noisy deck means runs will naturally terminate when the player can no longer sustain advances. The score screen shows rotations completed, total energy produced, and longest combo.

### Multiplier Thresholds

| Combo | Multiplier |
|-------|------------|
| 0–2   | 1.0×       |
| 3–5   | 1.5×       |
| 6–8   | 2.0×       |
| 9–11  | 2.5×       |
| 12+   | 3.0×       |

**Decay**: Multiplier drops by 0.5× for every 2 consecutive stalled turns (turns without advancing). Floor is 1.0×.

**Wild card**: Preserves current combo count (does not reset), but does not increment it. Multiplier is unaffected.

### Wrong Card Penalty (Revised)

Playing the wrong card on the current node:
- The card is **discarded** (lost).
- Combo resets to **0**.
- Multiplier is **not** instantly reset. It will decay naturally via the stall mechanic if the player can't recover quickly.

Rationale: Losing the card and the combo is already severe. Instant multiplier reset on top makes misclicks or calculated risks excessively punishing, which leads to overly conservative play — the opposite of what makes the game fun. The natural decay provides a recovery window that rewards players who can get back on track quickly.

---

## UI (`index.html` + `style.css`)

### Layout

- **Center**: Circular node display of the 8 intermediates. The ring rotates so the **current node is always at the top**. Completed nodes in the current rotation are subtly marked. Pre-loaded cards are visible on their target nodes as small card icons. Staged cofactors show with a distinct indicator.
- **Between nodes**: Edge labels showing the yield for each transition (e.g., "→ NADH") so the player always sees what's at stake before playing.
- **Bottom**: Hand of up to 5 cards (shrinks at higher rotations). Click to select, click a node to place. A visible "Discard" zone to drag/click unwanted cards.
- **Top right**: Score, combo streak, rotation count, current multiplier, stall counter.
- **Top left**: Running energy tally — total NADH, FADH₂, GTP produced this session.

### Aesthetic Direction

- **Background**: Near-black (#0a0a0f) with a subtle graph-paper grid overlay (like lab notebook paper). Lines in very dark gray or faint green (#1a2a1a).
- **Typography**: Monospace — JetBrains Mono or IBM Plex Mono. Node labels show abbreviations (OAA, CIT, ICIT, AKG, SCoA, SUC, FUM, MAL) at default zoom. Full names appear on hover.
- **Color**: Sparingly applied. One accent color (muted teal or green) for the active node. A distinct flash color (amber/gold) for yield events. Pre-loaded cards shown in a dimmer version of the accent. CO₂ release shown as a brief particle/fade animation.
- **No gradients, no decoration.** The cycle diagram is the visual. Cards are flat rectangles with molecule abbreviations and a thin colored border indicating type (product vs. cofactor vs. wild).

### Interactions

- Click a card in hand to select it (highlight border)
- Click a node to attempt placement
- **Correct advance**: Brief pulse animation on the node, score increment floats up with yield type label, ring rotates to position new current node at top
- **Pre-load**: Card slides to target node and docks as a small icon, subtle confirmation
- **Cofactor staged**: Similar to pre-load — card docks on node with a distinct cofactor indicator
- **Incorrect placement**: Card shakes, fades out (discarded). Combo counter visibly resets. No multiplier flash — it holds.
- **Multiplier increase**: Glow intensifies on active node, multiplier number scales up briefly
- **Multiplier decay**: Glow dims, subtle warning pulse
- **Auto-advance from pre-load**: Chain animation — rapid successive pulses if multiple pre-loaded steps resolve in sequence. This is the payoff moment.
- **CO₂ release**: Small particle animation (dots floating upward and fading) on steps 3 and 4
- **Discard**: Card fades out or slides off-screen
- **Difficulty escalation**: When hand limit shrinks, the hand UI visibly contracts. A brief notification ("Hand limit: 4") appears.

---

## Build Instructions for Agent

1. Start with `data.js` — hardcode all eight nodes with full field definitions (product cards, cofactors, yields, CO₂ flags) and the complete card pool with explicit deck weight percentages before touching game logic.
2. Build and test `game.js` state machine in isolation (no UI) — log state transitions to console. Verify: basic advance, pre-loading, cofactor staging, multi-card transitions (especially step 4), combo/multiplier/decay, deck recycling, wild card behavior, hand overflow (skip draw when full), cofactor stall exemption on current node, wrong-card penalty (combo reset, no multiplier reset).
3. Build static HTML layout with placeholder node positions — confirm circular layout and ring rotation are correct before wiring interactivity.
4. Wire card selection and node click handlers — validate against game logic. Test pre-load placement and cofactor staging visually.
5. Add scoring, combo, multiplier, stall counter, energy tally, and difficulty escalation display.
6. Add CSS animations last — pulse on correct, shake on incorrect, float on score, chain animation on pre-load resolution, CO₂ particles, ring rotation, hand contraction on difficulty change.
7. Test a full 10-rotation session manually. Specifically verify:
   - Pre-loaded cards auto-advance correctly
   - Step 4 (AKG → SCoA) requires all three cards
   - Cofactor placement on current node does NOT increment stall counter
   - Cofactor pre-loaded on future node DOES increment stall counter
   - Wrong card on current node resets combo but NOT multiplier
   - Deck recycling works after exhaustion
   - Deck rebuilds with correct weights after each rotation
   - Multiplier decays after 2 stalled turns
   - Wild card preserves but doesn't increment combo
   - Discard resets combo
   - Hand limit is enforced (draw skipped when full)
   - Difficulty escalation triggers at correct rotation thresholds
   - Hand limit shrinks at rotations 6 and 10
   - Game naturally becomes unsustainable around rotation 10–12

---

## Out of Scope (v1)

- Electron transport chain / proton gradient mechanic
- Glycolysis feeder mechanic
- Inhibitor/poison cards (strong v2 candidate — adds counterplay)
- Multiplayer or leaderboard
- Mobile touch optimization
- Sound
- Undo/replay

These are valid v2 directions but will compromise simplicity if introduced early.