import * as assert from 'assert';
import * as vscode from 'vscode';
import { buildStarterTaskFileContent, getTaskSolutionFileName } from '../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('starter file name maps to the current task', () => {
		assert.strictEqual(getTaskSolutionFileName('task_2'), 'task_2_solution.py');
	});

	test('starter file content includes the ticket id and a minimal stub', () => {
		const fileContent = buildStarterTaskFileContent('task_3');
		assert.match(fileContent, /task_3/);
		assert.match(fileContent, /def .*\(\)\s*:/);
		assert.match(fileContent, /pass/);
	});
});
