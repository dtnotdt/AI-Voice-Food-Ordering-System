"""
Delivery Validator — checks if a delivery address is within restaurant's service radius.
Uses Haversine formula for distance calculation.
"""
import math


# ── Restaurant Configuration ──────────────────────────────────────────────
RESTAURANT_LOCATION = {
    "lat": 21.1702,
    "lng": 72.8311,
    "name": "PetPooja Kitchen, Surat"
}

MAX_DELIVERY_RADIUS_KM = 10.0  # Maximum delivery distance in kilometers

# ── Mock nearby stores (same as Address.jsx for consistency) ──────────────
STORES = [
    {"id": "S1", "name": "Adajan Kitchen", "lat": 21.1960, "lng": 72.7933},
    {"id": "S2", "name": "Vesu Outlet", "lat": 21.1550, "lng": 72.7700},
    {"id": "S3", "name": "Athwa Hub", "lat": 21.1850, "lng": 72.8200},
]


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points on Earth.
    
    Returns:
        Distance in kilometers.
    """
    R = 6371  # Earth's radius in km
    
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def find_nearest_store(lat: float, lng: float) -> dict:
    """Find the closest store to the given coordinates."""
    nearest = None
    min_distance = float("inf")
    
    for store in STORES:
        dist = haversine(lat, lng, store["lat"], store["lng"])
        if dist < min_distance:
            min_distance = dist
            nearest = {**store, "distance_km": round(dist, 2)}
    
    return nearest


def validate_delivery(lat: float, lng: float) -> dict:
    """
    Check if delivery coordinates are within service radius.
    
    Returns:
        dict with: within_range, distance_km, nearest_store, restaurant
    """
    distance = haversine(
        RESTAURANT_LOCATION["lat"], RESTAURANT_LOCATION["lng"],
        lat, lng
    )
    
    within_range = distance <= MAX_DELIVERY_RADIUS_KM
    nearest_store = find_nearest_store(lat, lng)
    
    result = {
        "within_range": within_range,
        "distance_km": round(distance, 2),
        "max_radius_km": MAX_DELIVERY_RADIUS_KM,
        "nearest_store": nearest_store,
        "restaurant": RESTAURANT_LOCATION,
    }
    
    status = "✅ WITHIN" if within_range else "❌ OUTSIDE"
    print(f"📍 [DeliveryValidator] {status} range: {distance:.2f}km (max: {MAX_DELIVERY_RADIUS_KM}km)")
    
    return result
