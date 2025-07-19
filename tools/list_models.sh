#!/bin/bash

ENGINE="$1"

if [ -n "$ENGINE" ]; then
  jq -r '.models.chat[] | "\(.id): \(.name)"' ~/Library/Application\ Support/Witsy/engines/$ENGINE.json
else
  # Show all engines
  for file in ~/Library/Application\ Support/Witsy/engines/*.json; do
    engine_name=$(basename "$file" .json)
    echo "$engine_name:"
    jq -r '.models.chat[] | "  \(.id): \(.name)"' "$file"
  done
fi
