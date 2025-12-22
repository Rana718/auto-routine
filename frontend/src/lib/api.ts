/**
 * API Client for backend communication
 */

import type {
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    Order,
    OrderWithItems,
    OrderStats,
    OrderCreate,
    OrderStatus,
    Staff,
    StaffWithStats,
    StaffStats,
    StaffCreate,
    StaffStatusUpdate,
    Store,
    StoreWithOrders,
    StoreStats,
    StoreCreate,
    Route,
    RouteGenerate,
    RouteStatus,
    AllSettings,
    CutoffSettings,
    StaffSettings as StaffSettingsType,
    RouteSettings,
    NotificationSettings,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ============================================================================
// API CLIENT
// ============================================================================

class ApiError extends Error {
    constructor(
        public status: number,
        public message: string,
        public details?: unknown
    ) {
        super(message);
        this.name = "ApiError";
    }
}

async function fetchApi<T>(
    endpoint: string,
    options: RequestInit = {},
    token?: string
): Promise<T> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }


    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        let errorMessage = "APIエラーが発生しました";
        try {
            const errorData = await response.json();
            errorMessage = errorData.detail || errorMessage;
        } catch {
            // Ignore JSON parse errors
        }
        throw new ApiError(response.status, errorMessage);
    }

    if (response.status === 204) {
        return {} as T;
    }

    return response.json();
}

// Helper to get token from session storage or cookie
function getStoredToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
}

export function setStoredToken(token: string): void {
    if (typeof window !== "undefined") {
        localStorage.setItem("access_token", token);
    }
}

export function clearStoredToken(): void {
    if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
    }
}

// ============================================================================
// AUTH API
// ============================================================================

export const authApi = {
    async login(data: LoginRequest): Promise<TokenResponse> {
        const formData = new URLSearchParams();
        formData.append("username", data.email);
        formData.append("password", data.password);

        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new ApiError(
                response.status,
                error.detail || "ログインに失敗しました"
            );
        }

        const result = await response.json();
        setStoredToken(result.access_token);
        return result;
    },

    async register(data: RegisterRequest): Promise<UserResponse> {
        return fetchApi<UserResponse>("/api/auth/register", {
            method: "POST",
            body: JSON.stringify(data),
        });
    },

    async me(): Promise<UserResponse> {
        const token = getStoredToken();
        if (!token) throw new ApiError(401, "ログインが必要です");
        return fetchApi<UserResponse>("/api/auth/me", {}, token);
    },

    logout(): void {
        clearStoredToken();
    },
};

// ============================================================================
// ORDERS API
// ============================================================================

export const ordersApi = {
    async getAll(params?: {
        status?: OrderStatus;
        target_date?: string;
        search?: string;
        skip?: number;
        limit?: number;
    }): Promise<OrderWithItems[]> {
        const token = getStoredToken();
        const searchParams = new URLSearchParams();
        if (params?.status) searchParams.set("status", params.status);
        if (params?.target_date) searchParams.set("target_date", params.target_date);
        if (params?.search) searchParams.set("search", params.search);
        if (params?.skip !== undefined) searchParams.set("skip", String(params.skip));
        if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));

        const query = searchParams.toString();
        return fetchApi<OrderWithItems[]>(
            `/api/orders${query ? `?${query}` : ""}`,
            {},
            token || undefined
        );
    },

    async getStats(target_date?: string): Promise<OrderStats> {
        const token = getStoredToken();
        const query = target_date ? `?target_date=${target_date}` : "";
        return fetchApi<OrderStats>(`/api/orders/stats${query}`, {}, token || undefined);
    },

    async getById(orderId: number): Promise<OrderWithItems> {
        const token = getStoredToken();
        return fetchApi<OrderWithItems>(`/api/orders/${orderId}`, {}, token || undefined);
    },

    async create(data: OrderCreate): Promise<Order> {
        const token = getStoredToken();
        return fetchApi<Order>(
            "/api/orders",
            { method: "POST", body: JSON.stringify(data) },
            token || undefined
        );
    },

    async updateStatus(orderId: number, status: OrderStatus): Promise<{ message: string }> {
        const token = getStoredToken();
        return fetchApi<{ message: string }>(
            `/api/orders/${orderId}/status?status=${status}`,
            { method: "PATCH" },
            token || undefined
        );
    },

    async import(orders: OrderCreate[]): Promise<{ message: string; count: number }> {
        const token = getStoredToken();
        return fetchApi<{ message: string; count: number }>(
            "/api/orders/import",
            { method: "POST", body: JSON.stringify({ orders }) },
            token || undefined
        );
    },
};

// ============================================================================
// STAFF API
// ============================================================================

