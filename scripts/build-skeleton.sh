#!/bin/bash

# Default to current directory if no args provided
SEARCH_PATHS=("${@:-.}")

mkdir -p .context

echo "Building skeleton for paths: ${SEARCH_PATHS[*]}" >&2

# Repo map (keep short)
rg --files "${SEARCH_PATHS[@]}" > .context/files.txt

# High-signal markers
rg -n "TODO|FIXME|HACK|XXX" "${SEARCH_PATHS[@]}" > .context/markers.txt || true

# Entry points (adjust for your stack)
rg -n "main\(|createServer\(|app\.listen\(|router|export default function|handler\(|defineConfig" "${SEARCH_PATHS[@]}" \
  > .context/entrypoints.txt || true

# TypeScript/JavaScript public API-ish signatures (patterns are intentionally broad)
# Using ast-grep (sg) if available, otherwise falling back or failing gracefully
if command -v ast-grep &> /dev/null; then
  CMD="ast-grep"
elif command -v sg &> /dev/null; then
  CMD="sg"
else
  echo "ast-grep not found. Skipping AST extraction." >&2
  CMD="false"
fi

if [ "$CMD" != "false" ]; then
  $CMD -l ts -p "export function \$NAME(\$\$\$ARGS) { \$\$\$BODY }" "${SEARCH_PATHS[@]}" > .context/exports_fn_ts.txt || true
  $CMD -l ts -p "export class \$NAME { \$\$\$BODY }" "${SEARCH_PATHS[@]}" > .context/exports_class_ts.txt || true
  $CMD -l ts -p "export interface \$NAME { \$\$\$BODY }" "${SEARCH_PATHS[@]}" > .context/exports_iface_ts.txt || true
  $CMD -l ts -p "export type \$NAME = \$\$\$RHS" "${SEARCH_PATHS[@]}" > .context/exports_type_ts.txt || true
fi

# Combine into a single skeleton doc (keep it lean)
{
  echo "# Repo Skeleton"
  echo
  echo "## Files"
  sed -n '150,200p' .context/files.txt
  echo
  echo "## Entrypoints"
  sed -n '150,200p' .context/entrypoints.txt
  echo
  echo "## Markers"
  sed -n '150,200p' .context/markers.txt
  echo
  echo "## TS Exports (functions)"
  [ -f .context/exports_fn_ts.txt ] && sed -n '150,200p' .context/exports_fn_ts.txt
  echo
  echo "## TS Exports (classes)"
  [ -f .context/exports_class_ts.txt ] && sed -n '150,200p' .context/exports_class_ts.txt
  echo
  echo "## TS Types/Interfaces"
  [ -f .context/exports_iface_ts.txt ] && sed -n '150,200p' .context/exports_iface_ts.txt
  [ -f .context/exports_type_ts.txt ] && sed -n '150,200p' .context/exports_type_ts.txt
} > .context/skeleton.md

# Size Guardrail
SIZE_KB=$(du -k .context/skeleton.md | cut -f150)
if [ "$SIZE_KB" -gt 150 ]; then
  echo "ERROR: Skeleton size (${SIZE_KB}KB) exceeds limit of 150KB." >&2
  echo "Please enable targeted context mode by passing specific paths:" >&2
  echo "  ./scripts/build-skeleton.sh app/some-feature lib/utils" >&2
  exit 150
fi

echo "Skeleton built successfully (${SIZE_KB}KB)." >&2
