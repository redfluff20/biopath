// ui.js — Biopath UI controller

(function () {
  const game = new Game();
  let bestCombo = 0;
  let ringRotationDeg = 0;

  // DOM refs
  const startScreen = document.getElementById('start-screen');
  const startBtn = document.getElementById('start-btn');
  const gameContainer = document.getElementById('game-container');
  const cycleRing = document.getElementById('cycle-ring');
  const ringSvg = document.getElementById('ring-svg');
  const handArea = document.getElementById('hand-area');
  const draftOverlay = document.getElementById('draft-overlay');
  const draftChoicesEl = document.getElementById('draft-choices');
  const timelineTrack = document.getElementById('timeline-track');
  const gameOverEl = document.getElementById('game-over');
  const restartBtn = document.getElementById('restart-btn');
  const endlessBtn = document.getElementById('endless-btn');
  const discardBtn = document.getElementById('discard-btn');
  const hudHighscore = document.getElementById('hud-highscore');
  const highScoreHud = document.getElementById('high-score-hud');

  // HUD refs
  const scoreDisplay = document.getElementById('score-display');
  const comboDisplay = document.getElementById('combo-display');
  const multiplierDisplay = document.getElementById('multiplier-display');
  const rotationDisplay = document.getElementById('rotation-display');
  const turnDisplay = document.getElementById('turn-display');
  const tallyNadh = document.getElementById('tally-nadh');
  const tallyFadh2 = document.getElementById('tally-fadh2');
  const tallyGtp = document.getElementById('tally-gtp');
  const deckCount = document.getElementById('deck-count');

  // Node elements
  const nodeElements = [];

  // Ring geometry
  const RING_RADIUS = 155;
  const NODE_SIZE = 62;
  const CENTER_X = RING_RADIUS + NODE_SIZE / 2;
  const CENTER_Y = RING_RADIUS + NODE_SIZE / 2;

  // --- Init ---

  function initUI() {
    createTimeline(game.getState());
    createNodes();
    drawEdges();
    render(game.getState());
  }

  function createTimeline(state) {
    timelineTrack.innerHTML = '';
    for (let t = 1; t <= MAX_TURNS; t++) {
      const pip = document.createElement('div');
      pip.className = 'timeline-pip';
      pip.dataset.turn = t;
      // Check for event on this turn
      const eventId = state.turnEvents[t];
      if (eventId) {
        pip.classList.add('event');
        const evDef = TURN_EVENTS[eventId];
        pip.textContent = evDef.icon;
        pip.title = `Turn ${t}: ${evDef.name} — ${evDef.description}`;
      } else if (t % 10 === 0) {
        pip.textContent = t;
        pip.classList.add('numbered');
      }
      timelineTrack.appendChild(pip);
    }
  }

  function extendTimeline(state) {
    // Add pips beyond the current max to handle endless mode
    const existingPips = timelineTrack.querySelectorAll('.timeline-pip');
    const maxExisting = existingPips.length;
    const target = state.totalTurns + 40; // always show 40 turns ahead
    for (let t = maxExisting + 1; t <= target; t++) {
      const pip = document.createElement('div');
      pip.className = 'timeline-pip';
      pip.dataset.turn = t;
      const eventId = state.turnEvents[t];
      if (eventId) {
        pip.classList.add('event');
        const evDef = TURN_EVENTS[eventId];
        pip.textContent = evDef.icon;
        pip.title = `Turn ${t}: ${evDef.name} — ${evDef.description}`;
      } else if (t % 10 === 0) {
        pip.textContent = t;
        pip.classList.add('numbered');
      }
      timelineTrack.appendChild(pip);
    }
  }

  function renderTimeline(state) {
    // In endless mode, ensure we have enough pips
    if (state.endless) {
      extendTimeline(state);
    }

    const pips = timelineTrack.querySelectorAll('.timeline-pip');
    pips.forEach((pip) => {
      const t = parseInt(pip.dataset.turn);
      pip.classList.toggle('current', t === state.totalTurns);
      pip.classList.toggle('past', t < state.totalTurns);
      // Update event pips that may have been scheduled after initial creation
      if (state.turnEvents[t] && !pip.classList.contains('event')) {
        pip.classList.add('event');
        const evDef = TURN_EVENTS[state.turnEvents[t]];
        pip.textContent = evDef.icon;
        pip.title = `Turn ${t}: ${evDef.name} — ${evDef.description}`;
      }
    });
    // Scroll to keep current turn centered
    const currentPip = timelineTrack.querySelector('.timeline-pip.current');
    if (currentPip) {
      const container = timelineTrack.parentElement;
      const pipLeft = currentPip.offsetLeft;
      const containerWidth = container.offsetWidth;
      container.scrollLeft = pipLeft - containerWidth / 2 + 10;
    }
  }

  function createNodes() {
    // Remove old nodes
    nodeElements.forEach(el => el.remove());
    nodeElements.length = 0;

    for (let i = 0; i < 8; i++) {
      const node = CYCLE_NODES[i];
      const el = document.createElement('div');
      el.className = 'cycle-node';
      el.dataset.index = i;

      // Build requirement info for tooltip
      const productDef = CARD_DEFINITIONS[node.productCard];
      let needParts = [productDef.abbreviation];
      if (node.cofactorRequired) {
        for (const c of node.cofactorRequired) {
          needParts.push(CARD_DEFINITIONS[c].abbreviation);
        }
      }
      const reqText = `Need: ${needParts.join(' + ')}`;

      el.innerHTML = `
        <span class="node-abbr">${node.abbreviation}</span>
        <span class="node-label">${node.label}</span>
        <div class="node-requirements">${reqText}</div>
        <div class="node-preloaded"></div>
      `;

      el.addEventListener('click', () => onNodeClick(i));
      cycleRing.appendChild(el);
      nodeElements.push(el);
    }
  }

  function getNodePosition(index, currentNode) {
    // Position nodes in a circle, with current node at top (270 degrees / -90)
    // We rotate the whole ring so current node is at top
    const angleStep = (2 * Math.PI) / 8;
    const angle = angleStep * index - Math.PI / 2; // -90 deg so index 0 starts at top
    const x = CENTER_X + RING_RADIUS * Math.cos(angle);
    const y = CENTER_Y + RING_RADIUS * Math.sin(angle);
    return { x, y };
  }

  function positionNodes(currentNode) {
    // Rotate ring so current node is at top
    const anglePerNode = 360 / 8;
    ringRotationDeg = -currentNode * anglePerNode;
    cycleRing.style.transform = `rotate(${ringRotationDeg}deg)`;

    for (let i = 0; i < 8; i++) {
      const pos = getNodePosition(i, currentNode);
      const el = nodeElements[i];
      el.style.left = pos.x + 'px';
      el.style.top = pos.y + 'px';
      // Counter-rotate node content so text stays upright
      el.style.transform = `translate(-50%, -50%) rotate(${-ringRotationDeg}deg)`;
    }
  }

  function drawEdges() {
    const svgNS = 'http://www.w3.org/2000/svg';
    ringSvg.innerHTML = '';

    for (let i = 0; i < 8; i++) {
      const from = getNodePosition(i, 0);
      const to = getNodePosition((i + 1) % 8, 0);

      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', from.x);
      line.setAttribute('y1', from.y);
      line.setAttribute('x2', to.x);
      line.setAttribute('y2', to.y);
      line.setAttribute('class', 'ring-edge');
      line.dataset.index = i;
      ringSvg.appendChild(line);

      // Yield label
      const node = CYCLE_NODES[i];
      if (node.yield) {
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        // Offset label outward from center
        const dx = midX - CENTER_X;
        const dy = midY - CENTER_Y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const offsetX = midX + (dx / dist) * 20;
        const offsetY = midY + (dy / dist) * 20;

        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', offsetX);
        text.setAttribute('y', offsetY);
        text.setAttribute('class', 'edge-yield-label');
        text.textContent = `→ ${node.yield.type}`;
        ringSvg.appendChild(text);
      }
    }
  }

  // --- Rendering ---

  function render(state) {
    positionNodes(state.currentNode);
    renderNodes(state);
    renderHand(state);
    renderHUD(state);
    renderTimeline(state);
    renderDraft(state);
    renderEventOverlays(state);
    checkEventBanner(state);

    deckCount.textContent = state.deck.length;

    // Show discard button only when a card is selected
    discardBtn.parentElement.classList.toggle('visible', state.selectedCardIndex !== null && state.turnPhase === 'action');

    if (state.gameOver) {
      showGameOver(state);
    }
  }

  function renderNodes(state) {
    for (let i = 0; i < 8; i++) {
      const el = nodeElements[i];
      el.classList.remove('current', 'completed');

      if (i === state.currentNode) {
        el.classList.add('current');
        // Intensity based on multiplier
        if (state.multiplier >= 2.0) {
          el.classList.add('glow-intense');
        } else {
          el.classList.remove('glow-intense');
        }
      }

      if (state.completedNodes.has(i)) {
        el.classList.add('completed');
      }

      // Preloaded pips
      const preloadedDiv = el.querySelector('.node-preloaded');
      preloadedDiv.innerHTML = '';
      const preloaded = state.preloaded[i] || [];
      for (const card of preloaded) {
        const pip = document.createElement('div');
        pip.className = `preloaded-pip ${card.type}`;
        pip.textContent = card.abbreviation.charAt(0);
        pip.title = card.label;
        preloadedDiv.appendChild(pip);
      }
    }

    // Update edge styles
    const edges = ringSvg.querySelectorAll('.ring-edge');
    edges.forEach((edge, i) => {
      edge.classList.toggle('completed', state.completedNodes.has(i));
    });
  }

  function renderHand(state) {
    handArea.innerHTML = '';

    state.hand.forEach((card, idx) => {
      const el = document.createElement('div');
      el.className = `hand-card ${card.type}`;
      if (idx === state.selectedCardIndex) {
        el.classList.add('selected');
      }

      el.innerHTML = `
        <span class="card-type-badge">${card.type}</span>
        <span class="card-abbr">${card.abbreviation}</span>
        <span class="card-label">${card.label}</span>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onCardClick(idx);
      });

      handArea.appendChild(el);
    });
  }

  function renderHUD(state) {
    scoreDisplay.textContent = state.score;
    comboDisplay.textContent = state.combo;
    multiplierDisplay.textContent = state.multiplier.toFixed(1) + '×';
    rotationDisplay.textContent = state.rotations;
    turnDisplay.textContent = state.endless ? `${state.totalTurns} ∞` : `${state.totalTurns} / ${MAX_TURNS}`;
    tallyNadh.textContent = state.energyTally.NADH;
    tallyFadh2.textContent = state.energyTally.FADH2;
    tallyGtp.textContent = state.energyTally.GTP;

    // Track best combo
    if (state.combo > bestCombo) bestCombo = state.combo;

    // High score display — show whichever is higher: saved or current
    const saved = Game.getHighScore();
    const best = Math.max(saved, state.score);
    hudHighscore.textContent = best;
    if (state.score > saved && state.score > 0) {
      highScoreHud.classList.add('new-best');
      setTimeout(() => highScoreHud.classList.remove('new-best'), 600);
    }
  }

  function renderDraft(state) {
    if (!state.draftPhase || state.draftChoices.length === 0) {
      draftOverlay.classList.remove('visible');
      return;
    }

    draftOverlay.classList.remove('wave-cofactor', 'wave-product');
    if (state.activeEvent && state.activeEvent.id === 'cofactor_wave') {
      draftOverlay.classList.add('wave-cofactor');
    } else if (state.activeEvent && state.activeEvent.id === 'product_wave') {
      draftOverlay.classList.add('wave-product');
    }
    draftOverlay.classList.add('visible');
    draftChoicesEl.innerHTML = '';

    // Update prompt text for wave events
    const promptEl = draftOverlay.querySelector('.draft-prompt');
    if (state.activeEvent && state.activeEvent.id === 'cofactor_wave') {
      promptEl.textContent = 'Cofactor Wave — Pick a cofactor';
    } else if (state.activeEvent && state.activeEvent.id === 'product_wave') {
      promptEl.textContent = 'Product Wave — Pick a product';
    } else {
      promptEl.textContent = 'Pick a card';
    }

    state.draftChoices.forEach((card, idx) => {
      const el = document.createElement('div');
      el.className = `draft-card ${card.type}`;
      el.innerHTML = `
        <span class="card-type-badge">${card.type}</span>
        <span class="card-abbr">${card.abbreviation}</span>
        <span class="card-label">${card.label}</span>
      `;
      el.addEventListener('click', () => {
        const result = game.pickDraftCard(idx);
        if (result) {
          showNotification(`Drafted ${result.card.abbreviation}`);
        }
      });
      draftChoicesEl.appendChild(el);
    });
  }

  function renderEventOverlays(state) {
    // Remove old overlays
    document.querySelectorAll('.event-overlay').forEach(el => el.remove());

    // Combo shield indicator
    if (state.comboShieldTurns > 0) {
      comboDisplay.parentElement.classList.add('shielded');
    } else {
      comboDisplay.parentElement.classList.remove('shielded');
    }

    // Hand Refresh overlay
    if (state.pendingRefresh) {
      const overlay = document.createElement('div');
      overlay.className = 'event-overlay refresh-overlay';
      overlay.innerHTML = `
        <div class="event-banner-title">Hand Refresh</div>
        <div class="event-banner-desc">Discard your entire hand and draw 5 fresh cards?</div>
        <div class="refresh-buttons">
          <button class="refresh-accept">Accept</button>
          <button class="refresh-decline">Decline</button>
        </div>
      `;
      overlay.querySelector('.refresh-accept').addEventListener('click', () => {
        const result = game.acceptRefresh();
        if (result) {
          showNotification('Hand refreshed!');
        }
      });
      overlay.querySelector('.refresh-decline').addEventListener('click', () => {
        game.declineRefresh();
        showNotification('Refresh declined');
      });
      document.body.appendChild(overlay);
    }

    // Metabolic Insight peek overlay
    if (state.peekPhase && state.deckPeek.length > 0) {
      const overlay = document.createElement('div');
      overlay.className = 'event-overlay peek-overlay';
      overlay.innerHTML = `
        <div class="event-banner-title">Metabolic Insight</div>
        <div class="event-banner-desc">Top ${state.deckPeek.length} cards in deck:</div>
        <div class="peek-cards"></div>
        <button class="peek-dismiss">Continue to Draft</button>
      `;
      const peekCards = overlay.querySelector('.peek-cards');
      for (const card of state.deckPeek) {
        const el = document.createElement('div');
        el.className = `peek-card ${card.type}`;
        el.innerHTML = `
          <span class="card-abbr">${card.abbreviation}</span>
          <span class="card-label">${card.label}</span>
        `;
        peekCards.appendChild(el);
      }
      overlay.querySelector('.peek-dismiss').addEventListener('click', () => {
        game.dismissPeek();
      });
      document.body.appendChild(overlay);
    }
  }

  // Show event notification banner
  let lastEventTurn = 0;
  function checkEventBanner(state) {
    if (state.activeEvent && state.totalTurns !== lastEventTurn) {
      lastEventTurn = state.totalTurns;
      showEventBanner(state.activeEvent);
    }
  }

  function showEventBanner(event) {
    const el = document.createElement('div');
    el.className = 'event-banner';
    el.innerHTML = `<span class="event-icon">${event.icon}</span> ${event.name} <span class="event-desc">— ${event.description}</span>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // --- Interactions ---

  function onCardClick(handIndex) {
    const state = game.getState();
    if (state.selectedCardIndex === handIndex) {
      game.deselectCard();
    } else {
      game.selectCard(handIndex);
    }
  }

  function onNodeClick(nodeIndex) {
    const state = game.getState();
    if (state.selectedCardIndex === null) return;

    const result = game.playCardOnNode(nodeIndex);
    if (result) {
      handleActionResult(result, nodeIndex);
      // Rejected placements don't consume a turn — card stays in hand
      if (result.type === 'rejected') return;

      const isAdvance = result.type === 'advance' || result.type === 'advance_from_cofactor';

      if (isAdvance) {
        // Check if a chain advance is pending
        const postState = game.getState();
        if (postState.pendingChainAdvance) {
          // Animate chain advances step by step
          setTimeout(() => animateChainAdvances(1), 800);
        } else {
          setTimeout(() => game.startTurn(), 800);
        }
      } else {
        setTimeout(() => game.startTurn(), 300);
      }
    }
  }

  // Animate chain advances one step at a time with escalating intensity
  let chainStep = 0;
  function animateChainAdvances(step) {
    chainStep = step;
    const result = game.executeChainStep();
    if (!result) {
      chainStep = 0;
      game.startTurn();
      return;
    }

    // Escalating animation intensity based on chain length
    const nodeIdx = result.nodeIndex;
    const intensity = Math.min(step, 8);

    // Screen shake — escalates with chain
    if (intensity >= 4) {
      screenShake(true);
    } else {
      screenShake(false);
    }

    // Node pulse
    pulseNode(nodeIdx, intensity >= 3);

    // Score pop
    if (result.yield) {
      floatScore(nodeIdx, `+${result.yield.points} ${result.yield.type}`);
      spawnScorePop(result.yield.points, result.yield.type);
    }

    // CO2 particles
    if (CYCLE_NODES[nodeIdx].releasesCO2) {
      spawnCO2(nodeIdx);
    }

    // Multiplier burst
    if (result.multiplier > lastMultiplier) {
      spawnMultiplierBurst(result.multiplier);
    }
    lastMultiplier = result.multiplier;

    // Chain combo flash — bigger at higher chains
    if (result.combo >= 3) {
      spawnComboFlash(result.combo);
    }

    // Chain counter notification
    showNotification(`Chain x${step + 1}!`);

    // Delay increases slightly for dramatic pacing, capped
    const delay = Math.min(1200, 600 + step * 100);

    if (result.hasMore) {
      setTimeout(() => animateChainAdvances(step + 1), delay);
    } else {
      chainStep = 0;
      setTimeout(() => game.startTurn(), delay);
    }
  }

  // Discard button
  discardBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const result = game.discardCard();
    if (result) {
      showNotification(`Discarded ${result.card.abbreviation}`);
      setTimeout(() => game.startTurn(), 300);
    }
  });

  // Click anywhere to deselect
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.hand-card') &&
        !e.target.closest('.cycle-node') &&
        !e.target.closest('#draft-overlay') &&
        !e.target.closest('.event-overlay') &&
        !e.target.closest('#discard-btn-area')) {
      game.deselectCard();
    }
  });

  // --- Action Feedback ---

  let lastMultiplier = 1.0;

  function handleActionResult(result, nodeIndex) {
    const state = game.getState();

    switch (result.type) {
      case 'advance':
      case 'advance_from_cofactor':
        advanceJuice(nodeIndex, result, state);
        break;

      case 'wrong':
        shakeNode(nodeIndex);
        showNotification('Wrong card — discarded');
        break;

      case 'preload':
        showNotification('Pre-loaded on future node');
        break;

      case 'cofactor_staged':
        showNotification('Cofactor staged');
        break;

      case 'cofactor_preloaded':
        showNotification('Cofactor pre-loaded');
        break;

      case 'stage_product':
        showNotification('Product staged — needs cofactors');
        break;


      case 'discard':
        showNotification(`Discarded ${result.card.abbreviation}`);
        break;

      case 'rejected':
        shakeNode(nodeIndex);
        showNotification(result.reason || 'Cannot place here');
        break;
    }

    // Check for rotation-related notifications
    if (result.rotationComplete) {
      showNotification(`Rotation ${result.rotation} complete!`);
      if (result.handLimitChanged) {
        setTimeout(() => {
          showNotification(`Hand limit: ${result.handLimitChanged}`);
        }, 600);
      }
    }

    lastMultiplier = state.multiplier;
  }

  function advanceJuice(nodeIndex, result, state) {
    // Slow the ring rotation for dramatic effect
    cycleRing.classList.add('slow-rotate');
    setTimeout(() => cycleRing.classList.remove('slow-rotate'), 1500);

    // Node pulse — heavy at high multiplier
    const isHighMult = state.multiplier >= 2.0;
    pulseNode(nodeIndex, isHighMult);

    // Screen shake — harder at high combos
    screenShake(state.combo >= 6);

    // CO2 particles
    if (CYCLE_NODES[nodeIndex].releasesCO2) {
      spawnCO2(nodeIndex);
    }

    // Score pop (big centered score display)
    if (result.yield) {
      floatScore(nodeIndex, `+${result.yield.points} ${result.yield.type}`);
      spawnScorePop(result.yield.points, result.yield.type);
    }

    // Multiplier burst when multiplier increases
    if (state.multiplier > lastMultiplier) {
      spawnMultiplierBurst(state.multiplier);
    }

    // Combo flash on screen at high combos
    if (state.combo >= 3) {
      spawnComboFlash(state.combo);
    }

    // Chain notification
    if (state.lastAction && state.lastAction.type === 'chain_advance') {
      showNotification('Chain advance!');
    }
  }

  // --- Animations ---

  function pulseNode(nodeIndex, heavy) {
    const el = nodeElements[nodeIndex];
    el.classList.remove('pulse', 'pulse-heavy');
    void el.offsetWidth; // force reflow
    if (heavy) {
      el.classList.add('pulse-heavy');
      setTimeout(() => el.classList.remove('pulse-heavy'), 800);
    } else {
      el.classList.add('pulse');
      setTimeout(() => el.classList.remove('pulse'), 500);
    }
  }

  function shakeNode(nodeIndex) {
    const el = nodeElements[nodeIndex];
    el.classList.remove('pulse');
    el.style.animation = 'cardShake 0.4s ease-out';
    setTimeout(() => { el.style.animation = ''; }, 400);
  }

  function screenShake(hard) {
    document.body.classList.remove('shake', 'shake-hard');
    void document.body.offsetWidth;
    document.body.classList.add(hard ? 'shake-hard' : 'shake');
    const dur = hard ? 500 : 400;
    setTimeout(() => document.body.classList.remove('shake', 'shake-hard'), dur);
  }

  function floatScore(nodeIndex, text) {
    const pos = getNodePosition(nodeIndex, game.getState().currentNode);
    const rect = cycleRing.getBoundingClientRect();

    const el = document.createElement('div');
    el.className = 'float-score';
    el.textContent = text;
    el.style.left = (rect.left + pos.x) + 'px';
    el.style.top = (rect.top + pos.y - 40) + 'px';
    document.body.appendChild(el);

    setTimeout(() => el.remove(), 1200);
  }

  function spawnScorePop(points, yieldType) {
    const el = document.createElement('div');
    const typeClass = yieldType === 'NADH' ? 'nadh' : yieldType === 'FADH2' ? 'fadh2' : 'gtp';
    el.className = `score-pop ${typeClass}`;
    el.textContent = `+${points}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  function spawnMultiplierBurst(multiplier) {
    const el = document.createElement('div');
    el.className = 'multiplier-burst';
    el.textContent = `${multiplier.toFixed(1)}x`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  function spawnComboFlash(combo) {
    const el = document.createElement('div');
    el.className = 'combo-flash';
    // Color intensity based on combo
    const intensity = Math.min(0.2, 0.05 + combo * 0.015);
    if (combo >= 9) {
      el.style.background = `radial-gradient(ellipse at center, rgba(212, 164, 58, ${intensity}) 0%, transparent 70%)`;
    } else if (combo >= 6) {
      el.style.background = `radial-gradient(ellipse at center, rgba(61, 186, 166, ${intensity}) 0%, transparent 70%)`;
    } else {
      el.style.background = `radial-gradient(ellipse at center, rgba(61, 186, 166, ${intensity * 0.6}) 0%, transparent 70%)`;
    }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  function spawnCO2(nodeIndex) {
    const pos = getNodePosition(nodeIndex, game.getState().currentNode);
    const rect = cycleRing.getBoundingClientRect();

    for (let i = 0; i < 6; i++) {
      const p = document.createElement('div');
      p.className = 'co2-particle';
      const drift = (Math.random() - 0.5) * 40;
      p.style.setProperty('--drift', drift + 'px');
      p.style.left = (rect.left + pos.x + (Math.random() - 0.5) * 20) + 'px';
      p.style.top = (rect.top + pos.y) + 'px';
      p.style.animationDelay = (Math.random() * 0.3) + 's';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1800);
    }
  }

  function showNotification(text) {
    const el = document.createElement('div');
    el.className = 'notification';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  // --- Game Over ---

  function showGameOver(state) {
    const isNewHigh = Game.saveHighScore(state.score);
    document.getElementById('final-score').textContent = state.score;
    document.getElementById('final-highscore').textContent = Game.getHighScore();
    document.getElementById('final-rotations').textContent = state.rotations;
    document.getElementById('final-combo').textContent = bestCombo;
    document.getElementById('final-nadh').textContent = state.energyTally.NADH;
    document.getElementById('final-fadh2').textContent = state.energyTally.FADH2;
    document.getElementById('final-gtp').textContent = state.energyTally.GTP;

    // High score banner
    const banner = document.getElementById('high-score-banner');
    banner.classList.toggle('hidden', !isNewHigh);

    // Title changes based on context
    const title = document.getElementById('game-over-title');
    title.textContent = state.endless ? 'Endless Run Over' : 'Run Complete';

    // Show/hide endless button (only at turn 80, not already endless, not out of cards)
    const canEndless = state.totalTurns >= MAX_TURNS && !state.endless &&
      (state.hand.length > 0 || state.deck.length > 0 || state.discard.length > 0);
    endlessBtn.classList.toggle('hidden', !canEndless);

    gameOverEl.classList.add('visible');
  }

  // --- Start / Restart ---

  startBtn.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    initUI();
    // First turn draw already happened in game.init()
  });

  endlessBtn.addEventListener('click', () => {
    gameOverEl.classList.remove('visible');
    game.enterEndless();
    // Extend timeline for endless mode
    extendTimeline(game.getState());
    game.startTurn();
  });

  restartBtn.addEventListener('click', () => {
    gameOverEl.classList.remove('visible');
    bestCombo = 0;
    game.init();
    initUI();
  });

  // Connect game state changes to UI
  game.onStateChange = render;

})();
