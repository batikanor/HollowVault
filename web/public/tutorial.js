/**
 * In-UI guided tour. Walks a first-time visitor through the headline
 * sign-then-verify flow click-by-click. Auto-shows once on first visit
 * (localStorage-gated) and is re-triggerable from the TUTORIAL button
 * in the topbar.
 *
 * Pure vanilla JS, zero deps, ~150 lines. Step definitions live in STEPS;
 * each step is either a centered modal or a spotlight pinned to a CSS
 * selector. onNext can run an action (e.g. click SIGN); waitFor polls
 * for the resulting UI state before advancing.
 */
(function () {
  const SOURCE_PRESET_INDEX = 4;

  const STEPS = [
    {
      kind: "centered",
      title: "HVLT&lt;GO&gt; · WELCOME ABOARD",
      body: `
        <b>Hollow Vault</b> is an Ethereum signer whose private key has
        <b>never lived on this device</b> — it was created inside SpaceComputer's
        Orbitport KMS and signs there. We get back only the signature.
        <br><br>
        This 30-second tour walks the headline scenario: signing a journalist's
        priority-of-disclosure receipt, bound to a satellite-attested
        cosmic-randomness draw at this exact moment.
      `,
      cta: "▶ Begin tour",
    },
    {
      kind: "spotlight",
      target: "#presets",
      placement: "bottom",
      title: "STEP 1 · pick a real-world scenario",
      body: `
        Five concrete Web3 signing patterns. We'll use <b>Source disclosure</b> —
        the most compelling case for an off-device signer (the writer can't be
        coerced to produce a key they don't have).
      `,
      cta: "Next ▸ select preset",
      onNext: () => {
        const buttons = document.querySelectorAll(".preset-bar .pre");
        if (buttons[SOURCE_PRESET_INDEX]) buttons[SOURCE_PRESET_INDEX].click();
      },
    },
    {
      kind: "spotlight",
      target: "#msg",
      placement: "bottom",
      title: "STEP 2 · the exact bytes you'll sign",
      body: `
        The page already fetched <code>/api/identity</code> at load and
        interpolated the gateway's wallet address into the template. Edit
        anything — the signature commits to whatever ends up in this box.
      `,
      cta: "Next ▸",
    },
    {
      kind: "spotlight",
      target: "#btn-sign",
      placement: "top",
      title: "STEP 3 · sign it",
      body: `
        Clicking <b>F1 ▸ SIGN</b> kicks off three round-trips:
        <ol style="margin: 8px 0; padding-left: 18px;">
          <li>fetch a 32-byte cosmic seed from Orbitport's cTRNG</li>
          <li>keccak256(scheme &Vert; seed &Vert; ts &Vert; messageHash) → payloadHash</li>
          <li>Orbitport KMS signs the 32-byte payloadHash — the private key never crosses the wire</li>
        </ol>
      `,
      cta: "▶ Sign now",
      onNext: () => document.getElementById("btn-sign")?.click(),
      waitFor: () => {
        const raw = document.getElementById("raw");
        return raw && raw.textContent && raw.textContent.trim() !== "—" && raw.textContent.length > 50;
      },
    },
    {
      kind: "spotlight",
      target: "#raw",
      placement: "left",
      title: "STEP 4 · the attestation envelope",
      body: `
        The full envelope: cosmic seed (32 bytes), satellite signature (ed25519),
        payloadHash, ECDSA signature (64-byte compact + recovery id), signer
        pubkey + address, scheme + nonceMode metadata.
        <br><br>
        Same shape any auditor or contract can consume.
      `,
      cta: "Next ▸",
    },
    {
      kind: "spotlight",
      target: "#btn-verify",
      placement: "top",
      title: "STEP 5 · run the 5-check verifier",
      body: `
        The same library code runs in <code>HollowVaultVerifier.sol</code>
        on-chain (~31k gas via <code>ecrecover</code>). Five independent
        checks that all have to pass.
      `,
      cta: "▶ Verify",
      onNext: () => document.getElementById("btn-verify")?.click(),
      waitFor: () => {
        const checks = document.getElementById("checks");
        if (!checks) return false;
        const okMarks = checks.querySelectorAll(".res");
        const greenCount = Array.from(okMarks).filter((el) => /OK/i.test(el.textContent)).length;
        return greenCount >= 5;
      },
    },
    {
      kind: "spotlight",
      target: "#checks",
      placement: "right",
      title: "STEP 6 · all five green",
      body: `
        keccak(message), ed25519(seed&Vert;ts), cosmic↔message binding,
        ECDSA recovery, freshness window. Tamper any field of the
        attestation and the corresponding line turns red.
      `,
      cta: "Next ▸",
    },
    {
      kind: "centered",
      title: "TOUR COMPLETE · what we structurally kill",
      body: `
        Sony PS3 (2010) and Android Bitcoin wallets (2013) lost real money to
        the broken-RNG ECDSA bug. Visit
        <a href="/vulnerability" target="_blank" rel="noreferrer">/vulnerability</a>
        to watch the math recover the private key from two reused-nonce
        signatures — then come back here, where there is no local key to leak.
        <br><br>
        Press <b>F1</b> to sign anything. <b>F3</b> to batch. Both produce
        envelopes that pass the same 5-check verifier you just ran.
      `,
      cta: "Done · close tour",
    },
  ];

  let currentStepIndex = 0;
  let overlayEl = null;

  function ensureStyles() {
    if (document.getElementById("hv-tour-styles")) return;
    const s = document.createElement("style");
    s.id = "hv-tour-styles";
    s.textContent = `
      #hv-tour-overlay { position: fixed; inset: 0; z-index: 99999; pointer-events: none; }
      #hv-tour-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.62); pointer-events: auto; }
      #hv-tour-spotlight { position: fixed; box-shadow: 0 0 0 9999px rgba(0,0,0,0.62); border: 2px solid #ff8c00; border-radius: 6px; pointer-events: none; transition: all 0.25s ease; }
      #hv-tour-card { position: fixed; max-width: 460px; background: #0c0c0c; border: 1px solid #ff8c00; border-radius: 6px; padding: 16px 18px; pointer-events: auto; color: #ffd278; font-family: "IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace; font-size: 12px; line-height: 1.55; box-shadow: 0 0 40px rgba(255,140,0,0.4); }
      #hv-tour-card.centered { left: 50%; top: 50%; transform: translate(-50%, -50%); }
      #hv-tour-card h3 { margin: 0 0 10px; color: #ff8c00; font-size: 13px; letter-spacing: 0.05em; }
      #hv-tour-card .body { color: #ffd278; }
      #hv-tour-card .body code { background: #1a1300; padding: 1px 4px; border-radius: 2px; color: #00d4ff; }
      #hv-tour-card .body b { color: #fff200; }
      #hv-tour-card .body a { color: #00d4ff; }
      #hv-tour-card .controls { display: flex; gap: 8px; margin-top: 14px; align-items: center; }
      #hv-tour-card .controls .step { color: #6e6e6e; margin-right: auto; font-size: 11px; }
      #hv-tour-card button { background: #ff8c00; color: #000; border: none; padding: 6px 12px; font-family: inherit; font-size: 11px; font-weight: bold; cursor: pointer; letter-spacing: 0.05em; }
      #hv-tour-card button.skip { background: transparent; color: #6e6e6e; border: 1px solid #6e6e6e; }
      #hv-tour-card button:hover { opacity: 0.85; }
      #hv-tour-trigger { background: transparent; color: #ff8c00; border: 1px solid #ff8c00; padding: 3px 10px; font-family: inherit; font-size: 11px; font-weight: bold; cursor: pointer; letter-spacing: 0.05em; }
      #hv-tour-trigger:hover { background: #ff8c00; color: #000; }
    `;
    document.head.appendChild(s);
  }

  function buildOverlay() {
    overlayEl = document.createElement("div");
    overlayEl.id = "hv-tour-overlay";
    overlayEl.innerHTML = `
      <div id="hv-tour-mask"></div>
      <div id="hv-tour-spotlight" hidden></div>
      <div id="hv-tour-card"></div>
    `;
    document.body.appendChild(overlayEl);
    overlayEl.querySelector("#hv-tour-mask").addEventListener("click", closeTour);
  }

  function placeSpotlight(target) {
    const rect = target.getBoundingClientRect();
    const pad = 6;
    const sp = overlayEl.querySelector("#hv-tour-spotlight");
    sp.hidden = false;
    sp.style.left = rect.left - pad + "px";
    sp.style.top = rect.top - pad + "px";
    sp.style.width = rect.width + pad * 2 + "px";
    sp.style.height = rect.height + pad * 2 + "px";
    // inline:'nearest' avoids horizontal scrolling — the page is vertical-scroll
    // only, and asking for inline:'center' on a wide row caused the grid to
    // re-layout against a much larger virtual width.
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    return rect;
  }

  function placeCard(rect, placement, cardEl) {
    cardEl.classList.remove("centered");
    if (!rect) {
      cardEl.classList.add("centered");
      cardEl.style.left = "";
      cardEl.style.top = "";
      cardEl.style.transform = "";
      return;
    }
    const cardW = cardEl.offsetWidth || 460;
    const cardH = cardEl.offsetHeight;
    const margin = 16;
    let left;
    let top;
    switch (placement) {
      case "bottom":
        left = Math.max(16, Math.min(window.innerWidth - cardW - 16, rect.left));
        top = Math.min(window.innerHeight - cardH - 16, rect.bottom + margin);
        break;
      case "top":
        left = Math.max(16, Math.min(window.innerWidth - cardW - 16, rect.left));
        top = Math.max(16, rect.top - cardH - margin);
        break;
      case "left":
        left = Math.max(16, rect.left - cardW - margin);
        top = Math.max(16, Math.min(window.innerHeight - cardH - 16, rect.top));
        break;
      case "right":
      default:
        left = Math.min(window.innerWidth - cardW - 16, rect.right + margin);
        top = Math.max(16, Math.min(window.innerHeight - cardH - 16, rect.top));
        break;
    }
    cardEl.style.left = left + "px";
    cardEl.style.top = top + "px";
    cardEl.style.transform = "";
  }

  function renderCard(step) {
    const card = overlayEl.querySelector("#hv-tour-card");
    card.innerHTML = `
      <h3>${step.title}</h3>
      <div class="body">${step.body}</div>
      <div class="controls">
        <span class="step">${currentStepIndex + 1} / ${STEPS.length}</span>
        <button class="skip" onclick="window.HOLLOW_VAULT_TOUR_CLOSE()">Skip</button>
        <button onclick="window.HOLLOW_VAULT_TOUR_NEXT()">${step.cta || "Next ▸"}</button>
      </div>
    `;
    return card;
  }

  function showStep() {
    const step = STEPS[currentStepIndex];
    if (!step) {
      closeTour();
      return;
    }
    const card = renderCard(step);

    if (step.kind === "centered") {
      overlayEl.querySelector("#hv-tour-spotlight").hidden = true;
      placeCard(null, null, card);
      return;
    }
    const target = document.querySelector(step.target);
    if (!target) {
      overlayEl.querySelector("#hv-tour-spotlight").hidden = true;
      placeCard(null, null, card);
      return;
    }
    const rect = placeSpotlight(target);
    placeCard(rect, step.placement, card);
  }

  async function nextStep() {
    const step = STEPS[currentStepIndex];
    if (step && step.onNext) {
      try { step.onNext(); } catch (_) { /* ignore — auto-action best-effort */ }
    }
    currentStepIndex += 1;
    if (currentStepIndex >= STEPS.length) {
      closeTour();
      return;
    }
    if (step && step.waitFor) {
      const startedAt = Date.now();
      while (Date.now() - startedAt < 12000) {
        if (step.waitFor()) break;
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    showStep();
  }

  function closeTour() {
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
    currentStepIndex = 0;
  }

  function startTour() {
    ensureStyles();
    if (overlayEl) return;
    currentStepIndex = 0;
    buildOverlay();
    showStep();
  }

  window.HOLLOW_VAULT_TOUR_START = startTour;
  window.HOLLOW_VAULT_TOUR_NEXT = nextStep;
  window.HOLLOW_VAULT_TOUR_CLOSE = closeTour;

  // Auto-show once on first visit. 1.2s delay so /api/identity has filled in
  // the wallet address before STEP 2 appears.
  document.addEventListener("DOMContentLoaded", () => {
    ensureStyles();
    if (localStorage.getItem("hollowVaultTourSeen")) return;
    setTimeout(() => {
      try {
        localStorage.setItem("hollowVaultTourSeen", "1");
        startTour();
      } catch { /* ignore */ }
    }, 1200);
  });
})();
