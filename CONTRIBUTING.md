# Contributing to Echo-Saas

Thank you for your interest in contributing to Echo-Saas! Contributions of all kinds are welcome, including bug fixes, features, documentation, tests, UI improvements, performance improvements, and security improvements.

## Before You Start

Please:

1. Read the `README.md and all the Documentation Folder .md Files` to get Strong Foundation on the Software.
2. Search existing issues and pull requests before opening a new one.
3. For significant changes, open an issue first so the proposed approach can be discussed.
4. Never commit secrets, API keys, credentials, private tokens, or production data.

## Development Workflow

### 1. Fork and Clone

Fork the repository on GitHub and clone your fork:

```bash
git clone https://github.com/<your-username>/Echo-Saas.git
cd Echo-Saas
```

### 2. Create a Branch

Use a descriptive branch name:

```bash
git checkout -b feat/your-feature
```

Examples:

```text
feat/ai-document-ingestion
fix/auth-redirect
docs/setup-guide
refactor/rag-service
```

### 3. Make Your Changes

Keep changes focused and avoid unrelated modifications.

For new functionality:

- Add or update tests where appropriate.
- Update documentation when behavior or setup changes.
- Follow the existing project architecture and coding conventions.
- Keep security and privacy in mind when handling user or workspace data.

### 4. Run Checks

Before submitting a pull request, run the project's available:

- Linter
- Type checker
- Unit/integration tests
- Build
- Relevant service-specific checks

Use the commands documented in the repository's `README.md` and package configuration.

### 5. Commit Your Changes

Use clear commit messages.

Recommended format:

```text
type: short description
```

Examples:

```text
feat: add document ingestion status
fix: handle missing workspace permissions
docs: improve local setup instructions
refactor: simplify RAG service client
```

### 6. Open a Pull Request

Push your branch:

```bash
git push origin feat/your-feature
```

Then open a pull request against the repository's default branch.

Please complete the pull request template and explain:

- What changed
- Why it changed
- How it was tested
- Any relevant screenshots or recordings
- Any breaking changes or migration requirements

## Pull Request Guidelines

A good pull request should:

- Have a focused scope.
- Include enough context for reviewers.
- Avoid unnecessary formatting-only changes.
- Include tests for meaningful behavior changes where practical.
- Update documentation when necessary.
- Keep secrets and sensitive data out of commits.

## Reporting Bugs

Use the bug report issue template when possible.

Include:

- Clear reproduction steps
- Expected behavior
- Actual behavior
- Relevant logs or error messages
- Environment details
- Screenshots when useful

Remove API keys, tokens, passwords, personal information, and other sensitive data before posting logs.

## Feature Requests

Use the feature request template and explain the problem the feature would solve.

A useful proposal includes:

- The problem
- The proposed solution
- Alternatives considered
- Expected impact
- Any relevant technical considerations

## Security Issues

Do not disclose security vulnerabilities in public GitHub issues.

Follow the reporting process in `SECURITY.md`.

## Code Style

Follow the existing conventions of the relevant package or service. Prefer:

- Clear, descriptive names
- Small, focused functions and components
- Strong typing where supported
- Useful error handling
- Minimal duplication
- Comments only where they clarify non-obvious behavior

## License

By contributing to Echo-Saas, you agree that your contributions will be licensed under the project's license.
