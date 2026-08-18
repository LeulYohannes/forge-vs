# COPILOT BUILD INSTRUCTIONS — Forge AI VS Code Extension: Local Preview + Telemetry

## READ THIS FIRST — RULES THAT OVERRIDE EVERYTHING ELSE

1. **Do not modify `src/data/taskData.ts` in any way.** The 5 tasks, their exact field names (`id`, `title`, `priority`, `reporter`, `skill`, `company`, `ticketType`, `context`, `description`, `acceptanceCriteria`), and their content are final and already correct. Do not rename fields, add fields to this file, or regenerate ticket content.
2. **Do not change the existing `/evaluate` API contract.** The current `extension.ts` POSTs to `${apiUrl}/evaluate` with exactly this JSON body shape: `{ code: string, task_id: string, ticket_context: string }`, and expects back exactly this shape: `{ test_passed: boolean, ai_score: number, ai_feedback: string, exec_error?: string | null, error?: string | null, logs?: string[] }`. This is a real, already-deployed backend at `https://forge-ai-core.onrender.com`. You are NOT authorized to invent new fields on this request/response, rename existing ones, or assume the backend has endpoints other than `/evaluate`. If this build requires the backend to accept a new field (see Telemetry section below), you must ADD an optional field to the existing request body — never replace or restructure the existing contract.
3. **Do not invent new npm packages.** Every dependency you use must already be listed in `package.json`'s `devDependencies`, or must be a Node.js built-in module (e.g. `child_process`, `crypto`). If you believe a new dependency is genuinely required, STOP and add a clearly marked `// NEEDS APPROVAL: <package name> — <why>` comment instead of installing it silently.
4. **Do not remove or restructure `TicketViewProvider.ts`'s existing webview HTML/CSS styling patterns.** All new UI (preview results, consent dialog) must visually match the existing style: uses VS Code CSS variables (`var(--vscode-font-family)`, `var(--vscode-editor-background)`, etc.), not hardcoded colors, except where the existing `showResultsPanel` function in `extension.ts` already uses specific hex values (`#1e1e1e`, `#4caf50`, `#f44336`) — match that file's existing pattern exactly when extending it, do not introduce a third, different visual style.
5. **If any instruction below is ambiguous or you are not fully certain of a VS Code API's exact behavior, do not guess. Insert a comment `// TODO: VERIFY — <question>` and implement the most conservative/safe version, rather than inventing plausible-sounding but unverified API usage.**
6. **Do not add analytics/telemetry collection of any kind until the consent flow (Section 3) is fully implemented and gates all tracking.** Telemetry code that runs before consent exists is a hard failure of this spec, not a minor bug.

---

## CURRENT STATE OF THE CODEBASE (verified, as of this build — do not re-derive from scratch)

