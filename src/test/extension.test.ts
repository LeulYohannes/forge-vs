import * as assert from 'assert';
import * as vscode from 'vscode';
import { buildStarterTaskFileContent, getTaskSolutionFileName, buildAssignmentPanelHtml } from '../extension';
import { TicketViewProvider } from '../providers/TicketViewProvider';
import { AssignedTicket } from '../api/assignments';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('starter file name maps to the current task', () => {
        assert.strictEqual(getTaskSolutionFileName('task_2'), 'task_2_solution.py');
        assert.strictEqual(getTaskSolutionFileName('custom_task_99'), 'custom_task_99_solution.py');
    });

    test('starter file content in Demo Mode includes the ticket id and default stub', () => {
        const fileContent = buildStarterTaskFileContent('task_3');
        assert.match(fileContent, /task_3/);
        assert.match(fileContent, /def apply_metadata_filter/);
        assert.match(fileContent, /pass/);
    });

    test('starter file content in Assignment Mode uses assigned ticket function signature', () => {
        const mockTicket: AssignedTicket = {
            task_id: 'company_task_42',
            function_signature: 'def custom_search_pipeline(query: str, filters: dict = None) -> list:',
            company_name: 'Zare Innovations',
        };

        const fileContent = buildStarterTaskFileContent('company_task_42', mockTicket);
        assert.match(fileContent, /company_task_42/);
        assert.match(fileContent, /def custom_search_pipeline\(query: str, filters: dict = None\) -> list:/);
        assert.match(fileContent, /Implement the solution for company_task_42/);
    });

    test('Assignment Mode sidebar webview strictly guts narrative content', () => {
        const mockTicket: AssignedTicket = {
            task_id: 'custom_77',
            function_signature: 'def calculate_risk_score(events: list) -> float:',
            company_name: 'Acme Corp',
        };

        const sidebarHtml = TicketViewProvider.getHtmlForAssignmentMode(mockTicket);

        // Required elements in Assignment Mode
        assert.ok(sidebarHtml.includes("You're being assessed by Acme Corp"), 'Should display company name');
        assert.ok(sidebarHtml.includes('Implement the function below. Submit when ready.'), 'Should display exact instruction line');
        assert.ok(sidebarHtml.includes('def calculate_risk_score(events: list) -&gt; float:'), 'Should display escaped function signature');

        // Strictly withheld narrative fields
        assert.strictEqual(sidebarHtml.includes('Acceptance Criteria'), false, 'Must not render Acceptance Criteria');
        assert.strictEqual(sidebarHtml.includes('Description'), false, 'Must not render Description');
        assert.strictEqual(sidebarHtml.includes('Context'), false, 'Must not render Context');
        assert.strictEqual(sidebarHtml.includes('Reporter'), false, 'Must not render Reporter');
        assert.strictEqual(sidebarHtml.includes('priority'), false, 'Must not render Priority');
        assert.strictEqual(sidebarHtml.includes('taskSelect'), false, 'Must not render task switcher dropdown');
    });

    test('Assignment Mode editor panel strictly guts narrative content', () => {
        const mockTicket: AssignedTicket = {
            task_id: 'custom_88',
            function_signature: 'def optimize_routes(nodes: list):',
            company_name: 'FleetOps AI',
        };

        const panelHtml = buildAssignmentPanelHtml(mockTicket);

        // Required elements in Assignment Mode
        assert.ok(panelHtml.includes("You're being assessed by FleetOps AI"), 'Should display company name');
        assert.ok(panelHtml.includes('Implement the function below. Submit when ready.'), 'Should display exact instruction line');
        assert.ok(panelHtml.includes('def optimize_routes(nodes: list):'), 'Should display function signature');

        // Strictly withheld narrative fields
        assert.strictEqual(panelHtml.includes('Acceptance Criteria'), false, 'Must not render Acceptance Criteria');
        assert.strictEqual(panelHtml.includes('Description'), false, 'Must not render Description');
        assert.strictEqual(panelHtml.includes('Context'), false, 'Must not render Context');
        assert.strictEqual(panelHtml.includes('Reporter'), false, 'Must not render Reporter');
        assert.strictEqual(panelHtml.includes('priority'), false, 'Must not render Priority');
        assert.strictEqual(panelHtml.includes('taskSelect'), false, 'Must not render task switcher dropdown');
    });
});
