import * as vscode from 'vscode';

// Contract with the backend. The backend endpoints referenced here (/assignment/:token,
// and the extended /evaluate payload) DO NOT YET EXIST and must be built separately
// (see Section B). Do not invent additional endpoints beyond what's specified here.

export interface AssignedTicket {
    task_id: string;
    function_signature: string;   // e.g. "def hybrid_score_fusion(sparse_scores, dense_scores, alpha=0.5):"
    company_name: string;         // for display only — e.g. "Zare Innovations"
    // NOTE: deliberately NO context, description, or acceptanceCriteria fields here.
    // The gutted candidate experience must not receive this data from the backend at all —
    // do not fetch it and then hide it client-side; the backend contract itself should not
    // return it to this endpoint. If Section B's implementation returns these fields anyway,
    // the extension must still not render them (defense in depth), but flag this as a
    // backend-contract mismatch via a `// BACKEND TODO` comment, not silently accept it.
}

/**
 * Fetches the candidate's assigned ticket using their assignment token.
 * 
 * BACKEND TODO: Endpoint GET /assignment/:token must be implemented in forge-ai-core backend.
 */
export async function fetchAssignment(token: string, apiUrl: string): Promise<AssignedTicket | null> {
    const trimmedToken = token.trim();
    if (!trimmedToken) {
        vscode.window.showErrorMessage('Assignment token cannot be empty.');
        return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const normalizedApiUrl = apiUrl.replace(/\/+$/, '');
        // GET ${apiUrl}/assignment/${token}
        const response = await fetch(`${normalizedApiUrl}/assignment/${encodeURIComponent(trimmedToken)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 404 || response.status === 401 || response.status === 403) {
            let detail = 'Invalid or expired assignment code.';
            try {
                const errJson = await response.json() as { error?: string; message?: string; detail?: string };
                if (errJson.detail || errJson.message || errJson.error) {
                    detail = errJson.detail || errJson.message || errJson.error || detail;
                }
            } catch {
                // Ignore non-json response body for error status
            }
            vscode.window.showErrorMessage(`Assignment code error (${response.status}): ${detail}`);
            return null;
        }

        if (!response.ok) {
            vscode.window.showErrorMessage(`Could not load your assignment. Server returned status ${response.status}.`);
            return null;
        }

        const data = await response.json() as Record<string, any>;

        // BACKEND TODO: Verify that backend contract only returns task_id, function_signature, and company_name.
        // If the backend returns context, description, or acceptanceCriteria anyway, we explicitly withhold them here
        // (defense in depth) to prevent leakage to candidate views.
        if (data.context !== undefined || data.description !== undefined || data.acceptanceCriteria !== undefined || data.acceptance_criteria !== undefined) {
            // BACKEND TODO: Backend returned narrative/criteria fields on /assignment/:token. Strictly filtering them out.
        }

        if (!data.task_id || typeof data.task_id !== 'string') {
            vscode.window.showErrorMessage("Could not load your assignment: response missing required 'task_id'.");
            return null;
        }

        if (!data.function_signature || typeof data.function_signature !== 'string') {
            vscode.window.showErrorMessage("Could not load your assignment: response missing required 'function_signature'.");
            return null;
        }

        const assignedTicket: AssignedTicket = {
            task_id: data.task_id,
            function_signature: data.function_signature,
            company_name: typeof data.company_name === 'string' && data.company_name.trim() !== ''
                ? data.company_name.trim()
                : 'Assigned Company',
        };

        return assignedTicket;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error?.name === 'AbortError') {
            vscode.window.showErrorMessage('Could not load your assignment: request timed out.');
        } else {
            vscode.window.showErrorMessage(`Could not load your assignment. Please check your connection: ${error?.message || error}`);
        }
        return null;
    }
}
