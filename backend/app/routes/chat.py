from fastapi import APIRouter, HTTPException, Header
from app.models.schemas import ChatRequest, ChatResponse, StartResponse, AircraftSuggestion, AircraftPricing, LeadState
from app.services.concierge import concierge_service
from app.services.extractor import extractor_service
from app.services.lead_manager import lead_manager
from app.services.aircraft import aircraft_service, AIRCRAFT_FLEET
from app.services.intent_detector import intent_detector
from app.services.email_service import email_service
from app.auth import get_current_user_optional, get_current_user_required
from typing import Optional, List, Dict, Any
import re

router = APIRouter()


def filter_aircraft_names_from_special_requests(special_requests: List[str]) -> List[str]:
    """
    Filter out aircraft names from special_requests.
    Aircraft names should NOT be stored as special requests.
    
    Returns:
        Filtered list with aircraft names removed
    """
    if not special_requests:
        return special_requests
    
    # Get all aircraft names (case-insensitive)
    aircraft_names = set()
    for aircraft in AIRCRAFT_FLEET:
        aircraft_names.add(aircraft.name.lower())
        # Also add common variations
        if " " in aircraft.name:
            parts = aircraft.name.split()
            if len(parts) > 1:
                aircraft_names.add(parts[-1].lower())  # e.g., "longitude" from "Citation Longitude"
    
    # Filter out aircraft names
    filtered = []
    for request in special_requests:
        request_lower = request.lower().strip()
        is_aircraft_name = False
        
        # Check if request matches any aircraft name
        for aircraft_name in aircraft_names:
            if aircraft_name in request_lower or request_lower in aircraft_name:
                # Additional check: if it's exactly an aircraft name or contains it
                if request_lower == aircraft_name or request_lower.startswith(aircraft_name + " ") or request_lower.endswith(" " + aircraft_name):
                    is_aircraft_name = True
                    break
        
        if not is_aircraft_name:
            filtered.append(request)
        else:
            print(f"🚫 Filtered aircraft name from special_requests: '{request}'")
    
    return filtered


def find_baseline_aircraft(
    user_message: str,
    current_lead: LeadState,
    last_aircraft_list: Optional[List[Dict]]
) -> Optional[Dict]:
    """
    Determine baseline aircraft for filtering (BIGGER/SMALLER).
    Priority:
    1. Explicitly referenced aircraft name in message
    2. selected_aircraft (if exists)
    3. First aircraft from last shown list
    4. None (fallback to pax-based recommendations)
    """
    # 1. Check for explicitly mentioned aircraft in message
    mentioned_aircraft_id = intent_detector.detect_specific_aircraft_interest(user_message)
    if mentioned_aircraft_id:
        aircraft = aircraft_service.get_aircraft_by_id(mentioned_aircraft_id)
        if aircraft:
            return {
                "id": aircraft.id,
                "name": aircraft.name,
                "capacity": aircraft.capacity,
            }
    
    # 2. Check selected_aircraft
    if current_lead.selected_aircraft:
        for aircraft in AIRCRAFT_FLEET:
            if aircraft.name == current_lead.selected_aircraft:
                return {
                    "id": aircraft.id,
                    "name": aircraft.name,
                    "capacity": aircraft.capacity,
                }
    
    # 3. First aircraft from last shown list
    if last_aircraft_list and len(last_aircraft_list) > 0:
        first_aircraft = last_aircraft_list[0]
        return {
            "id": first_aircraft.get("id"),
            "name": first_aircraft.get("name"),
            "capacity": first_aircraft.get("capacity"),
        }
    
    return None


def compute_recommended_capacity_tier(pax: int, aircraft_service) -> tuple[int, int]:
    """
    Compute recommended capacity tier based on passenger count.
    
    The recommended tier represents the optimal capacity range that would be
    shown as "recommended aircraft" for the given pax.
    
    BIGGER jets = capacity > recommended ceiling
    SMALLER jets = capacity < recommended floor (but still >= pax)
    
    Returns:
        (floor, ceiling) tuple:
        - floor: minimum capacity in recommended tier (but at least pax)
        - ceiling: maximum capacity in recommended tier (defines upper bound for "bigger")
    """
    # Get recommended aircraft using standard logic (what would be shown initially)
    recommended_aircraft = aircraft_service.get_suitable_aircraft(
        pax=pax,
        preference=None  # Standard recommendation logic
    )
    
    if not recommended_aircraft:
        # Fallback: use pax as both floor and ceiling
        return (pax, pax)
    
    # Recommended ceiling: maximum capacity from recommended aircraft
    # This defines the upper bound - anything > this is "bigger"
    recommended_ceiling = max(a.capacity for a in recommended_aircraft)
    
    # Recommended floor: minimum capacity from recommended aircraft
    # This defines the lower bound - anything < this (but >= pax) is "smaller"
    recommended_floor = min(a.capacity for a in recommended_aircraft)
    
    # Ensure floor is at least pax
    recommended_floor = max(pax, recommended_floor)
    
    return (recommended_floor, recommended_ceiling)


