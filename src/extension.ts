import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import { Task, TASKS, TASK_1 } from './data/taskData';
import { TASK_FUNCTION_SIGNATURES } from './data/taskFunctionSignatures';
import { TicketViewProvider } from './providers/TicketViewProvider';
import { runLocalPreview, PreviewRunResult, TestResult } from './preview/localPreview';

interface EvaluationResult {
    test_passed: boolean;
    ai_score: number;
    ai_feedback: string;
    exec_error?: string | null;
    error?: string | null;
    logs?: string[];
}

interface TelemetryData {
    preview_run_count: number;
    time_to_first_submit_seconds: number | null;
    total_save_count: number;
    session_start_timestamp: number;
}

let currentTaskId: string = 'task_1';
let ticketProvider: TicketViewProvider | undefined;
let ticketPanel: vscode.WebviewPanel | undefined;
let previewRunInProgress = false;
let extensionContext: vscode.ExtensionContext;
const telemetrySessions: Record<string, TelemetryData> = {};

export function getTaskSolutionFileName(taskId: string): string {
    return `${taskId}_solution.py`;
}

export function buildStarterTaskFileContent(taskId: string): string {
    const sig = TASK_FUNCTION_SIGNATURES[taskId];
    const signatureLine = sig ? sig.signature : 'def solution():';
    return `# Starter file for ${taskId}\n\n\n${signatureLine}\n    """Implement the solution for ${taskId}."""\n    pass\n`;
}

function getTelemetryConsent(context: vscode.ExtensionContext): boolean {
    return context.globalState.get<boolean>('forgeAI.telemetryConsent') === true;
}

function getOrCreateTelemetrySession(taskId: string): TelemetryData {
    if (!telemetrySessions[taskId]) {
        telemetrySessions[taskId] = {
            preview_run_count: 0,
            time_to_first_submit_seconds: null,
            total_save_count: 0,
            session_start_timestamp: Date.now(),
        };
    }

    return telemetrySessions[taskId];
}

function resetTelemetrySession(taskId: string): void {
    telemetrySessions[taskId] = {
        preview_run_count: 0,
        time_to_first_submit_seconds: null,
        total_save_count: 0,
        session_start_timestamp: Date.now(),
    };
}

async function promptForTelemetryConsent(context: vscode.ExtensionContext): Promise<boolean> {
    const consentState = context.globalState.get<boolean>('forgeAI.telemetryConsent');
    if (consentState !== undefined) {
        return consentState === true;
    }

    const choice = await vscode.window.showInformationMessage(
        'Forge AI can track how you work on this ticket — how many times you run a local preview, how long you take, how many times you save — to help build a more complete picture of real engineering work, not just your final answer. This is separate from your code, which is only sent when you Submit. Do you consent to this tracking?',
        'Yes, I consent',
        "No, don't track"
    );

    const consent = choice === 'Yes, I consent';
    await context.globalState.update('forgeAI.telemetryConsent', consent);
    return consent;
}

async function promptForCandidateIdentity(context: vscode.ExtensionContext): Promise<string | null> {
    const identity = context.globalState.get<string>('forgeAI.candidateIdentity');
    if (identity !== undefined) {
        return identity;
    }

    const entered = await vscode.window.showInputBox({
        prompt: 'Enter your name or email so your submissions can be identified',
        placeHolder: 'name@example.com',
    });

    if (entered !== undefined) {
        await context.globalState.update('forgeAI.candidateIdentity', entered || null);
        return entered || null;
    }

    return null;
}

function getOrCreateParticipantId(context: vscode.ExtensionContext): string {
    let id = context.globalState.get<string>('forgeAI.participantId');
    if (!id) {
        id = randomUUID();
        context.globalState.update('forgeAI.participantId', id);
    }
    return id;
}

function trackSaveTelemetry(context: vscode.ExtensionContext): void {
    if (getTelemetryConsent(context) !== true) {
        return;
    }

    const session = getOrCreateTelemetrySession(currentTaskId);
    session.total_save_count += 1;
}

function trackPreviewTelemetry(context: vscode.ExtensionContext): void {
    if (getTelemetryConsent(context) !== true) {
        return;
    }

    const session = getOrCreateTelemetrySession(currentTaskId);
    session.preview_run_count += 1;
}

