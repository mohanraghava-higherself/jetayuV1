"""
Intent Detection Service
Detects user intent for aircraft-related queries and booking intent.
"""

import re
from typing import Optional, Tuple


class IntentDetector:
    """
    Detects user intents:
    - Aircraft queries (wants to see jets)
    - Booking intent (wants to proceed with booking)
    """
    
    # Patterns that indicate user wants to PROCEED with booking
    BOOKING_INTENT_PATTERNS = [
        # Direct booking confirmations
        r"\b(go\s+ahead|proceed|let'?s?\s+(do\s+it|book|proceed))\b",
        r"\b(book\s+(it|this|that|the\s+flight|the\s+jet))\b",
        r"\b(i'?d?\s+like\s+to\s+(book|proceed|confirm))\b",
        r"\b(yes,?\s+(please\s+)?(book|proceed|confirm))\b",
        r"\b(confirm\s+(the\s+)?(booking|flight|reservation))\b",
        r"\b(place\s+(the\s+)?(request|booking|order))\b",
        r"\b(sounds?\s+good,?\s+(let'?s?\s+)?(go|do\s+it|proceed|book))\b",
        r"\b(that('?s|\s+is)\s+(perfect|great|fine),?\s*(go\s+ahead|proceed|book)?)\b",
        r"\b(i'?m\s+(ready|interested)\s+to\s+(book|proceed))\b",
        r"\b(lock\s+(it\s+)?in)\b",
        r"\b(reserve\s+(it|this|the))\b",
        r"\b(make\s+(the\s+)?(reservation|booking))\b",
        r"\b(finalize|finalise)\b",
        # Simple affirmations in booking context
        r"^(yes|yeah|yep|yup|sure|ok|okay|absolutely|definitely)[\.\!\,]?\s*$",
    ]
    
    # Patterns that indicate user wants to see aircraft options
    AIRCRAFT_QUERY_PATTERNS = [
        # Direct questions about aircraft
        r"\b(what|which)\s+(jets?|aircraft|planes?|options?)\b",
        r"\bshow\s+(me\s+)?(the\s+)?(jets?|aircraft|planes?|options?)\b",
        r"\b(available|recommend|suggest)\s+(jets?|aircraft|planes?)\b",
        r"\bwhat\s+(do\s+you\s+)?(have|offer|recommend)\b",
        r"\b(let\s+me\s+)?see\s+(the\s+)?(jets?|aircraft|options?)\b",
        
        # Size preferences
        r"\b(bigger|larger|more\s+spacious)\s+(jets?|aircraft|planes?|options?)?\b",
        r"\b(smaller|compact|efficient)\s+(jets?|aircraft|planes?|options?)?\b",
        r"\b(need|want)\s+(a\s+)?(big|large|spacious)\s+(one|jet|plane|aircraft)?\b",
        r"\b(need|want)\s+(a\s+)?(small|compact)\s+(one|jet|plane|aircraft)?\b",
        
        # Category mentions
        r"\b(light\s+jet|midsize|mid-size|super\s+mid|large\s+cabin|ultra\s+long\s+range)\b",
        r"\b(gulfstream|bombardier|cessna|citation|challenger|global|falcon|phenom)\b",
        
        # Comparative queries
        r"\b(different|other|alternative)\s+(jets?|aircraft|planes?|options?)\b",
        r"\b(more|additional)\s+options?\b",
        r"\bwhat\s+else\b",
        
        # Price inquiries (often implies wanting to see options)
        r"\b(how\s+much|cost|price|pricing|rates?|cheapest|affordable|budget)\b.*\b(jet|aircraft|plane|flight)?\b",
        
        # Capacity related
        r"\b(fits?|accommodate|hold)\s+\d+\s+(people|passengers|guests|pax)\b",
    ]
    
    # Patterns for size preferences
    LARGER_PATTERNS = [
        r"\b(bigger|larger|more\s+spacious|more\s+room|bigger\s+cabin)\b",
        r"\b(upgrade|premium|luxury|top\s+tier|best)\b",
        r"\b(large\s+cabin|ultra\s+long\s+range)\b",
        r"\b(gulfstream\s+g650|gulfstream\s+g700|global\s+7500)\b",
    ]
    
    SMALLER_PATTERNS = [
        r"\b(smaller|compact|efficient|economical|light\s+jet)\b",
        r"\b(just\s+)?(me|myself|two\s+of\s+us|couple)\b",
        r"\b(budget|affordable|cheaper)\b",
    ]
    
    CHEAPEST_PATTERNS = [
        r"\b(cheapest|lowest\s+price|budget|affordable|economical)\b",
        r"\b(best\s+(price|value|deal))\b",
        r"\b(save\s+money|cost\s+effective)\b",
    ]
    
    FASTEST_PATTERNS = [
        r"\b(fastest|quickest|speed|quick)\b",
        r"\b(urgent|rush|asap|emergency)\b",
        r"\b(get\s+there\s+fast)\b",
    ]
    
    def detect_aircraft_intent(self, message: str) -> Tuple[bool, Optional[str]]:
        """
        Detect if user is asking about aircraft.
        
        Returns:
            Tuple of (wants_aircraft: bool, preference: Optional[str])
            preference can be: "larger", "smaller", "cheapest", "fastest", or None
        """
        message_lower = message.lower().strip()
        
        # Check if message is asking about aircraft
        wants_aircraft = False
        for pattern in self.AIRCRAFT_QUERY_PATTERNS:
            if re.search(pattern, message_lower):
                wants_aircraft = True
                break
        
        # Detect preference
        preference = None
        
        for pattern in self.LARGER_PATTERNS:
            if re.search(pattern, message_lower):
                preference = "larger"
                wants_aircraft = True  # Preference implies intent
                break
        
        if not preference:
            for pattern in self.SMALLER_PATTERNS:
                if re.search(pattern, message_lower):
                    preference = "smaller"
                    wants_aircraft = True
                    break
        
        if not preference:
            for pattern in self.CHEAPEST_PATTERNS:
                if re.search(pattern, message_lower):
                    preference = "cheapest"
                    wants_aircraft = True
                    break
        
        if not preference:
            for pattern in self.FASTEST_PATTERNS:
                if re.search(pattern, message_lower):
                    preference = "fastest"
                    wants_aircraft = True
                    break
        
        return wants_aircraft, preference
    
    def detect_specific_aircraft_interest(self, message: str) -> Optional[str]:
        """
        Detect if user mentions a specific aircraft model.
        Returns the aircraft ID if found.
        """
        message_lower = message.lower()
        
        # Map of keywords to aircraft IDs
        aircraft_keywords = {
            "cj4": "citation-cj4",
            "citation cj4": "citation-cj4",
            "phenom 300": "phenom-300e",
            "phenom 300e": "phenom-300e",
            "latitude": "citation-latitude",
            "citation latitude": "citation-latitude",
            "learjet 75": "learjet-75",
            "learjet": "learjet-75",
            "longitude": "citation-longitude",
            "citation longitude": "citation-longitude",
            "challenger 350": "challenger-350",
            "praetor 600": "praetor-600",
            "praetor": "praetor-600",
            "g650": "gulfstream-g650",
            "gulfstream g650": "gulfstream-g650",
            "falcon 8x": "falcon-8x",
            "challenger 650": "challenger-650",
            "global 7500": "global-7500",
            "g700": "gulfstream-g700",
            "gulfstream g700": "gulfstream-g700",
        }
        
        for keyword, aircraft_id in aircraft_keywords.items():
            if keyword in message_lower:
                return aircraft_id
        
        return None

    def detect_booking_intent(self, message: str) -> bool:
        """
        Detect if user wants to proceed with booking.
        Returns True if booking intent is detected.
        """
        message_lower = message.lower().strip()
        
        for pattern in self.BOOKING_INTENT_PATTERNS:
            if re.search(pattern, message_lower):
                return True
        
        return False


# Singleton
_intent_detector = None


def get_intent_detector() -> IntentDetector:
    global _intent_detector
    if _intent_detector is None:
        _intent_detector = IntentDetector()
    return _intent_detector


# Proxy
class IntentDetectorProxy:
    def __getattr__(self, name):
        return getattr(get_intent_detector(), name)


intent_detector = IntentDetectorProxy()

