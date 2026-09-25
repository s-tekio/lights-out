#!/usr/bin/env bash
set -euo pipefail

package_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dist_dir="${package_root}/dist"

mkdir -p "${dist_dir}"
cat > "${dist_dir}/package.json" <<'PKG'
{
  "type": "module"
}
PKG

echo "Wrote ${dist_dir}/package.json"
