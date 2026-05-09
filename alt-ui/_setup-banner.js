/**
 * Shared "setup required" banner for the alt-UIs.
 *
 * If the signer reports `setupRequired: true` (i.e. ORBITPORT_MODE=real but
 * credentials are missing), every UI shows a prominent fixed banner with
 * the exact steps the user must take. The banner is plain inline DOM so it
 * works in any of the five aesthetic shells.
 */
window.hollowVaultMountSetupBanner = async function (signerUrl) {
  let info;
  try {
    info = await (await fetch(signerUrl + "/health")).json();
  } catch {
    return false;
  }
  if (!info || !info.setupRequired) return false;

  const css = `
    .cosmic-setup-banner {
      position: fixed; inset: 0;
      background: rgba(10, 10, 14, 0.88);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 9999;
      display: grid; place-items: center;
      padding: 24px;
      font-family: -apple-system, "Inter", "Segoe UI", system-ui, sans-serif;
    }
    .cosmic-setup-card {
      max-width: 640px;
      background: #14141c;
      color: #f1f1f5;
      border: 1px solid #ff8c00;
      border-radius: 14px;
      padding: 28px 32px;
      box-shadow: 0 20px 60px -12px rgba(255, 140, 0, 0.25);
    }
    .cosmic-setup-card h2 {
      margin: 0 0 6px;
      font-size: 22px;
      color: #ff8c00;
      letter-spacing: 0.01em;
    }
    .cosmic-setup-card .why {
      margin: 0 0 20px;
      color: #c8c8d0;
      font-size: 14px;
      line-height: 1.5;
    }
    .cosmic-setup-card ol {
      margin: 0 0 18px;
      padding-left: 22px;
      font-size: 14px;
      line-height: 1.55;
      color: #f1f1f5;
    }
    .cosmic-setup-card ol li { margin: 6px 0; }
    .cosmic-setup-card a {
      color: #4dd0e1; text-decoration: underline; text-underline-offset: 3px;
    }
    .cosmic-setup-card code {
      background: #0b0b13;
      border: 1px solid #2a2a36;
      padding: 1px 6px;
      border-radius: 4px;
      font-family: ui-monospace, "JetBrains Mono", monospace;
      font-size: 13px;
      color: #4dd0e1;
    }
    .cosmic-setup-card .recheck {
      margin-top: 14px;
      display: flex; gap: 10px; align-items: center;
    }
    .cosmic-setup-card button {
      background: #ff8c00; color: #14141c;
      border: 0; padding: 9px 18px;
      border-radius: 8px;
      font: inherit; font-weight: 600;
      cursor: pointer;
    }
    .cosmic-setup-card button:hover { background: #ffaa3c; }
    .cosmic-setup-card .small {
      font-size: 12px; color: #8a8a96;
    }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const wrap = document.createElement("div");
  wrap.className = "cosmic-setup-banner";
  const stepsHtml = (info.steps || [])
    .map((s) => {
      const linked = s
        .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>')
        .replace(/'\.env'|`\.env`/g, "<code>.env</code>")
        .replace(/ORBITPORT_(CLIENT_ID|CLIENT_SECRET|MODE)/g, "<code>ORBITPORT_$1</code>")
        .replace(/`npm run dev`/g, "<code>npm run dev</code>");
      return `<li>${linked}</li>`;
    })
    .join("");

  wrap.innerHTML = `
    <div class="cosmic-setup-card" role="dialog" aria-labelledby="cosmic-setup-title">
      <h2 id="cosmic-setup-title">⚠ Setup required — Orbitport credentials missing</h2>
      <p class="why">${info.reason || "ORBITPORT_MODE=real but the signer has no Orbitport credentials. The UI needs a live KMS-backed signer to function."}</p>
      <ol>${stepsHtml}</ol>
      <div class="recheck">
        <button type="button" id="cosmic-setup-recheck">I&apos;ve added the credentials — re-check</button>
        <span class="small">Or restart the signer; this banner will disappear automatically.</span>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const recheck = async () => {
    const j = await (await fetch(signerUrl + "/health")).json().catch(() => null);
    if (j && !j.setupRequired) location.reload();
    else {
      const btn = wrap.querySelector("button");
      if (btn) {
        btn.textContent = "Still missing — check .env then click again";
        btn.style.background = "#e95d8d";
        setTimeout(() => { btn.textContent = "I've added the credentials — re-check"; btn.style.background = "#ff8c00"; }, 2500);
      }
    }
  };
  wrap.querySelector("#cosmic-setup-recheck").addEventListener("click", recheck);
  // Also poll quietly every 5s — picks up restart-after-edit flows.
  setInterval(async () => {
    const j = await (await fetch(signerUrl + "/health")).json().catch(() => null);
    if (j && !j.setupRequired) location.reload();
  }, 5000);

  return true;
};
