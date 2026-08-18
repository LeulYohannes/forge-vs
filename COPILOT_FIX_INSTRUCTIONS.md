# COPILOT FIX INSTRUCTIONS — Forge AI VS Code Extension: Bug Fixes + Missing Features

## READ THIS FIRST — RULES THAT STILL APPLY FROM `COPILOT_BUILD_INSTRUCTIONS.md`

This file assumes `COPILOT_BUILD_INSTRUCTIONS.md` (Parts 1–3: starter files, local preview, telemetry
consent) is already built and working, per the current state of `extension.ts`. The same ground rules
from that file still apply here, unchanged:

1. **Do not modify `src/data/taskData.ts`.** Not the 5 tasks, not the field names, not the content.
   Every fix below that needs new per-task data goes in a **new sibling file**, not into `taskData.ts`.
2. **Do not change the existing `/evaluate` API contract's existing fields.** You may **add** new
   optional fields to the POST body (as Part 3 of the original doc already did for `telemetry`). Never
   rename or restructure `code`, `task_id`, `ticket_context`, or the response shape.
3. **Do not add new npm packages.** Everything below is doable with Node built-ins
   (`crypto`, `child_process`, `os`, `path`, `fs`) plus the existing VS Code API.
4. **Match the existing visual style.** Sidebar/panel HTML uses VS Code CSS variables. The two results
   panels (`showResultsPanel`, `showPreviewResultsPanel`) use the existing hardcoded dark-panel style
   (`#1e1e1e`, `#4caf50`, `#f44336`, etc.) — extend that pattern, don't invent a third style.
5. **If anything below is ambiguous, insert `// TODO: VERIFY — <question>` and implement the safest,
   most conservative version.** Do not guess at product decisions. Several items below are marked
   **TODO: VERIFY** on purpose — build the safe default next to them, don't skip the fix waiting on
   an answer.

---

## FIX 1 — Local Preview Says "FAILED" Even When the Real Submission Passes

### Root cause (confirmed by reading the code)

In `runPreviewForFile()`, the extension runs:

```ts
const args = ['-m', 'pytest', filePath, '-v'];
```

`filePath` is the **candidate's own solution file** (`task_1_solution.py`), not a test file. That file
only ever contains the stub from `buildStarterTaskFileContent`:

```ts
return `# Starter file for ${taskId}\n\n\ndef solution():\n    """Implement the solution for ${taskId}."""\n    pass\n`;
```

Running `pytest` directly against a file with **zero `test_*` functions** collects 0 tests. Pytest's own
summary line in that case is `"no tests ran in 0.01s"` — which never matches the regex in
`parsePytestSummary` (`/\d+\s+(passed|failed|error|skipped|xpassed|xfailed)/i`). Downstream:

```ts
const passed = /\d+\s+passed/i.test(summary) && !failed;
```

`passed` can never become `true` this way — there is no code path in which local preview can ever say
PASSED, regardless of whether the candidate's code is correct. This isn't a flaky bug, it's a fully
unimplemented feature that was already flagged as an unresolved gap in the original build doc
(`// TODO: VERIFY — confirm the exact local test file naming/location convention`). That gap was never
closed, which is why it's still broken.

A second, related bug makes this worse: the starter stub always generates a generic `def solution():`,
but every task actually requires a **specific, differently-named function** (e.g.
`syntax_aware_splitter(source_code: str)` for task 1). Even a perfect local test harness would have
nothing correctly named to import.

### The fix

**1a. Add a function-signature lookup table.** New file `src/data/taskFunctionSignatures.ts`
(sibling to `taskData.ts`, does not modify it):

```ts
export interface TaskFunctionSignature {
    functionName: string;
    signature: string; // for the starter stub comment/def line
}

export const TASK_FUNCTION_SIGNATURES: Record<string, TaskFunctionSignature> = {
    task_1: { functionName: 'syntax_aware_splitter', signature: 'def syntax_aware_splitter(source_code: str):' },
    task_2: { functionName: 'hybrid_score_fusion',   signature: 'def hybrid_score_fusion(sparse_scores, dense_scores, alpha=0.5):' },
    task_3: { functionName: 'apply_metadata_filter', signature: 'def apply_metadata_filter(documents, conditions):' },
    task_4: { functionName: 'rerank_retrievals',     signature: 'def rerank_retrievals(query, raw_documents, top_k=3):' },
    task_5: { functionName: 'compute_faithfulness_score', signature: 'def compute_faithfulness_score(context_chunks, generated_answer):' },
};
```

