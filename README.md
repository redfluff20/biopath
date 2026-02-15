# Biopath

**This is the free browser game I wish existed when I was memorizing the Krebs cycle**

---

## What Is This

Biopath is a minimal browser game where you manage a hand of cards to push through the Krebs (TCA) cycle. Eight TCA intermediates sit in a circle on screen. The ring rotates so whatever step you're on is always at the top. You draw cards. You play them in order, over and over, until turn 80, and there's an option to go endless too!

You're using and memorizing the intermediates, cofactors, and energy yields, so after a few rounds, you'll have the cycle down. Oxaloacetate → Citrate → Isocitrate → α-Ketoglutarate → Succinyl-CoA → Succinate → Fumarate → Malate → back to Oxaloacetate.

I had a lot of fun with it.

**Game Rules**

- **Play the right product card on the current node** to advance the cycle. Some steps also need cofactor cards (NAD⁺, FAD, CoA, GDP, or Acetyl-CoA) staged on that node.
- **Pre-load a card on a future node** — Place product or cofactor cards on future nodes to utilize them when you get there.
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

## TL;DR

- Free browser game
- You learn the TCA cycle by playing, not by staring at diagrams
- Intermediates, cofactors, energy yields, CO₂ release points
