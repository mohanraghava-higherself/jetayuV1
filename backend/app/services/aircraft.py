"""
Aircraft Service
Manages aircraft data, pricing, and recommendations.
All aircraft knowledge lives here in the backend.
"""

from typing import List, Dict, Optional
from pydantic import BaseModel


class Aircraft(BaseModel):
    """Aircraft model with all details including pricing."""
    id: str
    name: str
    manufacturer: str
    category: str  # Light, Midsize, Super Mid, Large Cabin, Ultra Long Range
    capacity: int  # Max passengers
    range_nm: int  # Range in nautical miles
    speed_kph: int  # Cruise speed in km/h
    price_per_hour: int  # USD per flight hour
    base_price: int  # Base charter price USD (for typical 2-3 hour flight)
    description: str
    features: List[str]
    image_url: str
    interior_images: List[str]


# Complete aircraft fleet database
AIRCRAFT_FLEET: List[Aircraft] = [
    # Light Jets (1-6 passengers)
    Aircraft(
        id="citation-cj4",
        name="Citation CJ4",
        manufacturer="Cessna",
        category="Light",
        capacity=6,
        range_nm=2165,
        speed_kph=830,
        price_per_hour=3500,
        base_price=15000,
        description="Perfect for quick regional trips. Efficient and comfortable for small groups.",
        features=["Wi-Fi", "Refreshment center", "Leather seating", "USB charging"],
        image_url="https://images.unsplash.com/photo-1569629743817-70d8db6c323b?w=600&h=400&fit=crop",
        interior_images=[
            "https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=400&h=300&fit=crop"
        ],
    ),
    Aircraft(
        id="phenom-300e",
        name="Phenom 300E",
        manufacturer="Embraer",
        category="Light",
        capacity=7,
        range_nm=2010,
        speed_kph=861,
        price_per_hour=3800,
        base_price=16500,
        description="Best-selling light jet. Outstanding performance with exceptional cabin comfort.",
        features=["Full lavatory", "Wi-Fi", "Entertainment system", "Baggage space"],
        image_url="https://images.unsplash.com/photo-1559628233-100c798642d4?w=600&h=400&fit=crop",
        interior_images=[
            "https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=400&h=300&fit=crop"
        ],
    ),
    
    # Midsize Jets (6-8 passengers)
    Aircraft(
        id="citation-latitude",
        name="Citation Latitude",
        manufacturer="Cessna",
        category="Midsize",
        capacity=8,
        range_nm=2700,
        speed_kph=872,
        price_per_hour=4500,
        base_price=22000,
        description="Spacious midsize with flat-floor cabin. Ideal for business travel.",
        features=["Stand-up cabin", "Flat floor", "Full galley", "Wi-Fi", "Enclosed lavatory"],
        image_url="https://images.unsplash.com/photo-1583416750470-965b2707b355?w=600&h=400&fit=crop",
        interior_images=[
            "https://images.unsplash.com/photo-1583416750470-965b2707b355?w=400&h=300&fit=crop"
        ],
    ),
    Aircraft(
        id="learjet-75",
        name="Learjet 75 Liberty",
        manufacturer="Bombardier",
        category="Midsize",
        capacity=8,
        range_nm=2080,
        speed_kph=859,
        price_per_hour=4200,
        base_price=20000,
        description="Iconic performance with legendary Learjet speed and style.",
        features=["High-speed Wi-Fi", "Entertainment", "Full refreshment center"],
        image_url="https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=600&h=400&fit=crop",
        interior_images=[
            "https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=400&h=300&fit=crop"
        ],
    ),
    
    # Super Midsize Jets (8-10 passengers)
    Aircraft(
        id="citation-longitude",
        name="Citation Longitude",
        manufacturer="Cessna",
        category="Super Mid",
        capacity=12,
        range_nm=3500,
        speed_kph=890,
        price_per_hour=5500,
        base_price=32000,
        description="Super midsize with transatlantic capability. Whisper-quiet cabin.",
        features=["Stand-up cabin", "Flat floor", "Full galley", "Dual-zone climate", "Quiet cabin"],
        image_url="https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=600&h=400&fit=crop",
        interior_images=[
            "https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=400&h=300&fit=crop"
        ],
    ),
    Aircraft(
        id="challenger-350",
        name="Challenger 350",
        manufacturer="Bombardier",
        category="Super Mid",
        capacity=10,
        range_nm=3200,
        speed_kph=870,
        price_per_hour=5800,
        base_price=35000,
        description="Wide-body comfort with excellent range. Perfect for coast-to-coast.",
        features=["Wide cabin", "Full galley", "Entertainment suite", "Wi-Fi"],
        image_url="https://images.unsplash.com/photo-1583416750470-965b2707b355?w=600&h=400&fit=crop",
        interior_images=[
            "https://images.unsplash.com/photo-1583416750470-965b2707b355?w=400&h=300&fit=crop"
        ],
    ),
    Aircraft(
        id="praetor-600",
        name="Praetor 600",
        manufacturer="Embraer",
        category="Super Mid",
        capacity=12,
        range_nm=4018,
        speed_kph=863,
        price_per_hour=5600,
        base_price=33000,
        description="Newest super-midsize with longest range in class. Stone floors available.",
        features=["Fly-by-wire", "Ka-band Wi-Fi", "Full galley", "Bespoke interior options"],
        image_url="https://images.unsplash.com/photo-1559628233-100c798642d4?w=600&h=400&fit=crop",
        interior_images=[
            "https://images.unsplash.com/photo-1559628233-100c798642d4?w=400&h=300&fit=crop"
        ],
    ),
    
    # Large Cabin Jets (12-19 passengers)
    Aircraft(
        id="gulfstream-g650",
        name="Gulfstream G650",
        manufacturer="Gulfstream",
        category="Large Cabin",
        capacity=19,
        range_nm=7000,
        speed_kph=956,
        price_per_hour=9500,
        base_price=85000,
        description="Flagship large-cabin. Exceptional range and the ultimate in luxury.",
        features=["Full bedroom option", "Shower", "Full galley", "Multiple zones", "Ultra-quiet"],
        image_url="https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=600&h=400&fit=crop",
        interior_images=[
            "https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=400&h=300&fit=crop",
            "https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=400&h=300&fit=crop",
        ],
    ),
    Aircraft(
        id="falcon-8x",
        name="Falcon 8X",
        manufacturer="Dassault",
        category="Large Cabin",
        capacity=16,
        range_nm=6450,
        speed_kph=900,
        price_per_hour=8500,
        base_price=75000,
        description="Trijet reliability with elegant French design. Access to challenging airports.",
        features=["Three engines", "Short-field capability", "Skylight", "Full galley"],
        image_url="https://images.unsplash.com/photo-1583416750470-965b2707b355?w=600&h=400&fit=crop",
        interior_images=[
            "https://images.unsplash.com/photo-1583416750470-965b2707b355?w=400&h=300&fit=crop"
        ],
    ),
    Aircraft(
        id="challenger-650",
        name="Challenger 650",
        manufacturer="Bombardier",
        category="Large Cabin",
        capacity=12,
        range_nm=4000,
        speed_kph=870,
        price_per_hour=7000,
        base_price=55000,
        description="Proven wide-body workhorse. Exceptional cabin comfort for transcontinental flights.",
        features=["Wide cabin", "Full stand-up", "Complete galley", "Vision flight deck"],
        image_url="https://images.unsplash.com/photo-1569629743817-70d8db6c323b?w=600&h=400&fit=crop",
        interior_images=[
            "https://images.unsplash.com/photo-1569629743817-70d8db6c323b?w=400&h=300&fit=crop"
        ],
    ),
    
    # Ultra Long Range (14-19 passengers)
    Aircraft(
        id="global-7500",
        name="Global 7500",
        manufacturer="Bombardier",
        category="Ultra Long Range",
        capacity=17,
        range_nm=7700,
        speed_kph=920,
        price_per_hour=12000,
        base_price=120000,
        description="World's largest and longest-range business jet. Four living spaces.",
        features=["Master suite", "Full kitchen", "Crew rest", "Four living zones", "Nuage seats"],
        image_url="https://images.unsplash.com/photo-1583416750470-965b2707b355?w=600&h=400&fit=crop",
        interior_images=[
            "https://images.unsplash.com/photo-1583416750470-965b2707b355?w=400&h=300&fit=crop",
            "https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=400&h=300&fit=crop",
        ],
    ),
    Aircraft(
        id="gulfstream-g700",
        name="Gulfstream G700",
        manufacturer="Gulfstream",
        category="Ultra Long Range",
        capacity=19,
        range_nm=7500,
        speed_kph=956,
        price_per_hour=13000,
        base_price=130000,
        description="The pinnacle of private aviation. Tallest, widest, longest cabin ever.",
        features=["Five living areas", "Master suite", "Full shower", "Circadian lighting"],
        image_url="https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=600&h=400&fit=crop",
        interior_images=[
            "https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=400&h=300&fit=crop",
        ],
    ),
]


