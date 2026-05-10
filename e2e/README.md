# E2E tests

Black-box tests that hit the deployed application as an external client would.
Useful as smoke after each Vercel deploy and as the canonical contract for
"this URL still serves Hollow Vault correctly."

## Run

```bash
# default target = production deployment
npm run test:e2e

# point at a different environment
HOLLOW_VAULT_URL=http://localhost:4747 npm run test:e2e
HOLLOW_VAULT_URL=https://hollow-vault-<sha>-batikanors-projects.vercel.app npm run test:e2e
```

The runner uses `node:test` + the global `fetch`, so there's no Playwright
or browser dependency. Tests are parallelisable per-file, ordered within
each file (because some scenarios reuse a previous attestation).

## Layout

```
e2e/
├── README.md                     # this file
├── runner.mjs                    # shared helpers (BASE_URL, fetchJSON, etc.)
└── suites/
    ├── 01-static.test.mjs        # / serves the HVLT terminal, alt-views 200
    ├── 02-api-smoke.test.mjs     # /api/health + /api/identity shape
    ├── 03-sign-roundtrip.test.mjs# sign → verify → tamper-rejected
    ├── 04-typed.test.mjs         # /api/sign-typed → recover with viem
    ├── 05-batch.test.mjs         # /api/sign-batch → N attestations + batchId
    ├── 06-validation.test.mjs    # 400s on bad input, no 5xx
    └── 07-agents-stub.test.mjs   # /api/agents returns JSON, never HTML 404
```

## Status — hackathon-stage scaffold

These suites are written **quick-structured for the ETHPrague 2026 demo**. They
cover the headline flows but trade depth for getting-it-shipped.

### Post-hackathon work — do this BEFORE adding new product features

The goal is one e2e test for every user-facing flow, plus failure-mode tests
for everything in the security threat model.

**Hardening pass (priority A):**
- [ ] Replay-attack: send the same attestation twice and assert the verifier
      still returns ok. Then assert the on-chain consumer rejects the second
      submission for `cosmicTimestampUnix < lastSeen`.
- [ ] Concurrency: 50 simultaneous `/api/sign` requests; assert all distinct
      payloadHashes, all valid, P50 ≤ 350ms warm.
- [ ] Cold-start measurement: deploy fresh, hit /api/sign once, assert
      `< 5s` and that subsequent requests reuse the cached SignerHandle.
- [ ] Setup-required path: deploy a copy with `ORBITPORT_CLIENT_ID` removed
      and assert /api/health returns the structured `setupRequired` payload
      and that the SetupGate component renders the steps.

**Coverage pass (priority B) — every page + every feature:**
- [ ] /typed (UI) — fill the form, sign, verify the on-page result.
- [ ] /batch (UI) — submit multi-line input, assert N result cards.
- [ ] /verify (UI) — paste a known-good attestation, all 5 checks green;
      paste a tampered one, the right step turns red.
- [ ] /vulnerability (UI) — broken-RNG demo recovers the private key;
      safe demo does not.
- [ ] /agents (local-dev only) — start the Express signer, spawn agent,
      submit allowed intent (signs), submit denied intent (policy reject),
      submit over-budget intent (policy reject + audit entry).
- [ ] /chain (local-dev only) — Anvil + deploy, post attestation on-chain,
      read it back from the verifier event log.
- [ ] /guestbook (local-dev only) — sign + post, list shows the entry,
      tamper attempt is rejected.
- [ ] LiveModePill — assert pill state matches /api/health (real, mock,
      setup-required, offline) for each environment.
- [ ] CosmicAnimation — play through full timeline; assert the cosmic-ray
      streak hits the device icon at t≈1.4s.

**Threat model regression (priority C):**
- [ ] Modify each field of the attestation in turn (message, messageHash,
      cosmic.seed, cosmic.timestamp, cosmic.satelliteSignature,
      cosmic.satellitePublicKey, payloadHash, signature, recoveryId,
      signerPublicKey, signerAddress, signedAt) and assert verify rejects
      with the correct step failing. We have a basic version of this in
      `tests/verifier.test.ts` but the e2e variant should hit the deployed
      `/api/verify` route to catch deploy/SDK drift.
- [ ] Stale cosmic — timestamp 25 hours in the future and 121 seconds in
      the past should both fail the freshness check.
- [ ] Crafted r,s — submit a signature with `s > N/2` (high-s) and assert
      the on-chain verifier rejects (malleability protection).

**Tooling (priority D):**
- [ ] Switch the runner to Playwright for the UI cases (we'll need real
      DOM events for the form-fill cases above). Keep the API cases on
      `node:test` + fetch — fast enough to run on every commit.
- [ ] Add a `npm run test:e2e:preview` that hits the latest preview
      deployment for the current branch (PR-time gate).
- [ ] Wire e2e into CI with `gh-actions-vercel` so each PR's preview gets
      tested before merge.
- [ ] Capture timing metrics → publish to a small dashboard (Grafana Cloud
      free tier is enough) so we can see latency regressions before users do.

**Do NOT add new product features until the priority A/B/C lists above
are green.** The whole pitch is "the bug we structurally kill"; we owe
every user the corresponding test that proves we still kill it.
