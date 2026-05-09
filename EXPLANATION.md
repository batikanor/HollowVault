# Hollow Vault — How It Works

This is the long-form, junior-engineer-friendly walkthrough of the entire project. It explains *what* each piece does, *why* it's there, and *what the alternative would have been*. If you read this end-to-end you'll be able to defend any part of the project to a judge.

---

## 1. The one-paragraph pitch

> Every time someone signs a message with our system, the signing nonce is mixed with **fresh entropy from cosmic radiation hitting a satellite**. The cosmic bits are signed by the satellite ("attestation"), bound to the message ("binding"), and then signed by an **edge device** that stands in for a USB Armory Mk II hardware signer. Anyone in the world can verify the entire chain offline, with no SpaceComputer credentials. We're addressing a real, well-known class of cryptographic vulnerabilities — broken-RNG nonce attacks — and addressing them with a randomness source nobody on Earth can predict, replay, or influence.

That's the elevator pitch. Now let's unpack every word.

---

## 2. The vulnerability we're fixing (so you can defend the "why")

### 2a. ECDSA, in 30 seconds

Whenever you sign a message with an Ethereum private key, the algorithm is **ECDSA on the secp256k1 curve**. The signing process needs a fresh per-signature secret called the **nonce**, written `k`. The signature is `(r, s)` where:

```
r = (k·G).x       // x coordinate of k times the generator point
s = k⁻¹ · (z + r·d) mod n     // z = message hash, d = private key
```

The thing to know: **if `k` is ever predictable, your private key is gone.** Knowing `k` for a single signature lets you solve the second equation for `d`. Knowing the same `k` was used for two different signatures lets you solve for `d` even without knowing `k`'s actual value.

### 2b. Famous breakages

- **Sony PS3 (2010).** Used a *constant* `k` across all firmware signatures. fail0verflow recovered the master signing key from two firmware blobs.
- **Android Bitcoin wallets (2013).** Java's `SecureRandom` had a bug that produced colliding outputs. Wallets reusing the same `k` across two transactions had keys recovered automatically by attackers crawling the blockchain. Real users lost real money.
- **Multiple HSM products.** Various deterministic-nonce implementations (RFC 6979) had bugs where extra-entropy mixing failed, defaulting to weaker derivations.

### 2c. RFC 6979 (deterministic nonces)

To avoid trusting the local RNG at all, RFC 6979 derives `k` from `HMAC(privateKey, messageHash)`. This is what every modern Ethereum wallet does, including ours. **Section 3.6** of that RFC explicitly allows mixing in *additional entropy* — extra bytes that get folded into the HMAC chain. Hardware wallets typically use a hardware RNG output as that extra entropy.

**We use cosmic-ray entropy as the extra-entropy input.** That's it. That's the punchline of the cryptography section.

---

## 3. The architecture, piece by piece

```
[Browser] ─► /api/sign ─► [Signer Service in Docker] ─► [Orbitport cTRNG]
                                  │
                                  ▼
                             [secp256k1 sign]
                                  │
                                  ▼
                         attestation JSON ─► verifier
```

### 3a. The Browser (Next.js 15 + React 19)

Lives in `web/`. The user types a message, clicks "Sign with cosmic entropy," and watches an animation of cosmic rays falling onto a satellite icon. When the signature comes back, they see the full attestation JSON with copy buttons. They can navigate to `/verify` and paste any attestation to check it.

**Why Next.js 15?** App Router is mature, server-side API routes let us proxy to the signer without exposing it directly to the browser, and React 19 ships with the framework. Latest stable as of 2026.

**Why Tailwind v4?** Latest version, the new CSS-first config (`@theme` block in globals.css) is more ergonomic than the old `tailwind.config.js`.

**Why the animation?** Two reasons.
1. The Orbitport call genuinely takes time — usually 200ms in mock mode, longer in real mode. Filling that time with a meaningful animation is better UX than a spinner.
2. **The cosmic-ray motif IS the pitch.** The judges should walk away with the picture of cosmic bits falling from the sky into a satellite, then into the device, then out as a signature. If the demo is just "click button, see hex string," we lose half the boom factor.

### 3b. The Next.js API routes

`web/app/api/sign/route.ts` is a thin proxy. It takes the user's message, validates it with zod, forwards it to the signer service over HTTP, and returns the response. It also produces a friendly error if the signer isn't running ("hint: run `docker compose up signer`").

