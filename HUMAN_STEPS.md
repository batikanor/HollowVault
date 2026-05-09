# Human Steps

The signer is **production-mode by default** — it talks to SpaceComputer's live Orbitport KMS + cTRNG. You must obtain real credentials before it will start. The UI will block itself with an in-browser setup card if credentials are missing, so you can't accidentally demo a half-working state.

---

## Step 0 — Make sure you have the basics installed

```bash
node --version      # need v22 or higher
npm --version       # need v10 or higher
```

If `node` is missing or too old, install via [nvm](https://github.com/nvm-sh/nvm):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# close + reopen Terminal
nvm install 22
nvm use 22
```

---

## Step 1 — REQUIRED · Get production Orbitport credentials

This is the only manual step. Without it the signer refuses to start in production mode and the UI shows a fullscreen setup card instead of working content.

1. Open **<https://accounts.spacecomputer.io/>**
2. Sign up or log in (no waitlist — this is the live production sign-up).
3. On the dashboard, generate an **OAuth Client ID** and **Client Secret** pair.
4. Keep the page open — you'll paste both values in Step 2.

The same credential pair unlocks **both** services we use:
- `sdk.kms.*` — Space KMS (the headline path: key created in orbit, signs there)
- `sdk.ctrng.random()` — cosmic randomness

Treat the credentials like real production secrets. The SpaceComputer team is explicit about this in their guide: keep them server-side, never put them in a `NEXT_PUBLIC_*` variable, never commit a populated `.env`. Our `.env` is already in `.gitignore` and the credentials live only in the signer service (port 8080) — never in the browser bundle.

---

## Step 2 — REQUIRED · First-time setup

```bash
cp .env.example .env
npm run install:all
```

Open `.env` in your editor and paste your credentials into these two lines:

```
ORBITPORT_CLIENT_ID=<paste your client id here>
ORBITPORT_CLIENT_SECRET=<paste your client secret here>
```

Leave `ORBITPORT_MODE=real` (the default). The other endpoint URLs are correct for the production gateway.

---

## Step 3 — Run

```bash
npm run dev      # signer (8080) + cosmic-dark Next.js UI (4747)
npm run alt-ui   # Bloomberg + 4 alt aesthetics (5801–5805)
```

Then open the **canonical UI**:

> **▸ http://localhost:5804 ◂  — Bloomberg Agent Ops Terminal (main)**

What you should see:

- Top ticker: `ORBITPORT KMS LIVE (off-device TEE) · cTRNG STREAM ACTIVE …`
- Signer device panel: `mode REAL · signer KMS · ADDR 0x…`
- "AGENT OPS" section with a roster, spawn form, intent submitter and audit log
- Signer log in your terminal: `[signer] ready  mode=real  signerType=kms  address=0x…`

The other surfaces share the same backend and are kept maintained as alternative aesthetics:
- http://localhost:4747 — cosmic-dark Next.js (long-form pages: `/agents`, `/verify`, `/vulnerability`, …)
- http://localhost:5801 — Mission Control terminal
- http://localhost:5802 — Swiss / Editorial print
- http://localhost:5803 — Liquid Glass (Vision-Pro)
- http://localhost:5805 — Brutalist Newspaper

If credentials are missing or wrong, the UI shows a **fullscreen amber setup card** with the exact steps you must take. The signer terminal log prints a similar boxed message. The card auto-closes once it detects the signer is ready (it polls `/health` every 5 seconds), so you can paste credentials, restart, and the page reloads itself.

---

## Step 4 — *(Optional)* Spin up the alternative UI demos

Five additional aesthetic shells, each on its own port. All hit the same KMS-backed signer.

```bash
npm run alt-ui
```

| | |
|---|---|
| <http://localhost:5801> | Mission Control (terminal) |
| <http://localhost:5802> | Swiss / Editorial |
| <http://localhost:5803> | Liquid Glass |
| <http://localhost:5804> | Bloomberg Terminal |
| <http://localhost:5805> | Brutalist Newspaper |

Each one displays the same setup card if credentials are missing.

---

## Step 5 — *(Optional)* Talk to the SpaceComputer mentors at ETHPrague

The bounty literature names Filip, Amir, and Pedro as on-site mentors. A useful opener:

> "Hi — I'm building on the Space KMS track. I have it running end-to-end against live `accounts.spacecomputer.io` credentials, with cosmic-randomness binding into the signed payload via keccak256, on-chain `HollowVaultVerifier.sol`, and an in-browser broken-RNG attack reproduction that the KMS path structurally defeats. Can I show it to you for 90 seconds?"

---

## Step 6 — Right before the pitch

```bash
npm run smoke
```

This runs the in-process E2E test. You should see five green checkmarks across the cryptographic chain. If anything is red, that's what to fix before going on stage.

The smoke test deliberately uses local-signer mode (no network) so it works on flaky venue WiFi. Production mode requires the real Orbitport gateway to be reachable.

---

## Mock / offline mode (rare — not for production demo)

If you genuinely have no network and need to demo the cryptographic mechanics offline, set `ORBITPORT_MODE=mock` in `.env`. The signer will use a local secp256k1 key and generate synthetic-but-shape-compatible cosmic entropy. **The web UIs do NOT lean on this for the headline demo** — they're built around the real KMS path. Use mock only for the smoke test or as a last-ditch venue fallback.

---

## Quick troubleshooting

| symptom | fix |
|---|---|
| Fullscreen amber "Setup required" card | Credentials missing in `.env`. Follow Steps 1–2. |
| Fullscreen rose "Signer not reachable" card | Run `npm run dev` from the project root. |
| `auth0 token request failed: 401` / `403` | `ORBITPORT_CLIENT_ID` / `ORBITPORT_CLIENT_SECRET` wrong. Re-check the dashboard. |
| `Service not enabled within domain` | Audience is wrong. Must be exactly `https://op.spacecomputer.io/api`. The default in `.env.example` is correct. |
| Signer logs `alias contains unsupported characters` | Your `KMS_KEY_CACHE_PATH` was hand-edited; delete `.runtime/kms-key.json` and restart. |
| `port 4747 already in use` | `lsof -i :4747` to find the offender. Change the port in both `dev` and `start` scripts inside `web/package.json`. |
| `port 8080 already in use` | Set `SIGNER_PORT=8081` and `SIGNER_URL=http://localhost:8081` in `.env`. |
| `npm run dev` fails on `concurrently not found` | Run `npm run install:all` first. |
