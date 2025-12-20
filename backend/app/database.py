import httpx
from app.config import settings
from typing import Optional
from datetime import datetime


class SupabaseClient:
    """Simple Supabase client using REST API directly."""

    def __init__(self):
        self.url = settings.SUPABASE_URL
        # Use service role key if available (bypasses RLS), otherwise fall back to anon key
        self.key = settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY
        self.rest_url = f"{self.url}/rest/v1" if self.url else ""
        self.headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        self.is_configured = bool(self.url and self.key)
        self._verified = False
        self._works = False

    def _verify_connection(self):
        """Test if Supabase connection actually works."""
        if self._verified:
            return self._works
        
        self._verified = True
        if not self.is_configured:
            self._works = False
            return False
            
        try:
            # Try a simple query to check if tables exist
            with httpx.Client(timeout=5.0) as http:
                response = http.get(
                    f"{self.rest_url}/leads",
                    params={"select": "session_id", "limit": "1"},
                    headers=self.headers
                )
                self._works = response.status_code in (200, 206)
                if not self._works:
                    print(f"⚠️  Supabase tables not found (status {response.status_code})")
        except Exception as e:
            print(f"⚠️  Supabase connection failed: {e}")
            self._works = False
        
        return self._works

    def table(self, name: str):
        return TableQuery(self, name)


class TableQuery:
    def __init__(self, client: SupabaseClient, table_name: str):
        self.client = client
        self.table_name = table_name
        self.url = f"{client.rest_url}/{table_name}"
        self._filters = []
        self._select_cols = "*"
        self._order_col = None
        self._single = False
        self._pending_insert = None
        self._pending_update = None

    def select(self, columns: str = "*"):
        self._select_cols = columns
        return self

    def eq(self, column: str, value):
        self._filters.append(f"{column}=eq.{value}")
        return self

    def order(self, column: str, desc: bool = False):
        self._order_col = f"{column}.{'desc' if desc else 'asc'}"
        return self

    def single(self):
        self._single = True
        return self

    def insert(self, data: dict):
        self._pending_insert = data
        return self

    def update(self, data: dict):
        self._pending_update = data
        return self

    def execute(self):
        # Handle pending insert
        if self._pending_insert is not None:
            data = self._pending_insert
            self._pending_insert = None
            with httpx.Client() as http:
                response = http.post(
                    self.url, json=data, headers=self.client.headers
                )
                response.raise_for_status()
                return QueryResult(response.json())

        # Handle pending update
        if self._pending_update is not None:
            data = self._pending_update
            self._pending_update = None
            params = {}
            for f in self._filters:
                col, val = f.split("=", 1)
                params[col] = val
            with httpx.Client() as http:
                response = http.patch(
                    self.url, params=params, json=data, headers=self.client.headers
                )
                if response.status_code >= 400:
                    print(f"❌ Supabase update error {response.status_code}: {response.text}")
                response.raise_for_status()
                result = response.json()
                if result:
                    print(f"✅ Updated in DB: {list(data.keys())}")
                return QueryResult(result)

        # Handle select query
        params = {"select": self._select_cols}
        for f in self._filters:
            col, val = f.split("=", 1)
            params[col] = val
        if self._order_col:
            params["order"] = self._order_col

        headers = self.client.headers.copy()
        if self._single:
            headers["Accept"] = "application/vnd.pgrst.object+json"

        with httpx.Client() as http:
            response = http.get(self.url, params=params, headers=headers)
            response.raise_for_status()
            return QueryResult(response.json())


class QueryResult:
    def __init__(self, data):
        self.data = data


# ============================================
# Mock/In-Memory Database for Development
# ============================================

class MockDatabase:
    """In-memory mock database for development without Supabase."""

    def __init__(self):
        self.leads = {}  # session_id -> lead data
        self.conversations = []  # list of conversation records
        print("📦 Using in-memory mock database (data will not persist)")

    def table(self, name: str):
        return MockTableQuery(self, name)


