# Hollow Vault

> An Ethereum signing service whose private key has **never existed on this device**. The key was created inside SpaceComputer's Orbitport KMS — a Trusted Execution Environment held off-device, with on-orbit secure elements that "never export private keys" arriving on the [SpaceComputer roadmap](https://blog.spacecomputer.io/the-spacecomputer-roadmap/) (Q4 2026+) — and signs there. Each signature is bound to a fresh satellite-attested cosmic-randomness draw; the entire chain verifies offline.

Built for **ETHPrague 2026 — SpaceComputer bounty** ($6,000).
Tracks per the [official ETHPrague guide](https://spacecomputer.notion.site/ethprague-guide):
**Space KMS** (primary) · **Orbitport External Plugin** (drand-shape adapter) · **Space Fabric Trusted Application** (architectural stand-in only).

### Terminology used here matches SpaceComputer's canonical vocabulary

| we say | SpaceComputer canonical source |
|---|---|
| **Orbitport** | the [single API gateway](https://docs.spacecomputer.io/) for every SpaceComputer service |
| **Orbitport KMS** / **Space KMS** | [Key Management Service](https://blog.spacecomputer.io/kms-beyond-cloud/) — `sdk.kms.{createKey,sign,encrypt,decrypt,generateDataKey,rotateKey}` |
| **cTRNG** | "Cypherpunk Cosmic Randomness" — `sdk.ctrng.random()` ([beta announcement](https://blog.spacecomputer.io/cypherpunk-cosmic-randomness-ctrng-beta-now-live/)) |
| **Space Fabric** | the [satellite-native trusted computing architecture](https://arxiv.org/abs/2603.23745); reference hardware is the USB Armory Mk II |
| **off-device** (re: KMS today) | "TEE-secured KMS with hardware attestation from the ground" per the [satellite security services post](https://blog.spacecomputer.io/satellite-security-services/) |
| **on-orbit secure elements (Q4 2026+)** | "orbital nodes hold shares generated on board after launch" per the [roadmap](https://blog.spacecomputer.io/the-spacecomputer-roadmap/) |

We do **not** claim Proof of Execution Triangulation (Proof of ET), SEAP, Celestial Chain (L1), or Uncelestial Chain (L2) — none of those are part of this build.

---

## TL;DR — run it

```bash
cp .env.example .env
# paste ORBITPORT_CLIENT_ID + ORBITPORT_CLIENT_SECRET from
# https://accounts.spacecomputer.io/ into .env  (see HUMAN_STEPS.md)
npm run install:all
npm run dev          # signer + cosmic-dark Next.js UI
npm run alt-ui       # Bloomberg + 4 alt aesthetics
```

Then open the **Bloomberg Agent Ops Terminal** — the canonical UI for this project:

> **▸ http://localhost:5804 ◂  ← main**

The other surfaces share the same backend (port 8080 signer + Next.js verifier on 4747) and are kept maintained as alternative aesthetics:

| URL | role |
|---|---|
| **http://localhost:5804** | **Main · Bloomberg Agent Ops Terminal** (agents flow + sign + verify in one dense dashboard) |
| http://localhost:4747 | Cosmic-dark Next.js — long-form pages: `/agents`, `/verify`, `/vulnerability`, `/chain`, `/typed`, `/batch`, `/guestbook` |
| http://localhost:5801 | Mission Control · phosphor terminal aesthetic |
| http://localhost:5802 | Swiss / Editorial · print-bulletin aesthetic |
| http://localhost:5803 | Liquid Glass · Vision-Pro frosted-glass aesthetic |
| http://localhost:5805 | Brutalist Newspaper · broadsheet aesthetic |

Sub-second sanity check (no network):

```bash
npm run smoke
```

---

## Why this exists

The bug we structurally kill is the broken-RNG ECDSA nonce-reuse class — same family that compromised the Sony PS3 master signing key (fail0verflow, 27C3 2010) and a wave of Android Bitcoin wallets via the `SecureRandom` flaw (Bitcoin.org alert, 2013-08-11). Both happened because the signing key sat next to a faulty RNG on a device an attacker could read.

Hollow Vault flips the threat model in two ways at once:

1. **The signer was never in the room.** The secp256k1 key is created via `sdk.kms.createKey({ scheme: "ETHEREUM" })` inside Orbitport KMS; we get back only `{KeyId, Address, PublicKey}`. Every signature comes from `sdk.kms.sign({ messageType: "DIGEST", signingAlgorithm: "ETHEREUM_SECP256K1" })` — the private key never reaches our service, the user, the laptop, the browser, the disk. Phishing, $5-wrench attacks, and root-on-host attacks extract nothing because there is nothing local to extract.
2. **Each signature is bound to satellite-attested cosmic randomness.** A fresh cTRNG draw is fetched via `sdk.ctrng.random()` (same gateway, same credential pair). The cosmic seed and timestamp are folded into the keccak256-prefixed payload that KMS actually signs, so neither piece can be swapped post-hoc and replay across messages is impossible.

For offline / no-network demos, a `LocalSigner` fallback signs locally with `@noble/curves` and produces an identical-shaped attestation envelope. The verifier is signer-agnostic — same five checks pass against KMS-produced or local-produced signatures.

---

## Architecture

```
                                  ┌────────────────────────────────────────┐
                                  │     SpaceComputer Orbitport gateway    │
                                  │                                        │
                                  │  sdk.kms.createKey  → {keyId,addr}     │
                                  │  sdk.kms.sign(DIGEST) → r||s||v 65B    │
                                  │  sdk.ctrng.random() → cosmic bytes     │
                                  └────────────────────────────────────────┘
                                                ▲
                                                │ OAuth2 client_credentials
                                                │ (server-side credentials only)
┌──────────────────┐                    ┌───────┴──────────────────────────┐
│   Browser (UI)   │   POST /api/sign   │  Edge Signer Service             │
│  Next.js 15 app  │ ──────────────────▶│  · OrbitportSDK instance         │
│                  │                    │  · ensureKmsSigner OR            │
│                  │   POST /api/verify │    ensureLocalSigner             │
│                  │ ◀──────────────────│  · cosmic-binding payloadHash    │
│                  │                    │  · 4 sign endpoints + drand-shape│
└────────┬─────────┘                    └──────────────────────────────────┘
         │
         ▼
   Verifier (web/lib/verify.ts) — recovers signer address from r||s||v + payloadHash
   using @noble/curves with prehash:false (matches KMS DIGEST mode). Runs offline.
```

---

## What's verifiable, end-to-end

For each signature the offline verifier checks:

1. **Message hash** — `keccak256(message)` matches the claimed `messageHash`.
2. **Satellite signature** — ed25519 over `sha256(seed || timestamp)` against a published public key. The current public Orbitport cTRNG endpoint returns `{service, src, data}` without a per-call signature; we re-attest the bytes locally with a process-scoped ed25519 key so the verifier path stays uniform — `cosmic.source: "real"` records that the bytes themselves came from the live API. (When SpaceComputer's gateway begins emitting per-call signatures, this step swaps in cleanly with no envelope change.)
3. **Binding** — `payloadHash = keccak256("hollow-vault/v1|" || seed || "|" || ts || "|" || messageHash)` — exactly what KMS signed in DIGEST mode.
4. **ECDSA recovery** — `secp256k1.recoverPublicKey({prehash: false})` against `payloadHash` produces an Ethereum address matching the claimed signer.
5. **Freshness** — cosmic timestamp within ±2min / +24h window.

---

## Features

This isn't a "sign one message" demo. The build ships:

| feature | what it shows | where to find it |
|---|---|---|
| **Raw message signing** | the core cosmic-attested ECDSA flow with cosmic-ray UI animation | [/](http://localhost:4747/) |
| **EIP-712 typed data** | drop-in for any wagmi/viem dapp — Permits, votes, DEX orders, real Ethereum data shapes | [/typed](http://localhost:4747/typed) |
| **Batch signing** | one cTRNG draw → up to 50 sub-signatures via HMAC sub-seeding (bandwidth-aware design) | [/batch](http://localhost:4747/batch) |
| **On-chain anchoring** | one click signs + submits to a deployed `HollowVaultVerifier.sol`, waits for inclusion, reads back the `HollowVaultAttested` event | [/chain](http://localhost:4747/chain) |
| **Cosmic guestbook** | consumer demo: a public board where every post requires a verified cosmic attestation. QR-friendly for stage participation. | [/guestbook](http://localhost:4747/guestbook) |
| **Self-contained verifier** | five cryptographic checks, runs offline, zero SpaceComputer creds | [/verify](http://localhost:4747/verify) |
| **Live nonce-attack reproduction** | watch the Sony-PS3 / Android-wallet vulnerability recover a private key in your browser, then watch cosmic entropy neutralise it | [/vulnerability](http://localhost:4747/vulnerability) |
| **Solidity on-chain verifier** | `HollowVaultVerifier.sol` consumes attestations via `ecrecover`, ~31k gas, plug-in-able to any L2 contract | [`contracts/`](./contracts) |
| **Foundry tests + JS sim + live deployment** | `forge test` proves the contract; `npm run sim:contract` proves byte-for-byte hash match; `npm run deploy:local` deploys to Anvil and writes deployment.json the web app reads | [`contracts/test/`](./contracts/test) and [`scripts/`](./scripts) |
| **drand-compatible adapter** | `/info`, `/public/latest`, `/public/{round}` on the signer service. Any drand-using dApp can swap to hollow-vault with zero code change. | `signer/src/drand.ts` |
| **Real cTRNG via IPFS beacon** | three modes: `mock` (default, no network), `ipfs` (real cosmic bytes from SpaceComputer's no-auth public beacon), `real` (Auth0 + Orbitport API) | `signer/src/orbitport.ts` |
| **CLI** | `hollow sign/verify/batch` for headless / scripting / pipeline use | [`cli/`](./cli) |
| **In-process smoke test** | full E2E (sign → verify) with no network or Docker — sub-second sanity check before pitch | `npm run smoke` |

---

## Project layout

```
project_4_cosmic_signer/
├── README.md                ← you are here
├── EXPLANATION.md           ← junior-engineer-friendly walkthrough
├── HUMAN_STEPS.md           ← the only human-required actions
├── docker-compose.yml
├── .env.example
├── package.json             ← npm workspace root
├── signer/                  ← emulated edge device (USB Armory stand-in)
│   ├── Dockerfile
│   └── src/
│       ├── server.ts        ← Express HTTP — /health /identity /sign /sign-typed /sign-batch
│       ├── keystore.ts      ← persistent secp256k1 device identity
│       ├── orbitport.ts     ← cTRNG client (mock | real Auth0+Orbitport)
│       ├── attestation.ts   ← raw-message payload binding + ECDSA sign
│       ├── typed.ts         ← EIP-712 hashStruct + domainSeparator + sign
│       └── batch.ts         ← HMAC sub-seed derivation for batch signing
├── web/                     ← Next.js 15 + Tailwind v4 + React 19
│   ├── app/
│   │   ├── page.tsx              ← raw sign + cosmic-ray animation
│   │   ├── typed/page.tsx        ← EIP-712 typed-data
│   │   ├── batch/page.tsx        ← batch signing
│   │   ├── verify/page.tsx       ← verifier UI
│   │   ├── vulnerability/page.tsx← live nonce-attack demo
│   │   └── api/{sign,sign-typed,sign-batch,verify}/route.ts
│   ├── components/
│   └── lib/
│       ├── verify.ts             ← five-check offline verifier
│       ├── nonceAttack.ts        ← live broken-RNG reproduction
│       ├── typedExamples.ts      ← Permit / Vote / Order shapes
│       └── types.ts
├── contracts/               ← on-chain consumer
│   ├── src/HollowVaultVerifier.sol    ← ecrecover-based attestation verifier
│   ├── test/HollowVaultVerifier.t.sol ← Foundry round-trip + tamper tests
│   └── foundry.toml
├── cli/                     ← `hollow` headless tool
│   └── src/cli.ts
└── scripts/
    ├── smoke.ts             ← in-process E2E test
    └── contract-sim.ts      ← proves Solidity hash matches off-chain bytes
```

---

## Tech stack

- **Node 22** LTS, ES modules
- **TypeScript 5.6**
- **Next.js 15.5** (App Router, React 19.2)
- **Tailwind CSS v4.3**
- **@noble/curves v2** + **@noble/hashes v2** — modern audited cryptography (extra-entropy ECDSA via RFC 6979 §3.6)
- **viem v2.48** — Ethereum primitives
- **Express 4** for the signer service
- **zod** for input validation at every boundary
- **Solidity 0.8.27** + **Foundry** for the on-chain consumer contract
- **Docker Compose v2** for the signer container

---

## License

MIT — do whatever you want, attribution appreciated.
