# Biopath

**This is the free browser game I wish existed when I was memorizing the Krebs cycle**

---

## What Is This

Biopath is a minimal browser game where you manage a hand of cards to push through the Krebs (TCA) cycle. Eight TCA intermediates sit in a circle on screen. The ring rotates so whatever step you're on is always at the top. You draw cards. You play them in order, over and over, until turn 80, and there's an option to go endless too!

You're using and memorizing the intermediates, cofactors, and energy yields, so after a few rounds, you'll have the cycle down. Oxaloacetate → Citrate → Isocitrate → α-Ketoglutarate → Succinyl-CoA → Succinate → Fumarate → Malate → back to Oxaloacetate.

I had a lot of fun with it.

**Game Rules**

- **Play the right product card on the current node** to advance the cycle. Some steps also need cofactor cards (NAD⁺, FAD, CoA, GDP, or Acetyl-CoA) staged on that node.
- **Pre-load a card on a future node** — Place product or cofactor cards on future nodes to utilize them when you get there. However, note that staging a product card can end your multiplier!
- *Stage a cofactor* on the current node for a multi-card step. This is correct play and doesn't penalize you.
- **Discard** — dump a card you don't need. Costs your turn and kills your combo.

Every correct advance scores energy: NADH (worth the most), FADH₂, or GTP, depending on the step. Consecutive correct moves build a multiplier up to 3×. Stalling lets it decay. Mistakes reset your combo.

That's it. Draw, decide, play.

---

## Why This Actually Teaches You Something

The game encodes the real biochemistry. Here's what you internalize just by playing:

| Step | From → To | What You Need to Play | Energy You Score | CO₂? |
|------|-----------|----------------------|-----------------|------|
| 1 | OAA → Citrate | Citrate + Acetyl-CoA | — | No |
| 2 | Citrate → Isocitrate | Isocitrate | — | No |
| 3 | Isocitrate → α-Ketoglutarate | α-Ketoglutarate + NAD⁺ | NADH | Yes |
| 4 | α-KG → Succinyl-CoA | Succinyl-CoA + NAD⁺ + CoA | NADH | Yes |
| 5 | Succinyl-CoA → Succinate | Succinate + GDP | GTP | No |
| 6 | Succinate → Fumarate | Fumarate + FAD | FADH₂ | No |
| 7 | Fumarate → Malate | Malate | — | No |
| 8 | Malate → OAA | Oxaloacetate + NAD⁺ | NADH | No |

*Step 4:* Three cards required (Succinyl-CoA, NAD⁺, and CoA). It's the hardest transition and the most satisfying to nail. After a few sessions, you'll know without thinking: NAD⁺ shows up at three steps (3, 4, 8). CO₂ comes off at steps 3 and 4. The only FADH₂ is step 6. GTP is step 5.

---

The game can go into endless, but there are some difficulty/balance changes over time.

| Rotations | What Changes |
|-----------|-------------|
| 1–3 | Chill. 5-card hand. Normal draws. |
| 4–5 | More junk cards in the deck. Slightly harder to find what you need. |
| 6–7 | Hand shrinks to 4 cards. Junk keeps climbing. |
| 8–9 | Wild cards (your safety net) get scarce. |
| 10+ | Hand shrinks to 3. Deck is mostly noise. Survival mode. |

---

## Key Mechanics to Know

**Combo & Multiplier:** Consecutive correct advances build your multiplier (up to 3× at 12+ combo). Stalling for 2+ turns decays it. Discarding resets combo to 0. Wrong card resets combo but doesn't nuke your multiplier instantly — you get a recovery window.

**Pre-loading is the skill ceiling.** Placing cards ahead is speculative. Get it right and you trigger chain auto-advances (the best feeling in the game). Get it wrong and you wasted a card and a turn.

**Hand overflow:** If your hand is full, you just don't draw. No forced discard. Holding cards is a cost — you're losing draw opportunities.

**Wild cards:** Advance any step, no cofactor needed. They preserve your combo but don't grow it. They get rare fast.

**Deck recycling:** When the draw pile runs out, discarded cards reshuffle back in. After each full rotation, the deck rebuilds with weights biased toward your current position. The game stays dynamic.

---

## The Vibe

Dark background. Monospace font. Lab-notebook grid lines. Muted teal for the active node, gold flash when you score energy, tiny CO₂ particles floating off steps 3 and 4. No gradients, no decoration, no ads. Just the cycle.

Cards are flat rectangles — molecule abbreviation, thin colored border (product vs. cofactor vs. wild). Click to select, click a node to place. Drag to the discard zone when you need to dump something. The ring rotates smoothly when you advance. Chain auto-advances from pre-loads hit with rapid-fire pulses. It feels good.

---

## TL;DR for the Premed Grind

- Free browser game, no install
- You learn the TCA cycle by playing, not by staring at diagrams
- Intermediates, cofactors, energy yields, CO₂ release points — all encoded in the gameplay
- Gets hard enough to be genuinely engaging, not just "educational game" hard
- Your biochem exam will feel easier. Your high score will feel personal.

Go play it. Then go study everything else.
