import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { TASK_FUNCTION_SIGNATURES } from '../data/taskFunctionSignatures';
import { PREVIEW_TEST_BODIES } from '../data/previewTestCases';

export interface TestResult {
    name: string;
    status: 'PASSED' | 'FAILED' | 'ERROR';
}

export interface PreviewRunResult {
    test_passed: boolean;
    ai_score: number;
    ai_feedback: string;
    exec_error?: string | null;
    error?: string | null;
    logs?: string[];
    testResults?: TestResult[];
}

function buildPreviewTestFileContent(taskId: string, candidateFilePath: string): string {
    const sig = TASK_FUNCTION_SIGNATURES[taskId];
    const functionName = sig?.functionName || 'solution';
    const testBody = PREVIEW_TEST_BODIES[taskId] || '';

    // Normalize the path for Python
    const normalizedPath = candidateFilePath.replace(/\\/g, '\\\\');

    const header = `
import importlib.util
import sys

def get_fn():
    spec = importlib.util.spec_from_file_location("candidate_solution", r"${normalizedPath}")
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except Exception as e:
        raise RuntimeError(f"Failed to load candidate file: {e}")
    
    if not hasattr(module, '${functionName}'):
        raise AttributeError(f"Your file must define a function named '${functionName}'.")
    
    return getattr(module, '${functionName}')

`;

    return header + testBody;
}

function parseTestOutput(output: string): TestResult[] {
    const results: TestResult[] = [];
    const lines = output.split(/\r?\n/);

    // Match pytest -v output lines like: test_name PASSED [ 50%]
    const testLineRegex = /^(\S+)\s+(PASSED|FAILED|ERROR)\b/;

    for (const line of lines) {
        const match = line.match(testLineRegex);
        if (match) {
            const [, testName, status] = match;
            results.push({
                name: testName.split('::').pop() || testName,
                status: status as 'PASSED' | 'FAILED' | 'ERROR',
            });
        }
    }

    return results;
}

function buildSummaryFromTests(testResults: TestResult[]): { passed: number; failed: number; total: number } {
    const passed = testResults.filter((t) => t.status === 'PASSED').length;
    const failed = testResults.filter((t) => t.status !== 'PASSED').length;
    return { passed, failed, total: testResults.length };
}

export async function runLocalPreview(
    taskId: string,
    candidateFilePath: string,
    timeoutMs: number = 10000
): Promise<PreviewRunResult> {
    const testFileContent = buildPreviewTestFileContent(taskId, candidateFilePath);
    const tempDir = os.tmpdir();
    const tempTestFilePath = path.join(tempDir, `forge-preview-${taskId}-${Date.now()}.py`);

    try {
        // Write the generated test file
        fs.writeFileSync(tempTestFilePath, testFileContent, 'utf-8');

        // Spawn pytest
        const child = spawn('python', ['-m', 'pytest', tempTestFilePath, '-v'], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let output = '';
        let hasTimeout = false;

        child.stdout.on('data', (chunk) => {
            output += chunk.toString();
        });

        child.stderr.on('data', (chunk) => {
            output += chunk.toString();
        });

        const timeoutHandle = setTimeout(() => {
            hasTimeout = true;
            if (!child.killed) {
                child.kill('SIGTERM');
            }
        }, timeoutMs);

        await new Promise<void>((resolve) => {
            child.on('close', () => {
                clearTimeout(timeoutHandle);
                resolve();
            });
            child.on('error', (err) => {
                clearTimeout(timeoutHandle);
                output += `\nPreview run failed to start: ${err.message}`;
                resolve();
            });
        });

        if (hasTimeout) {
            output += '\nPreview run timed out — check for an infinite loop.';
        }

        // Parse test results
        const testResults = parseTestOutput(output);
        const summary = buildSummaryFromTests(testResults);

        if (testResults.length === 0) {
            // Fallback: no tests collected, show raw output
            return {
                test_passed: false,
                ai_score: 0,
                ai_feedback: output.trim() || 'No test output available.',
                exec_error: 'No tests collected. Check that your file defines the correct function.',
                error: null,
                logs: output.split(/\r?\n/),
                testResults: [],
            };
        }

        const test_passed = summary.failed === 0;
        const ai_score = Math.round((summary.passed / summary.total) * 100);

        return {
            test_passed,
            ai_score,
            ai_feedback: `${summary.passed}/${summary.total} tests passed`,
            exec_error: test_passed ? null : `${summary.failed} test(s) failed`,
            error: null,
            logs: output.split(/\r?\n/),
            testResults,
        };
    } catch (error: any) {
        return {
            test_passed: false,
            ai_score: 0,
            ai_feedback: error?.message || 'Preview run failed.',
            exec_error: error?.message || 'Preview run failed.',
            error: null,
            logs: [error?.message || 'Preview run failed.'],
            testResults: [],
        };
    } finally {
        // Clean up the temporary test file
        if (fs.existsSync(tempTestFilePath)) {
            try {
                fs.unlinkSync(tempTestFilePath);
            } catch {
                // Ignore cleanup errors
            }
        }
    }
}
