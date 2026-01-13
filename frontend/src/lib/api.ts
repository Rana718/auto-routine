/**
 * API Client for backend communication
 */

import { getSession } from "next-auth/react";
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

    // Get token from NextAuth session if not provided
    if (!token && typeof window !== "undefined") {
        try {
            const session = await getSession();
            if (session?.accessToken) {
                token = session.accessToken as string;
            }
        } catch (error) {
            console.error("Failed to get session:", error);
        }
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            ...headers,
            ...options.headers,
        },
    });

    if (!response.ok) {
        let errorMessage = "APIエラーが発生しました";
        if (response.status === 401 && typeof window !== "undefined") {
            window.location.href = "/signin";
            throw new ApiError(401, "認証が必要です");
        }
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
        const searchParams = new URLSearchParams();
        if (params?.status) searchParams.set("status", params.status);
        if (params?.target_date) searchParams.set("target_date", params.target_date);
        if (params?.search) searchParams.set("search", params.search);
        if (params?.skip !== undefined) searchParams.set("skip", String(params.skip));
        if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));

        const query = searchParams.toString();
        return fetchApi<OrderWithItems[]>(`/api/orders${query ? `?${query}` : ""}`);
    },

    async getStats(target_date?: string): Promise<OrderStats> {
        const query = target_date ? `?target_date=${target_date}` : "";
        return fetchApi<OrderStats>(`/api/orders/stats${query}`);
    },

    async getById(orderId: number): Promise<OrderWithItems> {
        return fetchApi<OrderWithItems>(`/api/orders/${orderId}`);
    },

    async create(data: OrderCreate): Promise<Order> {
        return fetchApi<Order>("/api/orders", { method: "POST", body: JSON.stringify(data) });
    },

    async updateStatus(orderId: number, status: OrderStatus): Promise<{ message: string }> {
        return fetchApi<{ message: string }>(
            `/api/orders/${orderId}/status?status=${status}`,
            { method: "PATCH" }
        );
    },

    async import(orders: OrderCreate[]): Promise<{ message: string; count: number }> {
        return fetchApi<{ message: string; count: number }>(
            "/api/orders/import",
            { method: "POST", body: JSON.stringify({ orders }) }
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
        const searchParams = new URLSearchParams();
        if (params?.active_only !== undefined)
            searchParams.set("active_only", String(params.active_only));
        if (params?.skip !== undefined) searchParams.set("skip", String(params.skip));
        if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));

        const query = searchParams.toString();
        return fetchApi<StaffWithStats[]>(`/api/staff${query ? `?${query}` : ""}`);
    },

    async getStats(): Promise<StaffStats> {
        return fetchApi<StaffStats>("/api/staff/stats");
    },

    async getById(staffId: number): Promise<StaffWithStats> {
        return fetchApi<StaffWithStats>(`/api/staff/${staffId}`);
    },

    async create(data: StaffCreate): Promise<Staff> {
        return fetchApi<Staff>("/api/staff", { method: "POST", body: JSON.stringify(data) });
    },

    async updateStatus(staffId: number, update: StaffStatusUpdate): Promise<{ message: string }> {
        return fetchApi<{ message: string }>(
            `/api/staff/${staffId}/status`,
            { method: "PATCH", body: JSON.stringify(update) }
        );
    },

    async autoAssign(staffId: number): Promise<{ message: string; assigned_count: number }> {
        return fetchApi<{ message: string; assigned_count: number }>(
            `/api/staff/${staffId}/auto-assign`,
            { method: "POST" }
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
        const searchParams = new URLSearchParams();
        if (params?.active_only !== undefined)
            searchParams.set("active_only", String(params.active_only));
        if (params?.category) searchParams.set("category", params.category);
        if (params?.district) searchParams.set("district", params.district);
        if (params?.search) searchParams.set("search", params.search);
        if (params?.skip !== undefined) searchParams.set("skip", String(params.skip));
        if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));

        const query = searchParams.toString();
        return fetchApi<StoreWithOrders[]>(`/api/stores${query ? `?${query}` : ""}`);
    },

    async getStats(): Promise<StoreStats> {
        return fetchApi<StoreStats>("/api/stores/stats");
    },

    async getCategories(): Promise<{ categories: string[] }> {
        return fetchApi<{ categories: string[] }>("/api/stores/categories");
    },

    async getDistricts(): Promise<{ districts: string[] }> {
        return fetchApi<{ districts: string[] }>("/api/stores/districts");
    },

    async getById(storeId: number): Promise<StoreWithOrders> {
        return fetchApi<StoreWithOrders>(`/api/stores/${storeId}`);
    },

    async create(data: StoreCreate): Promise<Store> {
        return fetchApi<Store>("/api/stores", { method: "POST", body: JSON.stringify(data) });
    },

    async update(storeId: number, data: Partial<StoreCreate>): Promise<Store> {
        return fetchApi<Store>(
            `/api/stores/${storeId}`,
            { method: "PATCH", body: JSON.stringify(data) }
        );
    },

    async delete(storeId: number): Promise<{ message: string }> {
        return fetchApi<{ message: string }>(`/api/stores/${storeId}`, { method: "DELETE" });
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
        const searchParams = new URLSearchParams();
        if (params?.route_date) searchParams.set("route_date", params.route_date);
        if (params?.staff_id !== undefined) searchParams.set("staff_id", String(params.staff_id));
        if (params?.status) searchParams.set("status", params.status);
        if (params?.skip !== undefined) searchParams.set("skip", String(params.skip));
        if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));

        const query = searchParams.toString();
        return fetchApi<Route[]>(`/api/routes${query ? `?${query}` : ""}`);
    },

    async getById(routeId: number): Promise<Route> {
        return fetchApi<Route>(`/api/routes/${routeId}`);
    },

    async generate(data: RouteGenerate): Promise<{ message: string; route_id: number }> {
        return fetchApi<{ message: string; route_id: number }>(
            "/api/routes/generate",
            { method: "POST", body: JSON.stringify(data) }
        );
    },

    async regenerateAll(route_date?: string): Promise<{ message: string; routes_count: number }> {
        const query = route_date ? `?route_date=${route_date}` : "";
        return fetchApi<{ message: string; routes_count: number }>(
            `/api/routes/regenerate-all${query}`,
            { method: "POST" }
        );
    },

    async updateStatus(routeId: number, status: RouteStatus): Promise<{ message: string }> {
        return fetchApi<{ message: string }>(
            `/api/routes/${routeId}/status?status=${status}`,
            { method: "PATCH" }
        );
    },

    async startAll(route_date?: string): Promise<{ message: string; count: number }> {
        const query = route_date ? `?route_date=${route_date}` : "";
        return fetchApi<{ message: string; count: number }>(
            `/api/routes/start-all${query}`,
            { method: "POST" }
        );
    },

    async updateStop(routeId: number, stopId: number, stop_status: string): Promise<{ message: string; new_status: string }> {
        return fetchApi<{ message: string; new_status: string }>(
            `/api/routes/${routeId}/stops/${stopId}`,
            {
                method: "PATCH",
                body: JSON.stringify({ stop_status })
            }
        );
    },
};