export const staffApi = {
    async getAll(params?: {
        active_only?: boolean;
        skip?: number;
        limit?: number;
    }): Promise<StaffWithStats[]> {
        const token = getStoredToken();
        const searchParams = new URLSearchParams();
        if (params?.active_only !== undefined)
            searchParams.set("active_only", String(params.active_only));
        if (params?.skip !== undefined) searchParams.set("skip", String(params.skip));
        if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));

        const query = searchParams.toString();
        return fetchApi<StaffWithStats[]>(
            `/api/staff${query ? `?${query}` : ""}`,
            {},
            token || undefined
        );
    },

    async getStats(): Promise<StaffStats> {
        const token = getStoredToken();
        return fetchApi<StaffStats>("/api/staff/stats", {}, token || undefined);
    },

    async getById(staffId: number): Promise<StaffWithStats> {
        const token = getStoredToken();
        return fetchApi<StaffWithStats>(`/api/staff/${staffId}`, {}, token || undefined);
    },

    async create(data: StaffCreate): Promise<Staff> {
        const token = getStoredToken();
        return fetchApi<Staff>(
            "/api/staff",
            { method: "POST", body: JSON.stringify(data) },
            token || undefined
        );
    },

    async updateStatus(staffId: number, update: StaffStatusUpdate): Promise<{ message: string }> {
        const token = getStoredToken();
        return fetchApi<{ message: string }>(
            `/api/staff/${staffId}/status`,
            { method: "PATCH", body: JSON.stringify(update) },
            token || undefined
        );
    },

    async autoAssign(staffId: number): Promise<{ message: string; assigned_count: number }> {
        const token = getStoredToken();
        return fetchApi<{ message: string; assigned_count: number }>(
            `/api/staff/${staffId}/auto-assign`,
            { method: "POST" },
            token || undefined
        );
    },
};

// ============================================================================
// STORES API
// ============================================================================

export const storesApi = {
    async getAll(params?: {
        active_only?: boolean;
        category?: string;
        district?: string;
        search?: string;
        skip?: number;
        limit?: number;
    }): Promise<StoreWithOrders[]> {
        const token = getStoredToken();
        const searchParams = new URLSearchParams();
        if (params?.active_only !== undefined)
            searchParams.set("active_only", String(params.active_only));
        if (params?.category) searchParams.set("category", params.category);
        if (params?.district) searchParams.set("district", params.district);
        if (params?.search) searchParams.set("search", params.search);
        if (params?.skip !== undefined) searchParams.set("skip", String(params.skip));
        if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));

        const query = searchParams.toString();
        return fetchApi<StoreWithOrders[]>(
            `/api/stores${query ? `?${query}` : ""}`,
            {},
            token || undefined
        );
    },

    async getStats(): Promise<StoreStats> {
        const token = getStoredToken();
        return fetchApi<StoreStats>("/api/stores/stats", {}, token || undefined);
    },

    async getCategories(): Promise<{ categories: string[] }> {
        const token = getStoredToken();
        return fetchApi<{ categories: string[] }>("/api/stores/categories", {}, token || undefined);
    },

    async getDistricts(): Promise<{ districts: string[] }> {
        const token = getStoredToken();
        return fetchApi<{ districts: string[] }>("/api/stores/districts", {}, token || undefined);
    },

    async getById(storeId: number): Promise<StoreWithOrders> {
        const token = getStoredToken();
        return fetchApi<StoreWithOrders>(`/api/stores/${storeId}`, {}, token || undefined);
    },

    async create(data: StoreCreate): Promise<Store> {
        const token = getStoredToken();
        return fetchApi<Store>(
            "/api/stores",
            { method: "POST", body: JSON.stringify(data) },
            token || undefined
        );
    },

    async update(storeId: number, data: Partial<StoreCreate>): Promise<Store> {
        const token = getStoredToken();
        return fetchApi<Store>(
            `/api/stores/${storeId}`,
            { method: "PATCH", body: JSON.stringify(data) },
            token || undefined
        );
    },

    async delete(storeId: number): Promise<{ message: string }> {
        const token = getStoredToken();
        return fetchApi<{ message: string }>(
            `/api/stores/${storeId}`,
            { method: "DELETE" },
            token || undefined
        );
    },
};

// ============================================================================
// ROUTES API
// ============================================================================

