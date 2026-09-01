from fastapi import APIRouter, HTTPException
from .supabase_db import supabase_admin

router = APIRouter(tags=["Candidate Assignments"])

@router.get("/assignment/{token}")
async def get_assignment(token: str):
    """
    Candidate endpoint: Resolves assignment token.
    Enforces STRICT GUTTING server-side. Returns ONLY task_id, function_signature, company_name.
    """
    res = supabase_admin.table("assignments")\
        .select("id, status, company_tickets(function_signature, companies(name))")\
        .eq("token", token)\
        .execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Invalid or expired assignment token.")

    assignment = res.data[0]
    ticket = assignment.get("company_tickets", {})
    company = ticket.get("companies", {})

    if assignment["status"] == "pending":
        supabase_admin.table("assignments").update({"status": "in_progress"}).eq("id", assignment["id"]).execute()

    return {
        "task_id": assignment["id"],
        "function_signature": ticket.get("function_signature", "def solution():"),
        "company_name": company.get("name", "Assigned Company")
    }
