# Contributing

Thank you for your interest in contributing to GroundLink AI. This document explains how to get started, what conventions to follow, and how to submit changes.

---

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Follow the setup guide in `docs/SETUP.md` to get the app running
4. Create a new branch for your change

```bash
git checkout -b feature/your-feature-name
```

---

## Branch Naming

Use one of these prefixes:

| Prefix | Use for |
|---|---|
| `feature/` | New functionality |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `refactor/` | Code restructuring without behavior change |
| `chore/` | Dependency updates, config changes |

Examples: `feature/pdf-highlighting`, `fix/citation-render`, `docs/api-reference`

---

## Code Style

The project uses TypeScript throughout. A few conventions to follow:

**General**
- Prefer `const` over `let` where possible
- Use `async/await` over `.then()` chains
- Always handle errors with `try/catch` in API routes and return appropriate HTTP status codes
- Log warnings with `console.warn` for non-fatal issues, `console.error` for actual errors

**React**
- Functional components only
- Keep component state as local as possible
- Avoid prop drilling more than two levels deep

**API routes**
- Every route must call `authenticateUser` middleware
- Return consistent JSON shapes: `{ success: true, ... }` or `{ error: string }`
- Always include rate limiter middleware on write endpoints

**Commits**
Follow conventional commits format:

```
feat: add PDF page highlighting
fix: citation badge strikethrough on dark mode
docs: add API reference
refactor: extract chunk scoring into separate function
chore: update openrouter dependency
```

---

## Adding a New API Route

1. Add the route handler in `api/index.ts`
2. Apply `authenticateUser` middleware
3. Apply a rate limiter if it is a write or compute-heavy operation
4. Return consistent JSON
5. Add a corresponding section in `docs/API.md`

Example skeleton:

```typescript
app.post('/api/your-route', authenticateUser, async (req: any, res) => {
  try {
    const { param } = req.body;
    if (!param) return res.status(400).json({ error: 'Missing param' });

    // your logic here

    res.json({ success: true, result: ... });
  } catch (err: any) {
    console.error('[your-route]', err.message);
    res.status(500).json({ error: err.message });
  }
});
```

---

## Submitting a Pull Request

1. Make sure `npm run lint` passes with no errors
2. Test your changes locally with `npm run dev`
3. Push your branch to your fork
4. Open a pull request against the `main` branch of the original repository
5. Fill in the PR description with what changed and why
6. Link any relevant issues

---

## Reporting Issues

Open a GitHub Issue with:

- A clear title describing the problem
- Steps to reproduce
- Expected behavior vs actual behavior
- Browser and OS if it is a UI issue
- Any relevant console errors

---

## What We Welcome

- Bug fixes with reproduction steps
- Performance improvements to the chunking or similarity search
- Support for additional file formats
- UI improvements
- Documentation corrections and additions
- Better error messages

---

## What to Discuss First

Before building large features, open an Issue first to discuss the approach. This avoids duplicate work and ensures the feature aligns with the project direction.
