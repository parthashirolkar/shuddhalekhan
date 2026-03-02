# AGENTS.md

This file provides guidelines for agentic coding tools working in this repository.

---

## Project Overview

TypeScript/Bun speech-to-text system tray application using whisper.cpp Docker container for GPU-accelerated transcription.
- **Runtime**: Bun v1.3.5+
- **Entry Point**: `ts-version/src/index.ts`
- **UI**: Windows system tray with systray2

---

## Build, Lint, Test Commands

```bash
# Install dependencies
bun install

# Lint code
bun run lint

# Fix lint issues
bun run lint:fix

# Type check
bun run typecheck

# Run tests (if test framework added)
bun test tests/*.test.ts

# Run single test function
bun test tests/*.test.ts --test-name-pattern "test_function_name"
```

---

**Key points**:
- Use relative path `"./tray-icon.ico"`, NOT Bun's `import ... with { type: "file" }`
- Set `copyDir: true` or icon won't work in compiled executable
- Icon file must be in working directory (where executable runs)
- Update menu items dynamically with `systray.sendAction({ type: "update-item", item })`
