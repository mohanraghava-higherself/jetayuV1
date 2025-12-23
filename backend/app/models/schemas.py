from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import json


# Request schemas
class ChatRequest(BaseModel):
    session_id: str
    message: str
    type: Optional[str] = None  # "AIRCRAFT_SELECTED" for structured payloads
    selected_aircraft: Optional[Dict[str, str]] = None  # {id: str, name: str} when type is AIRCRAFT_SELECTED


# Response schemas
class StartResponse(BaseModel):
    session_id: str
    assistant_message: str


class LeadState(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    date_time: Optional[str] = None
    route_from: Optional[str] = None
    route_to: Optional[str] = None
    pax: Optional[int] = None
    special_requests: List[str] = []
    selected_aircraft: Optional[str] = None  # Aircraft name if selected
    status: str = "draft"  # draft | confirmed | contacted
    submission_state: str = "collecting"  # collecting | awaiting_auth | confirmed
    user_id: Optional[str] = None  # User ID if authenticated


class AircraftPricing(BaseModel):
    estimate_low: int
    estimate_high: int
    currency: str = "USD"
    note: str = "Final pricing subject to routing and availability"


class AircraftSuggestion(BaseModel):
    id: str
    name: str
    manufacturer: str
    category: str
    capacity: int
    range_nm: int
    speed_kph: int
    description: str
    features: List[str]
    image_url: str
    interior_images: List[str]
    pricing: AircraftPricing


class ChatResponse(BaseModel):
    session_id: str  # Session ID (returned so frontend can track it)
    assistant_message: str
    lead_state: LeadState
    missing_fields: List[str]
    # Aircraft suggestions - only included when appropriate
    show_aircraft: bool = False
    aircraft: Optional[List[AircraftSuggestion]] = None
    aircraft_navigation_intent: Optional[str] = None  # "AIRCRAFT_BIGGER", "AIRCRAFT_SMALLER", "AIRCRAFT_RECOMMENDED", "AIRCRAFT_PREVIOUS"
    # Booking confirmation
    booking_confirmed: bool = False  # True when user proceeds to book AND auth successful
    requires_auth: bool = False  # True when booking requires authentication (blocks confirmation)


# Internal schemas
class ExtractionResult(BaseModel):
    updates: LeadState


class ConversationMessage(BaseModel):
    role: str
    message: str
    created_at: Optional[datetime] = None