def filter_bigger_aircraft(pax: int, all_aircraft: List, aircraft_service) -> List[Dict]:
    """
    Filter aircraft with capacity > recommended capacity tier ceiling.
    Uses capacity tiers based on what would be recommended, NOT baseline aircraft comparison.
    """
    _, recommended_ceiling = compute_recommended_capacity_tier(pax, aircraft_service)
    
    # Filter aircraft with capacity STRICTLY GREATER than recommended tier ceiling
    filtered = [
        a for a in all_aircraft
        if a.capacity > recommended_ceiling
    ]
    return sorted(filtered, key=lambda x: x.capacity)[:3]  # Top 3 by capacity


def filter_smaller_aircraft(pax: int, all_aircraft: List, aircraft_service) -> List[Dict]:
    """
    Filter aircraft with capacity < recommended tier floor but still >= pax.
    Uses capacity tiers based on what would be recommended, NOT baseline aircraft comparison.
    """
    recommended_floor, _ = compute_recommended_capacity_tier(pax, aircraft_service)
    
    # Filter aircraft smaller than recommended floor but still valid for pax
    filtered = [
        a for a in all_aircraft
        if a.capacity < recommended_floor and a.capacity >= pax
    ]
    return sorted(filtered, key=lambda x: x.capacity, reverse=True)[:3]  # Top 3 by capacity (desc)


def auto_select_aircraft(lead: LeadState, aircraft_service) -> str | None:
    """
    Auto-select an aircraft for booking confirmation if none is selected.
    Always computes statelessly from aircraft_service - no history used.
    
    Returns aircraft name if selected, None otherwise.
    """
    # CRITICAL: Never overwrite if already selected
    if lead.selected_aircraft is not None:
        return None
    
    # Auto-select best-fit aircraft based on pax
    if not lead.pax:
        print(f"⚠️  Cannot auto-select aircraft: pax is missing")
        return None
    
    try:
        recommended = aircraft_service.get_suitable_aircraft(
            pax=lead.pax,
            preference=None
        )
        if recommended and len(recommended) > 0:
            return recommended[0].name
    except Exception as e:
        print(f"⚠️  Error getting recommended aircraft: {e}")
    
    return None


def detect_aircraft_selection(message: str) -> str | None:
    """
    Detect if user is EXPLICITLY selecting a specific aircraft from the message.
    Only matches explicit selection phrases, NOT expressions of interest.
    
    Returns the aircraft name if found, None otherwise.
    
    CRITICAL: "I'm interested in X" does NOT count as selection.
    Only explicit selection phrases like "select", "choose", "go with", "book" count.
    """
    message_lower = message.lower()
    
    # STRICT patterns for explicit selection only (NOT "interested in")
    # These patterns indicate user is CONFIRMING selection, not just expressing interest
    explicit_selection_patterns = [
        r"(?:select|choose|pick|go with|take|book|confirm|want)\s+(?:the\s+)?([A-Za-z0-9\s]+(?:G\d+|Citation|Challenger|Global|Phenom|Falcon|Learjet|Praetor)[A-Za-z0-9\s]*)",
        r"(?:the\s+)?([A-Za-z]+\s+(?:G\d+|CJ\d+|\d+[A-Z]?))\s+(?:it is|that's|that is|will be|for me|please)",
        r"(?:let'?s?\s+)?(?:go|proceed|book)\s+(?:with\s+)?(?:the\s+)?([A-Za-z0-9\s]+(?:G\d+|Citation|Challenger|Global|Phenom|Falcon|Learjet|Praetor)[A-Za-z0-9\s]*)",
    ]
    
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
    
    # First check for explicit selection patterns
    import re
    for pattern in explicit_selection_patterns:
        match = re.search(pattern, message_lower)
        if match:
            # Extract aircraft name from match
            matched_text = match.group(1) if match.lastindex >= 1 else match.group(0)
            # Check if it matches a known aircraft
            for aircraft in aircraft_names:
                if aircraft in matched_text.lower():
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
    
    # If no explicit selection pattern found, return None
    # This ensures "I'm interested in X" does NOT count as selection
    return None


