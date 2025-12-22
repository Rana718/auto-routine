/**
 * TypeScript types matching backend API schema
 */

// ============================================================================
// ENUMS
// ============================================================================

export type OrderStatus =
    | "pending"
    | "processing"
    | "assigned"
    | "in_progress"
    | "completed"
    | "partially_completed"
    | "failed"
    | "cancelled";

export type ItemStatus =
    | "pending"
    | "assigned"
    | "purchased"
    | "failed"
    | "discontinued"
    | "out_of_stock"
    | "restocking";

export type StockStatus =
    | "in_stock"
    | "low_stock"
    | "out_of_stock"
    | "discontinued"
    | "unknown";

export type PurchaseStatus =
    | "pending"
    | "in_progress"
    | "purchased"
    | "failed"
    | "skipped";

export type RouteStatus =
    | "not_started"
    | "in_progress"
    | "completed"
    | "cancelled";

export type StopStatus =
    | "pending"
    | "current"
    | "completed"
    | "skipped";

export type StaffStatus =
    | "active"
    | "en_route"
    | "idle"
    | "off_duty";

export type StaffRole = "buyer" | "supervisor" | "admin";

// ============================================================================
// AUTH
// ============================================================================

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    name: string;
    email: string;
    password: string;
}

export interface TokenResponse {
    access_token: string;
    token_type: string;
    user: UserResponse;
}

export interface UserResponse {
    staff_id: number;
    staff_name: string;
    email: string;
    role: StaffRole;
    status: StaffStatus;
}

// ============================================================================
// ORDERS
// ============================================================================

export interface Order {
    order_id: number;
    robot_in_order_id: string | null;
    mall_name: string | null;
    customer_name: string | null;
    order_date: string;
    order_status: OrderStatus;
    cutoff_time: string | null;
    target_purchase_date: string | null;
    created_at: string;
    updated_at: string;
}

export interface OrderItem {
    item_id: number;
    order_id: number;
    sku: string;
    product_name: string;
    quantity: number;
    unit_price: number | null;
    is_bundle: boolean;
    parent_item_id: number | null;
    item_status: ItemStatus;
    priority: string;
    created_at: string;
}

export interface OrderWithItems extends Order {
    items: OrderItem[];
}

export interface OrderStats {
    total_orders: number;
    pending_orders: number;
    assigned_orders: number;
    completed_orders: number;
    failed_orders: number;
}

export interface OrderCreate {
    robot_in_order_id?: string;
    mall_name?: string;
    customer_name?: string;
    order_date: string;
    target_purchase_date?: string;
}

// ============================================================================
// STAFF
// ============================================================================

export interface Staff {
    staff_id: number;
    staff_name: string;
    staff_code: string | null;
    email: string | null;
    phone: string | null;
    role: StaffRole;
    status: StaffStatus;
    start_location_name: string;
    current_location_name: string | null;
    max_daily_capacity: number;
    is_active: boolean;
    created_at: string;
}

export interface StaffWithStats extends Staff {
    assigned_orders: number;
    assigned_stores: number;
    completed_today: number;
}

export interface StaffStats {
    total_staff: number;
    active_today: number;
    en_route: number;
    completed_orders: number;
}

export interface StaffCreate {
    staff_name: string;
    staff_code?: string;
    email?: string;
    phone?: string;
    password?: string;
    role?: StaffRole;
    start_location_name?: string;
    max_daily_capacity?: number;
}

export interface StaffStatusUpdate {
    status: StaffStatus;
    current_location_name?: string;
    current_location_lat?: number;
    current_location_lng?: number;
}

// ============================================================================
// STORES
// ============================================================================

export interface Store {
    store_id: number;
    store_name: string;
    store_code: string | null;
    address: string | null;
    district: string | null;
    latitude: number | null;
    longitude: number | null;
    opening_hours: Record<string, string> | null;
    category: string | null;
    priority_level: number;
    is_active: boolean;
    created_at: string;
}

export interface StoreWithOrders extends Store {
    orders_today: number;
}

export interface StoreStats {
    total_stores: number;
    active_stores: number;
    stores_with_orders: number;
    total_orders_today: number;
}

export interface StoreCreate {
    store_name: string;
    store_code?: string;
    address?: string;
    district?: string;
    latitude?: number;
    longitude?: number;
    opening_hours?: Record<string, string>;
    category?: string;
    priority_level?: number;
}

// ============================================================================
// ROUTES
// ============================================================================

export interface RouteStop {
    stop_id: number;
    route_id: number;
    store_id: number;
    store_name?: string;
    store_address?: string;
    store_latitude?: number;
    store_longitude?: number;
    stop_sequence: number;
    estimated_arrival: string | null;
    actual_arrival: string | null;
    actual_departure: string | null;
    items_count: number;
    stop_status: StopStatus;
}

export interface Route {
    route_id: number;
    list_id: number;
    staff_id: number;
    staff_name: string;
    staff_avatar: string;
    route_date: string;
    route_status: RouteStatus;
    total_distance_km: number | null;
    estimated_time_minutes: number | null;
    include_return: boolean;
    total_stops: number;
    completed_stops: number;
    estimated_duration: string;
    stops: RouteStop[];
}

export interface RouteGenerate {
    staff_id: number;
    list_id: number;
    optimization_priority?: "speed" | "distance" | "cost";
}

// ============================================================================
// SETTINGS
// ============================================================================

export interface CutoffSettings {
    cutoff_time: string;
    weekend_processing: boolean;
    holiday_override: boolean;
}

export interface StaffSettings {
    default_start_location: string;
    max_orders_per_staff: number;
    auto_assign: boolean;
}

export interface RouteSettings {
    optimization_priority: string;
    max_route_time_hours: number;
    include_return: boolean;
}

export interface NotificationSettings {
    cutoff_warning: boolean;
    order_failure_alert: boolean;
    route_completion_notification: boolean;
}

export interface AllSettings {
    cutoff: CutoffSettings;
    staff: StaffSettings;
    route: RouteSettings;
    notification: NotificationSettings;
}
