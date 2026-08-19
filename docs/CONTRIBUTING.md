# Contributing

## Getting Started

1. Fork and clone the repo
2. Follow SETUP.md to get running locally
3. Create a feature branch: git checkout -b feature/your-feature

## Branch Naming

- feature/ - new functionality
- fix/ - bug fixes
- docs/ - documentation only
- chore/ - dependency updates

## Code Style

- TypeScript throughout
- Async/await over .then chains
- Every API route must use authenticateUser middleware
- Return { success: true, ... } or { error: string } from all routes

## Submitting a PR

1. Test locally with npm run dev
2. Push your branch
3. Open a PR against main
4. Describe what changed and why