class AircraftService:
    """Service for aircraft recommendations and pricing."""
    
    def __init__(self):
        self.fleet = {aircraft.id: aircraft for aircraft in AIRCRAFT_FLEET}
    
    def get_all_aircraft(self) -> List[Aircraft]:
        """Get all available aircraft."""
        return AIRCRAFT_FLEET
    
    def get_aircraft_by_id(self, aircraft_id: str) -> Optional[Aircraft]:
        """Get specific aircraft by ID."""
        return self.fleet.get(aircraft_id)
    
    def get_suitable_aircraft(
        self, 
        pax: int, 
        route_distance_nm: Optional[int] = None,
        preference: Optional[str] = None  # "larger", "smaller", "cheapest", "fastest"
    ) -> List[Aircraft]:
        """
        Get aircraft suitable for the given parameters.
        Returns up to 3 best matches.
        """
        # Filter by capacity (aircraft must fit all passengers)
        suitable = [a for a in AIRCRAFT_FLEET if a.capacity >= pax]
        
        # Filter by range if we know the distance
        if route_distance_nm:
            suitable = [a for a in suitable if a.range_nm >= route_distance_nm]
        
        if not suitable:
            # If nothing fits, return the largest aircraft
            return sorted(AIRCRAFT_FLEET, key=lambda x: x.capacity, reverse=True)[:3]
        
        # Apply preference sorting
        if preference == "larger":
            suitable = sorted(suitable, key=lambda x: x.capacity, reverse=True)
        elif preference == "smaller":
            suitable = sorted(suitable, key=lambda x: x.capacity)
        elif preference == "cheapest":
            suitable = sorted(suitable, key=lambda x: x.base_price)
        elif preference == "fastest":
            suitable = sorted(suitable, key=lambda x: x.speed_kph, reverse=True)
        else:
            # Default: balance of efficiency (not too big, not too small)
            # Sort by how close capacity is to pax count, then by price
            suitable = sorted(suitable, key=lambda x: (x.capacity - pax, x.base_price))
        
        # Return top 3 recommendations
        return suitable[:3]
    
    def estimate_price(
        self, 
        aircraft: Aircraft, 
        route_from: str, 
        route_to: str,
        estimated_hours: float = 2.5
    ) -> Dict:
        """
        Estimate pricing for a specific aircraft and route.
        In V1, we use base estimates. Production would use real route data.
        """
        # Simple estimation based on hourly rate
        flight_cost = int(aircraft.price_per_hour * estimated_hours)
        
        # Add typical fees (simplified for V1)
        fees = int(flight_cost * 0.15)  # ~15% for landing, handling, etc.
        
        return {
            "base_charter": flight_cost,
            "estimated_fees": fees,
            "total_estimate": flight_cost + fees,
            "price_range_low": int((flight_cost + fees) * 0.9),
            "price_range_high": int((flight_cost + fees) * 1.2),
        }
    
    def get_aircraft_for_response(
        self,
        pax: Optional[int] = None,
        preference: Optional[str] = None,
        route_from: Optional[str] = None,
        route_to: Optional[str] = None,
    ) -> List[Dict]:
        """
        Get aircraft data formatted for API response.
        Includes pricing estimates.
        """
        # Default to 4 passengers if not specified
        passenger_count = pax or 4
        
        # Get suitable aircraft
        aircraft_list = self.get_suitable_aircraft(
            pax=passenger_count,
            preference=preference
        )
        
        # Format for response with pricing
        result = []
        for aircraft in aircraft_list:
            pricing = self.estimate_price(
                aircraft, 
                route_from or "Unknown",
                route_to or "Unknown"
            )
            
            result.append({
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
        
        return result
    
    def get_aircraft_summary_for_llm(self) -> str:
        """
        Get a summary of all aircraft for the LLM to reference.
        This gives the concierge knowledge about the fleet.
        """
        summary = "AVAILABLE AIRCRAFT FLEET:\n\n"
        
        for category in ["Light", "Midsize", "Super Mid", "Large Cabin", "Ultra Long Range"]:
            category_aircraft = [a for a in AIRCRAFT_FLEET if a.category == category]
            if category_aircraft:
                summary += f"=== {category.upper()} JETS ===\n"
                for a in category_aircraft:
                    summary += f"""
• {a.name} ({a.manufacturer})
  - Passengers: up to {a.capacity}
  - Range: {a.range_nm} nm | Speed: {a.speed_kph} km/h
  - Starting from: ${a.base_price:,}
  - {a.description}
"""
                summary += "\n"
        
        return summary


# Singleton instance
_aircraft_service = None


def get_aircraft_service() -> AircraftService:
    global _aircraft_service
    if _aircraft_service is None:
        _aircraft_service = AircraftService()
    return _aircraft_service


# Proxy for backwards compatibility
class AircraftServiceProxy:
    def __getattr__(self, name):
        return getattr(get_aircraft_service(), name)


aircraft_service = AircraftServiceProxy()