// ============================================================================
// SETTINGS API
// ============================================================================

export const settingsApi = {
    async getAll(): Promise<AllSettings> {
        return fetchApi<AllSettings>("/api/settings");
    },

    async updateCutoff(settings: CutoffSettings): Promise<CutoffSettings> {
        return fetchApi<CutoffSettings>(
            "/api/settings/cutoff",
            { method: "PUT", body: JSON.stringify(settings) }
        );
    },

    async updateStaff(settings: StaffSettingsType): Promise<StaffSettingsType> {
        return fetchApi<StaffSettingsType>(
            "/api/settings/staff",
            { method: "PUT", body: JSON.stringify(settings) }
        );
    },

    async updateRoute(settings: RouteSettings): Promise<RouteSettings> {
        return fetchApi<RouteSettings>(
            "/api/settings/route",
            { method: "PUT", body: JSON.stringify(settings) }
        );
    },

    async updateNotification(settings: NotificationSettings): Promise<NotificationSettings> {
        return fetchApi<NotificationSettings>(
            "/api/settings/notification",
            { method: "PUT", body: JSON.stringify(settings) }
        );
    },

    async importStores(): Promise<{ message: string; count: number }> {
        return fetchApi<{ message: string; count: number }>(
            "/api/settings/data/import-stores",
            { method: "POST" }
        );
    },

    async exportOrders(): Promise<{ message: string }> {
        return fetchApi<{ message: string }>(
            "/api/settings/data/export-orders",
            { method: "POST" }
        );
    },

    async backup(): Promise<{ message: string }> {
        return fetchApi<{ message: string }>(
            "/api/settings/data/backup",
            { method: "POST" }
        );
    },
};

