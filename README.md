# git-commit-at 🚀

**AI-powered conventional commit message generator** using Ollama, with interactive CLI, web UI, and live git branch visualization.

Generate thoughtful, consistent commit messages automatically based on your staged changes—no more generic "fix: bug" or "refactor: stuff" commits.

## Features ✨

- 🤖 **AI-Powered Suggestions** — Uses Ollama with `qwen2.5-coder:1.5b` to analyze diffs and suggest 3 commit message options
- 📋 **Conventional Commits** — Generates messages following the conventional commit standard (`feat:`, `fix:`, `refactor:`, etc.)
- 🎯 **Interactive Selection** — Pick your favorite suggestion or customize the format
- 🌿 **Branch Visualizer** — Web UI (Gradio) showing your git branch graph and commit history
- 👤 **Session Persistence** — Remember your login credentials so you don't re-authenticate
- 🐳 **Docker Support** — Everything runs in containers (Ollama, Redis, Gradio, Node app)
- 📊 **Commit History Tracking** — View all commits made with git-commit-at in the web UI
- ✅ **Smart Detection** — Auto-detects empty repos, handles missing git config, validates repos before running

## Architecture

```
┌─────────────────┐
│  git-commit-at  │  Node.js CLI wrapper (entrypoint)
└────────┬────────┘
         │
    ┌────┴───────┬──────────────┬────────────────┐
    │            │              │                │
┌───▼────┐  ┌────▼─────┐  ┌─────▼────┐  ┌──────▼───────┐
│ Ollama │  │  Redis   │  │  Gradio  │  │  commit-at   │
│ (AI)   │  │ (cache)  │  │ (web UI) │  │ (main app)   │
└────────┘  └──────────┘  └──────────┘  └──────────────┘

[Docker Compose] manages all services
```

### Key Files

| File | Purpose |
|------|---------|
| `wrapper.js` | CLI entry point; orchestrates Docker services, handles auth flow |
| `index.js` | Main commit logic; generates suggestions, prompts user, creates commit |
| `diff-parser.js` | Parses git diffs into human-readable format |
| `entrypoint.sh` | Docker entrypoint; sets up git config before running Node app |
| `docker-compose.yml` | Defines Ollama, Redis, Gradio, and commit-at services |
| `gradio/app.py` | Web UI for login, commit history, and branch visualization |
| `gradio/git_graph.py` | Renders git branch graph as PNG |

## Requirements

| Requirement | Version |
|---|---|
| Docker | Latest |
| Docker Compose | 2.0+ |
| Node.js | 18+ (for development; not needed if using Docker) |
| Ollama | 0.1.48+ (runs in Docker container) |

## Quick Start

### 1️⃣ Installation

```bash
npm install -g git-commit-at
```

Or clone and run locally:
```bash
git clone https://huggingface.co/spaces/build-small-hackathon/git-commit-a
cd git-commit-at
npm install
npm start  # or: node wrapper.js
```

### 2️⃣ First Run

```bash
cd your-git-project
git add .
git-commit-at
```

The first run will:
1. Start Docker containers (Ollama, Redis, Gradio)
2. Open the Gradio UI at `http://localhost:7860` in your browser
3. Prompt you to register or log in
4. Analyze your staged changes
5. Ask if you want a ticket number and custom commit format
6. Suggest 3 commit messages
7. Create the commit after you approve

### 3️⃣ Using the Web UI

Visit `http://localhost:7860` to:
- **Log in/Register** — Create your account (username + password)
- **View Commit History** — See all commits made with git-commit-at
- **Branch Visualizer** — Live graph of your git branches and commit history
- **Auto-refresh** — Click "Refresh" to update the graph after commits

## Usage Examples

### Basic commit
```bash
git add .
git-commit-at
# Select a suggestion, confirm, done!
```

### With ticket number
```bash
git add .
git-commit-at
# Ticket number: PROJ-123
# Select a suggestion
# Result: "PROJ-123 feat: add user authentication"
```