(These function names/signatures are taken directly from the existing "Your Mission" text already in
`taskData.ts` — nothing invented.)

**1b. Fix the starter stub** in `extension.ts` to use this table instead of the generic `solution()`:

```ts
export function buildStarterTaskFileContent(taskId: string): string {
    const sig = TASK_FUNCTION_SIGNATURES[taskId];
    const signatureLine = sig ? sig.signature : 'def solution():';
    return `# Starter file for ${taskId}\n\n\n${signatureLine}\n    """Implement the solution for ${taskId}."""\n    pass\n`;
}
```

Update `src/test/extension.test.ts`'s existing regex assumption (`/def .*\(\)\s*:/`) if it stops matching
signatures that take arguments — adjust the test, don't loosen the stub.

**1c. Add real local test bodies**, derived directly from the examples already written in each task's
`description` in `taskData.ts` (again, not invented). New file `src/data/previewTestCases.ts`:

```ts
export const PREVIEW_TEST_BODIES: Record<string, string> = {
  task_1: `
def test_splits_by_function_definitions():
    fn = get_fn()
    source_code = "\\ndef greet(name):\\n    return f\\"Hello, {name}\\"\\n\\ndef farewell(name):\\n    return f\\"Goodbye, {name}\\"\\n"
    result = fn(source_code)
    assert len(result) == 2
    assert "def greet" in result[0]
    assert "def farewell" in result[1]

def test_invalid_syntax_returns_empty_list():
    fn = get_fn()
    result = fn("def broken(:\\n    this is not valid python")
    assert result == []
`,
  task_2: `
def test_alpha_blends_sparse_and_dense_scores():
    fn = get_fn()
    sparse = {"doc_A": 0.9, "doc_B": 0.3}
    dense = {"doc_A": 0.2, "doc_B": 0.8}
    result = dict(fn(sparse, dense, alpha=0.5))
    assert abs(result["doc_A"] - 0.55) < 1e-6
    assert abs(result["doc_B"] - 0.55) < 1e-6

def test_alpha_zero_uses_only_sparse_scores():
    fn = get_fn()
    sparse = {"doc_A": 0.9, "doc_B": 0.3}
    dense = {"doc_A": 0.2, "doc_B": 0.8}
    result = dict(fn(sparse, dense, alpha=0.0))
    assert abs(result["doc_A"] - 0.9) < 1e-6
    assert abs(result["doc_B"] - 0.3) < 1e-6
`,
  task_3: `
def test_multiple_conditions_use_and_logic():
    fn = get_fn()
    documents = [
        {"id": "1", "status": "active", "score": 0.95, "created_at": "2024-06-01"},
        {"id": "2", "status": "active", "score": 0.42, "created_at": "2024-06-01"},
        {"id": "3", "status": "deprecated", "score": 0.88, "created_at": "2024-06-01"},
    ]
    conditions = {"min_score": 0.80, "status": "active"}
    result = fn(documents, conditions)
    assert [d["id"] for d in result] == ["1"]

def test_empty_conditions_returns_all_documents():
    fn = get_fn()
    documents = [{"id": "1", "status": "active", "score": 0.5, "created_at": "2024-06-01"}]
    result = fn(documents, {})
    assert len(result) == 1
`,
  task_4: `
def test_returns_top_k_documents_sorted_by_score():
    fn = get_fn()
    documents = [
        {"id": "doc_low", "relevance_score": 0.12},
        {"id": "doc_high", "relevance_score": 0.91},
        {"id": "doc_mid", "relevance_score": 0.55},
    ]
    result = fn("query", documents, top_k=2)
    assert [d["id"] for d in result] == ["doc_high", "doc_mid"]

def test_empty_input_returns_empty_list():
    fn = get_fn()
    result = fn("query", [], top_k=3)
    assert result == []
`,
  task_5: `
def test_faithfulness_ratio_for_supported_answer():
    fn = get_fn()
    context = ["The sky is blue.", "Water boils at 100 degrees Celsius."]
    answer = "The sky is blue and water boils at 100 degrees."
    result = fn(context, answer)
    assert result["statements_checked"] == 1
    assert result["supported_statements"] == 1
    assert result["faithfulness_ratio"] == 1.0
`,
};
```

**1d. Rewrite the preview-run logic** (new file `src/preview/localPreview.ts` recommended, imported into
`extension.ts`, to keep `extension.ts` from growing unbounded — matches the existing `providers/`/`data/`
modular pattern):

- Build the full pytest file content at run time by concatenating:
  1. A fixed header that dynamically imports the candidate's solution via
     `importlib.util.spec_from_file_location` (using the candidate's **absolute** file path, injected
     into the template string) and exposes `get_fn()`, which raises a clear `AttributeError` naming the
     expected function if it's missing (e.g. *"Your file must define a function named
     'syntax_aware_splitter'."*) — this turns a wrong-function-name mistake into a readable local error
     instead of a silent 0-collected-tests failure.
  2. The `PREVIEW_TEST_BODIES[taskId]` body for the current task.
- Write this generated content to a file in `os.tmpdir()` (Node's `os.tmpdir()`), named something like
  `forge-preview-${taskId}.py` — **not** inside the candidate's workspace, so it never gets confused with
  their real files or accidentally committed.
- `spawn('python', ['-m', 'pytest', tempTestFilePath, '-v'])` exactly as before (keep the existing 10s
  timeout / kill-on-timeout logic — that part is already correct and should not change).
- **Parse per-test results**, not just one summary line. Pytest `-v` output has lines like:
  `tmp_path::test_alpha_zero_uses_only_sparse_scores PASSED [ 50%]`. Use a line-based regex such as
  `/^(\S+::\S+)\s+(PASSED|FAILED|ERROR)\b/` against each output line to build a structured list of
  `{ name: string, status: 'PASSED' | 'FAILED' | 'ERROR' }`.
- Compute `ai_score` for the preview as `Math.round((passedCount / totalCount) * 100)` instead of the
  current binary `passed ? 100 : 0` — this is the "more accurate score" fix for the local side.
- If **zero** tests were parsed (e.g. the candidate's file has a syntax error that crashes collection),
  fall back to showing the raw output, exactly as `parsePytestSummary` already does — don't fabricate a
  score.

### Also update `showPreviewResultsPanel`

Replace the single feedback blob with a structured checklist: iterate the parsed per-test list and render
each as a row (✅/❌ + test name), above the raw pytest output (keep raw output too, collapsed or below,
for debugging). This directly serves Fix 2 below as well.

---

## FIX 2 — Results Are Too Generic / Not Structured (Both Local and Live)

### Local preview
Covered by Fix 1's structured per-test checklist + percentage-based score. No further work needed here
beyond what Fix 1 already produces.

### Live results (`showResultsPanel`)

Two concrete bugs found — both are silently **dropping data the backend already sends**, which is very
likely why live results feel generic even though the backend already returns more:

- `result.logs` (`string[]`, already in the `EvaluationResult` interface) is **never rendered anywhere**
  in `showResultsPanel`. Add a new "Execution Logs" section (same visual pattern as the existing
  `.feedback` block) that renders `result.logs.join('<br>')` when the array is non-empty.
- `result.error` (separate from `result.exec_error` in the interface) is also **never rendered** — only
  `exec_error` is checked. Add a second, distinctly labeled section for `result.error` when present, so
  neither field is silently dropped. If both are ever present, show both, clearly labeled separately
  (e.g. "Execution Error" vs "System Error") — do not merge them into one string.
- Pass the current `Task` object into `showResultsPanel(result, task)` and render the task's
  `acceptanceCriteria` (already available client-side from `taskData.ts`, no backend change needed)
  alongside the score, so the result has visible context instead of a bare number and a paragraph.
- Lightly format `ai_feedback`: if it contains lines starting with `- ` or `## `/`### `, convert those to
  real `<li>`/`<h4>` HTML instead of one `<br>`-joined wall of text. Fall back to the current
  `<br>`-joined behavior for anything that doesn't match — don't assume the backend always sends
  markdown.