// ============================================================================
// AUTOMATION API
// ============================================================================

export const automationApi = {
    async autoAssignDaily(target_date: string): Promise<{ message: string }> {
        return fetchApi<{ message: string }>(
            `/api/automation/auto-assign?target_date=${target_date}`,
            { method: "POST" }
        );
    },

    async generateAllRoutes(target_date: string): Promise<{ message: string; route_ids: number[] }> {
        return fetchApi<{ message: string; route_ids: number[] }>(
            `/api/automation/generate-routes?target_date=${target_date}`,
            { method: "POST" }
        );
    },
};

// ============================================================================
// ADMIN API
// ============================================================================

export const adminApi = {
    async deleteUser(userId: number): Promise<{ message: string }> {
        return fetchApi<{ message: string }>(
            `/api/admin/users/${userId}`,
            { method: "DELETE" }
        );
    },
};

// ============================================================================
// HOLIDAYS API
// ============================================================================

export interface Holiday {
    holiday_id: number;
    holiday_date: string;
    holiday_name: string | null;
    is_working: boolean;
}

export interface HolidayCreate {
    holiday_date: string;
    holiday_name?: string;
    is_working?: boolean;
}

export const holidaysApi = {
    async getAll(year?: number): Promise<Holiday[]> {
        const query = year ? `?year=${year}` : "";
        return fetchApi<Holiday[]>(`/api/holidays${query}`);
    },

    async create(data: HolidayCreate): Promise<Holiday> {
        return fetchApi<Holiday>("/api/holidays", {
            method: "POST",
            body: JSON.stringify(data),
        });
    },

    async update(holidayId: number, data: HolidayCreate): Promise<{ message: string }> {
        return fetchApi<{ message: string }>(`/api/holidays/${holidayId}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
    },

    async delete(holidayId: number): Promise<{ message: string }> {
        return fetchApi<{ message: string }>(`/api/holidays/${holidayId}`, {
            method: "DELETE",
        });
    },

    async importJapanHolidays(year?: number): Promise<{ message: string; year: number }> {
        const query = year ? `?year=${year}` : "";
        return fetchApi<{ message: string; year: number }>(
            `/api/holidays/import-japan-holidays${query}`,
            { method: "POST" }
        );
    },
};

// ============================================================================
// EXTENDED SETTINGS API
// ============================================================================

export const extendedSettingsApi = {
    async calculateDistances(): Promise<{ message: string; calculated_pairs: number }> {
        return fetchApi<{ message: string; calculated_pairs: number }>(
            "/api/settings/data/calculate-distances",
            { method: "POST" }
        );
    },
};

// ============================================================================
// NOTIFICATIONS API
// ============================================================================

export interface NotificationItem {
    id: string;
    type: "info" | "warning" | "success";
    title: string;
    message: string;
    time: string;
    read: boolean;
}

export const notificationsApi = {
    async getAll(): Promise<NotificationItem[]> {
        return fetchApi<NotificationItem[]>("/api/notifications");
    },
};

// ============================================================================
// AUTH API
// ============================================================================

export interface UpdateEmailRequest {
    new_email: string;
    password: string;
}

export interface UpdatePasswordRequest {
    current_password: string;
    new_password: string;
}

export const authApi = {
    async updateEmail(data: UpdateEmailRequest): Promise<{ message: string; email: string }> {
        return fetchApi<{ message: string; email: string }>(
            "/api/auth/me/email",
            { method: "PATCH", body: JSON.stringify(data) }
        );
    },

    async updatePassword(data: UpdatePasswordRequest): Promise<{ message: string }> {
        return fetchApi<{ message: string }>(
            "/api/auth/me/password",
            { method: "PATCH", body: JSON.stringify(data) }
        );
    },
};

export { ApiError };
