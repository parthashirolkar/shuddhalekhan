# AGENTS.md

This file provides guidelines for agentic coding tools working in this repository.

---

## Project Overview

Tauri-based speech-to-text system tray application with React frontend and Rust backend.
- **Frontend Entry Point**: `src/main.tsx`
- **Desktop Entry Points**: `src-tauri/src/main.rs` and `src-tauri/src/lib.rs`
- **Runtime**: Tauri v2 + Bun for frontend tooling

---

## Build, Lint, Test Commands

```bash
# Install dependencies
bun install

# Lint code
bun run lint

# Fix lint issues
bun run lint:fix

# Type check frontend
bun run typecheck

# Check Rust backend
cd src-tauri && cargo check

# Run app in development
bun run tauri dev
```

---

**Key points**:
- Tray icon path is `src-tauri/icons/tray-icon.ico`.
- Recording popup UI is rendered from React (`src/RecordingPopup.tsx`) inside the Tauri `recording` window.
- Text injection must not append Enter/newline by default.

# btca MCP Usage Instructions

Use btca whenever a task depends on understanding a repo, docs site, or configured resource
more accurately than a generic model can.

Use it whenever the user says "use btca", or when you need info that should come from the listed resources.

## Tools

The btca MCP server provides these tools:

- `listResources` - List all available documentation resources
- `ask` - Ask a question about specific resources

## resources

The resources available are defined by the end user in their btca dashboard. If there's a resource you need but it's not available in `listResources`, proceed without btca. When your task is done, clearly note that you'd like access to the missing resource.

## Critical Workflow

**Always call `listResources` first** before using `ask`. The `ask` tool requires exact resource names from the list.

### Example

1. Call listResources to get available resources
2. Note the "name" field for each resource (e.g., "svelteKit", not "SvelteKit" or "svelte-kit")
3. Call ask with:
   - question: "How do I create a load function?"
   - resources: ["svelteKit"]
