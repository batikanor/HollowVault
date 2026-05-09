/**
 * On-chain integration. Reads the deployment artifact written by the deploy
 * script and exposes a thin viem client + helpers for submitting cosmic
 * attestations to the HollowVaultVerifier contract.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  parseAbi,
  decodeEventLog,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry, sepolia } from "viem/chains";
import type { Attestation } from "./types";

const DEPLOYMENT_PATH = resolve(process.cwd(), "..", ".runtime", "deployment.json");

interface Deployment {
  chainId: number;
  rpcUrl: string;
  verifierAddress: Address;
  deployer: Address;
  deployerKey: Hex;
  network: string;
}

let cached: Deployment | null = null;

export function loadDeployment(): Deployment | null {
  if (cached) return cached;
  if (!existsSync(DEPLOYMENT_PATH)) return null;
  const raw = readFileSync(DEPLOYMENT_PATH, "utf8");
  cached = JSON.parse(raw) as Deployment;
  return cached;
}

const VERIFIER_ABI = parseAbi([
  "function payloadHash(bytes32 cosmicSeed, string calldata cosmicTimestamp, bytes32 messageHash) public pure returns (bytes32)",
  "function verify(bytes32 cosmicSeed, string calldata cosmicTimestamp, bytes32 messageHash, bytes32 r, bytes32 s, uint8 v, address claimedSigner) public pure returns (bool)",
  "function attest(bytes32 cosmicSeed, string calldata cosmicTimestamp, uint256 cosmicTimestampUnix, bytes32 messageHash, bytes32 r, bytes32 s, uint8 v, address claimedSigner) external returns (bool)",
  "event HollowVaultAttested(address indexed signer, bytes32 indexed messageHash, bytes32 cosmicSeed, uint256 cosmicTimestampUnix)",
]);

function chainFor(chainId: number) {
  if (chainId === foundry.id) return foundry;
  if (chainId === sepolia.id) return sepolia;
  return { ...foundry, id: chainId };
}

function publicClient(d: Deployment) {
  return createPublicClient({
    chain: chainFor(d.chainId),
    transport: http(d.rpcUrl),
  });
}

function walletClient(d: Deployment) {
  return createWalletClient({
    chain: chainFor(d.chainId),
    transport: http(d.rpcUrl),
    account: privateKeyToAccount(d.deployerKey),
  });
}

function splitSignature(att: Attestation): { r: Hex; s: Hex; v: number } {
  const compact = att.signature.toLowerCase().replace(/^0x/, "");
  if (compact.length !== 128) throw new Error(`expected 64-byte sig, got ${compact.length / 2} bytes`);
  const r = ("0x" + compact.slice(0, 64)) as Hex;
  const s = ("0x" + compact.slice(64, 128)) as Hex;
  const v = att.recoveryId + 27;
  return { r, s, v };
}

function unixSecondsFromIso(iso: string): bigint {
  return BigInt(Math.floor(new Date(iso).getTime() / 1000));
}

export interface OnchainAttestResult {
  txHash: Hex;
  blockNumber: string;
  gasUsed: string;
  status: "success" | "reverted";
  signer: Address;
  messageHash: Hex;
  cosmicSeedTopic: Hex;
  explorerUrl: string | null;
}

export async function submitAttestationOnchain(att: Attestation): Promise<OnchainAttestResult> {
  const d = loadDeployment();
  if (!d) {
    throw new Error("no deployment found at .runtime/deployment.json — run `npm run deploy:local` first");
  }

  const pc = publicClient(d);
  const wc = walletClient(d);
  const { r, s, v } = splitSignature(att);
  const seed32 = ("0x" + att.cosmic.seed) as Hex;
  const messageHash = att.messageHash as Hex;
  const cosmicTs = att.cosmic.timestamp;
  const cosmicTsUnix = unixSecondsFromIso(cosmicTs);

  const txHash = await wc.writeContract({
    address: d.verifierAddress,
    abi: VERIFIER_ABI,
    functionName: "attest",
    args: [seed32, cosmicTs, cosmicTsUnix, messageHash, r, s, v, att.signerAddress as Address],
  });

  const receipt = await pc.waitForTransactionReceipt({ hash: txHash });

  // Find our event in the logs
  let signer: Address = att.signerAddress as Address;
  let cosmicSeedTopic: Hex = seed32;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: VERIFIER_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "HollowVaultAttested") {
        signer = decoded.args.signer as Address;
        cosmicSeedTopic = decoded.args.cosmicSeed as Hex;
      }
    } catch {
      /* not our event */
    }
  }

  const explorerUrl =
    d.chainId === sepolia.id ? `https://sepolia.etherscan.io/tx/${txHash}` : null;

  return {
    txHash,
    blockNumber: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
    status: receipt.status,
    signer,
    messageHash,
    cosmicSeedTopic,
    explorerUrl,
  };
}

export interface OnchainHistoryItem {
  txHash: Hex;
  blockNumber: string;
  signer: Address;
  messageHash: Hex;
  cosmicSeed: Hex;
  cosmicTimestampUnix: string;
}

export async function readRecentAttestations(limit = 25): Promise<OnchainHistoryItem[]> {
  const d = loadDeployment();
  if (!d) return [];
  const pc = publicClient(d);
  const head = await pc.getBlockNumber();
  const fromBlock = head > 5000n ? head - 5000n : 0n;
  const logs = await pc.getContractEvents({
    address: d.verifierAddress,
    abi: VERIFIER_ABI,
    eventName: "HollowVaultAttested",
    fromBlock,
    toBlock: "latest",
  });
  return logs
    .slice(-limit)
    .reverse()
    .map((l) => ({
      txHash: l.transactionHash as Hex,
      blockNumber: l.blockNumber.toString(),
      signer: l.args.signer as Address,
      messageHash: l.args.messageHash as Hex,
      cosmicSeed: l.args.cosmicSeed as Hex,
      cosmicTimestampUnix: (l.args.cosmicTimestampUnix ?? 0n).toString(),
    }));
}

export function getDeploymentInfo() {
  const d = loadDeployment();
  if (!d) return null;
  return {
    chainId: d.chainId,
    rpcUrl: d.rpcUrl,
    verifierAddress: d.verifierAddress,
    network: d.network,
  };
}
