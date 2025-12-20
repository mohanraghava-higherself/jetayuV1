from fastapi import APIRouter, HTTPException, Header
from app.models.schemas import ChatRequest, ChatResponse, StartResponse, AircraftSuggestion, AircraftPricing, LeadState
from app.services.concierge import concierge_service
from app.services.extractor import extractor_service
from app.services.lead_manager import lead_manager
from app.services.aircraft import aircraft_service
from app.services.intent_detector import intent_detector
from app.services.email_service import email_service
from app.auth import get_current_user_optional, get_current_user_required
from typing import Optional, List
import re

router = APIRouter()


def detect_aircraft_selection(message: str) -> str | None:
    """
    Detect if user is selecting a specific aircraft from the message.
    Returns the aircraft name if found.
    """
    # Patterns like "I'm interested in the G650" or "Let's go with the Citation Longitude"
    patterns = [
        r"(?:interested in|want|choose|select|go with|book|take)\s+(?:the\s+)?([A-Za-z0-9\s]+(?:G\d+|Citation|Challenger|Global|Phenom|Falcon|Learjet|Praetor)[A-Za-z0-9\s]*)",
        r"(?:the\s+)?([A-Za-z]+\s+(?:G\d+|CJ\d+|\d+[A-Z]?))\s+(?:sounds?|looks?|is)\s+(?:good|great|perfect|fine)",
    ]
    
    message_lower = message.lower()
    
    # Known aircraft names to match
    aircraft_names = [
        "citation cj4", "cj4",
        "phenom 300e", "phenom 300",
        "citation latitude", "latitude",
        "learjet 75",
        "citation longitude", "longitude",
        "challenger 350",
        "praetor 600",
        "gulfstream g650", "g650",
        "falcon 8x",
        "challenger 650",
        "global 7500",
        "gulfstream g700", "g700",
    ]
    
    for aircraft in aircraft_names:
        if aircraft in message_lower:
            # Return the proper capitalized name
            name_map = {
                "citation cj4": "Citation CJ4",
                "cj4": "Citation CJ4",
                "phenom 300e": "Phenom 300E",
                "phenom 300": "Phenom 300E",
                "citation latitude": "Citation Latitude",
                "latitude": "Citation Latitude",
                "learjet 75": "Learjet 75 Liberty",
                "citation longitude": "Citation Longitude",
                "longitude": "Citation Longitude",
                "challenger 350": "Challenger 350",
                "praetor 600": "Praetor 600",
                "gulfstream g650": "Gulfstream G650",
                "g650": "Gulfstream G650",
                "falcon 8x": "Falcon 8X",
                "challenger 650": "Challenger 650",
                "global 7500": "Global 7500",
                "gulfstream g700": "Gulfstream G700",
                "g700": "Gulfstream G700",
            }
            return name_map.get(aircraft, aircraft.title())
    
    return None


