export interface TaskFunctionSignature {
    functionName: string;
    signature: string; // for the starter stub comment/def line
}

export const TASK_FUNCTION_SIGNATURES: Record<string, TaskFunctionSignature> = {
    task_1: { functionName: 'syntax_aware_splitter', signature: 'def syntax_aware_splitter(source_code: str):' },
    task_2: { functionName: 'hybrid_score_fusion', signature: 'def hybrid_score_fusion(sparse_scores, dense_scores, alpha=0.5):' },
    task_3: { functionName: 'apply_metadata_filter', signature: 'def apply_metadata_filter(documents, conditions):' },
    task_4: { functionName: 'rerank_retrievals', signature: 'def rerank_retrievals(query, raw_documents, top_k=3):' },
    task_5: { functionName: 'compute_faithfulness_score', signature: 'def compute_faithfulness_score(context_chunks, generated_answer):' },
};
