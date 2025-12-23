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
    
    # Patterns that indicate user is EXPRESSING INTEREST (NOT requesting alternatives)
    # These must be checked FIRST to prevent false positives in AIRCRAFT_QUERY_PATTERNS
    AIRCRAFT_INTEREST_PATTERNS = [
        r"\b(interested\s+in|considering|thinking\s+about|looking\s+at)\s+(?:the\s+)?([A-Za-z0-9\s]+(?:G\d+|Citation|Challenger|Global|Phenom|Falcon|Learjet|Praetor)[A-Za-z0-9\s]*)",
        r"\b([A-Za-z0-9\s]+(?:G\d+|Citation|Challenger|Global|Phenom|Falcon|Learjet|Praetor)[A-Za-z0-9\s]*)\s+(looks?\s+(good|great|nice|interesting|appealing)|sounds?\s+(good|great|interesting))",
        r"\btell\s+me\s+more\s+about\s+(?:the\s+)?([A-Za-z0-9\s]+(?:G\d+|Citation|Challenger|Global|Phenom|Falcon|Learjet|Praetor)[A-Za-z0-9\s]*)",
        r"\b(what\s+about|how\s+about)\s+(?:the\s+)?([A-Za-z0-9\s]+(?:G\d+|Citation|Challenger|Global|Phenom|Falcon|Learjet|Praetor)[A-Za-z0-9\s]*)",
    ]
    
    # Patterns that indicate user wants to see aircraft options (REQUEST for alternatives)
    # CRITICAL: These must NOT match aircraft names alone - only explicit request phrases
    AIRCRAFT_QUERY_PATTERNS = [
        # Direct questions about aircraft
        r"\b(what|which)\s+(jets?|aircraft|planes?|options?)\s+(?:are\s+)?(?:available|do\s+you\s+have)\b",
        r"\bshow\s+(me\s+)?(the\s+)?(jets?|aircraft|planes?|options?)\b",
        r"\b(available|recommend|suggest)\s+(jets?|aircraft|planes?)\b",
        r"\bwhat\s+(do\s+you\s+)?(have|offer|recommend)\s+(?:for|available)\b",
        r"\b(let\s+me\s+)?see\s+(the\s+)?(jets?|aircraft|options?)\b",
        
        # Size preferences (explicit requests)
        r"\b(bigger|larger|more\s+spacious)\s+(jets?|aircraft|planes?|options?)?\s+(?:available|do\s+you\s+have)\b",
        r"\b(smaller|compact|efficient)\s+(jets?|aircraft|planes?|options?)?\s+(?:available|do\s+you\s+have)\b",
        r"\b(need|want)\s+(a\s+)?(big|large|spacious)\s+(one|jet|plane|aircraft)?\b",
        r"\b(need|want)\s+(a\s+)?(small|compact)\s+(one|jet|plane|aircraft)?\b",
        
        # Category mentions (only when asking for options)
        r"\b(light\s+jet|midsize|mid-size|super\s+mid|large\s+cabin|ultra\s+long\s+range)\s+(?:available|options?)\b",
        
        # Comparative queries (explicit requests for alternatives)
        r"\b(different|other|alternative)\s+(jets?|aircraft|planes?|options?)\b",
        r"\b(more|additional)\s+options?\b",
        r"\bwhat\s+else\s+(?:do\s+you\s+have|is\s+available)\b",
        
        # Price inquiries (often implies wanting to see options)
        r"\b(how\s+much|cost|price|pricing|rates?|cheapest|affordable|budget)\s+(?:for|are|do\s+you\s+have)\s+(?:jets?|aircraft|planes?|options?)\b",
        
        # Capacity related (explicit questions)
        r"\b(what|which)\s+(jets?|aircraft)\s+(?:fits?|accommodate|hold)\s+\d+\s+(?:people|passengers|guests|pax)\b",
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
    
    # Aircraft Navigation Intent Patterns
    AIRCRAFT_BIGGER_PATTERNS = [
        r"\b(bigger|larger)\s+(jets?|aircraft|planes?|options?)\b",
        r"\b(upgrade\s+the\s+jet|bigger\s+than)\b",
        r"\b(show\s+me\s+)?(bigger|larger)\b",
        r"\b(more\s+spacious|more\s+room)\s+(jets?|aircraft|options?)?\b",
    ]
    
    AIRCRAFT_SMALLER_PATTERNS = [
        r"\b(smaller|more\s+compact)\s+(jets?|aircraft|planes?|options?)\b",
        r"\b(smaller\s+than|downgrade)\b",
        r"\b(show\s+me\s+)?(smaller|compact)\b",
        r"\b(any\s+)?smaller\s+(jets?|aircraft|options?)?\b",
    ]
    
    AIRCRAFT_RECOMMENDED_PATTERNS = [
        r"\b(recommended|best\s+options?|what\s+do\s+you\s+recommend)\b",
        r"\b(go\s+back\s+to\s+)?recommended\s+(jets?|aircraft|options?)?\b",
        r"\b(show\s+me\s+)?recommended\b",
        r"\b(best\s+for\s+this\s+trip|recommendations?)\b",
    ]
    
    AIRCRAFT_PREVIOUS_PATTERNS = [
        r"\b(previous|earlier|last)\s+(jets?|aircraft|planes?|options?|list)\b",
        r"\b(go\s+back|show\s+earlier|show\s+previous)\b",
        r"\b(show\s+me\s+)?previous\s+(jets?|aircraft|options?)?\b",
        r"\b(bring\s+back|restore)\s+(the\s+)?(previous|earlier|last)\b",
    ]
    
    def detect_aircraft_interest(self, message: str) -> bool:
        """
        Detect if user is EXPRESSING INTEREST in a specific aircraft.
        This is NOT a request for alternatives - just interest.
        
        Returns:
            True if user is expressing interest (not requesting alternatives)
        """
        message_lower = message.lower().strip()
        
        # Check for interest patterns first
        for pattern in self.AIRCRAFT_INTEREST_PATTERNS:
            if re.search(pattern, message_lower):
                return True
        
        return False
    
    def detect_aircraft_intent(self, message: str) -> Tuple[bool, Optional[str]]:
        """
        Detect if user is REQUESTING to see aircraft options (alternatives).
        This is different from expressing interest.
        
        Returns:
            Tuple of (wants_aircraft: bool, preference: Optional[str])
            wants_aircraft = True means user explicitly asked for alternatives/options
            preference can be: "larger", "smaller", "cheapest", "fastest", or None
        """
        message_lower = message.lower().strip()
        
        # CRITICAL: Check for interest first - if interest detected, do NOT set wants_aircraft
        if self.detect_aircraft_interest(message):
            # User is expressing interest, NOT requesting alternatives
            return False, None
        
        # Check if message is explicitly asking about aircraft options
        wants_aircraft = False
        for pattern in self.AIRCRAFT_QUERY_PATTERNS:
            if re.search(pattern, message_lower):
                wants_aircraft = True
                break
        
        # Detect preference (only if wants_aircraft is True)
        preference = None
        
        if wants_aircraft:
            for pattern in self.LARGER_PATTERNS:
                if re.search(pattern, message_lower):
                    preference = "larger"
                    break
            
            if not preference:
                for pattern in self.SMALLER_PATTERNS:
                    if re.search(pattern, message_lower):
                        preference = "smaller"
                        break
            
            if not preference:
                for pattern in self.CHEAPEST_PATTERNS:
                    if re.search(pattern, message_lower):
                        preference = "cheapest"
                        break
            
            if not preference:
                for pattern in self.FASTEST_PATTERNS:
                    if re.search(pattern, message_lower):
                        preference = "fastest"
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
    
    def detect_aircraft_navigation_intent(self, message: str) -> Optional[str]:
        """
        Detect aircraft navigation intent: BIGGER, SMALLER, RECOMMENDED, or PREVIOUS.
        
        Returns:
            "AIRCRAFT_BIGGER", "AIRCRAFT_SMALLER", "AIRCRAFT_RECOMMENDED", 
            "AIRCRAFT_PREVIOUS", or None
        """
        message_lower = message.lower().strip()
        
        # Check in priority order: RECOMMENDED, PREVIOUS, BIGGER, SMALLER
        # (More specific patterns first)
        
        for pattern in self.AIRCRAFT_RECOMMENDED_PATTERNS:
            if re.search(pattern, message_lower):
                return "AIRCRAFT_RECOMMENDED"
        
        for pattern in self.AIRCRAFT_PREVIOUS_PATTERNS:
            if re.search(pattern, message_lower):
                return "AIRCRAFT_PREVIOUS"
        
        for pattern in self.AIRCRAFT_BIGGER_PATTERNS:
            if re.search(pattern, message_lower):
                return "AIRCRAFT_BIGGER"
        
        for pattern in self.AIRCRAFT_SMALLER_PATTERNS:
            if re.search(pattern, message_lower):
                return "AIRCRAFT_SMALLER"
        
        return None


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

