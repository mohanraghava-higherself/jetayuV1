"""
Entity Extraction Layer
Extracts lead information from user messages.
Returns only explicitly stated information, never guesses.
"""

from app.config import settings
from app.models.schemas import LeadState
from typing import Optional
import json
import os
import re

# Load extraction prompt
PROMPT_PATH = os.path.join(os.path.dirname(__file__), "..", "prompts", "extraction.txt")


def load_extraction_prompt() -> str:
    try:
        with open(PROMPT_PATH, "r") as f:
            return f.read()
    except FileNotFoundError:
        return """You are an entity extraction system for a private jet concierge service.
Extract ONLY explicitly stated information from the user's message.
Never infer, guess, or assume values.
Return a JSON object with only the fields that have clear values in the message.

Fields to extract:
- name: The client's name (only if they explicitly state it)
- email: Email address (only if provided)
- date_time: Travel date/time (any format they mention)
- route_from: Departure location/airport/city
- route_to: Destination location/airport/city
- pax: Number of passengers (as integer)
- special_requests: Array of any special requests mentioned

Return ONLY valid JSON in this exact format:
{
  "updates": {
    "field_name": "extracted_value"
  }
}

Only include fields that have explicit values. Omit fields with no clear data."""


class ExtractorService:
    def __init__(self):
        self.client = None
        self.system_prompt = load_extraction_prompt()
        self._mock_mode = not settings.OPENAI_API_KEY

        if settings.OPENAI_API_KEY:
            try:
                from openai import OpenAI
                self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
            except Exception as e:
                print(f"⚠️  Could not initialize OpenAI for extraction: {e}")
                self._mock_mode = True

        if self._mock_mode:
            print("⚠️  Using regex-based extraction (mock mode)")

    def extract(self, user_message: str, current_lead: LeadState) -> Optional[LeadState]:
        """
        Extract entities from a user message.
        Returns LeadState with only the newly extracted fields populated.
        """
        # Check if this is likely just a name response (short message when name is missing)
        standalone_name = self._extract_standalone_name(user_message, current_lead)
        
        if self._mock_mode:
            extracted = self._extract_with_regex(user_message)
            # If we detected a standalone name and regex didn't catch it
            if standalone_name and not extracted.name:
                extracted.name = standalone_name
            return extracted

        messages = [
            {"role": "system", "content": self.system_prompt},
            {
                "role": "user",
                "content": f"Extract information from this message:\n\n\"{user_message}\"",
            },
        ]

        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0,
            max_tokens=300,
            response_format={"type": "json_object"},
        )

        try:
            raw_content = response.choices[0].message.content
            result = json.loads(raw_content)
            updates = result.get("updates", {})

            # If LLM didn't extract a name but we detected a standalone name
            if not updates.get("name") and standalone_name:
                updates["name"] = standalone_name

            # Log what was extracted
            if updates:
                print(f"📝 LLM Extracted: {updates}")

            # Build LeadState with extracted values
            extracted = LeadState(
                name=updates.get("name"),
                email=updates.get("email"),
                date_time=updates.get("date_time"),
                route_from=updates.get("route_from"),
                route_to=updates.get("route_to"),
                pax=updates.get("pax"),
                special_requests=updates.get("special_requests", []),
            )

            return extracted

        except (json.JSONDecodeError, KeyError) as e:
            print(f"⚠️  Extraction parse error: {e}")
            return None

    def _extract_standalone_name(self, message: str, current_lead: LeadState) -> Optional[str]:
        """
        Detect if the message is likely just a name response.
        This handles cases where user just types their name without "I'm" or "my name is".
        """
        # Only check if we don't have a name yet
        if current_lead.name:
            return None
        
        message = message.strip()
        words = message.split()
        
        # If message is 1-3 words and looks like a name
        if 1 <= len(words) <= 3:
            # Check if it doesn't contain obvious non-name patterns
            lower = message.lower()
            non_name_indicators = [
                '@', '.com', 'http', 'www',  # URLs/emails
                'yes', 'no', 'ok', 'okay', 'sure', 'thanks', 'thank',  # Responses
                'flight', 'jet', 'plane', 'book', 'need',  # Travel words
                'from', 'to', 'at', 'on', 'the', 'a', 'an',  # Articles/prepositions
                '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',  # Numbers
            ]
            
            if not any(indicator in lower for indicator in non_name_indicators):
                # Looks like it could be a name - capitalize properly
                name = ' '.join(word.capitalize() for word in words)
                print(f"📝 Detected standalone name: {name}")
                return name
        
        return None

    def _extract_with_regex(self, message: str) -> LeadState:
        """Simple regex-based extraction for development/testing."""
        msg_lower = message.lower()
        extracted = LeadState()

        # Extract email
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', message)
        if email_match:
            extracted.email = email_match.group()

        # Extract route_from (from X, departing X, leaving X)
        from_patterns = [
            r'from\s+([A-Z][a-zA-Z\s]+?)(?:\s+to|\s*$|,|\.|!|\?)',
            r'departing\s+([A-Z][a-zA-Z\s]+?)(?:\s+to|\s*$|,|\.|!|\?)',
            r'leaving\s+([A-Z][a-zA-Z\s]+?)(?:\s+to|\s*$|,|\.|!|\?)',
        ]
        for pattern in from_patterns:
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                extracted.route_from = match.group(1).strip()
                break

        # Extract route_to (to X, going to X, heading to X)
        to_patterns = [
            r'to\s+([A-Z][a-zA-Z\s]+?)(?:\s+on|\s+next|\s*$|,|\.|!|\?)',
            r'going\s+to\s+([A-Z][a-zA-Z\s]+?)(?:\s+on|\s+next|\s*$|,|\.|!|\?)',
            r'heading\s+to\s+([A-Z][a-zA-Z\s]+?)(?:\s+on|\s+next|\s*$|,|\.|!|\?)',
        ]
        for pattern in to_patterns:
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                extracted.route_to = match.group(1).strip()
                break

        # Extract date_time
        date_patterns = [
            r'(next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month))',
            r'(tomorrow|today)',
            r'((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)',
            r'(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)',
            r'(this\s+(?:weekend|week|month))',
            r'(in\s+(?:a\s+)?(?:\d+\s+)?(?:days?|weeks?|months?))',
        ]
        for pattern in date_patterns:
            match = re.search(pattern, msg_lower)
            if match:
                extracted.date_time = match.group(1)
                break

        # Extract pax (number of people)
        pax_patterns = [
            r'(\d+)\s*(?:people|passengers|persons|of\s+us|pax)',
            r'(?:just\s+)?me(?:\s+and\s+(\d+))?',
            r'(\d+)\s*(?:adults?|guests?)',
            r'(?:party\s+of|group\s+of)\s*(\d+)',
            r'two\s+of\s+us',
            r'three\s+of\s+us',
            r'four\s+of\s+us',
        ]
        for pattern in pax_patterns:
            match = re.search(pattern, msg_lower)
            if match:
                if 'just me' in msg_lower or 'only me' in msg_lower:
                    extracted.pax = 1
                elif 'two of us' in msg_lower:
                    extracted.pax = 2
                elif 'three of us' in msg_lower:
                    extracted.pax = 3
                elif 'four of us' in msg_lower:
                    extracted.pax = 4
                elif match.group(1):
                    try:
                        extracted.pax = int(match.group(1))
                    except ValueError:
                        pass
                break

        # Extract name (I'm X, my name is X, this is X, it's X, name's X)
        name_patterns = [
            r"(?:i'm|i am|my name is|this is|it's|name's|name is)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z]?[a-zA-Z]+)?)",
            r"(?:call me)\s+([A-Z][a-zA-Z]+)",
            # Also try lowercase with common patterns
            r"(?:i'm|i am|my name is)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)",
        ]
        for pattern in name_patterns:
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                name = match.group(1).strip()
                # Capitalize properly and filter out common non-name words
                non_names = {'looking', 'interested', 'trying', 'wanting', 'going', 'flying', 
                            'booking', 'here', 'ready', 'calling', 'reaching', 'contacting'}
                if name.lower() not in non_names and len(name) > 1:
                    extracted.name = name.title()  # Capitalize properly
                    break

        # Extract special requests
        special_requests = self._extract_special_requests(message)
        if special_requests:
            extracted.special_requests = special_requests

        # Log what was extracted for debugging
        extracted_fields = {k: v for k, v in extracted.model_dump().items() if v}
        if extracted_fields:
            print(f"📝 Extracted: {extracted_fields}")

        return extracted
    
    def _extract_special_requests(self, message: str) -> list:
        """Extract special requests from message."""
        msg_lower = message.lower().strip()
        requests = []
        
        # Check for negative responses (no special requests)
        no_request_patterns = [
            r'^no$', r'^none$', r'^nothing$', r'^nope$',
            r'^no thanks?$', r'^nothing special$', r'^no special',
            r"^that'?s? (?:all|it)$", r'^all good$', r'^all set$',
            r'^not really$', r'^not at (?:this|the) time$',
            r"^i'?m? good$", r'^we\'?re good$',
            r'^no,?\s*(?:that\'?s?)?\s*(?:all|it)?$',
        ]
        
        for pattern in no_request_patterns:
            if re.search(pattern, msg_lower):
                return ["none"]  # Marker to indicate we asked and they have no requests
        
        # Check for specific request keywords
        request_keywords = {
            'catering': ['catering', 'food', 'meal', 'dinner', 'lunch', 'breakfast', 'snack', 'cuisine', 'chef'],
            'dietary': ['vegetarian', 'vegan', 'kosher', 'halal', 'gluten', 'allergy', 'allergies', 'dietary'],
            'ground transport': ['limo', 'limousine', 'car service', 'ground transport', 'pickup', 'driver', 'chauffeur'],
            'pet': ['pet', 'dog', 'cat', 'animal'],
            'celebration': ['anniversary', 'birthday', 'celebration', 'honeymoon', 'special occasion', 'champagne', 'flowers'],
            'wifi': ['wifi', 'internet', 'connectivity'],
            'child': ['child', 'children', 'kids', 'baby', 'infant', 'car seat'],
            'medical': ['medical', 'wheelchair', 'oxygen', 'nurse', 'doctor'],
            'luggage': ['luggage', 'bags', 'golf', 'ski', 'equipment', 'oversized'],
        }
        
        for category, keywords in request_keywords.items():
            for keyword in keywords:
                if keyword in msg_lower:
                    # Extract the relevant part of the message
                    requests.append(message.strip())
                    break
            if requests:
                break  # Only add once
        
        return requests


# Lazy singleton instance
_extractor_service = None


def get_extractor_service():
    global _extractor_service
    if _extractor_service is None:
        _extractor_service = ExtractorService()
    return _extractor_service


# For backwards compatibility
class ExtractorServiceProxy:
    def __getattr__(self, name):
        return getattr(get_extractor_service(), name)


extractor_service = ExtractorServiceProxy()