**Do not attempt to make `ai_score` itself "more accurate" for live results** — that number comes
entirely from the `/evaluate` backend response and this repo has no visibility into how it's computed.
Insert a comment: `// BACKEND TODO: ai_score granularity/accuracy is backend-controlled — not fixable from the extension.`

---

## FIX 3 — No Task Selection Dropdown Visible (Always Opens Task 1)

### Root cause

`activate()` calls `showTicketPanel(TASK_1)` on every activation. This full-panel view
(`showTicketPanel`, opened front-and-center in `ViewColumn.One`) is almost certainly what's actually
being seen — and **it has no `<select>` dropdown at all.** The dropdown only exists in the *sidebar*
webview (`TicketViewProvider`), a completely separate piece of UI. The auto-opened panel that greets the
user on every activation is static and locked to whatever task was passed in.

A second bug in the same area: `forge-vs.showTicketView` calls `showTicketPanel(...)` fresh every time
it runs, calling `vscode.window.createWebviewPanel` again — repeated invocations create **duplicate
panels** instead of reusing one.

### The fix

- Refactor `showTicketPanel`'s HTML-building code into a reusable `buildTicketPanelHtml(task, taskId)`
  function, and add the **same** `<select>` dropdown markup + `onDidReceiveMessage`/`taskSelected`
  message pattern already used in `TicketViewProvider._getHtmlForWebview` — reuse the identical dropdown
  HTML/CSS so both surfaces look and behave the same way (ground rule 4).