### Custom format
```bash
git add .
git-commit-at
# Commit format: [<ticket>] <commit_message>
# Ticket number: BUG-456
# Result: "[BUG-456] fix: resolve null pointer exception"
```

## Configuration

### Commit Format

When prompted, specify a format using:
- `<commit_message>` — The generated message
- `<ticket>` — Your ticket/issue number

**Examples:**
- `<commit_message>` — Just the message
- `<ticket> <commit_message>` — Ticket prefix
- `[<ticket>] <commit_message>` — Bracketed ticket
- `(<ticket>) <commit_message>` — Parenthesized ticket

### Docker Compose

Edit `docker-compose.yml` to:
- Change Ollama model (see `conventional-comit.js`)
- Adjust port mappings (Gradio: 7860, Redis: 6379)
- Modify volume mounts

## Development

### Project Structure

```
git-commit-at/
├── index.js                 # Main app (runs in container)
├── wrapper.js               # CLI orchestrator
├── diff-parser.js           # Diff formatting
├── entrypoint.sh            # Docker setup
├── Dockerfile               # Node app image
├── docker-compose.yml       # All services
├── config.js                # Config persistence
├── gradio/
│   ├── app.py               # Web UI
│   ├── git_graph.py         # Branch visualization
│   ├── generate_graph.py    # Graph generation script
│   ├── auth_service.py      # User auth
│   ├── Dockerfile           # Python image
│   └── requirements.txt      # Python deps
└── package.json
```

### Running Locally (Without Docker)

```bash
# Install dependencies
npm install

# Start services manually
docker compose up -d

# Wait for Gradio UI to be ready at localhost:7860
# Then run the app
node index.js
```

### Debugging

If the branch visualizer shows empty:
1. Check Docker logs: `docker compose logs gradio`
2. Verify git is installed in gradio container
3. Ensure repo has at least one commit
4. Check Redis: `docker compose exec redis redis-cli`

If commits fail:
1. Check stderr for full error message
2. Verify you're in a git repo: `git rev-parse --show-toplevel`
3. Ensure git is configured: `git config user.name` and `git config user.email`

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Not inside a git repository" | Run git-commit-at from a git repo directory |
| No staged changes error | Run `git add` before `git-commit-at` |
| Ollama timeout | Ollama is slow first-run. Wait or increase timeout in `index.js` |
| Gradio UI won't load | Check Docker: `docker ps` and `docker compose logs` |
| Branch graph empty | Repo needs at least one commit; check `docker compose logs gradio` |
| Login required every time | Session expired (Redis timeout) or Redis not persisting |

## Environment Variables

| Var | Default | Description |
|-----|---------|---|
| `OLLAMA_URL` | `http://localhost:11434/` | Ollama API endpoint |
| `REDIS_URL` | `redis://redis:6379` | Redis connection |
| `SESSION_USERNAME` | (docker arg) | User name (passed by wrapper.js) |
| `SESSION_EMAIL` | (docker arg) | User email (passed by wrapper.js) |

## Performance

- **First run:** ~30 seconds (pulls Ollama model)
- **Subsequent runs:** ~5-10 seconds (Ollama inference)
- **Gradio UI:** Auto-refreshes every 3600s (configurable in `generate_graph.py`)

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and test locally: `docker compose up`
4. Commit with conventional commits: `git-commit-at` 😉
5. Push and open a PR

## Future Improvements

- [ ] Config file support (`.git-commit-atrc`)
- [ ] Multiple AI models (OpenAI, Claude, etc.)
- [ ] Integration with GitHub/GitLab issues
- [ ] Pre-commit hook integration
- [ ] Custom commit message templates
- [ ] Metrics dashboard (commits by user, type, repo)

## License

MIT — See [LICENSE](LICENSE) for details

## Support

- 📖 Docs: Check this README and inline comments
- 🐛 Issues: Report bugs on GitHub
- 💬 Discussions: Ask questions in GitHub Discussions

---

**Built with ❤️ by the git-commit-at team**

Made for developers who want better commits, faster. 🚀
