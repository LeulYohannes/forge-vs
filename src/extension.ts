import * as vscode from 'vscode';
import { Task, TASK_1 } from './data/taskData';
import { TicketViewProvider } from './providers/TicketViewProvider';

interface EvaluationResult {
    test_passed: boolean;
    ai_score: number;
    ai_feedback: string;
    exec_error?: string | null;
    error?: string | null;
    logs?: string[];
}

export function activate(context: vscode.ExtensionContext) {
    console.log('🚀 Forge AI extension is now active!');

    // Register the sidebar view provider
    const provider = new TicketViewProvider(context);
    const registration = vscode.window.registerWebviewViewProvider(
        'forge-vs.ticketView',
        provider,
        {
            webviewOptions: {
                retainContextWhenHidden: true
            }
        }
    );
    context.subscriptions.push(registration);
    console.log('✅ Ticket view provider registered with options');

    context.subscriptions.push(
        vscode.commands.registerCommand('forge-vs.showTicketView', async () => {
            console.log('📌 showTicketView command executed!');
            showTicketPanel(TASK_1);
        })
    );

    // Automatically open the ticket panel when the extension activates.
    showTicketPanel(TASK_1);

    // COMMAND: Submit for Evaluation (keep this working)
    context.subscriptions.push(
        vscode.commands.registerCommand('forge-vs.submit', async () => {
            console.log('📤 submit command executed!');
            
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No file open. Open a Python file first.');
                return;
            }

            const code = editor.document.getText();
            const fileName = editor.document.fileName.split('/').pop() || 'unknown.py';

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Submitting ${fileName} to Forge AI...`,
                    cancellable: false,
                },
                async () => {
                    try {
                        const config = vscode.workspace.getConfiguration('forgeAI');
                        const apiUrl = config.get('apiUrl') as string || 'http://localhost:8000';
                        console.log(`🌐 API URL: ${apiUrl}`);

                        const response = await fetch(`${apiUrl}/evaluate`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                code: code,
                                task_id: 'task_1',
                                ticket_context: '',
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

                        showResultsPanel(result);

                    } catch (error: any) {
                        vscode.window.showErrorMessage(`Failed to submit: ${error.message}`);
                        console.error('❌ Submit error:', error);
                    }
                }
            );
        })
    );

    // Remove the focusTicket command — it doesn't work reliably
    // Users can just click the rocket icon
}

function showResultsPanel(result: EvaluationResult) {
    const panel = vscode.window.createWebviewPanel(
        'forgeResults',
        'Forge AI Results',
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );

    const passed = result.test_passed ? 'passed' : 'failed';
    const feedback = (result.ai_feedback || 'No feedback').replace(/\n/g, '<br>');

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
            <div class="score ${passed}">${result.ai_score || 0}/100</div>
            <div class="status">${result.test_passed ? '✅ PASSED' : '❌ FAILED'}</div>
            
            <div class="section">
                <div class="section-title">Feedback</div>
                <div class="feedback">${feedback}</div>
            </div>

            ${result.exec_error ? `
                <div class="section">
                    <div class="section-title">Execution Error</div>
                    <div class="error">${result.exec_error}</div>
                </div>
            ` : ''}
        </body>
        </html>
    `;
}

function showTicketPanel(task: Task) {
    const panel = vscode.window.createWebviewPanel(
        'forgeTicket',
        'Forge AI Ticket',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    const criteriaHtml = task.acceptanceCriteria.map(criterion => `<li>${criterion}</li>`).join('');

    panel.webview.html = `<!DOCTYPE html>
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
            </style>
        </head>
        <body>
            <div class="ticket-id">${task.id}</div>
            <div class="ticket-title">${task.title}</div>
            <div class="ticket-meta">
                <span class="tag">${task.priority}</span>
                <span class="tag">${task.skill}</span>
                <span class="tag">${task.ticketType}</span>
                <span class="tag">${task.company}</span>
                <span class="tag">Reported by ${task.reporter}</span>
            </div>
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
        </body>
        </html>`;
}

export function deactivate() {
    console.log('👋 Forge AI extension deactivated');
}