import os
import io
import json
import base64
import redis
import gradio as gr
import gradio.networking as _gn
import gradio_client.utils as _gcu
from pathlib import Path
from auth_service import resolve_user, register_user, verify_password, store_session

# Bypass Gradio's localhost self-check (fails inside Docker)
_gn.url_ok = lambda *a, **kw: True

# gradio-client 1.3.0 crashes when additionalProperties is a boolean — patch it
_orig_s2t = _gcu._json_schema_to_python_type
def _safe_s2t(schema, defs=None):
    if not isinstance(schema, dict):
        return "Any"
    return _orig_s2t(schema, defs)
_gcu._json_schema_to_python_type = _safe_s2t

LOGS_PATH = Path('/root/.git-commit-at/logs.json')

_redis_client = None


def get_redis():
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis.from_url(
            os.getenv('REDIS_URL', 'redis://localhost:6379'),
            decode_responses=True,
            socket_connect_timeout=5,
        )
    return _redis_client


# ── data helpers ─────────────────────────────────────────────────────────────

def load_history(username: str):
    if not LOGS_PATH.exists():
        return []
    try:
        logs = json.loads(LOGS_PATH.read_text())
        rows = []
        for e in logs[:100]:
            if e.get('name') == username or e.get('email') == username:
                rows.append([
                    e.get('timestamp', '')[:19].replace('T', ' '),
                    e.get('message', ''),
                    (e.get('repo') or '').split('/')[-1] or (e.get('repo') or ''),
                    e.get('ticket') or '—',
                ])
        return rows
    except Exception:
        return []


def load_branch_graph():
    raw = get_redis().get('branch_graph')
    if not raw:
        return gr.update(visible=False)
    try:
        from PIL import Image
        img_bytes = base64.b64decode(raw)
        img = Image.open(io.BytesIO(img_bytes))
        return gr.update(value=img, visible=True)
    except Exception:
        return gr.update(visible=False)


def load_branch_info():
    return get_redis().get('branch_info') or '_No branch data yet — run `git-commit-at` from your repo._'


def current_repo_label():
    repo = get_redis().get('current_repo')
    return f'**Repo:** `{repo}`' if repo else '_No repo detected yet._'


# ── auth actions ─────────────────────────────────────────────────────────────

def do_login(username: str, password: str):
    username = username.strip()
    if not username or not password:
        return (
            "Please enter both username and password.",
            gr.update(visible=True), gr.update(visible=False),
            "", [], None, "", ""
        )

    user = resolve_user(get_redis(), username)
    if not user:
        return (
            "User not found. Please register first.",
            gr.update(visible=True), gr.update(visible=False),
            "", [], None, "", ""
        )

    if not verify_password(user, password):
        return (
            "Invalid password.",
            gr.update(visible=True), gr.update(visible=False),
            "", [], None, "", ""
        )

    store_session(get_redis(), username, user.get('email', ''))
    history = load_history(username)
    graph   = load_branch_graph()
    info    = load_branch_info()
    repo    = current_repo_label()

    return (
        "",                          # clear error
        gr.update(visible=False),    # hide auth panel
        gr.update(visible=True),     # show dashboard
        f"## Welcome back, {username}!",
        history,
        graph,
        info,
        repo,
    )


def do_register(username: str, email: str, password: str, confirm: str):
    username, email = username.strip(), email.strip()
    if not all([username, email, password, confirm]):
        return (
            "Please fill in all fields.",
            gr.update(visible=True), gr.update(visible=False),
            "", [], None, "", ""
        )
    if '@' not in email:
        return (
            "Please enter a valid email.",
            gr.update(visible=True), gr.update(visible=False),
            "", [], None, "", ""
        )
    if password != confirm:
        return (
            "Passwords do not match.",
            gr.update(visible=True), gr.update(visible=False),
            "", [], None, "", ""
        )
    if len(password) < 6:
        return (
            "Password must be at least 6 characters.",
            gr.update(visible=True), gr.update(visible=False),
            "", [], None, "", ""
        )

    existing = resolve_user(get_redis(), username)
    if existing and existing.get('password_hash'):
        return (
            "Username already taken. Please login instead.",
            gr.update(visible=True), gr.update(visible=False),
            "", [], None, "", ""
        )

    register_user(get_redis(), username, email, password)
    store_session(get_redis(), username, email)
    history = load_history(username)
    graph   = load_branch_graph()
    info    = load_branch_info()
    repo    = current_repo_label()

    return (
        "",
        gr.update(visible=False),
        gr.update(visible=True),
        f"## Welcome, {username}! 🎉",
        history,
        graph,
        info,
        repo,
    )