- Keep a module-level `let ticketPanel: vscode.WebviewPanel | undefined;` in `extension.ts`. On
  `forge-vs.showTicketView`: if `ticketPanel` already exists, call `ticketPanel.reveal()` and just update
  its `webview.html` — only call `createWebviewPanel` if it's undefined or was disposed. Register
  `ticketPanel.onDidDispose(() => { ticketPanel = undefined; })` so a closed panel doesn't leak state.
- Add a single shared function in `extension.ts`:
  ```ts
  function setCurrentTask(taskId: string) {
      currentTaskId = taskId;
      ticketProvider?.updateView(taskId);
      if (ticketPanel) {
          ticketPanel.webview.html = buildTicketPanelHtml(TASKS[taskId], taskId);
      }
  }
  ```
  Call this from **both** the sidebar's `onTaskSelected` callback and the panel's own
  `onDidReceiveMessage` handler for `taskSelected`, so switching tasks from either surface keeps both in
  sync (currently, changing the sidebar dropdown does not update the panel, and the panel has no way to
  change it at all).

---

## FIX 4 — Add a Separate Employer Notes Section

**Scope note:** a repo-wide search found **no existing "student notes" feature anywhere in this
codebase.** If one already exists, it lives outside this repository — Copilot should build **both** a
candidate notes section and a separate employer notes section as new features here, since nothing to
extend currently exists.

### Data model

Two fully independent stores, keyed per task, in `context.workspaceState` (local to the machine, not
sent to the backend — see TODO below):

- `forgeAI.notes.candidate.<taskId>` → `{ timestamp: number, text: string }[]`
- `forgeAI.notes.employer.<taskId>` → `{ timestamp: number, text: string }[]`

Use an **append-only list of timestamped entries**, not a single overwritable text blob — this is what
makes the record "precise": each note is a discrete, timestamped observation rather than a running
draft that silently overwrites itself.

### UI

In `TicketViewProvider._getHtmlForWebview`, add two new, visually separate sections below "Acceptance
Criteria":

- **"Your Notes"** — a textarea + "Add Note" button, rendering the candidate's existing entries
  chronologically underneath.
- **"Employer Notes"** — same interaction pattern, styled distinctly (e.g. a different accent color via
  a new CSS class, not the same block reused) so it reads as a structurally separate section, not a
  variant of the first.

### Message passing

Extend the existing `webviewView.webview.onDidReceiveMessage` handler in `TicketViewProvider` with two
new message types:

```ts
if (message.type === 'addCandidateNote') { /* append to forgeAI.notes.candidate.<taskId>, refresh */ }
if (message.type === 'addEmployerNote')   { /* append to forgeAI.notes.employer.<taskId>, refresh */ }
```

Each carries `{ taskId, text }`; on receipt, append `{ timestamp: Date.now(), text }` to the relevant
`workspaceState` array and re-render the webview HTML.

### TODO: VERIFY

