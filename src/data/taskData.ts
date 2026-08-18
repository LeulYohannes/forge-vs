export interface Task {
    id: string;
    title: string;
    priority: "P0" | "P1" | "P2" | "P3";
    reporter: string;
    skill: string;
    company: string;
    ticketType: "bug" | "feature" | "improvement";
    context: string;
    description: string;
    acceptanceCriteria: string[];
}

export const TASKS: Record<string, Task> = {
    task_1: {
        id: "RAG-114",
        title: "Chunking returns empty results on long documents",
        priority: "P1",
        reporter: "Sarah Chen",
        skill: "chunking",
        company: "Meridian AI",
        ticketType: "bug",
        context: `**Meridian AI — Ingestion Pipeline**

Sarah Chen reported: "We're seeing empty results from the chunker on documents longer than 10,000 characters. This is causing downstream retrieval to fail silently."

The chunker is the first step in our ingestion pipeline. If it returns empty, nothing gets indexed. This is affecting ~15% of our legal document processing.

**Files involved:**
- \`meridian/ingestion/splitter.py\` — the chunker itself
- \`meridian/ingestion/tests/test_splitter.py\` — unit tests

**Your task:** Fix the chunker so it properly splits documents by syntax, not just character count.`,
        description: `## Your Mission

Write a function \`syntax_aware_splitter(source_code: str) -> List[str]\` that splits Python source code into logical chunks (top-level functions, classes, etc.).

### Why This Matters

Our users upload Python scripts and Jupyter notebooks. We need to index them intelligently — splitting by function/class boundaries so retrieval is precise, not random.

### Requirements

1. **Split by syntax:** Top-level functions and classes become separate chunks
2. **Preserve indentation:** Keep the structure intact within each chunk
3. **Handle invalid syntax:** Return empty list for invalid Python
4. **Clean chunks:** No empty chunks, no trailing whitespace

### Example

\`\`\`python
source_code = """
def greet(name):
    return f"Hello, {name}"

def farewell(name):
    return f"Goodbye, {name}"
"""

# Should return:
# ["def greet(name):\\n    return f\"Hello, {name}\"", 
#  "def farewell(name):\\n    return f\"Goodbye, {name}\"",]
\`\`\``,
        acceptanceCriteria: [
            "Splits code by top-level function definitions",
            "Returns empty list for invalid Python syntax",
            "Preserves indentation and structure",
            "Handles empty input gracefully",
            "Handles code with no functions/classes (returns [])"
        ]
    },
    task_2: {
        id: "RAG-115",
        title: "Hybrid score fusion produces incorrect rankings",
        priority: "P1",
        reporter: "Marcus Webb",
        skill: "fusion",
        company: "Meridian AI",
        ticketType: "bug",
        context: `**Meridian AI — Retrieval Pipeline**

Marcus Webb flagged: "The hybrid search is ranking documents incorrectly. The alpha parameter seems to have no effect on the final scores."

We use a hybrid retrieval system that combines:
- **Sparse scores** (BM25 keyword matching)
- **Dense scores** (vector embeddings from our fine-tuned model)

The \`alpha\` parameter controls the balance between them. Currently, it's not working.

**Files involved:**
- \`meridian/retrieval/fusion.py\` — the fusion logic
- \`meridian/retrieval/tests/test_fusion.py\` — unit tests

**Your task:** Fix the fusion formula so alpha correctly weights dense vs sparse scores.`,
        description: `## Your Mission

Implement \`hybrid_score_fusion(sparse_scores, dense_scores, alpha=0.5)\` that combines sparse (BM25) and dense (vector) scores.

### The Formula

\`final_score = alpha * dense_score + (1 - alpha) * sparse_score\`

### Why This Matters

Our legal search customers need accurate hybrid ranking. If alpha doesn't work, we can't tune the search results.

### Requirements

1. **Handle missing keys:** Some documents may only have sparse or dense scores
2. **Return sorted list:** \`[(doc_id, score), ...]\` sorted by score descending
3. **Alpha works:** \`alpha=0.0\` = only sparse, \`alpha=1.0\` = only dense
4. **Tie handling:** Deterministic ordering for equal scores

### Example

\`\`\`python
sparse = {"doc_A": 0.9, "doc_B": 0.3}
dense = {"doc_A": 0.2, "doc_B": 0.8}
alpha = 0.5

# doc_A: 0.5*0.2 + 0.5*0.9 = 0.55
# doc_B: 0.5*0.8 + 0.5*0.3 = 0.55
# Returns: [("doc_A", 0.55), ("doc_B", 0.55)]  (tie, deterministic order)
\`\`\``,
        acceptanceCriteria: [
            "Correctly implements the fusion formula",
            "Handles missing documents gracefully",
            "Returns results sorted by score descending",
            "Alpha parameter changes rankings as expected",
            "Tie-breaking is deterministic"
        ]
    },
    task_3: {
        id: "RAG-116",
        title: "Metadata filter ignores date conditions",
        priority: "P2",
        reporter: "Sarah Chen",
        skill: "filtering",
        company: "Meridian AI",
        ticketType: "bug",
        context: `**Meridian AI — Search Pipeline**

Sarah Chen reported: "The metadata filter is treating all conditions as string matches. Date ranges and numeric thresholds are being ignored."

We need to support:
- **Exact matches:** \`{"status": "active"}\`
- **Numeric thresholds:** \`{"min_score": 0.8}\`
- **Date ranges:** \`{"created_after": "2024-01-01"}\`

**Files involved:**
- \`meridian/search/filter.py\` — the filter logic
- \`meridian/search/tests/test_filter.py\` — unit tests

**Your task:** Fix the filter to handle all condition types.`,
        description: `## Your Mission

Implement \`apply_metadata_filter(documents, conditions)\` that filters documents by metadata conditions.

### Supported Conditions

1. **Exact string matches:** \`{"status": "active"}\`
2. **Numeric thresholds:** \`{"min_score": 0.8}\`
3. **Date comparisons:** \`{"created_after": "2024-01-01"}\`

### Why This Matters

Our legal users filter by case number, document type, date range, and relevance score. Without this, search is unusable.

### Requirements

1. **Exact match:** \`doc["status"] == "active"\`
2. **Min score:** \`doc["score"] >= 0.8\`
3. **Date after:** \`doc["created_at"] >= "2024-01-01"\`
4. **Multiple conditions:** All must match (AND logic)
5. **Empty conditions:** Return all documents

### Example

\`\`\`python
documents = [
    {"id": "1", "status": "active", "score": 0.95, "created_at": "2024-06-01"},
    {"id": "2", "status": "active", "score": 0.42, "created_at": "2024-06-01"},
    {"id": "3", "status": "deprecated", "score": 0.88, "created_at": "2024-06-01"},
]

conditions = {"min_score": 0.80, "status": "active"}

# Returns: [{"id": "1", ...}]  (only doc 1 meets both conditions)
\`\`\``,
        acceptanceCriteria: [
            "Filters by exact string matches",
            "Handles numeric thresholds (min_score)",
            "Supports date comparisons (created_after)",
            "Returns unfiltered list if no conditions",
            "All conditions must match (AND logic)"
        ]
    },
    task_4: {
        id: "RAG-117",
        title: "Reranker returns raw scores instead of final documents",
        priority: "P1",
        reporter: "Marcus Webb",
        skill: "reranking",
        company: "Meridian AI",
        ticketType: "bug",
        context: `**Meridian AI — Reranking Pipeline**

Marcus Webb flagged: "The reranking step is returning raw relevance scores instead of the top K documents. Users are seeing scores instead of actual content."

We use a cross-encoder to rerank the top 10 retrieved documents down to the top 3. Currently, it's returning scores, not documents.

**Files involved:**
- \`meridian/retrieval/rerank.py\` — the reranking logic
- \`meridian/retrieval/tests/test_rerank.py\` — unit tests

**Your task:** Fix the reranker to return documents, not scores.`,
        description: `## Your Mission

Implement \`rerank_retrievals(query, raw_documents, top_k=3)\` that:

1. Accepts documents with a pre-computed \`relevance_score\` field
2. Sorts by score (highest first)
3. Returns the top K documents

### Document Shape

\`{"id": str, "content": str, "relevance_score": float}\`

### Why This Matters

Our cross-encoder (a neural network that computes relevance between query and document) gives us scores. But users don't want scores — they want the actual documents.

### Requirements

1. **Sort by score:** Highest relevance_score first
2. **Return top K:** Exactly \`top_k\` documents
3. **Tie handling:** Deterministic ordering for equal scores
4. **Empty input:** Return empty list

### Example

\`\`\`python
documents = [
    {"id": "doc_low", "relevance_score": 0.12},
    {"id": "doc_high", "relevance_score": 0.91},
    {"id": "doc_mid", "relevance_score": 0.55},
]

result = rerank_retrievals("query", documents, top_k=2)

# Returns: [{"id": "doc_high", ...}, {"id": "doc_mid", ...}]
\`\`\``,
        acceptanceCriteria: [
            "Sorts documents by relevance_score descending",
            "Returns exactly top_k documents",
            "Handles ties deterministically",
            "Returns empty list if no documents"
        ]
    },
    task_5: {
        id: "RAG-118",
        title: "Faithfulness evaluator always returns 0%",
        priority: "P0",
        reporter: "Sarah Chen",
        skill: "evaluation",
        company: "Meridian AI",
        ticketType: "bug",
        context: `**Meridian AI — Evaluation Pipeline**

Sarah Chen reported: "The faithfulness evaluation always returns 0%, even for perfectly supported answers. This is causing false negatives in our evaluation pipeline."

We need to check if generated answers are supported by the retrieved context. Currently, it's always failing.

**Files involved:**
- \`meridian/eval/faithfulness.py\` — the evaluator
- \`meridian/eval/tests/test_faithfulness.py\` — unit tests

**Your task:** Fix the faithfulness evaluator to correctly check if statements are supported by context.`,
        description: `## Your Mission

Implement \`compute_faithfulness_score(context_chunks, generated_answer)\` that:

1. Splits the answer into sentences
2. Checks if each sentence is supported by the context
3. Returns a report with:
   - \`statements_checked\`: total sentences
   - \`supported_statements\`: sentences supported by context
   - \`faithfulness_ratio\`: percentage of supported statements

### Word Overlap Threshold

A statement is supported if \`50% or more\` of its words appear in any context chunk.

### Why This Matters

We need to detect hallucinations in our RAG system. If we can't evaluate faithfulness, we can't trust our responses.

### Example

\`\`\`python
context = ["The sky is blue.", "Water boils at 100 degrees Celsius."]
answer = "The sky is blue and water boils at 100 degrees."

# "The sky is blue and water boils at 100 degrees." → split into sentences
# "The sky is blue and water boils at 100 degrees." is supported by context
# Returns: {"statements_checked": 1, "supported_statements": 1, "faithfulness_ratio": 1.0}
\`\`\``,
        acceptanceCriteria: [
            "Splits answer into sentences correctly",
            "Uses word overlap threshold (50%)",
            "Returns proper faithfulness_ratio",
            "Handles empty inputs gracefully"
        ]
    }
};

export const TASK_1 = TASKS.task_1;