export const routesApi = {
    async getAll(params?: {
        route_date?: string;
        staff_id?: number;
        status?: RouteStatus;
        skip?: number;
        limit?: number;
    }): Promise<Route[]> {
        const token = getStoredToken();
        const searchParams = new URLSearchParams();
        if (params?.route_date) searchParams.set("route_date", params.route_date);
        if (params?.staff_id !== undefined) searchParams.set("staff_id", String(params.staff_id));
        if (params?.status) searchParams.set("status", params.status);
        if (params?.skip !== undefined) searchParams.set("skip", String(params.skip));
        if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));

        const query = searchParams.toString();
        return fetchApi<Route[]>(
            `/api/routes${query ? `?${query}` : ""}`,
            {},
            token || undefined
        );
    },

    async getById(routeId: number): Promise<Route> {
        const token = getStoredToken();
        return fetchApi<Route>(`/api/routes/${routeId}`, {}, token || undefined);
    },

    async generate(data: RouteGenerate): Promise<{ message: string; route_id: number }> {
        const token = getStoredToken();
        return fetchApi<{ message: string; route_id: number }>(
            "/api/routes/generate",
            { method: "POST", body: JSON.stringify(data) },
            token || undefined
        );
    },

    async regenerateAll(route_date?: string): Promise<{ message: string; routes_count: number }> {
        const token = getStoredToken();
        const query = route_date ? `?route_date=${route_date}` : "";
        return fetchApi<{ message: string; routes_count: number }>(
            `/api/routes/regenerate-all${query}`,
            { method: "POST" },
            token || undefined
        );
    },

    async updateStatus(routeId: number, status: RouteStatus): Promise<{ message: string }> {
        const token = getStoredToken();
        return fetchApi<{ message: string }>(
            `/api/routes/${routeId}/status?status=${status}`,
            { method: "PATCH" },
            token || undefined
        );
    },

    async startAll(route_date?: string): Promise<{ message: string; count: number }> {
        const token = getStoredToken();
        const query = route_date ? `?route_date=${route_date}` : "";
        return fetchApi<{ message: string; count: number }>(
            `/api/routes/start-all${query}`,
            { method: "POST" },
            token || undefined
        );
    },
};

// ============================================================================
// SETTINGS API
// ============================================================================

export const settingsApi = {
    async getAll(): Promise<AllSettings> {
        const token = getStoredToken();
        return fetchApi<AllSettings>("/api/settings", {}, token || undefined);
    },

    async updateCutoff(settings: CutoffSettings): Promise<CutoffSettings> {
        const token = getStoredToken();
        return fetchApi<CutoffSettings>(
            "/api/settings/cutoff",
            { method: "PUT", body: JSON.stringify(settings) },
            token || undefined
        );
    },

    async updateStaff(settings: StaffSettingsType): Promise<StaffSettingsType> {
        const token = getStoredToken();
        return fetchApi<StaffSettingsType>(
            "/api/settings/staff",
            { method: "PUT", body: JSON.stringify(settings) },
            token || undefined
        );
    },

    async updateRoute(settings: RouteSettings): Promise<RouteSettings> {
        const token = getStoredToken();
        return fetchApi<RouteSettings>(
            "/api/settings/route",
            { method: "PUT", body: JSON.stringify(settings) },
            token || undefined
        );
    },

    async updateNotification(settings: NotificationSettings): Promise<NotificationSettings> {
        const token = getStoredToken();
        return fetchApi<NotificationSettings>(
            "/api/settings/notification",
            { method: "PUT", body: JSON.stringify(settings) },
            token || undefined
        );
    },

    async importStores(): Promise<{ message: string; count: number }> {
        const token = getStoredToken();
        return fetchApi<{ message: string; count: number }>(
            "/api/settings/data/import-stores",
            { method: "POST" },
            token || undefined
        );
    },

    async exportOrders(): Promise<{ message: string }> {
        const token = getStoredToken();
        return fetchApi<{ message: string }>(
            "/api/settings/data/export-orders",
            { method: "POST" },
            token || undefined
        );
    },

    async backup(): Promise<{ message: string }> {
        const token = getStoredToken();
        return fetchApi<{ message: string }>(
            "/api/settings/data/backup",
            { method: "POST" },
            token || undefined
        );
    },
};

// ============================================================================
// AUTOMATION API
// ============================================================================

export const automationApi = {
    async autoAssignDaily(target_date: string): Promise<{ message: string }> {
        const token = getStoredToken();
        return fetchApi<{ message: string }>(
            `/api/automation/auto-assign?target_date=${target_date}`,
            { method: "POST" },
            token || undefined
        );
    },

    async generateAllRoutes(target_date: string): Promise<{ message: string; route_ids: number[] }> {
        const token = getStoredToken();
        return fetchApi<{ message: string; route_ids: number[] }>(
            `/api/automation/generate-routes?target_date=${target_date}`,
            { method: "POST" },
            token || undefined
        );
    },
};

export { ApiError };