Insert this comment at the top of the notes code: `// TODO: VERIFY — employer notes currently save
locally only (workspaceState). Confirm whether these need to sync to the backend so an employer can read
them from somewhere other than the candidate's own machine, or whether local-only is sufficient for now.`
Do not add a backend call for notes without resolving this — there is no notes field in the `/evaluate`
contract today, and adding one would violate ground rule 2 without an explicit decision.

---

## FIX 5 — No User Tracking Without Login

### Root cause

Nothing in the current telemetry payload or the `/evaluate` POST body identifies **who** is submitting.
`TelemetryData` tracks behavior (save counts, timing) but never a person or even a stable anonymous
device ID. From the backend's point of view, every submission is unattributable.

### The fix

**5a. Persistent anonymous ID (ship immediately, no prompts):**

```ts
function getOrCreateParticipantId(context: vscode.ExtensionContext): string {
    let id = context.globalState.get<string>('forgeAI.participantId');
    if (!id) {
        id = randomUUID(); // from Node's built-in 'crypto' module
        context.globalState.update('forgeAI.participantId', id);
    }
    return id;
}
```

Generate this once on activation, reuse across sessions and across all tasks.

**5b. One-time name/email prompt**, so the anonymous ID can be mapped to a real person:

- On first activation (after the telemetry consent prompt, so ordering matches the existing pattern),
  if `context.globalState.get('forgeAI.candidateIdentity')` is undefined, show
  `vscode.window.showInputBox({ prompt: 'Enter your name or email so your submissions can be identified', placeHolder: 'name@example.com' })`.
- Store the raw string entered (or `null` if the candidate dismisses the box — don't force it; re-prompt
  isn't necessary, just retry silently next activation if still undefined) in
  `context.globalState.update('forgeAI.candidateIdentity', value)`.
- Add a command `forge-vs.resetCandidateIdentity` (mirrors `forge-vs.resetTelemetryConsent`) that clears
  it and re-prompts, for correcting typos.

**5c. Include both fields in the existing `/evaluate` POST body** as new optional, additive fields (same
pattern as `telemetry`):

```ts
body: JSON.stringify({
    code: code,
    task_id: currentTaskId,
    ticket_context: '',
    telemetry: telemetryAllowed ? session : null,
    participant_id: getOrCreateParticipantId(context),
    candidate_identity: context.globalState.get('forgeAI.candidateIdentity') ?? null,
}),
```

Send `participant_id` and `candidate_identity` **regardless of telemetry consent** — this is submission
attribution (who sent this code), not behavioral tracking (how they worked), so it isn't gated by the
same consent flag. Insert: `// BACKEND TODO: /evaluate endpoint must accept and store 'participant_id' and 'candidate_identity' — not yet implemented server-side.` — same convention as the existing telemetry TODO.

---

## TESTING CHECKLIST — self-verify before considering this done

- [ ] Preview run against a deliberately wrong solution shows FAILED with a correct per-test breakdown.
- [ ] Preview run against a correct solution (matching the task's own example) shows PASSED for every
      sub-test, and the score is 100.
- [ ] Preview run score reflects `passed/total`, not a flat 0 or 100, when some sub-tests pass and others
      don't.
- [ ] A candidate file with the wrong function name shows a clear "must define a function named X" error
      locally instead of a silent 0-tests-collected failure.
- [ ] Live results panel renders `logs` and `error` when a mocked backend response includes them.
- [ ] Both the sidebar dropdown and the auto-opened ticket panel change `currentTaskId` and immediately
      reflect each other's selection.
- [ ] Running "Forge AI: Show Ticket View" twice does not create a second panel.
- [ ] Candidate notes and employer notes persist independently across a reload and are scoped per task.
- [ ] A fresh install generates one stable `participantId` that survives a VS Code restart.
- [ ] `taskData.ts` is byte-for-byte unchanged.
- [ ] No new npm dependencies were added without a `// NEEDS APPROVAL` comment.

---

## OPEN QUESTIONS FOR YOU (collected TODO: VERIFY items)

1. Should employer notes sync to a backend eventually, or is local-only (current machine) fine for now?
2. Should the candidate identity prompt be required (block until answered) or optional/skippable as
   written above?
3. Confirm the backend team is aware of two new required changes: accepting/storing `telemetry`
   (already flagged previously) and now also `participant_id` + `candidate_identity`.
