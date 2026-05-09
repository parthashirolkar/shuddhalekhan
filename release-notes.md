# Shuddhalekhan 4.0.0

This release revives Agent Mode as a voice-first MCP client while keeping Dictation focused and unchanged.

## What's Changed

- Added Agent Mode behind the `Alt + Win` recording intent, separate from `Ctrl + Win` Dictation.
- Added a local agent sidecar using the Vercel AI SDK and OpenAI-compatible providers.
- Added MCP server configuration, connection, tool discovery, per-tool approval policies, and approval toasts.
- Enabled persisted Agent Mode MCP servers to reconnect and register tools automatically on app startup.
- Added guarded final agent toasts so empty model completions show a useful degraded response instead of a blank "Complete" notification.
- Added local audit logging for agent runs, tool requests, approvals, results, failures, and final responses.
- Added Settings UI for Agent provider configuration, MCP servers, Gmail preset setup, and tool policies.

## Update Note

This is a major Agent Mode release. Existing Dictation behavior is preserved, and Agent Mode remains opt-in from Settings.