class MockTableQuery:
    def __init__(self, db: MockDatabase, table_name: str):
        self.db = db
        self.table_name = table_name
        self._filters = {}
        self._select_cols = "*"
        self._order_col = None
        self._single = False

    def select(self, columns: str = "*"):
        self._select_cols = columns
        return self

    def eq(self, column: str, value):
        self._filters[column] = value
        return self

    def order(self, column: str, desc: bool = False):
        self._order_col = (column, desc)
        return self

    def single(self):
        self._single = True
        return self

    def insert(self, data: dict):
        self._pending_insert = data
        return self

    def update(self, data: dict):
        self._pending_update = data
        return self

    def execute(self):
        # Handle pending insert
        if hasattr(self, '_pending_insert') and self._pending_insert:
            data = self._pending_insert
            self._pending_insert = None
            
            if self.table_name == "leads":
                session_id = data.get("session_id")
                self.db.leads[session_id] = {
                    "session_id": session_id,
                    "user_id": data.get("user_id"),  # Support user_id
                    "name": None,
                    "email": None,
                    "date_time": None,
                    "route_from": None,
                    "route_to": None,
                    "pax": None,
                    "special_requests": [],
                    "selected_aircraft": None,
                    "status": "draft",  # Always default to draft
                    "submission_state": "collecting",  # Default submission state
                    "created_at": datetime.now().isoformat(),
                    "updated_at": datetime.now().isoformat(),
                }
                return QueryResult([self.db.leads[session_id]])
            elif self.table_name == "conversations":
                data["created_at"] = datetime.now().isoformat()
                self.db.conversations.append(data)
                return QueryResult([data])
            return QueryResult([])

        # Handle pending update
        if hasattr(self, '_pending_update') and self._pending_update:
            data = self._pending_update
            self._pending_update = None
            
            if self.table_name == "leads":
                session_id = self._filters.get("session_id")
                if session_id and session_id in self.db.leads:
                    self.db.leads[session_id].update(data)
                    return QueryResult([self.db.leads[session_id]])
            return QueryResult([])

        # Handle select query
        if self.table_name == "leads":
            session_id = self._filters.get("session_id")
            user_id = self._filters.get("user_id")
            
            if session_id:
                # Single lead lookup by session_id
                if session_id in self.db.leads:
                    data = self.db.leads[session_id]
                else:
                    data = None
                return QueryResult(data)
            elif user_id:
                # Multiple leads filtered by user_id
                data = [
                    lead for lead in self.db.leads.values()
                    if lead.get("user_id") == user_id
                ]
                # Apply ordering if specified
                if self._order_col:
                    col, desc = self._order_col
                    data.sort(key=lambda x: x.get(col, ""), reverse=desc)
                return QueryResult(data)
            else:
                # No filters - return empty (not supported in mock)
                return QueryResult([])
        elif self.table_name == "conversations":
            session_id = self._filters.get("session_id")
            data = [c for c in self.db.conversations if c.get("session_id") == session_id]
            if self._order_col:
                col, desc = self._order_col
                data.sort(key=lambda x: x.get(col, ""), reverse=desc)
            return QueryResult(data)
        return QueryResult([])


# ============================================
# Database Client Management
# ============================================

_db_client = None


def get_db():
    """Get the database client - Supabase if working, otherwise mock."""
    global _db_client

    if _db_client is not None:
        return _db_client

    # Try Supabase first
    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        supabase = SupabaseClient()
        if supabase._verify_connection():
            print("✅ Connected to Supabase")
            _db_client = supabase
            return _db_client
        else:
            print("⚠️  Supabase configured but not working - falling back to mock database")
            print("   Run database/schema.sql in your Supabase SQL Editor to create tables")

    # Fallback to mock database
    _db_client = MockDatabase()
    return _db_client


def is_using_mock() -> bool:
    """Check if we're using the mock database."""
    return isinstance(get_db(), MockDatabase)
