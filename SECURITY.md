# Security Policy

## Supported Versions

Security fixes are generally prioritized for the latest version of Echo-Saas.

| Version | Supported |
| --- | --- |
| Latest | Yes |
| Older versions | Best effort |

## Reporting a Vulnerability

Please do **not** report security vulnerabilities through public GitHub issues.

If you discover a potential vulnerability, report it privately to the project maintainers through the private security reporting mechanism available on the repository, or through the maintainer's private contact channel.

When reporting a vulnerability, please include:

- A clear description of the issue.
- The affected component or service.
- Steps to reproduce the issue.
- Proof of concept, if available and safe to provide.
- Potential security impact.
- Suggested remediation, if known.

Please avoid including real user data, credentials, API keys, access tokens, or other secrets.

## What to Expect

After a valid report is received, maintainers will:

1. Review and acknowledge the report.
2. Investigate and reproduce the issue where possible.
3. Assess its impact and severity.
4. Work on a fix or mitigation.
5. Coordinate disclosure when appropriate.

Response and remediation timelines may vary depending on severity and complexity.

## Security Best Practices for Contributors

Please:

- Never commit secrets or credentials.
- Use environment variables for sensitive configuration.
- Do not expose private workspace or user data in logs.
- Validate and sanitize untrusted input.
- Apply least-privilege access controls.
- Keep dependencies reasonably up to date.
- Review authentication and authorization changes carefully.

## Scope

Security reports may include issues involving:

- Authentication and authorization
- Workspace isolation
- API security
- Data exposure
- File/document ingestion
- AI/RAG data access
- Injection vulnerabilities
- Dependency vulnerabilities
- Secret exposure
- Server-side request vulnerabilities
- Other issues that could compromise confidentiality, integrity, or availability

Thank you for helping keep Echo-Saas and its users secure.
