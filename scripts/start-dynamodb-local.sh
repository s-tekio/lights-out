#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

docker compose up -d dynamodb-local

echo "DynamoDB Local starting on http://localhost:8000"
echo "Stop it with: docker compose down"
