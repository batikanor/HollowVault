import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashTypedData } from "viem";
import { eip712Digest, type EIP712TypedData } from "../signer/src/typed.js";

const usdcPermit: EIP712TypedData = {
  domain: {
    name: "USD Coin",
    version: "2",
    chainId: 1,
    verifyingContract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  },
  types: {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
  primaryType: "Permit",
  message: {
    owner: "0x1111111111111111111111111111111111111111",
    spender: "0x2222222222222222222222222222222222222222",
    value: "1000000",
    nonce: "0",
    deadline: "1799999999",
  },
};

describe("EIP-712 hashStruct + domainSeparator", () => {
  it("agrees with viem.hashTypedData for a USDC Permit", () => {
    const ours = "0x" + Buffer.from(eip712Digest(usdcPermit)).toString("hex");
    const viemDigest = hashTypedData({
      domain: {
        name: usdcPermit.domain.name,
        version: usdcPermit.domain.version,
        chainId: usdcPermit.domain.chainId,
        verifyingContract: usdcPermit.domain.verifyingContract as `0x${string}`,
      },
      types: usdcPermit.types as Record<string, { name: string; type: string }[]>,
      primaryType: usdcPermit.primaryType,
      message: {
        owner: usdcPermit.message.owner as `0x${string}`,
        spender: usdcPermit.message.spender as `0x${string}`,
        value: BigInt(usdcPermit.message.value as string),
        nonce: BigInt(usdcPermit.message.nonce as string),
        deadline: BigInt(usdcPermit.message.deadline as string),
      },
    });
    assert.equal(ours.toLowerCase(), viemDigest.toLowerCase());
  });

  it("changes when the message field changes", () => {
    const a = eip712Digest(usdcPermit);
    const altered: EIP712TypedData = {
      ...usdcPermit,
      message: { ...usdcPermit.message, value: "1000001" },
    };
    const b = eip712Digest(altered);
    assert.notEqual(Buffer.from(a).toString("hex"), Buffer.from(b).toString("hex"));
  });

  it("changes when the chainId changes", () => {
    const a = eip712Digest(usdcPermit);
    const replay: EIP712TypedData = {
      ...usdcPermit,
      domain: { ...usdcPermit.domain, chainId: 137 },
    };
    const b = eip712Digest(replay);
    assert.notEqual(Buffer.from(a).toString("hex"), Buffer.from(b).toString("hex"));
  });
});