def do_refresh(welcome_md):
    username = welcome_md.replace("## Welcome back, ", "").replace("## Welcome, ", "").replace("! 🎉", "").replace("!", "").strip()
    history = load_history(username)
    graph   = load_branch_graph()
    info    = load_branch_info()
    repo    = current_repo_label()
    return history, graph, info, repo


# ── layout ───────────────────────────────────────────────────────────────────

with gr.Blocks(title="git-commit-at", theme=gr.themes.Monochrome()) as app:

    # ── auth section ──────────────────────────────────────────────────────────
    auth_panel = gr.Column(visible=True)
    with auth_panel:
        gr.Markdown("# git-commit-at\nAI-powered conventional commit messages — local first")
        with gr.Tabs():
            with gr.Tab("Login"):
                gr.Markdown("### Sign in")
                login_user = gr.Textbox(label="Username", placeholder="your username")
                login_pass = gr.Textbox(label="Password", type="password")
                login_btn  = gr.Button("Login", variant="primary")
                login_msg  = gr.Markdown()

            with gr.Tab("Register"):
                gr.Markdown("### Create account")
                reg_user    = gr.Textbox(label="Username")
                reg_email   = gr.Textbox(label="Email")
                reg_pass    = gr.Textbox(label="Password", type="password")
                reg_confirm = gr.Textbox(label="Confirm Password", type="password")
                reg_btn     = gr.Button("Register", variant="primary")
                reg_msg     = gr.Markdown()

    # ── dashboard section ─────────────────────────────────────────────────────
    dash_panel = gr.Column(visible=False)
    with dash_panel:
        welcome_md = gr.Markdown("## Welcome!")

        with gr.Tabs():

            # ── commit history ────────────────────────────────────────────────
            with gr.Tab("Commit History"):
                history_table = gr.Dataframe(
                    headers=["Timestamp", "Message", "Repo", "Ticket"],
                    datatype=["str", "str", "str", "str"],
                    interactive=False,
                    wrap=True,
                )

            # ── branch visualizer ─────────────────────────────────────────────
            with gr.Tab("Branch Visualizer"):
                repo_label  = gr.Markdown()
                branch_info = gr.Markdown()
                branch_img  = gr.Image(
                    label="Branch Graph",
                    show_label=False,
                    visible=False,
                )
                refresh_btn = gr.Button("Refresh", variant="secondary")

    # ── wire up actions ───────────────────────────────────────────────────────

    _auth_outputs = [login_msg, auth_panel, dash_panel, welcome_md,
                     history_table, branch_img, branch_info, repo_label]

    login_btn.click(
        fn=do_login,
        inputs=[login_user, login_pass],
        outputs=_auth_outputs,
    )

    _reg_outputs = [reg_msg, auth_panel, dash_panel, welcome_md,
                    history_table, branch_img, branch_info, repo_label]

    reg_btn.click(
        fn=do_register,
        inputs=[reg_user, reg_email, reg_pass, reg_confirm],
        outputs=_reg_outputs,
    )

    refresh_btn.click(
        fn=do_refresh,
        inputs=[welcome_md],
        outputs=[history_table, branch_img, branch_info, repo_label],
    )


if __name__ == "__main__":
    app.launch(server_name="0.0.0.0", server_port=7860, show_error=True, show_api=False)
