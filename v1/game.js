// game.js — Core game logic for Biopath

class Game {
  constructor() {
    this.state = null;
    this.onStateChange = null; // callback for UI updates
    this.init();
  }

  init() {
    this.state = {
      currentNode: 0,
      hand: [],
      deck: [],
      discard: [],
      preloaded: {},        // nodeIndex -> [card objects]
      score: 0,
      combo: 0,
      stalledTurns: 0,
      totalTurns: 0,        // total turns played
      rotations: 0,
      multiplier: 1.0,
      handLimit: 5,
      energyTally: { NADH: 0, FADH2: 0, GTP: 0 },
      selectedCardIndex: null,   // single selection for playing on nodes
      draftChoices: [],          // cards shown for draft pick
      draftPhase: false,         // true when waiting for player to pick
      turnEvents: {},            // { turnNumber: eventId }
      activeEvent: null,         // current turn's event object or null
      enzymeBoostActive: false,  // enzyme boost flag
      comboShieldTurns: 0,       // turns remaining with combo protection
      pendingRefresh: false,     // waiting for player to accept/decline hand refresh
      deckPeek: [],              // cards peeked via Metabolic Insight
      peekPhase: false,          // true when showing peek overlay
      endless: false,            // endless mode (no turn limit)
      pendingChainAdvance: false, // chain advance waiting for UI animation
      gameOver: false,
      turnPhase: "draw",    // "draw" | "action" | "resolution"
      lastAction: null,     // for UI feedback
      completedNodes: new Set(), // nodes completed this rotation
      chainCount: 0, // for tracking chain auto-advances
    };
    this._buildDeck();
    this._shuffleDeck();
    // Initialize preloaded map for all nodes
    for (let i = 0; i < 8; i++) {
      this.state.preloaded[i] = [];
    }
    // Schedule turn events
    this._scheduleTurnEvents();
    // Draw initial hand
    for (let i = 0; i < this.state.handLimit; i++) {
      this._drawCard();
    }
    this.state.turnPhase = "action";
    this._notify();
  }

  // --- Deck Building ---

  _buildDeck() {
    const s = this.state;
    const currentIdx = s.currentNode;
    const deck = [];

    const diff = this._getDifficultySettings();
    const junkRate = diff.junk;
    const totalCards = DECK_SIZE;

    // --- Inventory awareness ---
    const inventory = {};
    for (const card of s.hand) {
      inventory[card.id] = (inventory[card.id] || 0) + 1;
    }
    for (let i = 0; i < 8; i++) {
      for (const card of (s.preloaded[i] || [])) {
        inventory[card.id] = (inventory[card.id] || 0) + 1;
      }
    }

    // Count cycle demand per card (cofactors by how many nodes need them, products = 1 each)
    const cycleDemand = {};
    for (const node of CYCLE_NODES) {
      cycleDemand[node.productCard] = 1;
      if (node.cofactorRequired) {
        for (const cf of node.cofactorRequired) {
          cycleDemand[cf] = (cycleDemand[cf] || 0) + 1;
        }
      }
    }

    // Saturation multiplier
    const _satMult = (cardId) => {
      const held = inventory[cardId] || 0;
      if (held === 0) return 1.0;
      const demand = cycleDemand[cardId] || 1;
      const saturation = held / demand;
      return Math.max(0.15, 1.0 - saturation * 0.65);
    };

    const _addCards = (cardId, baseCount) => {
      const count = Math.max(1, Math.round(baseCount * _satMult(cardId)));
      for (let i = 0; i < count; i++) {
        deck.push(this._makeCard(cardId));
      }
    };

    // --- Products: flat distribution with mild positional bias ---
    // Near products (next 3 steps) get slightly more, far products still appear
    for (let offset = 0; offset < 8; offset++) {
      const idx = (currentIdx + offset) % 8;
      const productId = CYCLE_NODES[idx].productCard;
      const isNear = offset < 3;
      const weight = isNear
        ? DECK_WEIGHTS.base.productNear
        : DECK_WEIGHTS.base.productFar;
      _addCards(productId, Math.round(totalCards * weight));
    }

    // --- Cofactors: proportional to cycle demand ---
    // NAD+ needed 3x gets 3 shares, FAD/CoA/GDP/Acetyl-CoA get 1 share each
    // Total demand units: 3 + 1 + 1 + 1 + 1 = 7
    const allCofactors = ["nad+", "fad", "coa", "gdp", "acetyl-coa"];
    const totalDemand = allCofactors.reduce((sum, cf) => sum + (cycleDemand[cf] || 1), 0);
    const cofactorBudget = totalCards - Math.round(totalCards * junkRate)
      - 8 * Math.round(totalCards * DECK_WEIGHTS.base.productFar)  // approximate product slots
      - 3 * Math.round(totalCards * (DECK_WEIGHTS.base.productNear - DECK_WEIGHTS.base.productFar));

    for (const cf of allCofactors) {
      const demand = cycleDemand[cf] || 1;
      const share = demand / totalDemand;
      _addCards(cf, Math.max(1, Math.round(cofactorBudget * share)));
    }

    // --- Junk buffer ---
    const junkCount = Math.round(totalCards * junkRate);
    for (let i = 0; i < junkCount; i++) {
      const distantOffset = 4 + Math.floor(Math.random() * 4);
      const distantIdx = (currentIdx + distantOffset) % 8;
      if (Math.random() < 0.5) {
        deck.push(this._makeCard(CYCLE_NODES[distantIdx].productCard));
      } else {
        const randCofactor = allCofactors[Math.floor(Math.random() * allCofactors.length)];
        deck.push(this._makeCard(randCofactor));
      }
    }

    this.state.deck = deck;
  }

