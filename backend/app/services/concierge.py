"""
Concierge Conversation Layer
Generates natural language replies that sound like a human concierge.
Focus: Private jet bookings ONLY.
"""

from app.config import settings
from app.models.schemas import LeadState
from typing import List, Dict, Optional
import os

# Load conversation prompt
PROMPT_PATH = os.path.join(os.path.dirname(__file__), "..", "prompts", "conversation.txt")


def load_conversation_prompt() -> str:
    try:
        with open(PROMPT_PATH, "r") as f:
            return f.read()
    except FileNotFoundError:
        return """You are a luxury private jet concierge named Alexandra.
Speak naturally like a warm phone conversation.
Be professional, calm, and attentive.
Never mention technical processes, forms, or system logic.
Keep responses concise but personable.
Guide the conversation to understand their travel needs."""


# Mock responses for development without OpenAI
MOCK_GREETINGS = [
    "Good evening. Welcome to Jetayu Private Aviation. How may I assist you with your travel arrangements today?",
    "Hello, and thank you for reaching out to Jetayu. I'm here to help with your private flight needs. What can I do for you?",
]

MOCK_RESPONSES = {
    "route": "That sounds like a wonderful trip. And where will you be departing from?",
    "date": "Perfect. When are you looking to travel?",
    "pax": "Excellent. How many passengers will be joining you?",
    "name": "I'd be happy to help arrange that. May I have your name for this reservation?",
    "email": "Wonderful. And what's the best email to reach you at?",
    "complete": "Excellent! I have all the details. Shall I place this booking request with our team? They'll reach out shortly to finalize availability.",
    "default": "I understand. Let me make a note of that. Could you tell me more about your travel plans?",
}


class ConciergeService:
    def __init__(self):
        self.client = None
        self.system_prompt = load_conversation_prompt()
        self._mock_mode = not settings.OPENAI_API_KEY

        if settings.OPENAI_API_KEY:
            try:
                from openai import OpenAI
                self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
            except Exception as e:
                print(f"⚠️  Could not initialize OpenAI: {e}")
                self._mock_mode = True

        if self._mock_mode:
            print("⚠️  OpenAI not configured - using mock responses")

    def generate_greeting(self) -> str:
        """Generate the opening concierge message."""
        if self._mock_mode:
            import random
            return random.choice(MOCK_GREETINGS)

        messages = [
            {"role": "system", "content": self.system_prompt},
            {
                "role": "user",
                "content": "Generate a warm, professional opening greeting for a new client calling the concierge service. Keep it brief (1-2 sentences).",
            },
        ]

        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=150,
        )

        return response.choices[0].message.content.strip()

    def generate_response(
        self,
        conversation_history: List[Dict],
        lead_state: LeadState,
        missing_fields: List[str],
    ) -> str:
        """Generate a natural concierge response based on conversation and lead state."""
        if self._mock_mode:
            return self._generate_mock_response(lead_state, missing_fields)

        try:
            # Build context about what information we still need
            guidance = self._build_guidance(lead_state, missing_fields)

            messages = [{"role": "system", "content": f"{self.system_prompt}\n\n{guidance}"}]

            # Add conversation history
            for msg in conversation_history[-10:]:  # Last 10 messages for context
                role = "assistant" if msg["role"] == "assistant" else "user"
                messages.append({"role": role, "content": msg["message"]})

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.7,
                max_tokens=200,
            )

            result = response.choices[0].message.content
            if result:
                return result.strip()
            else:
                print("Warning: OpenAI returned empty content")
                return self._generate_mock_response(lead_state, missing_fields)

        except Exception as e:
            print(f"OpenAI API error: {e}")
            # Fallback to mock response on error
            return self._generate_mock_response(lead_state, missing_fields)

    def _generate_mock_response(self, lead_state: LeadState, missing_fields: List[str]) -> str:
        """Generate a contextual mock response based on missing fields."""
        if not missing_fields:
            return MOCK_RESPONSES["complete"]

        # Priority order for asking (special_requests comes BEFORE name/email)
        priority = ["route_from", "route_to", "date_time", "pax", "special_requests", "name", "email"]

        for field in priority:
            if field in missing_fields:
                if field in ("route_from", "route_to"):
                    return MOCK_RESPONSES["route"]
                elif field == "date_time":
                    return MOCK_RESPONSES["date"]
                elif field == "pax":
                    return MOCK_RESPONSES["pax"]
                elif field == "special_requests":
                    return "Before I take your contact details, are there any special requirements for your flight? Perhaps specific catering, ground transportation, or any special occasions we should know about?"
                elif field == "name":
                    return MOCK_RESPONSES["name"]
                elif field == "email":
                    return MOCK_RESPONSES["email"]

        return MOCK_RESPONSES["default"]

    def _build_guidance(self, lead_state: LeadState, missing_fields: List[str]) -> str:
        """Build internal guidance for the concierge based on lead state."""
        guidance_parts = []

        # What we know
        known = []
        if lead_state.name:
            known.append(f"Client's name: {lead_state.name}")
        if lead_state.email:
            known.append(f"Email: {lead_state.email}")
        if lead_state.route_from:
            known.append(f"Departing from: {lead_state.route_from}")
        if lead_state.route_to:
            known.append(f"Traveling to: {lead_state.route_to}")
        if lead_state.date_time:
            known.append(f"Date/Time: {lead_state.date_time}")
        if lead_state.pax:
            known.append(f"Passengers: {lead_state.pax}")
        if lead_state.special_requests:
            known.append(f"Special requests: {', '.join(lead_state.special_requests)}")

        if known:
            guidance_parts.append("Information gathered so far:\n" + "\n".join(known))

        # What we need (subtly guide the conversation)
        if missing_fields:
            # IMPORTANT: special_requests comes BEFORE name/email!
            priority_order = [
                "route_from",
                "route_to",
                "date_time",
                "pax",
                "special_requests",  # Ask about special needs BEFORE contact info
                "name",
                "email",
            ]
            next_field = None
            for field in priority_order:
                if field in missing_fields:
                    next_field = field
                    break

            field_prompts = {
                "route_from": "Naturally ask where they'll be departing from.",
                "route_to": "Gently ask about their destination.",
                "date_time": "Ask about their preferred travel date or timeframe.",
                "pax": "Inquire about how many will be traveling.",
                "special_requests": "IMPORTANT: Ask about any special requirements BEFORE asking for name/email. Examples: catering preferences, ground transportation, pets, special occasions, dietary restrictions, etc.",
                "name": "Politely ask for their name for the reservation.",
                "email": "Ask for the best email to reach them at.",
            }

            if next_field and next_field in field_prompts:
                guidance_parts.append(
                    f"Conversational goal: {field_prompts[next_field]}"
                )

        if not missing_fields:
            guidance_parts.append(
                "IMPORTANT: We have ALL the details needed. Do the following:\n"
                "1. Summarize the booking details (route, date, passengers, name, email)\n"
                "2. Ask if they would like to PROCEED with placing the booking request\n"
                "3. Example: 'So that's [from] to [to] on [date] for [pax] passengers. "
                "I have your details as [name]. Shall I place this request with our team?'\n"
                "4. Wait for their confirmation before proceeding."
            )

        return "\n\n".join(guidance_parts) if guidance_parts else ""


# Lazy singleton instance
_concierge_service = None


def get_concierge_service():
    global _concierge_service
    if _concierge_service is None:
        _concierge_service = ConciergeService()
    return _concierge_service


# For backwards compatibility
class ConciergeServiceProxy:
    def __getattr__(self, name):
        return getattr(get_concierge_service(), name)


concierge_service = ConciergeServiceProxy()
