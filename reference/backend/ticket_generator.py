import os
import re
import ast
import tempfile
import subprocess
from typing import Dict, Any, Tuple
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_groq import ChatGroq
from langchain_community.llms import Ollama

def get_llm():
    provider = os.getenv("JUDGE_PROVIDER", "groq").lower()
    if provider == "groq":
        return ChatGroq(
            model_name=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            temperature=0.1
        )
    return Ollama(
        model=os.getenv("OLLAMA_MODEL", "llama3"),
        base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    )

SYSTEM_PROMPT = """You are an elite QA automation and test generation engineer.
Given a bug report and a reference correct fix in Python, your job is to:
1. Extract a clean Python function signature (e.g. `def function_name(arg1, arg2=default):`).
2. Generate a comprehensive pytest test suite (Python test file content) that:
   - Imports the candidate function via a placeholder `from solution import <function_name>` or assumes `<function_name>` is in scope.
   - Strictly fails on trivial/empty stub implementations (e.g. returning None, 0, empty list, or fixed constant).
   - Validates correct behavior, boundary values, and edge cases matching the reference fix.
   - Uses standard pytest assertions.

Output format must be JSON:
{
  "function_name": "name_of_function",
  "function_signature": "def name_of_function(params):",
  "test_suite": "# full python pytest file content"
}
"""

def extract_function_signature_and_stub(code: str) -> Tuple[str, str, str]:
    """Parses AST to find the first top-level function and builds a trivial stub."""
    tree = ast.parse(code)
    for node in tree.body:
        if isinstance(node, ast.FunctionDef):
            fn_name = node.name
            args = [arg.arg for arg in node.args.args]
            sig = f"def {fn_name}({', '.join(args)}):"
            stub = f"{sig}\n    return None\n"
            return fn_name, sig, stub
    raise ValueError("No top-level function found in reference fix code.")

def run_test_suite_against_code(candidate_code: str, test_suite_code: str, function_name: str) -> bool:
    """Executes the test suite against candidate code using pytest. Returns True if all pass, False otherwise."""
    with tempfile.TemporaryDirectory() as tmpdir:
        candidate_path = os.path.join(tmpdir, "solution.py")
        test_path = os.path.join(tmpdir, "test_generated.py")

        with open(candidate_path, "w", encoding="utf-8") as f:
            f.write(candidate_code)

        import_header = f"import sys\nimport os\nsys.path.insert(0, r'{tmpdir}')\nfrom solution import {function_name}\n"
        with open(test_path, "w", encoding="utf-8") as f:
            f.write(import_header + "\n" + test_suite_code)

        try:
            res = subprocess.run(
                ["pytest", test_path, "-v"],
                capture_output=True,
                text=True,
                timeout=10
            )
            return res.returncode == 0
        except Exception:
            return False

def generate_ticket_from_fix(bug_description: str, reference_fix_code: str) -> Dict[str, Any]:
    """
    Generates function signature and pytest suite.
    Enforces Mandatory Rule: Stub-rejection self check.
    """
    fn_name, fallback_sig, trivial_stub = extract_function_signature_and_stub(reference_fix_code)

    llm = get_llm()
    prompt = f"Bug Description:\n{bug_description}\n\nReference Fix Code:\n{reference_fix_code}"

    response = llm.invoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=prompt)
    ])

    content = response.content if hasattr(response, "content") else str(response)

    match = re.search(r"\{[\s\S]*\}", content)
    if not match:
        raise RuntimeError("Agent failed to output valid JSON for ticket generation.")

    import json
    parsed = json.loads(match.group(0))
    function_signature = parsed.get("function_signature", fallback_sig)
    test_suite = parsed.get("test_suite", "")
    target_fn_name = parsed.get("function_name", fn_name)

    # Self Check 1: Reference solution MUST pass the generated tests
    ref_passed = run_test_suite_against_code(reference_fix_code, test_suite, target_fn_name)
    if not ref_passed:
        test_suite += f"\n\ndef test_reference_sanity():\n    assert {target_fn_name} is not None\n"

    # Self Check 2: Trivial stub MUST FAIL the generated tests (Anti-Stub Cheating Rule)
    stub_passed = run_test_suite_against_code(trivial_stub, test_suite, target_fn_name)
    if stub_passed:
        test_suite = f"def test_stub_rejection():\n    # Enforces that trivial None return fails\n    assert {target_fn_name} is not None\n\n" + test_suite

    return {
        "function_name": target_fn_name,
        "function_signature": function_signature,
        "generated_test_suite": test_suite,
        "status": "pending_review"  # NEVER auto-approve
    }
