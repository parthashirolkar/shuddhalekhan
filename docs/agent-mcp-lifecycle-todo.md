# Agent and MCP Lifecycle TODO

Branch context: `codex/agent-mode`

This is a follow-up list for the current Agent Mode branch. The goal is to capture rough edges in the agent sidecar and MCP lifecycle so they can be revisited after the branch lands.

## Agent Sidecar Lifecycle

- [ ] Define an explicit sidecar state machine for `stopped`, `starting`, `ready`, `running`, `cancelling`, `failed`, and `stopping` instead of spreading lifecycle state across ad hoc booleans and IDs.
- [ ] Make sidecar startup idempotent and observable: repeated `start` calls should either reuse the ready process or report the in-flight startup rather than spawning or reconfiguring implicitly.
- [ ] Add a clear shutdown contract for app quit, Agent Mode disable, settings changes, and process crashes.
- [ ] Reconcile cancellation behavior between Electron and the sidecar so a cancelled run emits exactly one terminal event and stale completions cannot update UI.
- [ ] Decide whether new Agent Mode recordings should cancel the active run, be rejected while a run is active, or queue behind it; encode that policy in one place.
- [ ] Add recovery behavior when the sidecar exits unexpectedly during a run, including user-visible status and audit entry.

## MCP Registry Lifecycle

- [ ] Separate MCP registry configuration sync from live connection management so settings persistence, tool discovery, and runtime connections are not coupled too tightly.
- [ ] Make MCP server connection transitions explicit: `disabled`, `connecting`, `connected`, `discoveringTools`, `failed`, `disconnecting`, and `disconnected`.
- [ ] Preserve immutable MCP/tool-policy snapshots for active runs while still allowing settings changes to reconnect idle servers.
- [ ] Make hot reload behavior deterministic when a server is edited, disabled, removed, or re-enabled during an active run.
- [ ] Add a retry/backoff policy for transient MCP connection failures and surface the final failure reason in settings.
- [ ] Ensure disconnect always closes MCP clients, OAuth helpers, child processes, timers, pending approvals, and pending tool calls.

## OAuth and HTTP MCP

- [ ] Treat OAuth callback server lifetime as part of the server lifecycle, with explicit start, callback, timeout, and close transitions.
- [ ] Make OAuth token storage and refresh failures visible in server status instead of only surfacing them as generic connection failures.
- [ ] Add a user-facing reset/reconnect path for an OAuth MCP server whose token state is invalid or revoked.

## Approval and Tool Execution

- [ ] Tie pending approvals to both `agentRunId` and the immutable MCP snapshot version used by that run.
- [ ] Ensure approval timeout, user denial, run cancellation, and server disconnect all resolve the pending tool call through the same code path.
- [ ] Record one audit event per lifecycle transition and one terminal audit event per run.
- [ ] Decide whether long-running MCP tools should be abortable through `AbortSignal` and how cancellation should be reported to the model.

## Tests to Add

- [ ] Sidecar startup is idempotent under repeated config updates.
- [ ] Disabling Agent Mode stops the sidecar and emits no stale UI events afterward.
- [ ] Updating an MCP server during an active run does not mutate that run's tool snapshot.
- [ ] Removing or disabling a server closes the previous MCP client and updates settings status.
- [ ] Sidecar crash during a run produces a failed terminal event and clears active run state.
- [ ] Approval timeout and run cancellation each resolve pending approvals exactly once.
