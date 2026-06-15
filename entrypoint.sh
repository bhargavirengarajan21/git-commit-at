#!/bin/bash
set -e

if [ -z "$SESSION_USERNAME" ] || [ -z "$SESSION_EMAIL" ]; then
  echo "Error: SESSION_USERNAME and SESSION_EMAIL environment variables are required"
  exit 1
fi

git config --global user.name "$SESSION_USERNAME"
git config --global user.email "$SESSION_EMAIL"

exec node index.js
