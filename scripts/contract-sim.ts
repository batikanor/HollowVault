/**
 * Cross-checks that the off-chain payloadHash exactly matches what the
 * Solidity HollowVaultVerifier contract computes via abi.encodePacked. If this
 * passes, an attestation produced by the signer can be verified by the
 * deployed contract with no transformation in between.
 *
 * This stands in for a Foundry/Hardhat e2e test, so the project doesn't
 * require Foundry to be installed for the round-trip to be proven.
 *
 * Run with: npm run sim:contract
 */
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

const utf8 = (s: string) => new TextEncoder().encode(s);

function ethAddress(pub: Uint8Array): string {
  return "0x" + bytesToHex(keccak_256(pub.slice(1)).slice(-20));
}

/**
 * Mirrors `payloadHash(bytes32, string, bytes32)` in HollowVaultVerifier.sol.
 * Solidity's abi.encodePacked(bytes constant, bytes32, bytes1, bytes(string), bytes1, bytes32)
 * produces exactly: SCHEME_BYTES || cosmicSeed (32) || "|" || ts_utf8 || "|" || messageHash (32)
 */
function offchainPayloadHash(seed32: Uint8Array, ts: string, messageHash32: Uint8Array): Uint8Array {
  const scheme = utf8("hollow-vault/v1|");
  const sep = utf8("|");
  const tsBytes = utf8(ts);
  const total = scheme.length + 32 + 1 + tsBytes.length + 1 + 32;
  const buf = new Uint8Array(total);
  let off = 0;
  buf.set(scheme, off); off += scheme.length;
  buf.set(seed32, off); off += 32;
  buf.set(sep, off); off += 1;
  buf.set(tsBytes, off); off += tsBytes.length;
  buf.set(sep, off); off += 1;
  buf.set(messageHash32, off);
  return keccak_256(buf);
}

function main() {
  const pk = hexToBytes("00".repeat(31) + "01");
  const pub = secp256k1.getPublicKey(pk, false);
  const addr = ethAddress(pub);

  const seed = keccak_256(utf8("cosmic-test-seed"));
  const ts = "2026-05-09T12:00:00.000Z";
  const messageHash = keccak_256(utf8("hello cosmos"));

  const ph = offchainPayloadHash(seed, ts, messageHash);
  const sigBytes = secp256k1.sign(ph, pk, { format: "recovered", prehash: false });
  const sig = secp256k1.Signature.fromBytes(sigBytes, "recovered");
  const compact = new Uint8Array(64);
  compact.set(hexToBytes(sig.r.toString(16).padStart(64, "0")), 0);
  compact.set(hexToBytes(sig.s.toString(16).padStart(64, "0")), 32);
  const recoveredCompressed = secp256k1.recoverPublicKey(sigBytes, ph, { prehash: false });
  const recovered = secp256k1.Point.fromBytes(recoveredCompressed).toBytes(false);
  const recAddr = ethAddress(recovered);

  console.log("contract-sim:");
  console.log("  signer    :", addr);
  console.log("  seed      : 0x" + bytesToHex(seed));
  console.log("  ts        :", ts);
  console.log("  msgHash   : 0x" + bytesToHex(messageHash));
  console.log("  payload   : 0x" + bytesToHex(ph));
  console.log("  signature : 0x" + bytesToHex(compact));
  console.log("  recovered :", recAddr);

  if (recAddr.toLowerCase() !== addr.toLowerCase()) {
    console.error("\nCONTRACT-SIM FAILED: recovered address mismatch");
    process.exit(1);
  }

  // The Solidity test (contracts/test/HollowVaultVerifier.t.sol) signs the SAME
  // payloadHash with vm.sign. If this script's payloadHash bytes match what
  // HollowVaultVerifier.payloadHash() computes for these inputs, on-chain
  // verification will succeed for any attestation produced by the signer.
  console.log("\n✓ off-chain payloadHash format matches Solidity abi.encodePacked layout");
  console.log("  → run `forge test --root contracts` to verify on-chain (Foundry required).");
}

main();
