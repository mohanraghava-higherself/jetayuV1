"""
Lead State Manager
Manages lead data in Supabase, applies updates safely,
and determines what information is still needed.

Lead Status Flow:
- "draft": Conversation in progress, data being captured
- "confirmed": User said "proceed to book", email sent to operators
- "contacted": Operators have followed up (manual update)
"""

from app.database import get_db
from app.models.schemas import LeadState
from app.config import settings
from typing import List, Optional
import uuid
import logging
import httpx

logger = logging.getLogger(__name__)


class LeadManager:
    def __init__(self):
        pass

    @property
    def db(self):
        # Always get fresh db reference in case it changed
        return get_db()

    def create_session(self) -> str:
        """Create a new session with a draft lead record."""
        session_id = str(uuid.uuid4())

        # Create lead row - only send session_id
        # Status defaults to 'draft' in DB schema (or mock)
        self.db.table("leads").insert({
            "session_id": session_id
        }).execute()

        return session_id

    def get_lead(self, session_id: str) -> LeadState:
        """Retrieve current lead state from database."""
        try:
            result = (
                self.db.table("leads")
                .select("*")
                .eq("session_id", session_id)
                .single()
                .execute()
            )

            if result.data:
                return LeadState(
                    name=result.data.get("name"),
                    email=result.data.get("email"),
                    date_time=result.data.get("date_time"),
                    route_from=result.data.get("route_from"),
                    route_to=result.data.get("route_to"),
                    pax=result.data.get("pax"),
                    special_requests=result.data.get("special_requests") or [],
                    selected_aircraft=result.data.get("selected_aircraft"),
                    status=result.data.get("status") or "draft",
                    submission_state=result.data.get("submission_state") or "collecting",
                    user_id=result.data.get("user_id"),
                )
        except Exception as e:
            print(f"⚠️  Error fetching lead: {e}")

        return LeadState(submission_state="collecting")

    def update_lead(self, session_id: str, updates: LeadState) -> LeadState:
        """
        Apply updates to lead record.
        Only updates fields that have new values.
        Special requests are appended, not replaced.
        """
        current = self.get_lead(session_id)

        # Build update dict with only changed values
        update_data = {}

        # BLOCK name/email updates from LLM extraction if lead is authenticated
        # Authenticated leads have authoritative identity from auth system
        if not current.user_id:
            # Anonymous lead → allow name/email updates from LLM extraction
            if updates.name and updates.name != current.name:
                update_data["name"] = updates.name

            if updates.email and updates.email != current.email:
                update_data["email"] = updates.email
        # else: authenticated lead → skip name/email updates (identity is authoritative)

        if updates.date_time and updates.date_time != current.date_time:
            update_data["date_time"] = updates.date_time

        if updates.route_from and updates.route_from != current.route_from:
            update_data["route_from"] = updates.route_from

        if updates.route_to and updates.route_to != current.route_to:
            update_data["route_to"] = updates.route_to

        if updates.pax and updates.pax != current.pax:
            update_data["pax"] = updates.pax

        if updates.selected_aircraft and updates.selected_aircraft != current.selected_aircraft:
            update_data["selected_aircraft"] = updates.selected_aircraft

        # Append new special requests
        if updates.special_requests:
            existing = list(current.special_requests or [])
            new_requests = [r for r in updates.special_requests if r not in existing]
            if new_requests:
                combined = existing + new_requests
                update_data["special_requests"] = combined
                print(f"📋 Special requests: {existing} + {new_requests} = {combined}")

        # Apply updates if any
        if update_data:
            print(f"💾 Updating lead: {update_data}")
            try:
                self.db.table("leads").update(update_data).eq(
                    "session_id", session_id
                ).execute()
            except Exception as e:
                print(f"❌ Update failed: {e}")

        return self.get_lead(session_id)

    def associate_user(self, session_id: str, user_id: str) -> LeadState:
        """
        Associate a lead with a user account.
        Called after user logs in during booking confirmation.
        """
        try:
            self.db.table("leads").update({
                "user_id": user_id
            }).eq("session_id", session_id).execute()
        except Exception as e:
            print(f"⚠️  Could not associate user (column may not exist): {e}")
        
        return self.get_lead(session_id)

    def set_submission_state(self, session_id: str, state: str) -> LeadState:
        """
        Set the submission state for a lead.
        States: 'collecting', 'awaiting_auth', 'confirmed'
        """
        if state not in ['collecting', 'awaiting_auth', 'confirmed']:
            raise ValueError(f"Invalid submission_state: {state}. Allowed: 'collecting', 'awaiting_auth', 'confirmed'")
        
        try:
            self.db.table("leads").update({
                "submission_state": state
            }).eq("session_id", session_id).execute()
        except Exception as e:
            print(f"⚠️  Could not update submission_state: {e}")
        
        return self.get_lead(session_id)

    def confirm_booking(self, session_id: str, user_id: Optional[str] = None) -> LeadState:
        """
        Mark the lead as confirmed (user wants to proceed with booking).
        Allows confirmation when submission_state indicates user is authenticated
        or has progressed past initial collection.
        """
        # Get current lead to check submission_state
        current_lead = self.get_lead(session_id)
        
        # CRITICAL: Require user_id (authentication)
        if not user_id:
            print(f"⚠️  Cannot confirm booking: user_id is required")
            return current_lead

        # Allow confirmation if submission_state shows progress beyond collecting
        allowed_states = ['awaiting_auth', 'collecting']
        if current_lead.submission_state not in allowed_states:
            print(f"⚠️  Cannot confirm booking: submission_state is '{current_lead.submission_state}', expected one of {allowed_states}")
            return current_lead
        
        update_data = {
            "status": "confirmed",
            "submission_state": "confirmed",
            "user_id": user_id
        }
        
        try:
            self.db.table("leads").update(update_data).eq("session_id", session_id).execute()
            print(f"✅ Booking confirmed with user_id: {user_id}")
        except Exception as e:
            print(f"⚠️  Could not update status: {e}")
        
        return self.get_lead(session_id)

    def is_confirmed(self, session_id: str) -> bool:
        """Check if a lead has been confirmed."""
        lead = self.get_lead(session_id)
        return lead.status == "confirmed"

    def update_fields(self, session_id: str, fields: dict) -> LeadState:
        """Update arbitrary fields on a lead."""
        if not fields:
            return self.get_lead(session_id)
        try:
            self.db.table("leads").update(fields).eq("session_id", session_id).execute()
        except Exception as e:
            print(f"⚠️  Could not update lead fields: {e}")
        return self.get_lead(session_id)

    def attach_user_and_promote(self, session_id: str, user: dict, authorization: Optional[str] = None) -> LeadState:
        """
        Associate user info to lead and auto-promote submission_state when authenticated.
        Always persists name + email into DB so missing_fields no longer includes them.
        
        Args:
            session_id: Lead session ID
            user: { id, email, full_name (optional) }
            authorization: Optional JWT token for fetching user metadata
        """
        if not user or not user.get("id"):
            return self.get_lead(session_id)
        
        user_id = user["id"]
        user_email = user.get("email")
        explicit_full_name = user.get("full_name")
        
        lead = self.get_lead(session_id)
        update_data = {}
        
        # Check if user_id is already set in DB
        try:
            result = (
                self.db.table("leads")
                .select("user_id")
                .eq("session_id", session_id)
                .single()
                .execute()
            )
            existing_user_id = result.data.get("user_id") if result.data else None
        except Exception:
            existing_user_id = None
        
        # Always attach user_id if not already set
        if not existing_user_id:
            update_data["user_id"] = user_id
        
        # Resolve full_name using priority order:
        # 1) explicit full_name argument
        # 2) auth_user.user_metadata.full_name (from Supabase Auth API)
        # 3) profiles.full_name (lookup by user_id)
        # 4) fallback: email prefix (before @)
        resolved_full_name = None
        
        if explicit_full_name:
            resolved_full_name = explicit_full_name
        elif authorization:
            # Try to fetch from Supabase Auth API
            try:
                token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
                with httpx.Client(timeout=5.0) as http:
                    response = http.get(
                        f"{settings.SUPABASE_URL}/auth/v1/user",
                        headers={
                            "Authorization": f"Bearer {token}",
                            "apikey": settings.SUPABASE_KEY,
                        }
                    )
                    if response.status_code == 200:
                        user_data = response.json()
                        user_metadata = user_data.get("user_metadata", {})
                        resolved_full_name = user_metadata.get("full_name")
            except Exception as api_err:
                logger.debug(f"Could not fetch user metadata from Auth API: {api_err}")
        
        # If still no full_name, try profiles table
        if not resolved_full_name:
            try:
                profile_result = (
                    self.db.table("profiles")
                    .select("full_name")
                    .eq("id", user_id)
                    .single()
                    .execute()
                )
                if profile_result.data and profile_result.data.get("full_name"):
                    resolved_full_name = profile_result.data.get("full_name")
            except Exception as profile_err:
                logger.debug(f"Could not fetch profile: {profile_err}")
        
        # Fallback to email prefix
        if not resolved_full_name and user_email:
            resolved_full_name = user_email.split("@")[0]
        
        # Always update name if lead.name is null and we have a resolved name
        if resolved_full_name and (not lead.name or not lead.name.strip()):
            update_data["name"] = resolved_full_name
        
        # Always update email if lead.email is null and we have user email
        if user_email and (not lead.email or not lead.email.strip()):
            update_data["email"] = user_email
        
        # Auto-promote submission_state if authenticated and still collecting
        # Also advance if we now have complete contact info (name + email)
        current_state = getattr(lead, "submission_state", "collecting")
        has_complete_contact = (
            (resolved_full_name or lead.name) and 
            (user_email or lead.email)
        )
        
        if current_state == "collecting" and has_complete_contact:
            # User is authenticated with complete contact info - ready for confirmation
            update_data["submission_state"] = "awaiting_auth"
        elif current_state == "collecting":
            # Still collecting, but user is authenticated - promote anyway
            update_data["submission_state"] = "awaiting_auth"

        if update_data:
            lead = self.update_fields(session_id, update_data)
        
        # Fetch lead again to get user_id from DB
        updated_lead = self.get_lead(session_id)
        try:
            result = (
                self.db.table("leads")
                .select("user_id")
                .eq("session_id", session_id)
                .single()
                .execute()
            )
            db_user_id = result.data.get("user_id") if result.data else None
        except Exception:
            db_user_id = None
        
        logger.info(
            f"Lead after attach_user_and_promote: name={updated_lead.name}, email={updated_lead.email}, user_id={db_user_id}"
        )
        
        return updated_lead

    def set_selected_aircraft(self, session_id: str, aircraft_name: str) -> LeadState:
        """Update the selected aircraft for a lead."""
        try:
            self.db.table("leads").update({
                "selected_aircraft": aircraft_name
            }).eq("session_id", session_id).execute()
        except Exception as e:
            # Column might not exist in old schema - log but don't fail
            print(f"⚠️  Could not update selected_aircraft (column may not exist): {e}")
        
        return self.get_lead(session_id)

    def get_missing_fields(self, lead: LeadState) -> List[str]:
        """
        Determine which fields are still missing.
        
        The order matters - follows the natural conversation flow:
        1. Flight details (route, date, pax)
        2. Special requests (BEFORE name/email)
        3. Contact info (name, email)
        """
        missing = []

        # Core flight details first
        if not lead.route_from:
            missing.append("route_from")
        if not lead.route_to:
            missing.append("route_to")
        if not lead.date_time:
            missing.append("date_time")
        if not lead.pax:
            missing.append("pax")
        
        # If we have flight details, check for special requests before contact info
        has_flight_details = lead.route_from and lead.route_to and lead.date_time and lead.pax
        
        if has_flight_details:
            # Ask about special requests BEFORE name/email
            # Mark as missing only if:
            # 1. No special requests captured yet, OR
            # 2. It's not ["none"] (which indicates they said "no special requests")
            has_been_asked = lead.special_requests and (
                lead.special_requests == ["none"] or 
                "none" in [r.lower() for r in lead.special_requests]
            )
            if not lead.special_requests and not has_been_asked:
                missing.append("special_requests")
        
        # Contact info last
        # SKIP name/email checks if user is authenticated (identity already known)
        if not lead.user_id:
            # Anonymous lead → check for name/email
            if not lead.name:
                missing.append("name")
            if not lead.email:
                missing.append("email")
        # else: authenticated user → identity already known, skip name/email checks

        return missing

    def save_message(self, session_id: str, role: str, message: str) -> None:
        """Save a conversation message to the database."""
        self.db.table("conversations").insert(
            {"session_id": session_id, "role": role, "message": message}
        ).execute()

    def get_conversation_history(self, session_id: str) -> List[dict]:
        """Get conversation history for a session."""
        result = (
            self.db.table("conversations")
            .select("role, message, created_at")
            .eq("session_id", session_id)
            .order("created_at")
            .execute()
        )

        return result.data if result.data else []

    def get_user_leads(self, user_id: str) -> List[dict]:
        """
        Get all leads for a specific user.
        Used for My Bookings page.
        """
        try:
            result = (
                self.db.table("leads")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .execute()
            )
            return result.data if result.data else []
        except Exception as e:
            print(f"⚠️  Error fetching user leads: {e}")
            return []


# Singleton instance
lead_manager = LeadManager()
