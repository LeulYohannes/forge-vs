export const PREVIEW_TEST_BODIES: Record<string, string> = {
    task_1: `
def test_splits_by_function_definitions():
    fn = get_fn()
    source_code = "\\ndef greet(name):\\n    return f\\"Hello, {name}\\"\\n\\ndef farewell(name):\\n    return f\\"Goodbye, {name}\\"\\n"
    result = fn(source_code)
    assert len(result) == 2
    assert "def greet" in result[0]
    assert "def farewell" in result[1]

def test_invalid_syntax_returns_empty_list():
    fn = get_fn()
    result = fn("def broken(:\\n    this is not valid python")
    assert result == []
`,
    task_2: `
def test_alpha_blends_sparse_and_dense_scores():
    fn = get_fn()
    sparse = {"doc_A": 0.9, "doc_B": 0.3}
    dense = {"doc_A": 0.2, "doc_B": 0.8}
    result = dict(fn(sparse, dense, alpha=0.5))
    assert abs(result["doc_A"] - 0.55) < 1e-6
    assert abs(result["doc_B"] - 0.55) < 1e-6

def test_alpha_zero_uses_only_sparse_scores():
    fn = get_fn()
    sparse = {"doc_A": 0.9, "doc_B": 0.3}
    dense = {"doc_A": 0.2, "doc_B": 0.8}
    result = dict(fn(sparse, dense, alpha=0.0))
    assert abs(result["doc_A"] - 0.9) < 1e-6
    assert abs(result["doc_B"] - 0.3) < 1e-6
`,
    task_3: `
def test_multiple_conditions_use_and_logic():
    fn = get_fn()
    documents = [
        {"id": "1", "status": "active", "score": 0.95, "created_at": "2024-06-01"},
        {"id": "2", "status": "active", "score": 0.42, "created_at": "2024-06-01"},
        {"id": "3", "status": "deprecated", "score": 0.88, "created_at": "2024-06-01"},
    ]
    conditions = {"min_score": 0.80, "status": "active"}
    result = fn(documents, conditions)
    assert [d["id"] for d in result] == ["1"]

def test_empty_conditions_returns_all_documents():
    fn = get_fn()
    documents = [{"id": "1", "status": "active", "score": 0.5, "created_at": "2024-06-01"}]
    result = fn(documents, {})
    assert len(result) == 1
`,
    task_4: `
def test_returns_top_k_documents_sorted_by_score():
    fn = get_fn()
    documents = [
        {"id": "doc_low", "relevance_score": 0.12},
        {"id": "doc_high", "relevance_score": 0.91},
        {"id": "doc_mid", "relevance_score": 0.55},
    ]
    result = fn("query", documents, top_k=2)
    assert [d["id"] for d in result] == ["doc_high", "doc_mid"]

def test_empty_input_returns_empty_list():
    fn = get_fn()
    result = fn("query", [], top_k=3)
    assert result == []
`,
    task_5: `
def test_faithfulness_ratio_for_supported_answer():
    fn = get_fn()
    context = ["The sky is blue.", "Water boils at 100 degrees Celsius."]
    answer = "The sky is blue and water boils at 100 degrees."
    result = fn(context, answer)
    assert result["statements_checked"] == 1
    assert result["supported_statements"] == 1
    assert result["faithfulness_ratio"] == 1.0
`,
};
