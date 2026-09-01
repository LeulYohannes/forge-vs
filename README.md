# Forge AI — VS Code Extension

Forge AI is a skills verification platform that lets engineers solve real engineering tickets inside VS Code and get graded by an automated AI judge.

## Features

- **Demo Mode** — Solve 5 pre-built RAG engineering challenges (syntax-aware splitter, hybrid score fusion, metadata filter, reranker, faithfulness evaluator) directly inside VS Code.
- **Assignment Mode** — Companies issue a token to a candidate. Entering the token loads a company-specific ticket with only the function signature exposed — no test suite, no hints.
- **Local Preview Run** — Run a quick local pytest check before submitting (available for the 5 demo tasks). Use `Ctrl+Shift+R` / `Cmd+Shift+R`.
- **Official Submit** — Sends your code to the Forge AI grading engine. Results are scored by test suite + AI judge. Use `Ctrl+Shift+E` / `Cmd+Shift+E`.
- **Telemetry** — With consent, the extension tracks how many previews you ran, how many times you saved, and how long you took before submitting. This is sent to the company as behavioral context, separate from your code score.

## Requirements

- Python 3.9+ must be installed and available on `PATH` (`python --version` should work in your terminal).
- `pytest` must be installed (`pip install pytest`) for local preview runs.

## Getting Started

### Demo Mode (no token needed)

1. Install the extension.
2. Open the **Forge AI** icon in the Activity Bar.
3. Run **Forge AI: Start Task** from the Command Palette (`Ctrl+Shift+P`).
4. A starter Python file opens. Implement the function.
5. Press `Ctrl+Shift+R` to run a local preview.
6. Press `Ctrl+Shift+E` to submit for official grading.

### Assignment Mode (company candidate)

1. Install the extension.
2. Open the Command Palette and run **Forge AI: Enter Assignment Code**.
3. Paste your assignment token.
4. The ticket panel shows the function signature you need to implement.
5. Run **Forge AI: Start Task** to create your solution file.
6. Press `Ctrl+Shift+E` to submit when ready.

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `forgeAI.apiUrl` | `https://forge-ai-core.onrender.com` | URL of the Forge AI backend. Change only if you are self-hosting. |

## Commands

| Command | Shortcut | Description |
|---|---|---|
| Forge AI: Start Task | — | Creates and opens the starter solution file |
| Forge AI: Preview Run | `Ctrl+Shift+R` | Runs local pytest preview (demo tasks only) |
| Forge AI: Submit for Evaluation | `Ctrl+Shift+E` | Submits code to grading engine |
| Forge AI: Enter Assignment Code | — | Loads a company-assigned ticket via token |
| Forge AI: Show Ticket View | — | Re-opens the ticket panel |
| Forge AI: Reset Telemetry Consent | — | Re-prompts for telemetry tracking consent |

## Release Notes

### 0.0.1

- Initial release: demo mode, assignment mode, telemetry, local preview, submit.