- `src/extension.ts` — activation, registers `forge-vs.submit` command (reads active editor's full text, POSTs to backend `/evaluate`, shows result in a `createWebviewPanel` results panel), and `showTicketPanel()` (a full-panel ticket view, separate from the sidebar).
- `src/providers/TicketViewProvider.ts` — the SIDEBAR webview (`forge-vs.ticketView`), with a `<select>` dropdown to switch between the 5 tasks. On change, posts a `taskSelected` message back to the extension host, which updates `currentTaskId` in `extension.ts`.
- `src/data/taskData.ts` — the 5 hardcoded tickets (`task_1` through `task_5`), matching the same Meridian AI narrative used in the existing web app. Exports `TASKS` (a `Record<string, Task>`) and `TASK_1`.
- `package.json` — `forge-vs.submit` command bound to `Ctrl+Shift+E`/`Cmd+Shift+E`. Config setting `forgeAI.apiUrl` (default `https://forge-ai-core.onrender.com`). Build via `esbuild.js`, bundled to `./dist/extension.js`.
- **What does NOT exist yet, and is the actual scope of this build:** local preview test execution, any telemetry/consent system, any starter-file scaffolding per task.

---

## PART 1 — Starter File Scaffolding (build this first — everything else depends on it)

Currently, `forge-vs.submit` requires the candidate to already have some file open — there is no command that creates a real starter file for the selected task. Add this.

### 1.1 New command: `forge-vs.startTask`
- Add to `package.json` `contributes.commands`: `{ "command": "forge-vs.startTask", "title": "Forge AI: Start Task" }`.
- Add to `activationEvents`: `"onCommand:forge-vs.startTask"`.
- Implementation (in `extension.ts` or a new `src/commands/startTask.ts` — your choice, but keep it consistent with the existing single-file style in `extension.ts` if you're unsure):
  - Prompts nothing — uses the current `currentTaskId` (already tracked in `extension.ts`).
  - Creates a file named exactly `${currentTaskId}_solution.py` in the currently open workspace folder (use `vscode.workspace.workspaceFolders?.[0].uri` — if no workspace folder is open, show an error message: `"Open a folder first, then start a task."` and stop; do not silently create a file in an undefined location).
  - If the file already exists, open it as-is (do NOT overwrite existing candidate work).
  - If it doesn't exist, create it with a minimal starter stub — a function signature with `pass` and a one-line comment referencing the ticket ID. Do not pre-write any implementation logic; this is a stub for the candidate to fill in, not a partial answer.
  - Open the file in the editor after creating/finding it.

---

## PART 2 — Local Preview Run (the core missing feature)

**Non-negotiable design rule, repeat of the architecture already agreed on for this project: the local preview run is NEVER the real, scored result. Only the existing `/evaluate` backend call (via `forge-vs.submit`) produces the real score. The preview run's only job is fast local feedback.**

### 2.1 New command: `forge-vs.previewRun`
- Add to `package.json`: `{ "command": "forge-vs.previewRun", "title": "Forge AI: Preview Run (Local, Not Scored)" }`. The title text "(Local, Not Scored)" is REQUIRED, not optional — this is the label that prevents candidate confusion about which result counts.
- Keybinding: `Ctrl+Shift+R` / `Cmd+Shift+R` — do not reuse the existing submit keybinding.

### 2.2 Implementation requirements
- Use Node's built-in `child_process.spawn` (NOT `exec` — `spawn` avoids shell-injection risk from candidate code content and handles streaming output better). Do not use any third-party process-execution package.
- Run: `python -m pytest <path to the relevant local test file> -v` against the candidate's current file. **You do not have the actual local test files' exact filenames or locations in this repo — this is a real gap.** Insert `// TODO: VERIFY — confirm the exact local test file naming/location convention with the founder before this can run correctly; DO NOT invent a fake path.**
- Set an explicit timeout on the spawned process (recommend 10 seconds) — if it doesn't complete, kill the process and show `"Preview run timed out — check for an infinite loop."` Do not let a local preview run hang indefinitely; this directly mirrors the sandboxing discipline already used on the backend and must not be skipped just because this runs locally.
- Parse pytest's output for a simple pass/fail count (e.g. regex or line-based parsing of pytest's summary line — do not assume a specific pytest version's exact output format without a fallback; if parsing fails, show the raw output rather than a fabricated/guessed summary).
- Display results in a webview, styled consistently with the EXISTING `showResultsPanel` function's visual style in `extension.ts` (same dark background, same score/pass-fail color pattern) — but with a clearly different, unmistakable header reading **"LOCAL PREVIEW — NOT YOUR OFFICIAL SCORE"** in a distinct color (e.g. amber/yellow, not the existing green/red pass-fail colors) so it cannot be visually confused with a real submission result.

### 2.3 Auto-trigger on save
- Register `vscode.workspace.onDidSaveTextDocument`.
- Only trigger if the saved file matches the current task's expected filename pattern (`*_solution.py`) — do not trigger preview runs for unrelated files the candidate might have open.
- Debounce: if a save-triggered preview run is already in progress, ignore additional save events until it completes. Do not queue multiple overlapping runs.

---

## PART 3 — Telemetry with Mandatory Consent Gate

### 3.1 Consent must be implemented and working BEFORE any tracking code is added or activated. This is not a suggestion — build this section first, verify it works, then proceed to 3.2.

- On extension activation, check `context.globalState.get('forgeAI.telemetryConsent')`.
- If undefined (first run), show `vscode.window.showInformationMessage` with EXACTLY this text (do not paraphrase or shorten it):

  > "Forge AI can track how you work on this ticket — how many times you run a local preview, how long you take, how many times you save — to help build a more complete picture of real engineering work, not just your final answer. This is separate from your code, which is only sent when you Submit. Do you consent to this tracking?"

  With two buttons: `"Yes, I consent"` and `"No, don't track"`.
- Store the response in `context.globalState.update('forgeAI.telemetryConsent', true | false)`.
- If the candidate selects "No," **no telemetry code below may execute at all** — not a reduced version, none. Verify this by checking the consent flag as the very first line of every telemetry-related function, and returning immediately if false or undefined.
- Add a command `forge-vs.resetTelemetryConsent` (for testing/debugging and so a candidate can change their mind) that clears the stored flag and re-prompts on next activation.

### 3.2 Exact telemetry schema — do not add, rename, or omit fields

```typescript
interface TelemetryData {
    preview_run_count: number;       // increments each time forge-vs.previewRun completes (success or fail)
    time_to_first_submit_seconds: number | null;  // seconds from task file creation to first forge-vs.submit call; null if not yet submitted
    total_save_count: number;        // increments on every onDidSaveTextDocument for the task's solution file
    session_start_timestamp: number; // Date.now() when forge-vs.startTask was called
}
```

- Store this per-task-session in memory (a module-level object keyed by `taskId`, reset when `forge-vs.startTask` is called for a new session) — do NOT persist telemetry to disk beyond the current VS Code session unless explicitly asked to add persistence later.
- Track `session_start_timestamp` when `forge-vs.startTask` runs (Part 1).
- Increment `preview_run_count` in the preview run handler (Part 2), AFTER checking consent.
- Increment `total_save_count` in the save listener, AFTER checking consent.
- Calculate `time_to_first_submit_seconds` inside the EXISTING `forge-vs.submit` command handler, only on the first submit of a session (check if it's already been set; do not overwrite on subsequent submits within the same session).

### 3.3 Sending telemetry with the real submission
- In the existing `forge-vs.submit` command handler in `extension.ts`, extend the existing POST body — **add** a new optional field, do not restructure the existing ones:
  ```typescript
  body: JSON.stringify({
      code: code,
      task_id: currentTaskId,
      ticket_context: '',
      telemetry: telemetryConsentGiven ? currentSessionTelemetry : null,  // null if no consent
  })
  ```
- **This requires a corresponding backend change to accept and store this new optional `telemetry` field — that backend change is OUT OF SCOPE for this extension build.** Insert a clear comment: `// BACKEND TODO: /evaluate endpoint must accept an optional 'telemetry' field in the request body and store it — not yet implemented server-side as of this extension build.` Do not assume the backend already handles this field silently; flag it explicitly so it isn't missed.

---

## PART 4 — Explicit Testing Checklist (self-verify against this before considering the build done)

- [ ] `forge-vs.startTask` creates a real file, does not overwrite existing candidate work if the file already exists.
- [ ] `forge-vs.previewRun` never hangs indefinitely (timeout confirmed working by testing against an intentional infinite loop).
- [ ] Preview run results are visually and textually unmistakable from real submission results (different header, different color).
- [ ] Telemetry consent prompt appears on first activation, and NEVER again after a choice is made (unless `forge-vs.resetTelemetryConsent` is run).
- [ ] With consent declined, confirm via testing that `preview_run_count`, `total_save_count`, etc. are never sent and never even incremented — not just hidden.
- [ ] The existing `forge-vs.submit` flow (already working) still functions identically to before for the `code`, `task_id`, and `ticket_context` fields — this build must not break existing, working functionality.
- [ ] `taskData.ts` is byte-for-byte unchanged from its current state.

---

## OPTIONAL LOW-PRIORITY CLEANUP (do only after Parts 1–4 are complete and verified — do not let this distract from the core build)

- `package.json`'s `activationEvents` currently includes `"*"` alongside specific events like `"onView:forge-vs.ticketView"`. The `"*"` activates the extension on every VS Code startup regardless of use, which is discouraged practice and unnecessary given the specific events already listed. If touching this file for Part 1/3 additions anyway, it is safe to remove `"*"` — but do not do this as a standalone change without also verifying the extension still activates correctly via its specific events afterward.
- `extension.ts` reads `process.env.FORGE_API_URL` as a fallback before the VS Code configuration setting — `process.env` in a packaged, shipped extension reflects the environment of whoever built the `.vsix`, not the end user's machine, so this fallback is likely dead/misleading code in production. Flag with a comment if noticed; do not silently remove without confirmation, since it may be intentional for the founder's own local dev testing.
