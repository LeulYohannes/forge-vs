import * as vscode from 'vscode';
import { Task, TASKS } from '../data/taskData';

export class TicketViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'forge-vs.ticketView';

    private _view?: vscode.WebviewView;
    private _currentTaskId: string = 'task_1';
    private _onTaskSelected?: (taskId: string) => void;

    constructor(
        private readonly _extensionContext: vscode.ExtensionContext,
        onTaskSelected?: (taskId: string) => void
    ) {
        this._onTaskSelected = onTaskSelected;
        console.log('📦 TicketViewProvider constructor called');
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        console.log('📖 resolveWebviewView called!');
        
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview, this._currentTaskId);
        
        // Handle messages from the webview (dropdown selection)
        webviewView.webview.onDidReceiveMessage((message) => {
            if (message.type === 'taskSelected') {
                this._currentTaskId = message.taskId;
                if (this._onTaskSelected) {
                    this._onTaskSelected(message.taskId);
                }
                // Update the view with the new task
                if (this._view) {
                    this._view.webview.html = this._getHtmlForWebview(this._view.webview, message.taskId);
                }
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview, taskId: string): string {
        const task = TASKS[taskId];
        if (!task) {
            return `<html><body><p>Task not found</p></body></html>`;
        }

        // Build dropdown options
        const taskOptions = Object.entries(TASKS).map(([id, t]) => {
            const selected = id === taskId ? 'selected' : '';
            return `<option value="${id}" ${selected}>${t.id} - ${t.title.substring(0, 40)}${t.title.length > 40 ? '...' : ''}</option>`;
        }).join('');

        const criteriaHtml = task.acceptanceCriteria
            .map(criterion => `<li>${criterion}</li>`)
            .join('');

        return `<!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    padding: 12px 16px;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
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
                    font-family: var(--vscode-editor-font-family);
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                }
                .ticket-title {
                    font-size: 18px;
                    font-weight: 600;
                    margin: 6px 0 4px 0;
                    color: var(--vscode-foreground);
                }
                .ticket-meta {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    margin: 8px 0 16px 0;
                    font-size: 12px;
                }
                .ticket-meta .tag {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 4px;
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    font-family: var(--vscode-editor-font-family);
                }
                .ticket-meta .priority {
                    background-color: #F97316;
                    color: #0A0A0A;
                    font-weight: 600;
                }
                .section {
                    margin-top: 16px;
                }
                .section h3 {
                    font-size: 13px;
                    font-weight: 600;
                    margin-bottom: 6px;
                    color: var(--vscode-foreground);
                }
                .section .content {
                    font-size: 13px;
                    color: var(--vscode-descriptionForeground);
                    white-space: pre-wrap;
                }
                .section ul {
                    padding-left: 16px;
                    margin: 4px 0;
                }
                .section ul li {
                    font-size: 13px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 2px;
                }
                .divider {
                    border: none;
                    border-top: 1px solid var(--vscode-panel-border);
                    margin: 14px 0;
                }
                .context-block {
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    padding: 10px 12px;
                    border-radius: 4px;
                    border-left: 3px solid var(--vscode-textLink-foreground);
                    font-size: 13px;
                    color: var(--vscode-descriptionForeground);
                    white-space: pre-wrap;
                }
                code {
                    font-family: var(--vscode-editor-font-family);
                    font-size: 12px;
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    padding: 1px 4px;
                    border-radius: 3px;
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
                <span class="tag priority">${task.priority}</span>
                <span class="tag">${task.skill}</span>
                <span class="tag">${task.ticketType}</span>
                <span class="tag">${task.company}</span>
            </div>
            <div class="ticket-meta" style="margin-top: -4px; font-size: 12px; color: var(--vscode-descriptionForeground);">
                Reported by ${task.reporter}
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
                const select = document.getElementById('taskSelect');
                select.addEventListener('change', () => {
                    const vscode = acquireVsCodeApi();
                    vscode.postMessage({
                        type: 'taskSelected',
                        taskId: select.value
                    });
                });
            </script>
        </body>
        </html>`;
    }

    public updateView(taskId: string) {
        this._currentTaskId = taskId;
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview, taskId);
        }
    }
}
