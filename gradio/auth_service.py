import json
import hashlib
import secrets
import os
import requests
from pathlib import Path

LOGS_PATH = Path('/root/.git-commit-at/logs.json')
CONFIG_PATH = Path('/root/.git-commit-at/config.json')
REMOTE_DB_URL = os.getenv('REMOTE_DB_URL', '')


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def resolve_user(r, username: str) -> dict | None:
    # 1. Redis — cached user profile
    cached = r.get(f'user:{username}')
    if cached:
        return json.loads(cached)

    # 2. logs.json — user has committed before from this machine
    if LOGS_PATH.exists():
        try:
            logs = json.loads(LOGS_PATH.read_text())
            for entry in logs:
                if entry.get('name') == username or entry.get('email') == username:
                    user = {
                        'username': entry.get('name', username),
                        'email': entry.get('email', ''),
                        'source': 'logs',
                    }
                    r.setex(f'user:{username}', 3600, json.dumps(user))
                    return user
        except Exception:
            pass

    # 3. Remote DB — source of truth for registered users
    if REMOTE_DB_URL:
        try:
            resp = requests.get(f'{REMOTE_DB_URL}/users/{username}', timeout=5)
            if resp.ok:
                user = resp.json()
                r.setex(f'user:{username}', 3600, json.dumps(user))
                return user
        except Exception:
            pass

    return None


def register_user(r, username: str, email: str, password: str) -> dict:
    user = {
        'username': username,
        'email': email,
        'password_hash': _hash_password(password),
        'source': 'local',
    }
    r.set(f'user:{username}', json.dumps(user))

    # Persist to remote DB if configured
    if REMOTE_DB_URL:
        try:
            requests.post(f'{REMOTE_DB_URL}/users', json=user, timeout=5)
        except Exception:
            pass

    return user


def verify_password(user: dict, password: str) -> bool:
    stored_hash = user.get('password_hash')
    if not stored_hash:
        # User found via logs.json — no password set yet, treat as first login
        return True
    return stored_hash == _hash_password(password)


def store_session(r, username: str, email: str) -> dict:
    token = secrets.token_hex(16)
    session = {'username': username, 'email': email, 'token': token}
    r.setex('active_session', 86400, json.dumps(session))  # 24h TTL
    return session
