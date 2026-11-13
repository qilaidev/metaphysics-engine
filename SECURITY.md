# Security Policy

## Supported Versions

Only the latest release on the `main` branch is actively supported with security updates.

| Version        | Supported |
| -------------- | --------- |
| `main` (0.3.x) | Yes       |
| `< 0.3.0`      | No        |

## Reporting a Vulnerability

If you discover a security vulnerability in **Metaphysics Engine**, please **do not** open a public GitHub issue.

Instead, report it privately via [GitHub Security Advisories](https://github.com/qilaidev/metaphysics-engine/security/advisories/new).

Please include:

- A clear description of the vulnerability and its potential impact.
- Steps to reproduce or a minimal proof-of-concept.
- Affected endpoint(s), CLI command(s), or MCP tool(s).

We aim to acknowledge reports within 48 hours and provide a remediation timeline once verified.

## Security Considerations for Self-Hosting

- **Stateless Engine**: By default, `metaphysics-engine` stores no user PII, birth charts, or conversation history on disk.
- **Production Secrets**: In `NODE_ENV=production`, `DOCS_PASSWORD` is mandatory to protect `/api-docs` and OpenAPI endpoints. Never commit `.env` files, private keys (`*.pem`, `*.key`), or session artifacts.
- **Optional LLM Providers**: If you enable AI narrative synthesis (`OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, etc.), ensure API keys are injected via environment variables or secret managers, never hardcoded.
