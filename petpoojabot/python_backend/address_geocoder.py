"""
Address Geocoder — converts spoken addresses to lat/lng coordinates
using OpenStreetMap Nominatim (free, no API key required).
"""
import requests
import re


NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "PetpoojaBot/1.0 (voice-ordering-app)"


def geocode_address(address_text: str, default_city: str = "Surat") -> dict | None:
    """
    Geocode a spoken address string to lat/lng coordinates.
    
    Args:
        address_text: spoken address like "702 lake view apartments adajan surat"
        default_city: append to query if no city detected
        
    Returns:
        dict with lat, lng, display_name, and area. None if not found.
    """
    # Clean up the spoken text
    cleaned = address_text.strip()
    
    # If no city name detected, append default
    common_cities = ["surat", "ahmedabad", "mumbai", "delhi", "gurgaon", "pune", "bangalore"]
    has_city = any(city in cleaned.lower() for city in common_cities)
    
    query = cleaned if has_city else f"{cleaned}, {default_city}"
    
    print(f"🗺️ [Geocoder] Geocoding: '{query}'")
    
    try:
        response = requests.get(
            NOMINATIM_URL,
            params={
                "q": query,
                "format": "json",
                "limit": 1,
                "countrycodes": "in",  # Restrict to India
                "addressdetails": 1,
            },
            headers={"User-Agent": USER_AGENT},
            timeout=5,
        )
        
        results = response.json()
        
        if not results:
            print(f"⚠️ [Geocoder] No results for: '{query}'")
            # Try with just the city if detailed query failed
            if default_city.lower() not in query.lower():
                return geocode_address(f"{query}, {default_city}")
            return None
        
        result = results[0]
        lat = float(result["lat"])
        lng = float(result["lon"])
        display_name = result.get("display_name", query)
        
        # Extract area from address details
        address_details = result.get("address", {})
        area = (
            address_details.get("suburb")
            or address_details.get("neighbourhood")
            or address_details.get("city_district")
            or address_details.get("city")
            or ""
        )
        
        geo_result = {
            "lat": lat,
            "lng": lng,
            "display_name": display_name,
            "area": area,
            "raw_query": query,
        }
        
        print(f"✅ [Geocoder] Found: {area} ({lat:.4f}, {lng:.4f})")
        return geo_result
        
    except requests.exceptions.Timeout:
        print("❌ [Geocoder] Request timed out")
        return None
    except Exception as e:
        print(f"❌ [Geocoder] Error: {e}")
        return None