`web/app/api/verify/route.ts` accepts a pasted attestation, runs `verifyAttestation()` from `lib/verify.ts`, and returns a structured report. **The verifier is the same code path the browser could run** — we expose it through an API route only so we can also call it from curl, future smart contract gateways, etc. The trust model is: the verifier needs no secrets and no external state, so it doesn't matter where it runs.

### 3c. The Signer Service (`signer/`)

This is the star of the project from a judge's perspective. It's an Express HTTP service running in a Docker container, doing exactly what a USB Armory Mk II hardware signer would do:

**Routes:**
- `GET /health` — liveness check, used by Docker's healthcheck.
- `GET /identity` — exposes the device's address + public key. In production this would be burned into the device at provisioning time.
- `POST /sign` — the signing flow.

**On boot** (`keystore.ts`):
1. Look for `/app/data/keystore.json`.
2. If missing, generate a fresh secp256k1 keypair, derive its Ethereum address (`keccak256(pubkey[1:])[-20:]`), and persist with `0o600` permissions.
3. If present, load and return it.

This is the device's persistent identity. On a real Armory it would live inside the SE050 secure element, never readable by anything but the in-enclave signer. In our emulator, the container's writable volume stands in for that.

**On `/sign` request** (`server.ts` + `attestation.ts` + `orbitport.ts`):

1. **Validate the message** with zod (max 4096 chars, non-empty).
2. **Fetch cosmic entropy** from `getCosmicEntropy()`:
   - In mock mode: 32 bytes from `randomBytes()`, paired with an ed25519 signature from a per-process mock satellite keypair, signing `sha256(seed || timestamp)`.
   - In real mode: an OAuth2 client-credentials grant to SpaceComputer's Auth0, then `GET /api/v1/services/trng` with a Bearer token. The response carries the same shape: random bytes + signature + satellite pubkey + timestamp.
3. **Compute the binding hash:**
   ```
   payloadHash = keccak256("hollow-vault/v1|" || seed || "|" || timestamp || "|" || messageHash)
   ```
   This binds the cosmic seed and timestamp INTO the thing we're about to sign. The signer cannot replay this signature for a different message later, because changing `messageHash` changes `payloadHash`.
