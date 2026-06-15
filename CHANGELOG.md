# Changelog

All notable changes to this project will be documented in this file.

## [1.1.1] - 2026-06-15

### Added
- Bundled Gradio web UI (`gradio/`) directly into the npm package — no separate repo needed
- `auth_service.py` — Redis-based user auth with session storage (signals CLI when login is complete)
- `generate_graph.py` — renders git branch DAG as PNG and stores in Redis after each commit
- `Pillow` added to Python dependencies for branch graph image support

### Changed
- Consolidated `git-commit-ai` UI into `git-commit-at/gradio/` — single repo, single package
- Removed obsolete `scripts/copy_ai.js` and `scripts/postinstall.js`

### Fixed
- Mount user's current working directory (`process.cwd()`) into the container at `/git-repo` so `git diff --cached` runs against the correct repo, not the package source
- Use `/git-repo` volume mount to avoid overwriting app code at `/app` inside the container
- Add `--build` flag to `docker compose run` so code changes are always reflected without manual rebuilds
- Remove async console.log from model pull background fetch to prevent interrupting inquirer prompts
- Detect TTY availability at runtime and use `-it` or `-i` accordingly to fix `cannot attach stdin to a TTY-enabled container` error in non-terminal environments

## [1.0.6] - 2025-05-30

### Changed
- Minor updates (see git history)

## [1.0.5] - 2025-05-30

### Added
- Final version release with Docker Compose support

## [1.0.4]

### Fixed
- Various bug fixes

## [1.0.3]

### Fixed
- Various bug fixes

## [1.0.2]

### Fixed
- Commit-related fixes

## [1.0.1]

### Fixed
- Commit-related fixes

## [1.0.0]

### Added
- Initial release: AI-powered git commit message suggester using Ollama + `qwen2.5-coder:1.5b`
- Interactive CLI with conventional commit format
- Docker and Docker Compose support
- Ticket number support for commit message formatting
