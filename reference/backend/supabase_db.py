import os
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL environment variable is missing.")

# Anon client for general operations
supabase_anon: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Service role client ONLY for server-side token resolution (never expose key to client)
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY)

def get_authenticated_client(jwt_token: str) -> Client:
    """Returns a client scoped to the authenticated user's JWT."""
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    client.postgrest.auth(jwt_token)
    return client
