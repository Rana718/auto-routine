# Map Routing Logic - Route Optimization System

## Overview
The system uses **Nearest Neighbor Algorithm** (greedy approach) to optimize delivery routes for staff members visiting multiple stores. It calculates distances using the **Haversine formula** and generates optimized stop sequences.

---

## Backend Route Optimization

### 1. Distance Calculation (Haversine Formula)

```python
def calculate_distance(lat1, lon1, lat2, lon2) -> float:
    """
    Calculate distance between two GPS coordinates in kilometers
    Uses Haversine formula for spherical distance
    """
    # Convert to radians
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)² + cos(lat1) × cos(lat2) × sin(dlon/2)²
    c = 2 × asin(√a)
    distance_km = 6371 × c  # Earth radius = 6371 km
    
    return distance_km
```

**Example:**
- Store A: (35.6762, 139.6503) - Tokyo Station
- Store B: (35.6895, 139.6917) - Akihabara
- Distance: ~3.2 km

---

### 2. Nearest Neighbor Algorithm

```python
def nearest_neighbor_route(start_point, stores):
    """
    Greedy TSP approximation algorithm
    Always visits the nearest unvisited store
    
    Time Complexity: O(n²)
    Space Complexity: O(n)
    """
    result = []
    remaining = list(stores)
    current_lat, current_lng = start_point
    
    while remaining:
        # Find nearest unvisited store
        nearest_store = min(
            remaining,
            key=lambda s: calculate_distance(current_lat, current_lng, s.lat, s.lng)
        )
        
        # Visit this store
        result.append(nearest_store)
        current_lat, current_lng = nearest_store.lat, nearest_store.lng
        remaining.remove(nearest_store)
    
    return result
```

**Algorithm Steps:**
1. Start at staff's home/office location
2. Find the nearest unvisited store
3. Move to that store
4. Repeat until all stores visited
5. Optionally return to start location

**Example Route Generation:**
```
Start: Office (35.6762, 139.6503)
Stores to visit:
  - Store A: (35.6895, 139.6917) - 3.2 km away
  - Store B: (35.6580, 139.7016) - 4.1 km away
  - Store C: (35.6812, 139.7671) - 8.5 km away

Optimized Route:
  Office → Store A (3.2 km) → Store C (5.8 km) → Store B (7.3 km)
  Total: 16.3 km
```

---

### 3. Route Generation Process

```python
async def generate_route_for_staff(db, staff_id, target_date):
    """
    Complete route generation workflow
    """
    # 1. Get staff info and start location
    staff = await get_staff(staff_id)
    start_lat = staff.start_location_lat or 35.6762  # Default: Tokyo
    start_lng = staff.start_location_lng or 139.6503
    
    # 2. Get purchase list for the date
    purchase_list = await get_purchase_list(staff_id, target_date)
    
    # 3. Get unique stores to visit
    stores = await get_stores_from_purchase_list(purchase_list.list_id)
    # Returns: [(store_id, lat, lng, items_count), ...]
    
    # 4. Optimize route using Nearest Neighbor
    optimized_order = nearest_neighbor_route(
        start_point=(start_lat, start_lng),
        stores=stores
    )
    
    # 5. Calculate time estimates
    total_distance = 0.0
    estimated_time = 0
    prev_lat, prev_lng = start_lat, start_lng
    current_time = datetime.combine(target_date, time(10, 0))  # Start at 10:00 AM
    
    for store in optimized_order:
        # Calculate travel distance
        dist = calculate_distance(prev_lat, prev_lng, store.lat, store.lng)
        total_distance += dist
        
        # Estimate travel time (5 min per km)
        travel_time = int(dist * 5)
        current_time += timedelta(minutes=travel_time)
        
        # Create route stop
        create_route_stop(
            store_id=store.store_id,
            sequence=store.sequence,
            estimated_arrival=current_time,
            items_count=store.items_count
        )
        
        # Add shopping time (15 min per store)
        current_time += timedelta(minutes=15)
        estimated_time += travel_time + 15
        
        prev_lat, prev_lng = store.lat, store.lng
    
    # 6. Save route to database
    route = Route(
        staff_id=staff_id,
        route_date=target_date,
        total_distance_km=total_distance,
        estimated_time_minutes=estimated_time,
        route_status="not_started"
    )
    
    return route.route_id
```

---

### 4. Time Estimation Constants

```python
SHOPPING_TIME_PER_STORE = 15  # minutes
TRAVEL_TIME_PER_KM = 5        # minutes (12 km/h average speed)
START_TIME = "10:00"          # Default start time
```

