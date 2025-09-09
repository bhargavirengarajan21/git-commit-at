export const spec = () => (`
- The Conventional Commits specification is a lightweight convention on top of commit messages.
- It provides simple rules for creating an explicit commit history, making automated tooling easier.
- This convention aligns with SemVer by describing features, fixes, and breaking changes in commit messages.

- Commit message structure:
  - <type>[optional scope]: <description>
  - <type #ticketNumber>: <description> (if ticket number exists)
  - [optional body]
  - [optional footer(s)]

- Commit types and meanings:
  - fix: patches a bug (corresponds to PATCH in SemVer)
  - feat: introduces a new feature (corresponds to MINOR in SemVer)
  - BREAKING CHANGE: indicates a breaking API change, either as a footer or with a ! after type/scope (corresponds to MAJOR in SemVer)
  - Other allowed types (examples): build:, chore:, ci:, docs:, style:, refactor:, perf:, test:, etc.

- Commit message details:
  - Additional types have no effect on SemVer unless accompanied by BREAKING CHANGE.
  - Scope is optional and gives context, e.g., feat(parser): add array parsing.
  - Description follows the colon and space immediately.
  - Optional longer body can follow, separated by a blank line.
  - Optional footers may follow, each as a token:value pair.
  - Footers tokens replace whitespace with hyphens (e.g., Acked-by).
  - BREAKING CHANGE can be used as a footer token.

- Examples:
  - feat: allow config object to extend other configs
    BREAKING CHANGE: 'extends' key now used differently
  - feat!: send email when product shipped
  - feat(api)!: send email when product shipped
  - chore!: drop support for Node 6
    BREAKING CHANGE: uses JS features not in Node 6
  - docs: fix spelling in CHANGELOG
  - feat(lang): add Polish language
  - fix: prevent racing of requests
    Remove obsolete timeouts.
    Reviewed-by: Z
    Refs: #123

- Specification notes (RFC 2119 keywords):
  - Commits MUST start with a type (noun) + optional scope + optional ! + colon + space.
  - feat MUST be used for new features.
  - fix MUST be used for bug fixes.
  - Scope MAY be provided (e.g., fix(parser):).
  - Description MUST immediately follow colon+space.
  - Body MAY provide detailed info after one blank line.
  - Body MAY contain multiple paragraphs.
  - Footers MAY appear after a blank line, each with token separator (colon or space#).
  - Footer tokens MUST replace whitespace with hyphens (except BREAKING CHANGE).
  - Footer values MAY contain spaces/newlines; parsing ends at next footer token.
  - Breaking changes MUST appear in prefix or footer.
  - BREAKING CHANGE footer format: "BREAKING CHANGE: description"
  - Breaking changes in prefix use ! before colon (e.g., feat!: ...)
  - BREAKING CHANGE footer can be omitted if ! is used.
  - Types other than feat and fix MAY be used.
  - Case insensitive except BREAKING CHANGE must be uppercase.
  - BREAKING-CHANGE footer token is synonymous with BREAKING CHANGE.

- Why use Conventional Commits?
  - Enables automatic CHANGELOG generation.
  - Automatically determines semantic version bump.
  - Improves communication of changes to team and stakeholders.
  - Triggers build and publish pipelines.
  - Makes contributing easier by structuring commit history.
`);
