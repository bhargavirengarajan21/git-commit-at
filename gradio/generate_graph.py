#!/usr/bin/env python3
"""
Run inside the gradio container via:
  docker compose run --rm -v "<repo>:/git-repo" gradio python /app/generate_graph.py
Renders the branch graph and stores it as base64 PNG in Redis.
"""
import sys
import os
import io
import base64
import redis
import json

import matplotlib
matplotlib.use("Agg")

sys.path.insert(0, '/app')
from git_graph import render_branch_graph

REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379')
REPO_PATH = '/git-repo'

r = redis.Redis.from_url(REDIS_URL, decode_responses=True)

try:
    if not os.path.isdir(REPO_PATH):
        raise FileNotFoundError(f"Repository path does not exist: {REPO_PATH}")

    if not os.path.isdir(os.path.join(REPO_PATH, '.git')):
        raise RuntimeError(f"Not a git repository: {REPO_PATH}")

    fig, info = render_branch_graph(REPO_PATH, '')
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=100, bbox_inches='tight',
                facecolor='#0D1117', edgecolor='none')
    buf.seek(0)
    encoded = base64.b64encode(buf.read()).decode()
    r.setex('branch_graph', 3600, encoded)
    r.setex('branch_info', 3600, info)
    print("Branch graph saved to Redis.")
except Exception as e:
    print(f"Error generating graph: {type(e).__name__}: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)
