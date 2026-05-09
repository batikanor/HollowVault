#!/usr/bin/env bash
# Deploy CosmicVerifier to a local Anvil chain.
# Idempotent: if Anvil isn't running, starts it. Re-deploys cleanly each run.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME="$ROOT/.runtime"
mkdir -p "$RUNTIME"

PATH="$HOME/.foundry/bin:$PATH"

if ! command -v forge >/dev/null 2>&1; then
  echo "ERROR: foundry not installed. Run:"
  echo "  curl -L https://foundry.paradigm.xyz | bash && \"\$HOME/.foundry/bin/foundryup\""
  exit 1
fi

# Start Anvil if not already running
if ! curl -s -X POST http://localhost:8545 \
     -H 'content-type: application/json' \
     -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' >/dev/null 2>&1; then
  echo "→ starting anvil…"
  nohup anvil --chain-id 31337 --port 8545 > "$RUNTIME/anvil.log" 2>&1 &
  disown
  for i in $(seq 1 10); do
    sleep 0.5
    if curl -s -X POST http://localhost:8545 \
         -H 'content-type: application/json' \
         -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' >/dev/null 2>&1; then
      echo "  anvil up"
      break
    fi
  done
fi

DEPLOYER_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
DEPLOYER_ADDR="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

echo "→ deploying CosmicVerifier…"
cd "$ROOT/contracts"
OUTPUT=$(forge create --broadcast \
  --rpc-url http://localhost:8545 \
  --private-key "$DEPLOYER_KEY" \
  src/CosmicVerifier.sol:CosmicVerifier 2>&1)

ADDR=$(echo "$OUTPUT" | awk '/Deployed to:/ {print $3}')
TXH=$(echo "$OUTPUT" | awk '/Transaction hash:/ {print $3}')

if [ -z "$ADDR" ]; then
  echo "deploy failed:"
  echo "$OUTPUT"
  exit 1
fi

echo "  contract: $ADDR"
echo "  tx:       $TXH"

cat > "$RUNTIME/deployment.json" <<EOF
{
  "chainId": 31337,
  "rpcUrl": "http://localhost:8545",
  "verifierAddress": "$ADDR",
  "deployer": "$DEPLOYER_ADDR",
  "deployerKey": "$DEPLOYER_KEY",
  "deploymentTx": "$TXH",
  "network": "anvil-local",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "→ wrote $RUNTIME/deployment.json"
echo "✓ deploy:local complete"