function updateFirstSubmitTime(context: vscode.ExtensionContext): TelemetryData | null {
    if (getTelemetryConsent(context) !== true) {
        return null;
    }

    const session = getOrCreateTelemetrySession(currentTaskId);
    if (session.time_to_first_submit_seconds === null) {
        session.time_to_first_submit_seconds = Number(((Date.now() - session.session_start_timestamp) / 1000).toFixed(2));
    }

    return session;
}

function hasSolutionFilePattern(fileName: string): boolean {
    return /_solution\.py$/i.test(fileName);
}

function setCurrentTask(taskId: string) {
    currentTaskId = taskId;
    ticketProvider?.updateView(taskId);
    if (ticketPanel && ticketPanel.webview) {
        ticketPanel.webview.html = buildTicketPanelHtml(TASKS[taskId], taskId);
    }
}

function buildTicketPanelHtml(task: Task, taskId: string): string {
    const criteriaHtml = task.acceptanceCriteria.map(criterion => `<li>${criterion}</li>`).join('');
    const taskOptions = Object.entries(TASKS).map(([id, t]) => {
        const selected = id === taskId ? 'selected' : '';
        return `<option value="${id}" ${selected}>${t.id} - ${t.title.substring(0, 40)}${t.title.length > 40 ? '...' : ''}</option>`;
    }).join('');

    return `<!DOCTYPE html>
    <html>
    <head>
        <style>
            body {
                font-family: var(--vscode-font-family);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                padding: 16px;
                line-height: 1.6;
            }
            .dropdown-container {
                margin-bottom: 16px;
            }
            .dropdown-container select {
                width: 100%;
                padding: 6px 8px;
                background: var(--vscode-dropdown-background);
                color: var(--vscode-dropdown-foreground);
                border: 1px solid var(--vscode-dropdown-border);
                border-radius: 4px;
                font-size: 12px;
                font-family: var(--vscode-font-family);
                cursor: pointer;
            }
            .dropdown-container select:focus {
                outline: 1px solid var(--vscode-focusBorder);
            }
            .ticket-id {
                color: var(--vscode-textLink-foreground);
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.4px;
                margin-bottom: 8px;
            }
            .ticket-title {
                font-size: 20px;
                font-weight: 700;
                margin: 0 0 10px 0;
            }
            .ticket-meta {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 14px;
                font-size: 12px;
            }
            .tag {
                padding: 3px 10px;
                border-radius: 999px;
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                font-size: 11px;
            }
            .section {
                margin-top: 18px;
            }
            .section h3 {
                margin: 0 0 8px 0;
                font-size: 13px;
                font-weight: 700;
            }
            .content, .context-block {
                font-size: 13px;
                color: var(--vscode-descriptionForeground);
                white-space: pre-wrap;
            }
            .context-block {
                background: var(--vscode-editor-inactiveSelectionBackground);
                padding: 12px;
                border-radius: 6px;
            }
            ul {
                padding-left: 18px;
                margin: 0;
            }
            li {
                margin-bottom: 6px;
            }
            .divider {
                border: none;
                border-top: 1px solid var(--vscode-panel-border);
                margin: 14px 0;
            }
        </style>
    </head>
    <body>
        <div class="dropdown-container">
            <select id="taskSelect">
                ${taskOptions}
            </select>
        </div>

        <div class="ticket-id">${task.id}</div>
        <div class="ticket-title">${task.title}</div>
        <div class="ticket-meta">
            <span class="tag">${task.priority}</span>
            <span class="tag">${task.skill}</span>
            <span class="tag">${task.ticketType}</span>
            <span class="tag">${task.company}</span>
        </div>

        <hr class="divider" />

        <div class="section">
            <h3>Context</h3>
            <div class="context-block">${task.context}</div>
        </div>

        <div class="section">
            <h3>Description</h3>
            <div class="content">${task.description}</div>
        </div>

        <div class="section">
            <h3>Acceptance Criteria</h3>
            <ul>${criteriaHtml}</ul>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            const select = document.getElementById('taskSelect');
            select.addEventListener('change', () => {
                vscode.postMessage({
                    type: 'taskSelected',
                    taskId: select.value
                });
            });
        </script>
    </body>
    </html>`;
}