@router.post("/start", response_model=StartResponse)
async def start_conversation():
    """
    Start a new conversation session.
    Creates a session ID with a draft lead and returns the opening greeting.
    """
    try:
        # Create new session (with draft lead)
        session_id = lead_manager.create_session()

        # Generate greeting
        greeting = concierge_service.generate_greeting()

        # Save greeting to conversation history
        lead_manager.save_message(session_id, "assistant", greeting)

        return StartResponse(session_id=session_id, assistant_message=greeting)

    except Exception as e:
        print(f"Error in /start: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Process a user message and return concierge response.
    Extracts entities, updates lead state, and generates natural reply.
    
    Aircraft suggestions are returned when:
    1. Passenger count (pax) is JUST extracted (not previously known)
    2. User explicitly asks about aircraft/jets/options
    
    Booking confirmation triggers:
    - When user says "go ahead", "proceed", "book it", etc.
    - If user is authenticated: lead is associated with user and confirmed
    - If user is NOT authenticated: returns requires_auth flag
    - Email is sent to operators
    - Lead status changes from "draft" to "confirmed"
    """
    try:
        session_id = request.session_id
        user_message = request.message
        booking_confirmed = False
        requires_auth = False
        
        # Get current user (optional - doesn't fail if not authenticated)
        current_user = get_current_user_optional(authorization)

        # Save user message
        lead_manager.save_message(session_id, "user", user_message)

        # Get current lead state BEFORE extraction
        lead_before = lead_manager.get_lead(session_id)
        pax_before = lead_before.pax  # Track if pax existed before
        was_already_confirmed = lead_before.status == "confirmed"

        # Check for aircraft selection in message
        selected_aircraft = detect_aircraft_selection(user_message)
        if selected_aircraft and not lead_before.selected_aircraft:
            lead_manager.set_selected_aircraft(session_id, selected_aircraft)
            print(f"🛩️  Aircraft selected: {selected_aircraft}")

        # Extract entities from user message
        current_lead = lead_before
        try:
            extracted = extractor_service.extract(user_message, current_lead)
            # Update lead if we extracted anything
            if extracted:
                current_lead = lead_manager.update_lead(session_id, extracted)
        except Exception as extract_err:
            print(f"Extraction error (non-fatal): {extract_err}")
            # Continue without extraction

        # Re-fetch lead to get latest state (including selected aircraft)
        current_lead = lead_manager.get_lead(session_id)

        # Check if pax was JUST extracted (wasn't there before, is there now)
        pax_just_extracted = (pax_before is None and current_lead.pax is not None)

        # Detect user intent for aircraft queries
        wants_aircraft, preference = intent_detector.detect_aircraft_intent(user_message)

        # Detect booking intent
        wants_to_book = intent_detector.detect_booking_intent(user_message)
        
        # Get current submission state
        current_submission_state = current_lead.submission_state or "collecting"

        # Handle booking submission flow with hard state gates
        if wants_to_book and not was_already_confirmed:
            # CRITICAL: Check submission state to prevent unauthorized confirmation
            if current_submission_state == "collecting":
                # User wants to proceed - set state to awaiting_auth
                if not current_user:
                    # User not authenticated - require auth
                    current_lead = lead_manager.set_submission_state(session_id, "awaiting_auth")
                    requires_auth = True
                    print(f"🔒 Submission state set to 'awaiting_auth' - auth required")
                else:
                    # User is authenticated - can proceed directly to confirmation
                    user_id = current_user["id"]
                    current_lead = lead_manager.confirm_booking(session_id, user_id=user_id)
                    booking_confirmed = True
                    print(f"✅ BOOKING CONFIRMED for session {session_id}")
                    print(f"   User: {user_id}")
                    print(f"   Client: {current_lead.name or 'Unknown'}")
                    print(f"   Route: {current_lead.route_from} → {current_lead.route_to}")
                    print(f"   Aircraft: {current_lead.selected_aircraft or 'Not selected'}")
                    
                    # Send email notification
                    try:
                        email_service.send_booking_notification_background(
                            lead=current_lead,
                            session_id=session_id,
                            selected_aircraft=current_lead.selected_aircraft,
                        )
                    except Exception as email_err:
                        print(f"⚠️  Email queue failed (non-fatal): {email_err}")
            
            elif current_submission_state == "awaiting_auth":
                # Already in awaiting_auth state - check if user just authenticated
                if current_user:
                    # User is now authenticated - confirm booking
                    user_id = current_user["id"]
                    current_lead = lead_manager.confirm_booking(session_id, user_id=user_id)
                    booking_confirmed = True
                    print(f"✅ BOOKING CONFIRMED after auth for session {session_id}")
                    print(f"   User: {user_id}")
                    
                    # Send email notification
                    try:
                        email_service.send_booking_notification_background(
                            lead=current_lead,
                            session_id=session_id,
                            selected_aircraft=current_lead.selected_aircraft,
                        )
                    except Exception as email_err:
                        print(f"⚠️  Email queue failed (non-fatal): {email_err}")
                else:
                    # Still not authenticated - keep requiring auth
                    requires_auth = True
                    print(f"🔒 Still awaiting authentication for session {session_id}")
            
            elif current_submission_state == "confirmed":
                # Already confirmed - do nothing (prevent duplicate confirmations)
                booking_confirmed = True
                print(f"ℹ️  Booking already confirmed for session {session_id}")

        # Determine if we should show aircraft
        # Case 1: Pax was just extracted (user didn't explicitly ask)
        # Case 2: User explicitly asks about aircraft/jets
        show_aircraft = False
        aircraft_list = None

        if (pax_just_extracted or wants_aircraft) and not booking_confirmed:
            show_aircraft = True
            # Get suitable aircraft based on passenger count and preference
            aircraft_data = aircraft_service.get_aircraft_for_response(
                pax=current_lead.pax,
                preference=preference,
                route_from=current_lead.route_from,
                route_to=current_lead.route_to,
            )
            
            # Convert to response model
            aircraft_list = [
                AircraftSuggestion(
                    id=a["id"],
                    name=a["name"],
                    manufacturer=a["manufacturer"],
                    category=a["category"],
                    capacity=a["capacity"],
                    range_nm=a["range_nm"],
                    speed_kph=a["speed_kph"],
                    description=a["description"],
                    features=a["features"],
                    image_url=a["image_url"],
                    interior_images=a["interior_images"],
                    pricing=AircraftPricing(
                        estimate_low=a["pricing"]["estimate_low"],
                        estimate_high=a["pricing"]["estimate_high"],
                        currency=a["pricing"]["currency"],
                        note=a["pricing"]["note"],
                    )
                )
                for a in aircraft_data
            ]
            
            print(f"✈️  Showing aircraft: pax_just_extracted={pax_just_extracted}, wants_aircraft={wants_aircraft}, preference={preference}")

        # Get missing fields
        missing_fields = lead_manager.get_missing_fields(current_lead)

        # Get conversation history
        history = lead_manager.get_conversation_history(session_id)

        # Generate concierge response
        try:
            response_message = concierge_service.generate_response(
                history, current_lead, missing_fields
            )
        except Exception as llm_err:
            print(f"LLM error: {llm_err}")
            response_message = None

        # Override response message based on submission state
        # CRITICAL: Never use confirmation language unless booking is actually confirmed
        if requires_auth:
            # User needs to authenticate - use gentle, non-committal language
            response_message = "To proceed with your booking, please sign in or create an account. This will allow us to securely process your request and keep you updated."
        elif booking_confirmed:
            # Booking is confirmed - safe to use confirmation language
            response_message = "Perfect! I've placed the booking request. Our team will reach out to you shortly to finalize the details. Is there anything else I can help you with?"
        elif current_submission_state == "awaiting_auth":
            # Waiting for auth - gentle reminder without confirmation language
            if not response_message or not response_message.strip():
                response_message = "I'm ready to proceed whenever you are. Just let me know when you'd like to continue, and I'll take care of everything."
        elif not response_message or not response_message.strip():
            # Default fallback
            response_message = "I'd be happy to help with that. Could you tell me more about your flight requirements?"

        # Save assistant response
        lead_manager.save_message(session_id, "assistant", response_message)

        return ChatResponse(
            assistant_message=response_message,
            lead_state=current_lead,
            missing_fields=missing_fields,
            show_aircraft=show_aircraft,
            aircraft=aircraft_list,
            booking_confirmed=booking_confirmed,
            requires_auth=requires_auth,
        )

    except Exception as e:
        print(f"Error in /chat: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my-bookings")
async def get_my_bookings(
    authorization: str = Header(...)
):
    """
    Get all bookings for the authenticated user.
    Requires authentication.
    Returns list of leads sorted by created_at DESC.
    """
    try:
        # Get current user (required - will raise 401 if not authenticated)
        current_user = get_current_user_required(authorization)
        user_id = current_user["id"]
        
        # Get user's leads
        leads = lead_manager.get_user_leads(user_id)
        
        # Format response (only include relevant fields)
        bookings = []
        for lead in leads:
            bookings.append({
                "session_id": lead.get("session_id"),
                "name": lead.get("name"),
                "email": lead.get("email"),
                "date_time": lead.get("date_time"),
                "route_from": lead.get("route_from"),
                "route_to": lead.get("route_to"),
                "pax": lead.get("pax"),
                "selected_aircraft": lead.get("selected_aircraft"),
                "status": lead.get("status", "draft"),
                "created_at": lead.get("created_at"),
                "updated_at": lead.get("updated_at"),
            })
        
        return {"bookings": bookings}
    
    except HTTPException:
        # Re-raise auth errors
        raise
    except Exception as e:
        print(f"Error in /my-bookings: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