**Example Time Calculation:**
```
Route: Office → Store A (3 km) → Store B (5 km) → Store C (4 km)

Office → Store A:
  - Travel: 3 km × 5 min/km = 15 min
  - Arrival: 10:15
  - Shopping: 15 min
  - Departure: 10:30

Store A → Store B:
  - Travel: 5 km × 5 min/km = 25 min
  - Arrival: 10:55
  - Shopping: 15 min
  - Departure: 11:10

Store B → Store C:
  - Travel: 4 km × 5 min/km = 20 min
  - Arrival: 11:30
  - Shopping: 15 min
  - Departure: 11:45

Total Time: 1 hour 45 minutes
Total Distance: 12 km
```

---

## Frontend Map Visualization

### 1. Map Component (Leaflet.js)

```typescript
// Uses OpenStreetMap tiles
// Library: Leaflet.js (react-leaflet)

interface RouteMapProps {
    stops: Stop[];                    // Array of store locations
    startLocation?: {                 // Staff start location
        lat: number;
        lng: number;
        name: string;
    };
}

function RouteMap({ stops, startLocation }) {
    // 1. Initialize map centered on route
    const map = L.map("route-map").setView(center, 13);
    
    // 2. Add OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
    
    // 3. Add start location marker (green)
    L.marker([startLocation.lat, startLocation.lng], { 
        icon: CurrentIcon 
    }).bindPopup("出発地点");
    
    // 4. Add store markers with sequence numbers
    stops.forEach((stop) => {
        const icon = getIconByStatus(stop.stop_status);
        L.marker([stop.latitude, stop.longitude], { icon })
            .bindPopup(`${stop.stop_sequence}. ${stop.store_name}`)
            .addTo(map);
    });
    
    // 5. Draw route line connecting all stops
    const routePoints = [startLocation, ...stops];
    L.polyline(routePoints, {
        color: "#14b8a6",      // Teal color
        weight: 3,
        opacity: 0.7,
        dashArray: "5, 10"     // Dashed line
    }).addTo(map);
    
    // 6. Auto-fit bounds to show all markers
    map.fitBounds(routePoints, { padding: [50, 50] });
}
```

### 2. Marker Icons

```typescript
// Marker colors indicate stop status:

DefaultIcon (Blue):
  - Status: "pending" (待機中)
  - Not yet visited

CurrentIcon (Green):
  - Status: "current" (現在地)
  - Staff is currently here

CompletedIcon (Grey):
  - Status: "completed" (完了)
  - Already visited

SkippedIcon (Yellow):
  - Status: "skipped" (スキップ)
  - Store was skipped
```

### 3. Map Features

```typescript
// Interactive Features:
- Click marker → Show popup with store details
- Zoom in/out with mouse wheel
- Pan by dragging
- Auto-center on route
- Responsive sizing

// Popup Information:
- Stop sequence number
- Store name
- Store address
- Items count
- Current status
```

---

## Route Status Flow

```
Route Lifecycle:

1. NOT_STARTED (未開始)
   ↓ [Staff clicks "Start Route"]
   
2. IN_PROGRESS (進行中)
   ↓ [Staff visits each store]
   
3. COMPLETED (完了)
   [All stops completed]

Alternative:
   CANCELLED (キャンセル)
   [Route cancelled by admin]
```

### Stop Status Flow

```
Stop Lifecycle:

1. PENDING (待機中)
   - Initial state
   - Not yet visited
   
2. CURRENT (現在地)
   - Staff is at this location
   - Actively shopping
   
3. COMPLETED (完了)
   - Items purchased
   - Ready to move to next stop
   
4. SKIPPED (スキップ)
   - Store closed/unavailable
   - Items not found
```

---

## API Endpoints for Routing

### Generate Route
```http
POST /api/routes/generate
Content-Type: application/json

{
  "staff_id": 1,
  "list_id": 123,
  "optimization_priority": "speed"  // or "distance", "balanced"
}

Response:
{
  "message": "ルートを生成しました",
  "route_id": 456,
  "optimization": "speed"
}
```

### Get Route Details
```http
GET /api/routes/456

Response:
{
  "route_id": 456,
  "staff_id": 1,
  "staff_name": "田中太郎",
  "route_date": "2025-12-26",
  "route_status": "in_progress",
  "total_distance_km": 12.5,
  "estimated_time_minutes": 105,
  "stops": [
    {
      "stop_id": 1,
      "store_id": 10,
      "store_name": "ヨドバシカメラ秋葉原",
      "store_address": "東京都千代田区...",
      "stop_sequence": 1,
      "stop_status": "completed",
      "items_count": 3,
      "estimated_arrival": "2025-12-26T10:15:00",
      "actual_arrival": "2025-12-26T10:12:00"
    },
    // ... more stops
  ]
}
```