@router.post("/start", response_model=StartResponse)
async def start_conversation(authorization: Optional[str] = Header(None)):
    """
    Start a new conversation session.
    Creates a session ID with a draft lead and returns the opening greeting.
    """
    try:
        # Get current user (optional)
        current_user = get_current_user_optional(authorization)

        # Create new session (with draft lead)
        session_id = lead_manager.create_session()

        # If authenticated, attach user info and promote submission state
        if current_user:
            lead_manager.attach_user_and_promote(
                session_id,
                {
                    "id": current_user.get("id"),
                    "email": current_user.get("email"),
                    "full_name": None  # Will be resolved from Auth API or profiles table
                },
                authorization=authorization
            )

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
        
        # Auto-create session if not provided (first message from landing page)
        if not session_id or session_id.strip() == '':
            session_id = lead_manager.create_session()
            # If authenticated, attach user immediately
            current_user = get_current_user_optional(authorization)
            if current_user:
                lead_manager.attach_user_and_promote(
                    session_id,
                    {
                        "id": current_user.get("id"),
                        "email": current_user.get("email"),
                        "full_name": None
                    },
                    authorization=authorization
                )
        
        user_message = request.message
        booking_confirmed = False
        requires_auth = False
        
        # ============================================================
        # CRITICAL: HARD SHORT-CIRCUIT FOR STRUCTURED AIRCRAFT SELECTION
        # ============================================================
        # If this is a structured AIRCRAFT_SELECTED payload, bypass ALL logic
        # and immediately persist the selection. This makes selection deterministic
        # and frontend-driven, eliminating all LLM/auto-selection interference.
        if request.type == "AIRCRAFT_SELECTED" and request.selected_aircraft:
            aircraft_name = request.selected_aircraft.get("name")
            if aircraft_name:
                # Get current user (optional)
                current_user = get_current_user_optional(authorization)
                
                # If authenticated, ensure lead is linked to user
                if current_user:
                    lead_manager.attach_user_and_promote(
                        session_id,
                        {
                            "id": current_user.get("id"),
                            "email": current_user.get("email"),
                            "full_name": None
                        },
                        authorization=authorization
                    )
                
                # Persist aircraft selection IMMEDIATELY (force=True to overwrite any existing)
                lead_manager.set_selected_aircraft(session_id, aircraft_name, force=True)
                
                # Save user message for conversation history
                lead_manager.save_message(session_id, "user", f"Selected {aircraft_name}")
                
                # Get updated lead state (fresh read)
                current_lead = lead_manager.get_lead(session_id)

                # If all core flight details are present, mark details as confirmed to avoid re-asking them
                has_flight_details = (
                    current_lead.route_from and 
                    current_lead.route_to and 
                    current_lead.date_time and 
                    current_lead.pax
                )
                if has_flight_details:
                    lead_manager.update_lead(session_id, {"submission_state": "details_confirmed"})

                # Fresh state after possible submission_state update
                current_lead = lead_manager.get_lead(session_id)
                
                # STEP 1: Acknowledge selection (short, confident)
                acknowledgment = f"Perfect — I've locked in the {aircraft_name} for your journey."
                
                # STEP 2: Determine next action with strict priority AFTER selection:
                # special_requests → name → email → confirmation summary
                response_parts = [acknowledgment]
                # After selection we do NOT re-ask flight details. Focus on remaining fields only.
                missing_special = not current_lead.special_requests
                missing_name = (not current_lead.user_id) and (not current_lead.name)
                missing_email = (not current_lead.user_id) and (not current_lead.email)

                if missing_special:
                    response_parts.append("Any special requirements for your flight? Catering preferences, ground transportation, or special occasions we should note?")
                elif missing_name:
                    response_parts.append("May I have the name for this booking?")
                elif missing_email:
                    response_parts.append("What's the best email to reach you with the booking details?")
                else:
                    summary_parts = ["Here's a quick summary before I proceed:"]
                    if current_lead.route_from and current_lead.route_to:
                        summary_parts.append(f"• Route: {current_lead.route_from} → {current_lead.route_to}")
                    if current_lead.date_time:
                        summary_parts.append(f"• Date: {current_lead.date_time}")
                    if current_lead.pax:
                        summary_parts.append(f"• Passengers: {current_lead.pax}")
                    if current_lead.selected_aircraft:
                        summary_parts.append(f"• Aircraft: {current_lead.selected_aircraft}")
                    summary_parts.append("")
                    summary_parts.append("Shall I place this booking request with our team?")
                    response_parts = [acknowledgment] + summary_parts
                
                # Combine response parts
                response_message = " ".join(response_parts) if len(response_parts) == 1 else "\n\n".join(response_parts)
                
                # Save assistant response
                lead_manager.save_message(session_id, "assistant", response_message)
                
                # Return response with show_aircraft=False (cards disappear)
                return ChatResponse(
                    session_id=session_id,  # Return session_id so frontend can track it
                    assistant_message=response_message,
                    lead_state=current_lead,
                    missing_fields=[],  # Flight fields are considered satisfied after selection path
                    show_aircraft=False,  # CRITICAL: Hide cards immediately
                    aircraft=None,
                    aircraft_navigation_intent=None,
                    booking_confirmed=False,  # CRITICAL: Do NOT auto-confirm
                    requires_auth=False,
                )
        
        # Get current user (optional - doesn't fail if not authenticated)
        current_user = get_current_user_optional(authorization)

        # If authenticated, ensure lead is linked to user and promoted out of 'collecting'
        # This MUST run every time to persist name/email into DB
        if current_user:
            lead_manager.attach_user_and_promote(
                session_id,
                {
                    "id": current_user.get("id"),
                    "email": current_user.get("email"),
                    "full_name": None  # Will be resolved from Auth API or profiles table
                },
                authorization=authorization
            )

        # Ensure lead exists for this session (handles RLS/missing rows gracefully)
        lead_before = lead_manager.get_lead(session_id)
        if lead_before is None:
            lead_manager.create_lead_with_session(session_id)
            lead_before = lead_manager.get_lead(session_id) or LeadState(submission_state="collecting")

        # Save user message
        lead_manager.save_message(session_id, "user", user_message)
        pax_before = lead_before.pax  # Track if pax existed before
        selected_aircraft_before = lead_before.selected_aircraft
        was_already_confirmed = lead_before.status == "confirmed"

        # Check for EXPLICIT aircraft selection in message
        # This must happen BEFORE any aircraft re-pull logic
        # CRITICAL: If user explicitly selects, we MUST NOT show cards
        selected_aircraft = detect_aircraft_selection(user_message)
        aircraft_explicitly_selected = False
        if selected_aircraft:
            # Explicit selection confirmed - set selected_aircraft IMMEDIATELY
            # This MUST persist before any other logic runs
            # CRITICAL: User explicit selection can overwrite previous selection (force=True)
            current_lead = lead_manager.get_lead(session_id)
            if current_lead.selected_aircraft and current_lead.selected_aircraft != selected_aircraft:
                print(f"🔄 User explicitly changing aircraft: {current_lead.selected_aircraft} → {selected_aircraft}")
                lead_manager.set_selected_aircraft(session_id, selected_aircraft, force=True)
            else:
                lead_manager.set_selected_aircraft(session_id, selected_aircraft)
            print(f"🛩️  Aircraft selected and persisted: {selected_aircraft}")
            aircraft_explicitly_selected = True
            # Force reload to get updated state
            current_lead = lead_manager.get_lead(session_id)
            # Verify persistence
            if current_lead.selected_aircraft != selected_aircraft:
                print(f"⚠️  WARNING: Aircraft selection may not have persisted correctly")
                # Retry persistence with force
                current_lead = lead_manager.set_selected_aircraft(session_id, selected_aircraft, force=True)

        # DETERMINISTIC PAX EXTRACTION for numeric-only input
        # If we're awaiting pax and user sends pure number, extract it directly
        pax_extracted_deterministically = None
        if lead_before.pax is None:
            # Check if message is purely numeric (with optional whitespace)
            import re
            numeric_pattern = r'^\s*(\d+)\s*$'
            match = re.match(numeric_pattern, user_message.strip())
            if match:
                try:
                    pax_value = int(match.group(1))
                    # Validate reasonable range (1-100)
                    if 1 <= pax_value <= 100:
                        pax_extracted_deterministically = pax_value
                        # Update lead directly with deterministic pax
                        lead_manager.update_lead(session_id, {"pax": pax_value})
                        print(f"🔢 Deterministic pax extraction: {pax_value} (from numeric-only input: '{user_message}')")
                        # Reload lead to get updated state
                        current_lead = lead_manager.get_lead(session_id)
                except ValueError:
                    pass  # Not a valid integer, continue with LLM extraction

        # Extract entities from user message (LLM extraction)
        # This will still run to extract other fields, but pax is already set if numeric-only
        current_lead = lead_manager.get_lead(session_id)  # Use latest state
        try:
            extracted = extractor_service.extract(user_message, current_lead)
            # Update lead if we extracted anything
            # Convert LeadState to dict for update_lead()
            if extracted:
                # Convert LeadState object to dict
                extracted_dict = {
                    "name": extracted.name,
                    "email": extracted.email,
                    "date_time": extracted.date_time,
                    "route_from": extracted.route_from,
                    "route_to": extracted.route_to,
                    "pax": extracted.pax,
                    "special_requests": extracted.special_requests,
                    "selected_aircraft": extracted.selected_aircraft,
                }
                # CRITICAL: Remove selected_aircraft from extraction to prevent overwriting user selection
                # selected_aircraft must ONLY be set via detect_aircraft_selection() or auto-selection
                extracted_dict.pop("selected_aircraft", None)
                # Remove None values to avoid unnecessary updates
                extracted_dict = {k: v for k, v in extracted_dict.items() if v is not None}
                
                # CRITICAL: Filter aircraft names from special_requests
                # Aircraft names should NEVER be stored as special requests
                if "special_requests" in extracted_dict and extracted_dict["special_requests"]:
                    filtered_requests = filter_aircraft_names_from_special_requests(extracted_dict["special_requests"])
                    if filtered_requests:
                        extracted_dict["special_requests"] = filtered_requests
                    else:
                        # All requests were aircraft names - remove the field
                        del extracted_dict["special_requests"]
                
                # If pax was extracted deterministically, don't override it with LLM result
                # (LLM might not extract it correctly for numeric-only input)
                if pax_extracted_deterministically is not None and "pax" in extracted_dict:
                    # Keep deterministic pax, remove LLM pax if different
                    if extracted_dict["pax"] != pax_extracted_deterministically:
                        print(f"⚠️  LLM extracted pax={extracted_dict['pax']}, but keeping deterministic pax={pax_extracted_deterministically}")
                        del extracted_dict["pax"]
                
                if extracted_dict:
                    current_lead = lead_manager.update_lead(session_id, extracted_dict)
        except Exception as extract_err:
            print(f"Extraction error (non-fatal): {extract_err}")
            # Continue without extraction

        # Re-fetch lead to get latest state (including selected aircraft)
        current_lead = lead_manager.get_lead(session_id)

        # Check if pax was JUST extracted (wasn't there before, is there now)
        pax_just_extracted = (pax_before is None and current_lead.pax is not None)
        
        # Check if pax CHANGED (was different before)
        pax_changed = (pax_before is not None 
                      and current_lead.pax is not None 
                      and pax_before != current_lead.pax)
        
        # CRITICAL: NEVER clear selected_aircraft due to pax changes
        # Once selected_aircraft is set (via structured payload), it is IMMUTABLE
        # User selection ALWAYS wins - no auto-clearing, no pax-based clearing
        if pax_changed and selected_aircraft_before:
            current_lead = lead_manager.get_lead(session_id)
            print(f"🔒 Passenger count changed ({pax_before} → {current_lead.pax}) - preserving selected aircraft: {current_lead.selected_aircraft}")

        # Detect user intent for aircraft queries
        # CRITICAL: Check for INTEREST first (separate from REQUEST)
        aircraft_interest = intent_detector.detect_aircraft_interest(user_message)
        wants_aircraft, preference = intent_detector.detect_aircraft_intent(user_message)
        
        # Detect aircraft navigation intent (BIGGER, SMALLER, RECOMMENDED, PREVIOUS)
        navigation_intent = intent_detector.detect_aircraft_navigation_intent(user_message)
        
        # Log intent detection
        if aircraft_interest:
            print(f"💭 Aircraft INTEREST detected (not a request for alternatives)")
        elif wants_aircraft:
            print(f"🔍 Aircraft REQUEST detected (user wants to see alternatives)")
        if navigation_intent:
            print(f"🧭 Aircraft NAVIGATION intent detected: {navigation_intent}")

        # Detect booking intent
        wants_to_book = intent_detector.detect_booking_intent(user_message)
        
        # Get current submission state
        current_submission_state = current_lead.submission_state or "collecting"

        # Handle booking submission flow with hard state gates
        if wants_to_book and not was_already_confirmed:
            # Re-fetch lead to ensure we have latest state
            current_lead = lead_manager.get_lead(session_id)
            
            # CRITICAL: Auto-select ONLY if selected_aircraft is NULL
            # If user selected an aircraft (via structured payload), it is IMMUTABLE
            # Auto-selection happens ONLY when user NEVER selected an aircraft
            if current_lead.selected_aircraft is None:
                auto_selected = auto_select_aircraft(current_lead, aircraft_service)
                if auto_selected:
                    lead_manager.set_selected_aircraft(session_id, auto_selected)
                    current_lead = lead_manager.get_lead(session_id)
                    print(f"✈️  Auto-selected aircraft for booking: {auto_selected}")
                else:
                    print(f"⚠️  Could not auto-select aircraft - pax may be missing")
            else:
                print(f"✅ Aircraft already selected: {current_lead.selected_aircraft} - skipping auto-selection (IMMUTABLE)")
            
            # CRITICAL: Check submission state to prevent unauthorized confirmation
            if current_submission_state == "collecting":
                # User wants to proceed - set state to awaiting_auth
                if not current_user:
                    # User not authenticated - require auth
                    current_lead = lead_manager.set_submission_state(session_id, "awaiting_auth")
                    requires_auth = True
                    print(f"🔒 Submission state set to 'awaiting_auth' - auth required")
                else:
                    # User is authenticated - promote state and confirm
                    user_id = current_user["id"]
                    # Promote to awaiting_auth before confirmation
                    current_lead = lead_manager.set_submission_state(session_id, "awaiting_auth")
                    current_lead = lead_manager.confirm_booking(session_id, user_id=user_id)
                    booking_confirmed = current_lead.status == "confirmed"  # Only true if confirmation succeeded
                    if booking_confirmed:
                        print(f"✅ BOOKING CONFIRMED for session {session_id}")
                        print(f"   User: {user_id}")
                        print(f"   Client: {current_lead.name or 'Unknown'}")
                        print(f"   Route: {current_lead.route_from} → {current_lead.route_to}")
                        print(f"   Aircraft: {current_lead.selected_aircraft}")
                        
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
                    # Re-check and auto-select aircraft if needed
                    # CRITICAL: Only auto-select if selected_aircraft is NULL (user never selected)
                    # If user selected an aircraft, it is IMMUTABLE
                    current_lead = lead_manager.get_lead(session_id)
                    if current_lead.selected_aircraft is None:
                        auto_selected = auto_select_aircraft(current_lead, aircraft_service)
                        if auto_selected:
                            lead_manager.set_selected_aircraft(session_id, auto_selected)
                            current_lead = lead_manager.get_lead(session_id)
                            print(f"✈️  Auto-selected aircraft after auth: {auto_selected}")
                    else:
                        print(f"✅ Aircraft already selected: {current_lead.selected_aircraft} - skipping auto-selection (IMMUTABLE)")
                    
                    # User is now authenticated - confirm booking (aircraft auto-selected if needed)
                    user_id = current_user["id"]
                    current_lead = lead_manager.confirm_booking(session_id, user_id=user_id)
                    booking_confirmed = current_lead.status == "confirmed"  # Only true if confirmation succeeded
                    if booking_confirmed:
                            print(f"✅ BOOKING CONFIRMED after auth for session {session_id}")
                            print(f"   User: {user_id}")
                            print(f"   Aircraft: {current_lead.selected_aircraft}")
                            
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
        # CRITICAL RULE: NEVER show aircraft if selected_aircraft is set
        # This check must happen FIRST, before any other logic
        show_aircraft = False
        aircraft_list = None
        aircraft_navigation_intent = None
        wants_to_change_aircraft = False
        
        # Re-fetch lead to ensure we have latest selected_aircraft state
        current_lead = lead_manager.get_lead(session_id)
        
        # STRICT CHECK: If aircraft was explicitly selected in this message, NEVER show cards
        if aircraft_explicitly_selected:
            print(f"🚫 Aircraft explicitly selected - suppressing card display")
            show_aircraft = False
        # STRICT CHECK: If selected_aircraft is already set, NEVER show cards
        elif current_lead.selected_aircraft is not None:
            print(f"🚫 Aircraft already selected ({current_lead.selected_aircraft}) - suppressing card display")
            show_aircraft = False
        # Handle aircraft navigation intents (BIGGER, SMALLER, RECOMMENDED, PREVIOUS)
        elif navigation_intent and current_lead.pax is not None:
            print(f"🧭 Processing navigation intent: {navigation_intent}")
            aircraft_navigation_intent = navigation_intent
            
            if navigation_intent == "AIRCRAFT_PREVIOUS":
                # AIRCRAFT_PREVIOUS removed - no history tracking
                # Treat as AIRCRAFT_RECOMMENDED instead
                navigation_intent = "AIRCRAFT_RECOMMENDED"
                print(f"📜 AIRCRAFT_PREVIOUS treated as AIRCRAFT_RECOMMENDED (no history)")
            
            if navigation_intent == "AIRCRAFT_RECOMMENDED":
                # Reset to fresh recommendations
                aircraft_data = aircraft_service.get_aircraft_for_response(
                    pax=current_lead.pax or 4,
                    preference=None,  # No preference - get standard recommendations
                    route_from=current_lead.route_from,
                    route_to=current_lead.route_to,
                )
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
                # Stateless - no history tracking
                show_aircraft = True
                print(f"⭐ Showing recommended aircraft ({len(aircraft_list)} aircraft)")
            elif navigation_intent in ["AIRCRAFT_BIGGER", "AIRCRAFT_SMALLER"]:
                # Use capacity tiers, NOT baseline aircraft comparison
                # Get ALL aircraft from fleet for tier computation (needed for capacity tier calculation)
                all_fleet = aircraft_service.get_all_aircraft()
                
                pax_count = current_lead.pax or 4
                
                if navigation_intent == "AIRCRAFT_BIGGER":
                    filtered_aircraft = filter_bigger_aircraft(pax_count, all_fleet, aircraft_service)
                else:  # AIRCRAFT_SMALLER
                    filtered_aircraft = filter_smaller_aircraft(pax_count, all_fleet, aircraft_service)
                
                if filtered_aircraft:
                    # Format for response
                    aircraft_data = []
                    for aircraft in filtered_aircraft:
                        pricing = aircraft_service.estimate_price(
                            aircraft,
                            current_lead.route_from or "Unknown",
                            current_lead.route_to or "Unknown"
                        )
                        aircraft_data.append({
                            "id": aircraft.id,
                            "name": aircraft.name,
                            "manufacturer": aircraft.manufacturer,
                            "category": aircraft.category,
                            "capacity": aircraft.capacity,
                            "range_nm": aircraft.range_nm,
                            "speed_kph": aircraft.speed_kph,
                            "description": aircraft.description,
                            "features": aircraft.features,
                            "image_url": aircraft.image_url,
                            "interior_images": aircraft.interior_images,
                            "pricing": {
                                "estimate_low": pricing["price_range_low"],
                                "estimate_high": pricing["price_range_high"],
                                "currency": "USD",
                                "note": "Final pricing subject to routing and availability"
                            }
                        })
                    
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
                    
                    # Stateless - no history tracking
                    show_aircraft = True
                    
                    # Log with capacity tier info
                    floor, ceiling = compute_recommended_capacity_tier(pax_count, aircraft_service)
                    if navigation_intent == "AIRCRAFT_BIGGER":
                        print(f"🔍 Filtered {navigation_intent} aircraft: {len(aircraft_list)} results (pax={pax_count}, recommended_ceiling={ceiling}, capacity_tier_based=True)")
                    else:
                        print(f"🔍 Filtered {navigation_intent} aircraft: {len(aircraft_list)} results (pax={pax_count}, recommended_floor={floor}, capacity_tier_based=True)")
                else:
                    # Log capacity tier info even when no results
                    floor, ceiling = compute_recommended_capacity_tier(pax_count, aircraft_service)
                    if navigation_intent == "AIRCRAFT_BIGGER":
                        print(f"⚠️  No {navigation_intent} aircraft found (pax={pax_count}, recommended_ceiling={ceiling}, capacity_tier_based=True)")
                    else:
                        print(f"⚠️  No {navigation_intent} aircraft found (pax={pax_count}, recommended_floor={floor}, capacity_tier_based=True)")
        else:
            # No aircraft selected - proceed with normal logic
            # CRITICAL: Only treat as "change aircraft" if it's an explicit REQUEST, not INTEREST
            # Interest should NOT trigger re-pull or clear selection
            wants_to_change_aircraft = wants_aircraft and not aircraft_interest and current_lead.selected_aircraft is None
            
            # If user wants different aircraft explicitly, we still do NOT clear an existing selection
            if wants_to_change_aircraft:
                print(f"🔄 User requested different aircraft - keeping existing selection until new selection is made")
            elif aircraft_interest:
                # User expressed interest - do NOT re-pull, do NOT clear selection
                print(f"💭 User expressed interest - proceeding to next field without re-pull")

            # Show aircraft ONLY if:
            # - Passenger count is present (required for recommendations)
            # - AND no aircraft is currently selected (selected_aircraft is None)
            # - AND (pax was just extracted OR pax changed OR user explicitly REQUESTED alternatives)
            # - AND booking is not confirmed
            # 
            # CRITICAL: Cards visibility depends ONLY on selected_aircraft being None
            # CRITICAL: Interest does NOT trigger re-pull - only explicit requests do
            has_pax = current_lead.pax is not None
            no_selection = current_lead.selected_aircraft is None
            # Only trigger on explicit REQUEST, not INTEREST
            should_trigger = (pax_just_extracted or pax_changed or (wants_aircraft and not aircraft_interest))
            
            should_show = (
                has_pax
                and no_selection
                and should_trigger
                and not booking_confirmed
            )
            
            if should_show:
                show_aircraft = True
                # Get suitable aircraft based on passenger count and preference
                aircraft_data = aircraft_service.get_aircraft_for_response(
                    pax=current_lead.pax or 4,  # Default to 4 if pax not set
                    preference=preference,
                    route_from=current_lead.route_from,
                    route_to=current_lead.route_to,
                )
                
                # Stateless - no history tracking
                
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
                
                print(f"✈️  Showing aircraft: pax={current_lead.pax}, pax_just_extracted={pax_just_extracted}, wants_aircraft={wants_aircraft}, preference={preference}, selected_aircraft={current_lead.selected_aircraft}")
            else:
                if not has_pax:
                    print(f"🚫 Not showing aircraft - no passenger count yet")
                elif not should_trigger:
                    print(f"🚫 Not showing aircraft - no trigger condition (pax_just_extracted={pax_just_extracted}, pax_changed={pax_changed}, wants_aircraft={wants_aircraft})")

        # FORCE DB RELOAD before computing missing_fields
        # This ensures we use the final DB state, not stale in-memory objects
        current_lead = lead_manager.get_lead(session_id)

        # Get missing fields
        missing_fields = lead_manager.get_missing_fields(current_lead)

        # Get conversation history
        history = lead_manager.get_conversation_history(session_id)

        # Determine if we're in flight selection phase
        # Cards are visible = flight selection phase = NO QUESTIONS
        in_flight_selection_phase = (
            show_aircraft 
            and current_lead.pax is not None 
            and current_lead.selected_aircraft is None
        )

        # Generate concierge response
        # Skip LLM generation during flight selection phase to avoid questions
        # Also skip LLM generation when booking is confirmed (we'll use explicit confirmation message)
        response_message = None
        if not in_flight_selection_phase and not booking_confirmed:
            try:
                response_message = concierge_service.generate_response(
                    history, current_lead, missing_fields
                )
            except Exception as llm_err:
                print(f"LLM error: {llm_err}")
                response_message = None

        # Override response message based on submission state and special conditions
        # CRITICAL: Never use confirmation language unless booking is actually confirmed
        # Priority order matters - check explicit selection first
        if aircraft_explicitly_selected and current_lead.selected_aircraft:
            # Aircraft was just explicitly selected - acknowledge selection clearly
            response_message = f"Perfect choice. I've locked in the {current_lead.selected_aircraft} for your journey."
        elif navigation_intent == "AIRCRAFT_BIGGER" and show_aircraft:
            response_message = "Here are some larger aircraft options for your journey."
        elif navigation_intent == "AIRCRAFT_SMALLER" and show_aircraft:
            response_message = "These smaller jets may suit your needs better."
        elif navigation_intent == "AIRCRAFT_RECOMMENDED" and show_aircraft:
            response_message = "Here are the recommended aircraft for this trip."
        elif navigation_intent == "AIRCRAFT_PREVIOUS" and show_aircraft:
            response_message = "Sure — bringing back the previous options."
        elif aircraft_interest and not show_aircraft:
            # User expressed interest in an aircraft - acknowledge and proceed
            # Extract aircraft name if possible for personalized response
            aircraft_name = None
            for aircraft in AIRCRAFT_FLEET:
                if aircraft.name.lower() in user_message.lower():
                    aircraft_name = aircraft.name
                    break
            if aircraft_name:
                response_message = f"The {aircraft_name} is an excellent choice. It offers exceptional comfort and performance for your journey."
            else:
                response_message = "That's a wonderful aircraft. It would be perfect for your trip."
        elif pax_just_extracted and current_lead.pax and show_aircraft:
            # When passenger count is just extracted and cards are shown
            # Provide brief acknowledgment - NO QUESTIONS during flight selection phase
            response_message = f"For {current_lead.pax} passenger{'s' if current_lead.pax > 1 else ''}, these aircraft are a great fit."
        elif wants_aircraft and show_aircraft:
            # User asked to see aircraft options - provide contextual response based on preference
            if preference == "larger":
                response_message = "Absolutely — here are some larger aircraft options that offer more space and range."
            elif preference == "smaller":
                response_message = "Of course — here are some more compact aircraft options that are efficient for your trip."
            elif preference == "cheapest":
                response_message = "Certainly — here are the most economical options that fit your needs."
            elif preference == "fastest":
                response_message = "Yes — here are the fastest aircraft options available for this route."
            else:
                # Generic request for aircraft options
                response_message = "Sure — here are other aircraft that work well for this trip."
        elif wants_to_change_aircraft and show_aircraft:
            # User asked to change aircraft - acknowledge and show cards
            response_message = "Sure — here are other aircraft that work well for this trip."
        elif in_flight_selection_phase and not response_message:
            # During flight selection phase, provide minimal acknowledgment if no specific message
            response_message = ""  # Empty message - cards speak for themselves
        elif wants_to_book and current_lead.selected_aircraft is None:
            # User wants to book but aircraft not selected
            response_message = "Please select an aircraft to proceed with booking."
        elif requires_auth:
            # User needs to authenticate - use specified copy
            response_message = "To proceed with your booking and coordinate with our operators, please sign in to Jetayu."
        elif booking_confirmed and current_lead.selected_aircraft:
            # Booking is confirmed - provide warm concierge confirmation message
            # CRITICAL: Use selected_aircraft from database (source of truth), NEVER infer from conversation
            aircraft_name = current_lead.selected_aircraft  # Explicitly from DB
            
            # Build confirmation message with explicit aircraft name
            confirmation_parts = []
            
            # Greeting with name if available
            if current_lead.name:
                confirmation_parts.append(f"Thank you, {current_lead.name}.")
            
            # Route details
            route_text = ""
            if current_lead.route_from and current_lead.route_to:
                route_text = f"from {current_lead.route_from} to {current_lead.route_to}"
            
            # Date
            date_text = ""
            if current_lead.date_time:
                date_text = f"on {current_lead.date_time}"
            
            # Passengers
            pax_text = ""
            if current_lead.pax:
                pax_text = f"for {current_lead.pax} passenger{'s' if current_lead.pax > 1 else ''}"
            
            # Build main confirmation sentence
            main_parts = []
            if route_text:
                main_parts.append(route_text)
            if date_text:
                main_parts.append(date_text)
            if pax_text:
                main_parts.append(pax_text)
            
            # CRITICAL: Aircraft name MUST come from selected_aircraft (database value)
            main_sentence = ""
            if main_parts:
                main_sentence = f"Your request {' '.join(main_parts)} on the **{aircraft_name}** has been placed with our team."
            else:
                main_sentence = f"Your request for the **{aircraft_name}** has been placed with our team."
            
            confirmation_parts.append(main_sentence)
            confirmation_parts.append("We'll be in touch shortly.")
            
            # Join main parts with spaces, then add tracking message on new line
            response_message = " ".join(confirmation_parts) + "\n\nYou can track the status of this booking anytime from the **My Bookings** section."
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
            session_id=session_id,  # Return session_id so frontend can track it
            assistant_message=response_message,
            lead_state=current_lead,
            missing_fields=missing_fields,
            show_aircraft=show_aircraft,
            aircraft=aircraft_list,
            aircraft_navigation_intent=aircraft_navigation_intent,
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
        # CRITICAL: ONLY return bookings with status='confirmed'
        # Do NOT return draft, awaiting_auth, or any other status
        bookings = []
        for lead in leads:
            # Strict filter: only confirmed bookings
            if lead.get("status") != "confirmed":
                continue
            
            # Additional safety: skip if selected_aircraft is NULL (defensive)
            if not lead.get("selected_aircraft"):
                print(f"⚠️  Skipping confirmed booking without aircraft: {lead.get('session_id')}")
                continue
            
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

