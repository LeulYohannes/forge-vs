import secrets
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional
from .supabase_db import supabase_anon, supabase_admin, get_authenticated_client
from .ticket_generator import generate_ticket_from_fix

router = APIRouter(prefix="/companies", tags=["Companies"])

class CompanySignupRequest(BaseModel):
    name: str
    contact_email: EmailStr
    password: str

class TicketUploadRequest(BaseModel):
    bug_description: str
    reference_fix_code: str

class AssignRequest(BaseModel):
    candidate_email: Optional[EmailStr] = None

def get_current_user_token(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header.")
    return authorization.split(" ")[1]

def verify_company_membership(company_id: str, token: str):
    client = get_authenticated_client(token)
    user_res = client.auth.get_user(token)
    if not user_res.user:
        raise HTTPException(status_code=401, detail="Invalid token.")
    
    res = client.table("company_users").select("*").eq("company_id", company_id).eq("user_id", user_res.user.id).execute()
    if not res.data:
        raise HTTPException(status_code=403, detail="Not authorized for this company.")
    return user_res.user

@router.post("/signup")
async def company_signup(payload: CompanySignupRequest):
    auth_res = supabase_anon.auth.sign_up({
        "email": payload.contact_email,
        "password": payload.password,
    })
    if not auth_res.user:
        raise HTTPException(status_code=400, detail="Failed to create auth user.")

    user_id = auth_res.user.id

    comp_res = supabase_admin.table("companies").insert({
        "name": payload.name,
        "contact_email": payload.contact_email
    }).execute()
    company = comp_res.data[0]

    supabase_admin.table("company_users").insert({
        "company_id": company["id"],
        "user_id": user_id,
        "role": "admin"
    }).execute()

    return {
        "company_id": company["id"],
        "user_id": user_id,
        "session": auth_res.session
    }

@router.post("/{company_id}/tickets")
async def upload_ticket(
    company_id: str,
    payload: TicketUploadRequest,
    token: str = Depends(get_current_user_token)
):
    user = verify_company_membership(company_id, token)

    try:
        gen_result = generate_ticket_from_fix(payload.bug_description, payload.reference_fix_code)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent test generation failed: {str(e)}")

    client = get_authenticated_client(token)
    ticket_data = {
        "company_id": company_id,
        "bug_description": payload.bug_description,
        "reference_fix_code": payload.reference_fix_code,
        "function_signature": gen_result["function_signature"],
        "generated_test_suite": gen_result["generated_test_suite"],
        "status": "pending_review"
    }

    insert_res = client.table("company_tickets").insert(ticket_data).execute()
    return insert_res.data[0]

@router.post("/{company_id}/tickets/{ticket_id}/approve")
async def approve_ticket(
    company_id: str,
    ticket_id: str,
    token: str = Depends(get_current_user_token)
):
    user = verify_company_membership(company_id, token)
    client = get_authenticated_client(token)

    update_res = client.table("company_tickets").update({
        "status": "approved",
        "reviewed_by": user.id,
        "reviewed_at": "now()"
    }).eq("id", ticket_id).eq("company_id", company_id).execute()

    if not update_res.data:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    return {"status": "approved", "ticket": update_res.data[0]}

@router.post("/{company_id}/tickets/{ticket_id}/reject")
async def reject_ticket(
    company_id: str,
    ticket_id: str,
    token: str = Depends(get_current_user_token)
):
    user = verify_company_membership(company_id, token)
    client = get_authenticated_client(token)

    update_res = client.table("company_tickets").update({
        "status": "rejected",
        "reviewed_by": user.id,
        "reviewed_at": "now()"
    }).eq("id", ticket_id).eq("company_id", company_id).execute()

    return {"status": "rejected", "ticket": update_res.data[0]}

@router.post("/{company_id}/tickets/{ticket_id}/assign")
async def create_assignment(
    company_id: str,
    ticket_id: str,
    payload: AssignRequest,
    token: str = Depends(get_current_user_token)
):
    verify_company_membership(company_id, token)
    client = get_authenticated_client(token)

    ticket_res = client.table("company_tickets").select("status").eq("id", ticket_id).eq("company_id", company_id).execute()
    if not ticket_res.data or ticket_res.data[0]["status"] != "approved":
        raise HTTPException(status_code=400, detail="Cannot assign an unapproved ticket.")

    assignment_token = secrets.token_urlsafe(16)
    assign_res = client.table("assignments").insert({
        "token": assignment_token,
        "company_ticket_id": ticket_id,
        "candidate_email": payload.candidate_email,
        "status": "pending"
    }).execute()

    return {
        "assignment_id": assign_res.data[0]["id"],
        "token": assignment_token,
        "status": "pending"
    }
