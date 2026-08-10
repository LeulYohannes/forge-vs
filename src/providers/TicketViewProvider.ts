import * as vscode from 'vscode';
import { Task, TASK_1 } from '../data/taskData';

export class TicketViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'forge-vs.ticketView';

    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionContext: vscode.ExtensionContext) {
        console.log('📦 TicketViewProvider constructor called');
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        console.log('📖 resolveWebviewView called! THIS IS CRITICAL — IF YOU SEE THIS, THE VIEW IS WORKING!');
        
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview, TASK_1);
        console.log('✅ Webview HTML set!');
    }

    private _getHtmlForWebview(webview: vscode.Webview, task: Task): string {
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
        </body>
        </html>`;
    }

    public updateView(task: Task) {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview, task);
        }
    }
}