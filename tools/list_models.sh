#!/bin/bash

ENGINE="$1"

if [ -n "$ENGINE" ]; then
  # Filter for specific engine
  jq -r --arg engine "$ENGINE" '.engines | to_entries | map(select(.key == $engine and (.value.models.chat | length) > 0)) | map("\(.key):\n" + (.value.models.chat | map("  - \(.id)") | join("\n"))) | .[]' ~/Library/Application\ Support/Witsy/settings.json
else
  # Show all engines
  jq -r '.engines | to_entries | map(select(.key != "__favorites__" and (.value.models.chat | length) > 0)) | map("\(.key):\n" + (.value.models.chat | map("  - \(.id)") | join("\n"))) | .[]' ~/Library/Application\ Support/Witsy/settings.json
fi