  _makeCard(cardId) {
    const def = CARD_DEFINITIONS[cardId];
    return {
      id: cardId,
      uid: Math.random().toString(36).substr(2, 9), // unique instance id
      label: def.label,
      abbreviation: def.abbreviation,
      type: def.type
    };
  }

  _shuffleDeck() {
    const deck = this.state.deck;
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

  _recycleDeck() {
    // Reshuffle discard pile into deck
    this.state.deck = [...this.state.discard];
    this.state.discard = [];
    this._shuffleDeck();
  }

  _drawCard() {
    if (this.state.deck.length === 0) {
      if (this.state.discard.length === 0) return; // no cards anywhere
      this._recycleDeck();
    }
    if (this.state.deck.length === 0) return;

    // Inventory-aware draw: if the top card is something we're saturated on,
    // try to find a better card deeper in the deck (up to 5 cards deep).
    const s = this.state;
    const inventory = {};
    for (const c of s.hand) inventory[c.id] = (inventory[c.id] || 0) + 1;
    for (let i = 0; i < 8; i++) {
      for (const c of (s.preloaded[i] || [])) inventory[c.id] = (inventory[c.id] || 0) + 1;
    }

    // Count cycle demand for the card
    const _demand = (cardId) => {
      let d = 0;
      for (const node of CYCLE_NODES) {
        if (node.productCard === cardId) d++;
        if (node.cofactorRequired && node.cofactorRequired.includes(cardId)) {
          d += node.cofactorRequired.filter(c => c === cardId).length;
        }
      }
      return Math.max(d, 1);
    };

    // Look at top few cards and pick the least-saturated one
    const searchDepth = Math.min(5, s.deck.length);
    let bestIdx = s.deck.length - 1; // default: top of deck
    let bestScore = Infinity;

    for (let i = s.deck.length - 1; i >= s.deck.length - searchDepth; i--) {
      const card = s.deck[i];
      const held = inventory[card.id] || 0;
      const demand = _demand(card.id);
      const saturation = held / demand;
      if (saturation < bestScore) {
        bestScore = saturation;
        bestIdx = i;
      }
    }

    // Pull the chosen card from the deck
    const [drawn] = s.deck.splice(bestIdx, 1);
    s.hand.push(drawn);
  }

  // --- Difficulty ---

  _getDifficultySettings() {
    const rot = this.state.rotations;
    let settings = {
      junk: DECK_WEIGHTS.base.junk,
      handLimit: 5
    };
    for (const tier of DECK_WEIGHTS.escalation) {
      if (rot >= tier.rotation) {
        settings = { junk: tier.junk, handLimit: tier.handLimit };
      }
    }
    return settings;
  }

  // --- Multiplier ---

  _getMultiplier(combo) {
    let mult = 1.0;
    for (const t of MULTIPLIER_THRESHOLDS) {
      if (combo >= t.minCombo) mult = t.multiplier;
    }
    return mult;
  }

  _updateMultiplier() {
    this.state.multiplier = this._getMultiplier(this.state.combo);
  }

  // --- Turn Flow ---

  startTurn() {
    const s = this.state;
    if (s.gameOver) return;

    s.totalTurns++;
    s.selectedCardIndex = null;
    s.activeEvent = null;

    // Decrement combo shield
    if (s.comboShieldTurns > 0) s.comboShieldTurns--;

    // In endless mode, schedule more events if we're running out
    if (s.endless) {
      const maxScheduled = Math.max(...Object.keys(s.turnEvents).map(Number), 0);
      if (s.totalTurns >= maxScheduled - 5) {
        this._scheduleEndlessEvents();
      }
    }

    // Check for turn event
    const eventId = s.turnEvents[s.totalTurns];
    if (eventId) {
      this._applyEvent(eventId);
      // Hand refresh and insight interrupt the normal flow
      if (eventId === "hand_refresh") {
        // Wait for player to accept/decline — don't start draft yet
        this._notify();
        return;
      }
      if (eventId === "insight") {
        // Show peek first, then player dismisses into draft
        this._notify();
        return;
      }
    }

    // Draft phase: show 4 cards, player picks 1
    this._startDraft();

    // If draft couldn't start (hand full or no cards), go straight to action
    if (!s.draftPhase) {
      s.turnPhase = "action";
    }
    this._notify();
  }

  selectCard(handIndex) {
    if (this.state.turnPhase !== "action") return;
    if (handIndex < 0 || handIndex >= this.state.hand.length) return;
    this.state.selectedCardIndex = handIndex;
    this._notify();
  }

  deselectCard() {
    this.state.selectedCardIndex = null;
    this._notify();
  }

  // --- Draft Draw ---

  _startDraft() {
    const s = this.state;
    if (s.hand.length >= s.handLimit) {
      // At hand limit, skip draft
      s.draftPhase = false;
      s.draftChoices = [];
      return;
    }
    if (s.deck.length === 0 && s.discard.length > 0) {
      this._recycleDeck();
    }
    if (s.deck.length === 0) {
      s.draftPhase = false;
      s.draftChoices = [];
      return;
    }

    // Check for wave events — override draft with specific card types
    const waveEvent = s.activeEvent && (s.activeEvent.id === "cofactor_wave" || s.activeEvent.id === "product_wave");
    if (waveEvent) {
      const targetType = s.activeEvent.id === "cofactor_wave" ? CARD_TYPE.COFACTOR : CARD_TYPE.PRODUCT;
      const choices = [];
      const allIds = Object.keys(CARD_DEFINITIONS).filter(id => CARD_DEFINITIONS[id].type === targetType);
      for (let i = 0; i < 4; i++) {
        const cardId = allIds[Math.floor(Math.random() * allIds.length)];
        choices.push(this._makeCard(cardId));
      }
      s.draftChoices = choices;
      s.draftPhase = true;
      this._notify();
      return;
    }

    // Pull 4 cards from top of deck (or fewer if not enough)
    const choices = [];
    const count = Math.min(4, s.deck.length);
    for (let i = 0; i < count; i++) {
      choices.push(s.deck.pop());
    }
    s.draftChoices = choices;
    s.draftPhase = true;
    this._notify();
  }

  pickDraftCard(choiceIndex) {
    const s = this.state;
    if (!s.draftPhase || choiceIndex < 0 || choiceIndex >= s.draftChoices.length) return null;

    const picked = s.draftChoices[choiceIndex];
    s.hand.push(picked);

    // For wave events, cards are fabricated — don't put them back in deck
    const isWave = s.activeEvent && (s.activeEvent.id === "cofactor_wave" || s.activeEvent.id === "product_wave");
    if (!isWave) {
      // Put the other card(s) at the bottom of the deck
      for (let i = 0; i < s.draftChoices.length; i++) {
        if (i !== choiceIndex) {
          s.deck.unshift(s.draftChoices[i]); // bottom of deck
        }
      }
    }

    s.draftChoices = [];
    s.draftPhase = false;
    s.turnPhase = "action";

    const result = { type: "draft_pick", card: picked };
    s.lastAction = result;
    this._notify();
    return result;
  }

  // --- Turn Events ---

  _scheduleTurnEvents() {
    const events = {};
    // Pick TURN_EVENT_COUNT unique turns from range [4, MAX_TURNS - 2]
    const available = [];
    for (let t = 4; t <= MAX_TURNS - 2; t++) available.push(t);
    // Shuffle and pick
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    const chosen = available.slice(0, TURN_EVENT_COUNT).sort((a, b) => a - b);
    for (const turn of chosen) {
      const eventId = TURN_EVENT_IDS[Math.floor(Math.random() * TURN_EVENT_IDS.length)];
      events[turn] = eventId;
    }
    this.state.turnEvents = events;
  }

  // Enter endless mode — schedule more events and continue
  enterEndless() {
    const s = this.state;
    s.endless = true;
    s.gameOver = false;
    // Schedule additional events for turns beyond MAX_TURNS
    this._scheduleEndlessEvents();
    this._notify();
  }

  _scheduleEndlessEvents() {
    const s = this.state;
    // Add ~8 events per 40-turn block, starting from current turn
    const startTurn = s.totalTurns + 2;
    const endTurn = startTurn + 40;
    const available = [];
    for (let t = startTurn; t <= endTurn; t++) {
      if (!s.turnEvents[t]) available.push(t);
    }
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    const count = Math.min(8, available.length);
    const chosen = available.slice(0, count);
    for (const turn of chosen) {
      s.turnEvents[turn] = TURN_EVENT_IDS[Math.floor(Math.random() * TURN_EVENT_IDS.length)];
    }
  }

  _applyEvent(eventId) {
    const s = this.state;
    s.activeEvent = TURN_EVENTS[eventId];

    switch (eventId) {
      case "enzyme_boost":
        s.enzymeBoostActive = true;
        break;
      case "combo_shield":
        s.comboShieldTurns = 3;
        break;
      case "hand_refresh":
        s.pendingRefresh = true;
        break;
      case "insight":
        // Peek at top 8 cards
        s.deckPeek = s.deck.slice(-Math.min(8, s.deck.length)).reverse();
        s.peekPhase = true;
        break;
      // cofactor_wave and product_wave are handled in _startDraft
    }
  }

  acceptRefresh() {
    const s = this.state;
    if (!s.pendingRefresh) return null;
    // Discard entire hand
    for (const card of s.hand) {
      s.discard.push(card);
    }
    s.hand = [];
    s.pendingRefresh = false;
    // Draw 5 fresh cards
    for (let i = 0; i < 5; i++) {
      this._drawCard();
    }
    s.turnPhase = "action";
    s.draftPhase = false;
    s.draftChoices = [];
    const result = { type: "hand_refresh" };
    s.lastAction = result;
    this._notify();
    return result;
  }

  declineRefresh() {
    const s = this.state;
    if (!s.pendingRefresh) return;
    s.pendingRefresh = false;
    // Proceed to normal draft
    this._startDraft();
    if (!s.draftPhase) {
      s.turnPhase = "action";
    }
    this._notify();
  }

  dismissPeek() {
    const s = this.state;
    s.deckPeek = [];
    s.peekPhase = false;
    // Proceed to draft
    this._startDraft();
    if (!s.draftPhase) {
      s.turnPhase = "action";
    }
    this._notify();
  }

  // Discard selected card to end the turn
  discardCard() {
    const s = this.state;
    if (s.turnPhase !== "action" || s.selectedCardIndex === null) return null;

    const card = s.hand.splice(s.selectedCardIndex, 1)[0];
    s.discard.push(card);
    s.selectedCardIndex = null;

    // Discarding counts as a stall
    s.stalledTurns++;
    if (s.stalledTurns >= 2 && s.comboShieldTurns <= 0) {
      s.multiplier = Math.max(1.0, s.multiplier - 0.5);
      s.stalledTurns = 0;
    } else if (s.stalledTurns >= 2) {
      s.stalledTurns = 0;
    }

    const result = { type: "discard", card };
    s.lastAction = result;
    s.turnPhase = "draw";

    // Game-over checks
    if (s.hand.length === 0 && s.deck.length === 0 && s.discard.length === 0) {
      s.gameOver = true;
    }
    if (s.totalTurns >= MAX_TURNS && !s.endless) {
      s.gameOver = true;
    }

    this._notify();
    return result;
  }

  // Play selected card on a node
  playCardOnNode(nodeIndex) {
    const s = this.state;
    if (s.turnPhase !== "action" || s.selectedCardIndex === null) return null;
    if (nodeIndex < 0 || nodeIndex >= 8) return null;

    const card = s.hand[s.selectedCardIndex];
    const isCurrentNode = nodeIndex === s.currentNode;

    let result;

    if (card.type === CARD_TYPE.COFACTOR) {
      result = this._playCofactor(nodeIndex, card, isCurrentNode);
    } else if (card.type === CARD_TYPE.PRODUCT) {
      if (isCurrentNode) {
        result = this._playProductOnCurrent(card);
      } else {
        result = this._preloadCard(nodeIndex, card);
      }
    }

    if (result) {
      // Rejected placements don't consume the card
      if (result.type === "rejected") {
        s.selectedCardIndex = null;
        s.lastAction = result;
        this._notify();
        return result;
      }

      // Remove card from hand
      s.hand.splice(s.selectedCardIndex, 1);
      s.selectedCardIndex = null;
      s.lastAction = result;

      // Resolution phase
      this._resolve(result);
      this._notify();
    }

    return result;
  }


  // --- Card Play Logic ---

  _playProductOnCurrent(card) {
    const s = this.state;
    const node = CYCLE_NODES[s.currentNode];

    // Check if this is the correct product card
    if (card.id === node.productCard) {
      // Check if a product is already staged on this node
      const alreadyHasProduct = (s.preloaded[s.currentNode] || []).some(c => c.type === CARD_TYPE.PRODUCT);
      if (alreadyHasProduct) {
        return { type: "rejected", card, nodeIndex: s.currentNode, reason: `${node.abbreviation} already has a product card` };
      }
      // Check cofactor requirements
      if (this._cofactorsSatisfied(s.currentNode)) {
        return { type: "advance", card, nodeIndex: s.currentNode };
      } else {
        // Correct product but cofactors not yet met — stage it on the node
        if (!s.preloaded[s.currentNode]) s.preloaded[s.currentNode] = [];
        s.preloaded[s.currentNode].push(card);
        return { type: "stage_product", card, nodeIndex: s.currentNode };
      }
    } else {
      // Wrong card on current node
      return { type: "wrong", card, nodeIndex: s.currentNode };
    }
  }

  _playCofactor(nodeIndex, card, isCurrentNode) {
    const s = this.state;
    // Validate: only allow cofactors that this node actually needs
    const node = CYCLE_NODES[nodeIndex];
    const isNeeded = node.cofactorRequired && node.cofactorRequired.includes(card.id);
    if (!isNeeded) {
      // Build a helpful message showing what this node needs
      let needStr = 'nothing';
      if (node.cofactorRequired) {
        needStr = node.cofactorRequired.map(c => CARD_DEFINITIONS[c].abbreviation).join(', ');
      }
      return { type: "rejected", card, nodeIndex, reason: `${node.abbreviation} needs ${needStr}` };
    }

    // Check if this cofactor is already satisfied (don't allow duplicates beyond what's needed)
    const placedOfType = (s.preloaded[nodeIndex] || []).filter(c => c.id === card.id).length;
    const requiredCount = node.cofactorRequired.filter(c => c === card.id).length;
    if (placedOfType >= requiredCount) {
      return { type: "rejected", card, nodeIndex, reason: `${node.abbreviation} already has ${card.abbreviation}` };
    }

    // Place cofactor on node
    if (!s.preloaded[nodeIndex]) s.preloaded[nodeIndex] = [];
    s.preloaded[nodeIndex].push(card);

    if (isCurrentNode) {
      // Cofactor on current node: check if this completes the transition
      if (this._checkAutoAdvance(nodeIndex)) {
        return { type: "advance_from_cofactor", card, nodeIndex };
      }
      return { type: "cofactor_staged", card, nodeIndex, isCurrentNode: true };
    } else {
      // Pre-loading cofactor on future node
      return { type: "cofactor_preloaded", card, nodeIndex, isCurrentNode: false };
    }
  }

  _preloadCard(nodeIndex, card) {
    const s = this.state;
    const node = CYCLE_NODES[nodeIndex];

    // Validate: only allow pre-loading the correct product card for this node
    if (card.id !== node.productCard) {
      return { type: "rejected", card, nodeIndex, reason: `${node.abbreviation} needs ${CARD_DEFINITIONS[node.productCard].abbreviation}` };
    }

    // Prevent stacking multiple product cards on a node
    if (!s.preloaded[nodeIndex]) s.preloaded[nodeIndex] = [];
    const alreadyHasProduct = s.preloaded[nodeIndex].some(c => c.type === CARD_TYPE.PRODUCT);
    if (alreadyHasProduct) {
      return { type: "rejected", card, nodeIndex, reason: `${node.abbreviation} already has a product card` };
    }

    s.preloaded[nodeIndex].push(card);
    return { type: "preload", card, nodeIndex };
  }

  _cofactorsSatisfied(nodeIndex) {
    const node = CYCLE_NODES[nodeIndex];
    if (!node.cofactorRequired) return true;

    const placed = (this.state.preloaded[nodeIndex] || [])
      .filter(c => c.type === CARD_TYPE.COFACTOR)
      .map(c => c.id);

    for (const required of node.cofactorRequired) {
      const idx = placed.indexOf(required);
      if (idx === -1) return false;
      placed.splice(idx, 1); // consume it
    }
    return true;
  }

  _hasProductStaged(nodeIndex) {
    const node = CYCLE_NODES[nodeIndex];
    const placed = this.state.preloaded[nodeIndex] || [];
    return placed.some(c => c.id === node.productCard);
  }

  _checkAutoAdvance(nodeIndex) {
    return this._cofactorsSatisfied(nodeIndex) && this._hasProductStaged(nodeIndex);
  }

  // --- Resolution ---

  _resolve(result) {
    const s = this.state;

    switch (result.type) {
      case "advance":
      case "advance_from_cofactor":
        this._doAdvance(result.nodeIndex);
        break;

      case "wrong":
        s.discard.push(result.card);
        if (s.comboShieldTurns <= 0) {
          s.combo = 0;
        }
        break;

      case "stage_product":
        // Product staged on current node waiting for cofactors — no stall (current node)
        break;

      case "cofactor_staged":
        // Cofactor on current node — no stall penalty
        break;

      case "cofactor_preloaded":
        // Cofactor on future node — stall ticks
        s.stalledTurns++;
        break;

      case "preload":
        s.stalledTurns++;
        break;

    }

    // Multiplier decay: if stalledTurns >= 2, reduce multiplier by 0.5 (unless shielded)
    if (s.stalledTurns >= 2 && s.comboShieldTurns <= 0) {
      s.multiplier = Math.max(1.0, s.multiplier - 0.5);
      s.stalledTurns = 0; // reset stall counter after decay
    } else if (s.stalledTurns >= 2) {
      s.stalledTurns = 0; // reset counter but don't decay
    }

    // After an advance, set multiplier from combo (may increase it)
    if (result.type === 'advance' || result.type === 'advance_from_cofactor') {
      this._updateMultiplier();
    }

    // --- Game-over conditions ---
    // 1. No cards anywhere
    if (s.hand.length === 0 && s.deck.length === 0 && s.discard.length === 0) {
      s.gameOver = true;
    }
    // 2. Hard turn limit — unless endless mode
    if (s.totalTurns >= MAX_TURNS && !s.endless) {
      s.gameOver = true;
    }

    s.turnPhase = "draw"; // ready for next turn
  }

  _doAdvance(nodeIndex) {
    const s = this.state;
    const node = CYCLE_NODES[nodeIndex];

    // Score yield
    if (node.yield) {
      const boostMult = s.enzymeBoostActive ? 2 : 1;
      const points = Math.round(node.yield.value * s.multiplier * boostMult);
      if (s.enzymeBoostActive) s.enzymeBoostActive = false;
      s.score += points;
      s.energyTally[node.yield.type] = (s.energyTally[node.yield.type] || 0) + 1;
      s.lastAction.yield = { type: node.yield.type, points };
    }

    // Update combo
    s.combo++;
    s.stalledTurns = 0;
    this._updateMultiplier();

    // Mark node as completed this rotation
    s.completedNodes.add(nodeIndex);

    // Clear preloaded cards on this node (consumed by transition)
    s.preloaded[nodeIndex] = [];

    // Advance to next node
    const nextIdx = (nodeIndex + 1) % 8;
    s.currentNode = nextIdx;

    // Check for rotation completion
    if (nextIdx === 0) {
      this._onRotationComplete();
    }

    // Check for chain auto-advances from preloaded cards
    this._checkChainAdvance();
  }

  _checkChainAdvance() {
    const s = this.state;
    const nodeIdx = s.currentNode;
    const preloaded = s.preloaded[nodeIdx] || [];

    if (preloaded.length === 0) return;

    // Check if correct product + cofactors are preloaded
    const node = CYCLE_NODES[nodeIdx];
    const hasProduct = preloaded.some(c => c.id === node.productCard);

    if (hasProduct && this._cofactorsSatisfied(nodeIdx)) {
      // Don't execute immediately — flag it for the UI to animate
      s.pendingChainAdvance = true;
      return;
    }

    // Discard wrong product cards that were preloaded on this node
    const currentPreloaded = s.preloaded[nodeIdx] || [];
    const wrongCards = currentPreloaded.filter(c =>
      c.type === CARD_TYPE.PRODUCT && c.id !== node.productCard
    );
    for (const wc of wrongCards) {
      s.discard.push(wc);
    }
    s.preloaded[nodeIdx] = currentPreloaded.filter(c =>
      !(c.type === CARD_TYPE.PRODUCT && c.id !== node.productCard)
    );
  }

  // Execute one chain advance step (called by UI with delay between steps)
  executeChainStep() {
    const s = this.state;
    if (!s.pendingChainAdvance) return null;

    s.pendingChainAdvance = false;
    const nodeIdx = s.currentNode;
    s.lastAction = { type: "chain_advance", nodeIndex: nodeIdx };
    this._doAdvance(nodeIdx);
    // _doAdvance may set pendingChainAdvance again if another chain is ready
    this._notify();
    return {
      type: "chain_advance",
      nodeIndex: nodeIdx,
      yield: s.lastAction.yield,
      combo: s.combo,
      multiplier: s.multiplier,
      hasMore: s.pendingChainAdvance
    };
  }

  _onRotationComplete() {
    const s = this.state;
    s.rotations++;
    s.completedNodes = new Set();

    // Apply difficulty escalation
    const diff = this._getDifficultySettings();
    const oldHandLimit = s.handLimit;
    s.handLimit = diff.handLimit;

    // Rebuild deck with new weights
    this._buildDeck();
    // Mix in discards
    s.deck = [...s.deck, ...s.discard];
    s.discard = [];
    this._shuffleDeck();

    // Trim hand if over new limit
    while (s.hand.length > s.handLimit) {
      s.discard.push(s.hand.pop());
    }

    s.lastAction = {
      ...s.lastAction,
      rotationComplete: true,
      rotation: s.rotations,
      handLimitChanged: oldHandLimit !== s.handLimit ? s.handLimit : null
    };
  }

  // --- Utility ---

  getNodeDisplayData() {
    return CYCLE_NODES.map((node, i) => ({
      ...node,
      index: i,
      isCurrent: i === this.state.currentNode,
      isCompleted: this.state.completedNodes.has(i),
      preloaded: this.state.preloaded[i] || [],
      transition: this._getTransitionLabel(i)
    }));
  }

  _getTransitionLabel(nodeIndex) {
    const node = CYCLE_NODES[nodeIndex];
    if (!node.yield) return null;
    return `→ ${node.yield.type}`;
  }

  getState() {
    return {
      ...this.state,
      completedNodes: new Set(this.state.completedNodes),
      hand: [...this.state.hand],
      draftChoices: [...this.state.draftChoices],
      deckPeek: [...this.state.deckPeek],
      turnEvents: { ...this.state.turnEvents },
      preloaded: Object.fromEntries(
        Object.entries(this.state.preloaded).map(([k, v]) => [k, [...v]])
      ),
    };
  }

  // --- High Score ---

  static getHighScore() {
    try {
      return parseInt(localStorage.getItem('biopath_highscore') || '0', 10);
    } catch { return 0; }
  }

  static saveHighScore(score) {
    try {
      const current = Game.getHighScore();
      if (score > current) {
        localStorage.setItem('biopath_highscore', String(score));
        return true; // new high score
      }
    } catch {}
    return false;
  }

  _notify() {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }
}
