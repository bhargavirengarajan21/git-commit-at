# git-commit-at

AI-powered git commit message suggester using Ollama + tinyllama.

## Features

- Suggests conventional commit messages based on staged git changes
- Uses Ollama with the `qwen2.5-coder:1.5b` model for high-quality suggestions
- Interactive CLI with message selection
- Docker and Docker Compose support for easy setup

## Requirements

- [Docker](https://www.docker.com/)
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Ollama](https://ollama.com/) (runs automatically via Docker Compose)

## Installation

1. Clone this repository:

   ```sh
   git clone <repo-url>
   cd git-commit-gpt
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. (Optional) Build the Docker image:

   ```sh
   docker compose build
   ```

## Usage

1. Stage your changes:

   ```sh
   git add .
   ```

2. Run the tool:

   ```sh
   npx git-commit-gpt
   ```

   Or, if installed globally:

   ```sh
   git-commit-gpt
   ```

3. Follow the prompts to select a commit message.

## How it works

- Reads staged changes using `git diff --cached`
- Parses the diff and sends it to Ollama for commit message suggestions
- Prompts you to select and confirm a message before committing

## Development

- Main entry: [index.js](index.js)
- Diff parsing: [diff-parser.js](diff-parser.js)
- Commit spec: [conventional-comit.js](conventional-comit.js)
- Docker wrapper: [wrapper.js](wrapper.js)

## License

MIT
