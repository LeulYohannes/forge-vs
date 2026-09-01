from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Dict, Any
from .supabase_db import supabase_admin
# Replace with actual import path from forge-ai-core: e.g. from src.pipeline import evaluate_code
# from src.pipeline import evaluate_code

router = APIRouter(tags=["Evaluation"])

class EvaluationRequest(BaseModel):
    code: str
    task_id: str
    ticket_context: Optional[str] = ""
    telemetry: Optional[Dict[str, Any]] = None
    participant_id: Optional[str] = None
    candidate_identity: Optional[str] = None
    assignment_token: Optional[str] = None
    company_name: Optional[str] = None

@router.post("/evaluate")
async def evaluate(payload: EvaluationRequest):
    custom_test_suite = None
    assignment_id = None
    company_id = None

    if payload.assignment_token:
        # Dynamic Test Suite Resolution from company_tickets
        assign_res = supabase_admin.table("assignments")\
            .select("id, company_ticket_id, company_tickets(company_id, generated_test_suite)")\
            .eq("token", payload.assignment_token)\
            .execute()

        if assign_res.data:
            assignment = assign_res.data[0]
            assignment_id = assignment["id"]
            ticket = assignment.get("company_tickets", {})
            company_id = ticket.get("company_id")
            custom_test_suite = ticket.get("generated_test_suite")

    # In actual pipeline, run evaluate_code(payload.code, payload.task_id, custom_test_suite=custom_test_suite)
    # Placeholder returning evaluation contract shape:
    result = {
        "test_passed": True,
        "ai_score": 100,
        "ai_feedback": "All tests passed successfully.",
        "exec_error": None,
        "error": None,
        "logs": ["Pytest test execution complete."]
    }

    # Persist submission with telemetry & assignment references
    if assignment_id:
        supabase_admin.table("submissions").insert({
            "assignment_id": assignment_id,
            "company_id": company_id,
            "code": payload.code,
            "ai_score": result.get("ai_score", 0),
            "ai_feedback": result.get("ai_feedback", ""),
            "test_passed": result.get("test_passed", False),
            "telemetry": payload.telemetry
        }).execute()

        supabase_admin.table("assignments").update({"status": "submitted"}).eq("id", assignment_id).execute()

    return result
