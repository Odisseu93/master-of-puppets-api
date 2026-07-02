# Project Rules

## Git and Verification
- Before committing any changes, you must run:
  1. The project's tests (`npm test` or `npm run test`).
  2. The verification checks (linting with `npm run lint`).
  3. The TypeScript compiler check (`npm run build -- --noEmit`).
- Only proceed with committing code if all tests, lint checks, and compiler checks pass successfully. If there are failures, fix them before making a commit.
