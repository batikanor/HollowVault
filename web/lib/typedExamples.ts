/**
 * A library of common real-world EIP-712 message shapes the user can pick
 * from to demo. These match what wagmi/viem/Permit2/Seaport actually emit,
 * so judges who know their Ethereum will recognise them on sight.
 */

export const PERMIT_EXAMPLE = {
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
} as const;

export const VOTE_EXAMPLE = {
  domain: {
    name: "ETHPrague Cosmic DAO",
    version: "1",
    chainId: 1,
    verifyingContract: "0x0000000000000000000000000000000000C05M1C",
  },
  types: {
    Vote: [
      { name: "proposalId", type: "uint256" },
      { name: "support", type: "uint8" },
      { name: "voter", type: "address" },
      { name: "reason", type: "string" },
    ],
  },
  primaryType: "Vote",
  message: {
    proposalId: "42",
    support: 1,
    voter: "0x1111111111111111111111111111111111111111",
    reason: "Funded by cosmic rays.",
  },
} as const;

export const ORDER_EXAMPLE = {
  domain: {
    name: "Cosmic Marketplace",
    version: "1",
    chainId: 1,
    verifyingContract: "0xC05M1C00000000000000000000000000000C05M1C",
  },
  types: {
    Order: [
      { name: "maker", type: "address" },
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minAmountOut", type: "uint256" },
      { name: "expiry", type: "uint256" },
      { name: "salt", type: "uint256" },
    ],
  },
  primaryType: "Order",
  message: {
    maker: "0x1111111111111111111111111111111111111111",
    tokenIn: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    tokenOut: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    amountIn: "1000000000",
    minAmountOut: "300000000000000000",
    expiry: "1799999999",
    salt: "0x1234567890",
  },
} as const;

export const EXAMPLES = [
  { id: "permit", label: "USDC Permit (EIP-2612)", payload: PERMIT_EXAMPLE },
  { id: "vote", label: "Governance Vote", payload: VOTE_EXAMPLE },
  { id: "order", label: "DEX Order", payload: ORDER_EXAMPLE },
] as const;