### Update Stop Status
```http
PATCH /api/routes/456/stops/1
Content-Type: application/json

{
  "stop_status": "completed"
}
```

### Regenerate All Routes
```http
POST /api/routes/regenerate-all?route_date=2025-12-26

Response:
{
  "message": "2025-12-26の5件のルートを再生成しました",
  "routes_count": 5,
  "route_ids": [456, 457, 458, 459, 460]
}
```

---

## Optimization Priorities

### 1. Speed Priority (Default)
```python
# Minimize total time
# Considers: travel time + shopping time
# Best for: urgent deliveries, time-sensitive orders
```

### 2. Distance Priority
```python
# Minimize total distance
# Considers: only travel distance
# Best for: fuel efficiency, cost reduction
```

### 3. Balanced Priority
```python
# Balance between time and distance
# Considers: weighted combination
# Best for: general use cases
```

---

## Real-World Example

### Scenario: Staff Member Route for December 26, 2025

**Staff:** 田中太郎 (Tanaka Taro)
**Start Location:** Office in Shibuya (35.6580, 139.7016)
**Target Date:** 2025-12-26
**Start Time:** 10:00 AM

**Stores to Visit:**
1. ヨドバシカメラ秋葉原 (Yodobashi Akihabara)
   - Location: (35.6895, 139.6917)
   - Items: 3 products
   - Distance from office: 3.2 km

2. ビックカメラ新宿 (Bic Camera Shinjuku)
   - Location: (35.6938, 139.7036)
   - Items: 2 products
   - Distance from Yodobashi: 1.5 km

3. ドン・キホーテ渋谷 (Don Quijote Shibuya)
   - Location: (35.6612, 139.6980)
   - Items: 5 products
   - Distance from Bic Camera: 3.8 km

**Optimized Route:**
```
10:00 - Depart from Office (Shibuya)
        ↓ 3.2 km (16 min)
10:16 - Arrive at Yodobashi Akihabara
10:16 - 10:31 - Shopping (15 min, 3 items)
        ↓ 1.5 km (8 min)
10:39 - Arrive at Bic Camera Shinjuku
10:39 - 10:54 - Shopping (15 min, 2 items)
        ↓ 3.8 km (19 min)
11:13 - Arrive at Don Quijote Shibuya
11:13 - 11:28 - Shopping (15 min, 5 items)
11:28 - Route Complete

Total Distance: 8.5 km
Total Time: 1 hour 28 minutes
Total Items: 10 products
```

**Map Visualization:**
```
    Office (Shibuya) 🏢 [Green Marker - Start]
         ↓ (dashed line)
    ① Yodobashi Akihabara 📍 [Grey - Completed]
         ↓ (dashed line)
    ② Bic Camera Shinjuku 📍 [Green - Current]
         ↓ (dashed line)
    ③ Don Quijote Shibuya 📍 [Blue - Pending]
```

---

## Performance Considerations

### Algorithm Complexity
- **Nearest Neighbor:** O(n²) - Fast for practical use
- **Optimal TSP:** O(n!) - Too slow for real-time
- **Trade-off:** 10-20% longer than optimal, but instant results

### Scalability
- **Small routes (< 10 stops):** < 100ms
- **Medium routes (10-30 stops):** < 500ms
- **Large routes (30-50 stops):** < 2 seconds

### Database Optimization
```sql
-- Pre-calculate distance matrix for frequently visited stores
CREATE TABLE store_distance_matrix (
    from_store_id INT,
    to_store_id INT,
    distance_km DECIMAL(10, 2),
    PRIMARY KEY (from_store_id, to_store_id)
);

-- Index for fast route queries
CREATE INDEX idx_routes_date_staff ON routes(route_date, staff_id);
CREATE INDEX idx_stops_route_sequence ON route_stops(route_id, stop_sequence);
```

---

## Future Enhancements

### 1. Advanced Algorithms
- **2-opt optimization:** Improve route by swapping edges
- **Genetic algorithms:** Better solutions for large routes
- **Real-time traffic:** Integrate Google Maps API

### 2. Dynamic Routing
- **Live updates:** Adjust route based on store availability
- **Traffic avoidance:** Reroute around congestion
- **Priority changes:** Reorder stops for urgent items

### 3. Multi-Vehicle Routing
- **Fleet optimization:** Assign multiple staff members
- **Load balancing:** Distribute items evenly
- **Capacity constraints:** Consider vehicle limits

### 4. Machine Learning
- **Time prediction:** Learn actual shopping times
- **Store patterns:** Predict availability
- **Traffic patterns:** Historical data analysis