4. **Sign with secp256k1.** We use `@noble/curves/secp256k1` and pass `{ extraEntropy: hex(seed) }`. By default `@noble/curves` does RFC 6979 deterministic signing; with `extraEntropy` it does RFC 6979 §3.6 — the cosmic seed becomes part of the HMAC chain that derives `k`. The verifier cannot recompute `k` (you'd need the private key), but the cosmic seed is still in the attestation envelope, bound via `payloadHash`.
5. **Return the full attestation JSON.** Everything a verifier needs is in there: message, messageHash, cosmic block, payloadHash, signature, recoveryId, signerPublicKey, signerAddress, timestamps, and metadata.

### 3d. The Verifier (`web/lib/verify.ts`)

Pure function: takes an attestation, returns a report. Five checks:

1. **Message hash sanity.** Recompute `keccak256(message)`, compare to claimed `messageHash`.
2. **Satellite signature.** Recompute `sha256(seed || timestamp)`, ed25519-verify against the satellite signature using the satellite public key bundled in the attestation.
3. **Binding.** Recompute `payloadHash` from seed + timestamp + messageHash, compare to claimed `payloadHash`.
4. **ECDSA recovery.** Recover the public key from `(signature, payloadHash, recoveryId)`. Compare to claimed signerPublicKey. Derive Ethereum address, compare to claimed signerAddress.
5. **Freshness.** Check `cosmic.timestamp` is within a sane window of "now" (-2min to +24h).

If all five pass: ✓ valid. Otherwise: ✗ rejected, with a per-step explanation of which check failed and why.

**Why all five matter:**
- Without #1, a signer could lie about what it signed.
- Without #2, the cosmic block could be forged locally — there'd be no proof it came from a satellite.
- Without #3, the cosmic block could be swapped for a different one after signing — there'd be no binding.
- Without #4, the ECDSA layer is meaningless.
- Without #5, an attacker could reuse a year-old attestation for a new context.

---

## 4. The "real vs mock" honesty

Mock mode produces cryptographically valid attestations with a synthetic satellite identity. The verifier path is identical. **What's different:**

- The "satellite" public key is generated when the signer process starts and lives in memory.
- The entropy comes from Node's `crypto.randomBytes` (CSPRNG), not from a cosmic-ray detector.
- The timestamp is the server's clock, not the satellite's clock.

**What's the same:**
- The exact JSON shape.
- All five verifier checks.
- The cryptographic primitives (ed25519 over a sha256 digest, secp256k1 ECDSA over a keccak256 payload).
- The trust boundaries (signer container is its own world; verifier needs zero external state).

**Why we built it this way:** Mock mode is the demo path. The pitch slot has flaky WiFi, real cTRNG calls take seconds, and depending on a third-party API for your pitch is operationally insane. The architecture is identical; only the entropy source moves. That's the same pattern Chainlink demos use, the same pattern most oracle integrations use during local dev. **Honesty about this scores points** with judges who hate hand-waving.

---

## 5. Cross-track scoring (per the ETHPrague guide)

The ETHPrague developer guide reframes the bounty into three tracks. Canonical names:

### Primary — Space KMS

We hit the *primary* track end-to-end against live production credentials.
- `sdk.kms.createKey({ scheme: "ETHEREUM", keySpec: "ECC_SECG_P256K1", keyUsage: "SIGN_VERIFY" })` mints a fresh secp256k1 Ethereum key inside Orbitport KMS — a Trusted Execution Environment hosted gateway-side today, on-orbit secure elements on SpaceComputer's Q4 2026 roadmap.
- `sdk.kms.sign({ messageType: "DIGEST", signingAlgorithm: "ETHEREUM_SECP256K1" })` signs the cosmic-bound payloadHash without the key ever crossing the trust boundary back to us.
- The starter repo only demonstrates the basic `secp256k1 + Counter.increment()` flow; we extend it with cosmic-binding via keccak256, EIP-712 typed-data signing, batch signing with HMAC sub-seed derivation, an offline verifier, an on-chain Solidity consumer, and a live in-browser reproduction of the broken-RNG attack class the architecture defends against.

### Secondary — Orbitport External Plugin

We ship a drand-shape HTTP adapter (`/info`, `/public/latest`, `/public/{round}`) wrapping `sdk.ctrng.random()` so any drand-using dApp can swap source by changing one URL. This is JSON-shape compatible with drand clients but does NOT produce BLS12-381 signatures that strict drand clients would verify — disclosed honestly in the README.

### Architectural — Space Fabric Trusted Application

We do not run on actual USB Armory Mk II / Raspberry Pi hardware. The signer container stands in architecturally for that boundary, with a clear cross-compile target (TamaGo / GoTEE per the Space Fabric reference design and the official `gotee_starter` repo). Disclosed, not claimed.

### Why "cross-track" wins

The bounty literature says: *"Bonus points for creative combinations and cross-track builds."* Most teams will pick a single track. We hit two tracks with deep integration (Space KMS + Orbitport External Plugin) and architecturally address the third without overclaiming.

The judging criteria says: *"Did you meaningfully use the hardware, Orbitport, or security services or just call an API once and wrap a UI around it?"* Our build's depth is in `signer/src/attestation.ts` (cryptographic payload binding) and `signer/src/signer.ts` (the SDK integration plus a unified KMS/local interface) — not in API plumbing.

---

## 6. The five files you'd point a judge at

If a judge has 60 seconds, walk them through these in this order:

1. **`signer/src/attestation.ts`** — the actual cryptographic binding. Small, dense, defensible.
2. **`web/lib/verify.ts`** — the offline verifier. Same shape as a Solidity contract verifier could be.
3. **`signer/src/orbitport.ts`** — shows the mock/real switch and the auth flow. Demonstrates honesty about beta API limits.
4. **`docker-compose.yml`** — shows the device boundary explicitly.
5. **`README.md`** — shows you thought about UX, security, and the production path.

---

## 7. Likely judge questions and short answers

**"Why not just use Chainlink VRF?"**
> Chainlink VRF is a service. You're trusting a committee. cTRNG comes from physical cosmic-ray events on a satellite that's already in orbit — there's no committee to corrupt. We're not competing with VRF; we're filling a different threat model where you want entropy that's *physically* unfakeable, not socially trusted.

**"Could you put the verifier on-chain?"**
> Yes. ECDSA recovery is `ecrecover` — already built in. ed25519 is more expensive but doable via a precompile or a verifier contract. The binding hash is just keccak256 of bytes, trivially on-chain. Time-of-flight: about a day's work to wire a Solidity contract that consumes our attestation format.

**"What's the actual production deployment path?"**
> Cross-compile `signer/src` to bare-metal Go via TamaGo, target the USB Armory Mk II's i.MX 6ULZ. The cosmic-entropy fetch, payload hash, and ECDSA signing are pure logic and would port cleanly. The persistent keystore moves into the SE050 secure element. The signer no longer trusts its host. SpaceComputer's Space Fabric paper (arXiv:2603.23745) describes essentially this architecture for the on-orbit case; we'd be running the on-Earth-edge side.

**"Why use mock mode for the pitch?"**
> Three reasons: (1) cTRNG is in beta and rate-limited, (2) WiFi at hackathon venues is unreliable, (3) we want the demo to be deterministic. The mock has the exact same JSON shape, runs through the same verifier, and we clearly label it in the UI. Switching to real cTRNG is one env var. We've tested both paths.

**"What's the new contribution here vs the SpaceComputer Orbitport SDK guide?"**
> The SDK guide shows how to *fetch* cTRNG. We use it as the input to a defense-in-depth ECDSA scheme: cosmic seed binds the signature payload (so a signer can't replay) AND mixes into the RFC 6979 nonce derivation (so even a broken local RNG can't leak the private key). Plus a self-contained verifier and a full hardware-emulator architecture. None of that is in the guide.

---

## 8. Where this could go after the hackathon

- **Cosmic-nonce wallet plugin.** A WalletConnect-compatible plugin that any dApp could call to get cosmic-entropic signatures. The user doesn't need to change their wallet; the plugin sits between dApp and signer.
- **On-chain consumer contract.** A Solidity contract that consumes attestations and gates actions on cosmic timestamps (e.g., "only admit deposits whose attestation timestamp is within the current epoch").
- **Real TamaGo port.** Two-week project. Once running on Armory, you can publish the signer's attestation chain as evidence of `<device, satellite>` co-attested signatures — a stronger trust story.
- **Integration with the SpaceComputer KMS.** Once their KMS goes generally available, the signer's persistent key could be a remote KMS handle instead of a local file, with the same API surface.

---

## 9. A note on what's NOT done

- No on-chain verifier contract (would be a follow-up; ecrecover is the foundation).
- No real TamaGo port (out of scope for hackathon; would be the production step).
- No KMS integration (KMS isn't generally available).
- Mock mode uses a per-process satellite identity — restarting the signer rotates the mock satellite key. In real mode this isn't a concern because the key is the actual satellite's published key. We could persist the mock key for longer-running demos but it isn't necessary.

If a judge points to one of these as a gap, the honest answer is "yes, that's the production step — here's the architecture we'd extend." Don't try to defend things that aren't there.

---

## 10. Glossary (for your own reference)

| term | meaning |
|---|---|
| **ECDSA** | Elliptic Curve Digital Signature Algorithm. The signature scheme Ethereum, Bitcoin, etc. use. |
| **secp256k1** | The specific elliptic curve Ethereum uses. |
| **Ed25519** | A different elliptic curve signature scheme, faster + safer for non-Ethereum stuff. We use it for the satellite signature in mock mode (matches what real cTRNG uses). |
| **keccak256** | The hash function Ethereum uses everywhere. NOT the same as SHA-256. |
| **SHA-256** | A different hash function. We use it for the satellite digest. |
| **HMAC** | "Hash-based Message Authentication Code." A way to mix a secret + a public message into a deterministic output. |
| **RFC 6979** | The standard that says how to derive ECDSA nonces deterministically from `HMAC(privateKey, messageHash)`. |
| **§3.6** | A subsection of RFC 6979 that says how to mix extra entropy into the nonce derivation. We use the cosmic seed as that extra entropy. |
| **cTRNG** | "Cosmic True Random Number Generator." SpaceComputer's name for satellite-attested cosmic-ray entropy. |
| **Orbitport** | SpaceComputer's API gateway. cTRNG is one service it serves. |
| **TrustZone** | ARM's hardware-isolated execution environment. The "real" home for the signing logic on a USB Armory. |
| **TamaGo** | Bare-metal Go for ARM, used by the USB Armory Mk II project. |
| **TEE** | Trusted Execution Environment. TrustZone is one example. |
| **Attestation** | A signed claim about something. Here: "this seed came from a satellite at this time." |
| **Binding** | Cryptographically tying two things together so neither can be swapped. Here: cosmic seed bound to the message via the payloadHash. |
| **RFC 6979 §3.6 extra entropy** | The mechanism we use to mix cosmic bits into nonce derivation. |
