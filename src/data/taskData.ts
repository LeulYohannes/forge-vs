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

export const TASK_1: Task = {
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
# ["def greet(name):\\n    return f\\"Hello, {name}\\"", 
#  "def farewell(name):\\n    return f\\"Goodbye, {name}\\"",]
\`\`\``,
    acceptanceCriteria: [
        "Splits code by top-level function definitions",
        "Returns empty list for invalid Python syntax",
        "Preserves indentation and structure",
        "Handles empty input gracefully",
        "Handles code with no functions/classes (returns [])"
    ]
};