function formatFeedbackHtml(feedback: string): string {
    let html = feedback;

    // Convert markdown-style bullet points to HTML lists
    const bulletRegex = /^- (.+)$/gm;
    html = html.replace(bulletRegex, '<li>$1</li>');

    // Wrap consecutive list items in <ul>
    const ulRegex = /(<li>.+<\/li>)/s;
    if (ulRegex.test(html)) {
        html = html.replace(/(<li>.+<\/li>)/s, (match) => `<ul>${match}</ul>`);
    }

    // Convert markdown headers to HTML
    html = html.replace(/^### (.+)$/gm, '<h4 style="margin-top: 10px;">$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3 style="margin-top: 10px;">$1</h3>');

    // Preserve line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
}

function showPreviewResultsPanel(result: PreviewRunResult) {
    const panel = vscode.window.createWebviewPanel(
        'forgePreviewResults',
        'Local Preview Results',
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );

    const passed = result.test_passed ? 'passed' : 'failed';
    const testChecklistHtml = result.testResults && result.testResults.length > 0
        ? result.testResults.map((t) => {
            const icon = t.status === 'PASSED' ? '✅' : '❌';
            return `<div style="padding: 6px 0; font-size: 13px;">${icon} ${t.name}</div>`;
        }).join('')
        : '';
    const rawOutput = (result.logs || []).join('<br>');

    panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 24px;
                    background: #1e1e1e;
                    color: #cccccc;
                    line-height: 1.6;
                }
                .preview-header {
                    text-align: center;
                    font-size: 18px;
                    font-weight: 700;
                    letter-spacing: 0.08em;
                    color: #f4c542;
                    margin-bottom: 12px;
                    text-transform: uppercase;
                }
                .score {
                    font-size: 64px;
                    font-weight: 700;
                    text-align: center;
                    padding: 20px 0 10px 0;
                }
                .passed { color: #4caf50; }
                .failed { color: #f44336; }
                .status {
                    text-align: center;
                    font-size: 18px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid #333;
                }
                .section {
                    margin-top: 20px;
                }
                .section-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: #888;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 8px;
                }
                .test-checklist {
                    background: #2d2d2d;
                    padding: 12px;
                    border-radius: 6px;
                    margin-bottom: 12px;
                }
                .feedback {
                    background: #2d2d2d;
                    padding: 16px;
                    border-radius: 6px;
                    white-space: pre-wrap;
                    font-size: 14px;
                }
                .error {
                    color: #f44336;
                    background: #2d1e1e;
                    padding: 12px;
                    border-radius: 6px;
                    margin-top: 12px;
                    border: 1px solid #f44336;
                }
            </style>
        </head>
        <body>
            <div class="preview-header">LOCAL PREVIEW — NOT YOUR OFFICIAL SCORE</div>
            <div class="score ${passed}">${result.ai_score || 0}/100</div>
            <div class="status">${result.test_passed ? '✅ PASSED' : '❌ FAILED'}</div>

            ${testChecklistHtml ? `
                <div class="section">
                    <div class="section-title">Test Results</div>
                    <div class="test-checklist">${testChecklistHtml}</div>
                </div>
            ` : ''}

            <div class="section">
                <div class="section-title">Pytest Output</div>
                <div class="feedback">${rawOutput || result.ai_feedback || 'No output'}</div>
            </div>

            ${result.exec_error ? `
                <div class="section">
                    <div class="section-title">Preview Error</div>
                    <div class="error">${result.exec_error}</div>
                </div>
            ` : ''}
        </body>
        </html>
    `;
}

function showResultsPanel(result: EvaluationResult, task: Task) {
    const panel = vscode.window.createWebviewPanel(
        'forgeResults',
        'Forge AI Results',
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );

    const passed = result.test_passed ? 'passed' : 'failed';
    const criteriaHtml = task.acceptanceCriteria.map(criterion => `<li>${criterion}</li>`).join('');
    const formattedFeedback = formatFeedbackHtml(result.ai_feedback || 'No feedback');

    // BACKEND TODO: ai_score granularity/accuracy is backend-controlled — not fixable from the extension.
    panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 24px;
                    background: #1e1e1e;
                    color: #cccccc;
                    line-height: 1.6;
                }
                .score {
                    font-size: 64px;
                    font-weight: 700;
                    text-align: center;
                    padding: 20px 0 10px 0;
                }
                .passed { color: #4caf50; }
                .failed { color: #f44336; }
                .status {
                    text-align: center;
                    font-size: 18px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid #333;
                }
                .section {
                    margin-top: 20px;
                }
                .section-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: #888;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 8px;
                }
                .feedback, .content {
                    background: #2d2d2d;
                    padding: 16px;
                    border-radius: 6px;
                    white-space: pre-wrap;
                    font-size: 14px;
                }
                .error {
                    color: #f44336;
                    background: #2d1e1e;
                    padding: 12px;
                    border-radius: 6px;
                    margin-top: 12px;
                    border: 1px solid #f44336;
                }
                ul {
                    padding-left: 20px;
                    margin: 0;
                }
                li {
                    margin-bottom: 6px;
                }
                h4 {
                    margin: 12px 0 6px 0;
                }
            </style>
        </head>
        <body>
            <div class="score ${passed}">${result.ai_score || 0}/100</div>
            <div class="status">${result.test_passed ? '✅ PASSED' : '❌ FAILED'}</div>

            <div class="section">
                <div class="section-title">Acceptance Criteria</div>
                <ul>${criteriaHtml}</ul>
            </div>

            <div class="section">
                <div class="section-title">Feedback</div>
                <div class="feedback">${formattedFeedback}</div>
            </div>

            ${result.logs && result.logs.length > 0 ? `
                <div class="section">
                    <div class="section-title">Execution Logs</div>
                    <div class="content">${result.logs.join('<br>')}</div>
                </div>
            ` : ''}

            ${result.exec_error ? `
                <div class="section">
                    <div class="section-title">Execution Error</div>
                    <div class="error">${result.exec_error}</div>
                </div>
            ` : ''}

            ${result.error ? `
                <div class="section">
                    <div class="section-title">System Error</div>
                    <div class="error">${result.error}</div>
                </div>
            ` : ''}
        </body>
        </html>
    `;
}

async function showOrUpdateTicketPanel() {
    const task = TASKS[currentTaskId];

    if (ticketPanel && !ticketPanel.active) {
        ticketPanel.webview.html = buildTicketPanelHtml(task, currentTaskId);
        ticketPanel.reveal();
    } else if (!ticketPanel) {
        ticketPanel = vscode.window.createWebviewPanel(
            'forgeTicket',
            'Forge AI Ticket',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );
        ticketPanel.webview.html = buildTicketPanelHtml(task, currentTaskId);
        ticketPanel.onDidDispose(() => {
            ticketPanel = undefined;
        });
        ticketPanel.webview.onDidReceiveMessage((message) => {
            if (message.type === 'taskSelected') {
                setCurrentTask(message.taskId);
                void showOrUpdateTicketPanel();
            }
        });
    }
}

export async function activate(context: vscode.ExtensionContext) {
    extensionContext = context;
    console.log('🚀 Forge AI extension is now active!');

    await promptForTelemetryConsent(context);
    await promptForCandidateIdentity(context);
    getOrCreateParticipantId(context);

    ticketProvider = new TicketViewProvider(context, (taskId: string) => {
        setCurrentTask(taskId);
    });

    const registration = vscode.window.registerWebviewViewProvider(
        'forge-vs.ticketView',
        ticketProvider,
        {
            webviewOptions: {
                retainContextWhenHidden: true,
            },
        }
    );
    context.subscriptions.push(registration);
    console.log('✅ Ticket view provider registered with options');

    await showOrUpdateTicketPanel();

    context.subscriptions.push(
        vscode.commands.registerCommand('forge-vs.showTicketView', async () => {
            await showOrUpdateTicketPanel();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('forge-vs.startTask', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('Open a folder first, then start a task.');
                return;
            }

            const fileName = getTaskSolutionFileName(currentTaskId);
            const filePath = path.join(workspaceFolder.uri.fsPath, fileName);
            const fileUri = vscode.Uri.file(filePath);

            if (!fs.existsSync(filePath)) {
                await vscode.workspace.fs.writeFile(fileUri, Buffer.from(buildStarterTaskFileContent(currentTaskId)));
            }

            const document = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(document, { preview: false, viewColumn: vscode.ViewColumn.Active });

            resetTelemetrySession(currentTaskId);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('forge-vs.previewRun', async () => {
            const editor = vscode.window.activeTextEditor;
            const filePath = editor?.document.fileName;
            if (!filePath) {
                vscode.window.showErrorMessage('No file open. Open a Python file first.');
                return;
            }

            if (previewRunInProgress) {
                vscode.window.showWarningMessage('Preview run already in progress...');
                return;
            }

            previewRunInProgress = true;

            try {
                const result = await runLocalPreview(currentTaskId, filePath, 10000);
                showPreviewResultsPanel(result);
                trackPreviewTelemetry(context);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Preview run failed: ${error?.message}`);
            } finally {
                previewRunInProgress = false;
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('forge-vs.resetTelemetryConsent', async () => {
            await context.globalState.update('forgeAI.telemetryConsent', undefined);
            await promptForTelemetryConsent(context);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('forge-vs.resetCandidateIdentity', async () => {
            await context.globalState.update('forgeAI.candidateIdentity', undefined);
            await promptForCandidateIdentity(context);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('forge-vs.submit', async () => {
            console.log(`📤 submit command executed for task: ${currentTaskId}`);

            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No file open. Open a Python file first.');
                return;
            }

            const code = editor.document.getText();
            const fileName = editor.document.fileName.split('/').pop() || 'unknown.py';
            const telemetryAllowed = getTelemetryConsent(context);
            const session = telemetryAllowed ? updateFirstSubmitTime(context) : null;

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Submitting ${fileName} for ${TASKS[currentTaskId]?.id || currentTaskId}...`,
                    cancellable: false,
                },
                async () => {
                    try {
                        const config = vscode.workspace.getConfiguration('forgeAI');
                        const apiUrl = process.env.FORGE_API_URL ||
                            config.get('apiUrl') as string ||
                            'https://forge-ai-core.onrender.com';
                        console.log(`🌐 API URL: ${apiUrl}`);

                        // BACKEND TODO: /evaluate endpoint must accept an optional 'telemetry' field in the request body and store it — not yet implemented server-side as of this extension build.
                        // BACKEND TODO: /evaluate endpoint must accept and store 'participant_id' and 'candidate_identity' — not yet implemented server-side.
                        const response = await fetch(`${apiUrl}/evaluate`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                code: code,
                                task_id: currentTaskId,
                                ticket_context: '',
                                telemetry: telemetryAllowed ? session : null,
                                participant_id: getOrCreateParticipantId(context),
                                candidate_identity: context.globalState.get('forgeAI.candidateIdentity') ?? null,
                            }),
                        });

                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`API Error (${response.status}): ${errorText}`);
                        }

                        const result = await response.json() as EvaluationResult;

                        const passedText = result.test_passed ? '✅ PASSED' : '❌ FAILED';
                        vscode.window.showInformationMessage(
                            `Forge AI: ${passedText} (Score: ${result.ai_score}/100)`
                        );

                        showResultsPanel(result, TASKS[currentTaskId]);
                    } catch (error: any) {
                        vscode.window.showErrorMessage(`Failed to submit: ${error.message}`);
                        console.error('❌ Submit error:', error);
                    }
                }
            );
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument((document) => {
            if (!hasSolutionFilePattern(document.fileName)) {
                return;
            }

            if (previewRunInProgress) {
                return;
            }

            trackSaveTelemetry(context);

            if (getTelemetryConsent(context) !== true) {
                return;
            }

            void (async () => {
                const result = await runLocalPreview(currentTaskId, document.fileName, 10000);
                showPreviewResultsPanel(result);
                trackPreviewTelemetry(context);
            })();
        })
    );
}

export function deactivate() {
    console.log('👋 Forge AI extension deactivated');
}
