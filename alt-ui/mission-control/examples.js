/**
 * Canonical example messages reused across all alt-UI frontends. Each one
 * demonstrates a real Web3 / web signing pattern that benefits from
 * "key in orbit + cosmic timestamp + offline verifier".
 *
 * Variables {address} and {timestamp} are substituted at load time:
 *   {address}   → the signer's KMS-backed Ethereum address
 *   {timestamp} → the user's clock at the moment the example is loaded
 *
 * Each frontend includes a *copy* of this file (the static servers don't
 * share a path tree). Keep them in sync.
 */
window.HOLLOW_VAULT_EXAMPLES = [
  {
    id: "siwe",
    short: "Login (SIWE)",
    title: "Sign-In With Ethereum",
    blurb: "EIP-4361 challenge — universal Web3 login, no password needed",
    body: `hollow-vault.app wants you to sign in with your Ethereum account:
{address}

Sign in to Hollow Vault to access your dashboard.

URI: https://hollow-vault.app
Version: 1
Chain ID: 1
Nonce: 7f3e9a2c4d1a8b9e
Issued At: {timestamp}
Expiration Time: {expiration}`,
  },
  {
    id: "vote",
    short: "DAO vote",
    title: "Governance vote · Uniswap-style",
    blurb: "On-chain governance with cosmic-timestamped reasoning",
    body: `Uniswap Governance · Proposal #42
"Deploy Uniswap v4 on Base mainnet"

Voter: {address}
Vote:  YES — voting power 1,250 UNI
Reason: Multi-chain liquidity unlocks ~$50M TVL based on Llama Risk audit
        (2026-05). Latency profile measured at p95 < 800ms across mainnet
        ↔ Base bridges; risk-adjusted fee revenue projects +18% by Q4.
Snapshot: block 21,498,732
Cast at:  {timestamp}`,
  },
  {
    id: "bid",
    short: "Sealed bid",
    title: "Sealed-bid auction · anti-MEV",
    blurb: "Commit-reveal: bid locked to a cosmic moment, no front-running",
    body: `SealedBid · Lot CryptoPunk #7804

Bidder:    {address}
Bid:       12.5 ETH (sealed envelope)
Reveal:    block 21,500,000 (≈24h from cosmic timestamp)
Auction:   0x9f2c8741b5de77a3

The cosmic seed locks this bid to a fresh, unpredictable moment in orbit.
No replay, no late edits, no front-running by the auction operator.

Submitted: {timestamp}`,
  },
  {
    id: "predict",
    short: "Public prediction",
    title: "On-the-record · cosmic-timestamped call",
    blurb: "Prove you said it BEFORE the fact (the timestamp is in orbit)",
    body: `On The Record — cosmic-timestamped prediction.

I, {address}, hereby commit to the following prediction:

    ETH/USD will close above $5,000 on or before 2026-07-09 23:59 UTC.

This signature is bound to a satellite-attested cosmic-randomness draw
at this exact moment. I cannot retroactively claim I made this call
later — the cosmic seed could not have existed on Earth before the
satellite emitted it.

Wager: bragging rights. Confidence: medium-high.
Filed: {timestamp}`,
  },
  {
    id: "disclose",
    short: "Source disclosure",
    title: "Whistleblower disclosure · key in orbit",
    blurb: "$5-wrench attack stops working when there is no key to hand over",
    body: `Signed Disclosure — source-protection mode.

Source identifier: B7-2026-05
Document SHA-256:  0x4e5a7d9c1b3a82f7… (medical-pricing-records-2025-q4.zip)

I attest:

  · I provided the above document to journalist Sarah Klein on 2026-05-09.
  · The signing key for this attestation lives inside SpaceComputer's
    Orbitport KMS, not on any device I control. The "$5 wrench attack"
    cannot extract this key from me — I cannot be coerced into handing
    over what has never existed in my possession.
  · This signature establishes priority of disclosure if the story is
    later reproduced or contested.

Signer: {address}
Filed:  {timestamp}`,
  },
];

window.hollowVaultLoadExample = function (idx, address) {
  const ex = window.HOLLOW_VAULT_EXAMPLES[idx];
  if (!ex) return "";
  const now = new Date();
  const future = new Date(now.getTime() + 24 * 3600 * 1000);
  return ex.body
    .replace(/{address}/g, address || "<your-wallet-address>")
    .replace(/{timestamp}/g, now.toISOString())
    .replace(/{expiration}/g, future.toISOString());
};
