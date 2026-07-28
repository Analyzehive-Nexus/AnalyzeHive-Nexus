const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// What comes from API
export interface ApiUser {
    id: string;
    email: string;
    name: string;
    role: string;
}

// What you might extend locally
export interface AppUser extends ApiUser {
    // Add any frontend-only properties
    preferences?: any;
    lastLogin?: string;
}

// Backward compatibility alias if needed, but better to use specific types
export type User = ApiUser;

export interface LoginResponse {
    access_token: string;
    token_type: string;
    user: ApiUser;
}

export interface ApiError {
    detail: string;
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        const config: RequestInit = {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...options.headers,
            },
        };

        const token = this.getToken();
        if (token) {
            config.headers = {
                ...config.headers,
                Authorization: `Bearer ${token}`,
            };
        }

        const response = await fetch(url, config);

        if (!response.ok) {
            const error: ApiError = await response.json().catch(() => ({
                detail: "An unexpected error occurred",
            }));
            throw new Error(error.detail);
        }

        return response.json();
    }

    getToken(): string | null {
        if (typeof window === "undefined") return null;
        return localStorage.getItem("auth_token");
    }

    setToken(token: string): void {
        localStorage.setItem("auth_token", token);
        document.cookie = `auth_token=${token}; path=/; max-age=86400; SameSite=Lax`;
    }

    clearToken(): void {
        if (typeof window === "undefined") return;
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user");
        // Clear cookie properly
        document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    }

    setUser(user: ApiUser): void {
        // Convert ApiUser to AppUser if needed
        const appUser: AppUser = {
            ...user,
            lastLogin: new Date().toISOString(),
        };
        localStorage.setItem("user", JSON.stringify(appUser));
    }

    getUser(): AppUser | null {
        if (typeof window === "undefined") return null;
        const user = localStorage.getItem("user");
        return user ? JSON.parse(user) : null;
    }

    isAuthenticated(): boolean {
        return !!this.getToken();
    }

    async login(email: string, password: string): Promise<LoginResponse> {
        const response = await this.request<LoginResponse>("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });

        this.setToken(response.access_token);
        this.setUser(response.user);

        return response;
    }

    async logout(): Promise<void> {
        this.clearToken();
    }

    async getCurrentUser(): Promise<ApiUser> {
        return this.request<ApiUser>("/api/auth/me");
    }

    async verifyToken(): Promise<{ valid: boolean; user: ApiUser }> {
        const user = await this.request<ApiUser>("/api/auth/me");
        return { valid: true, user };
    }

    // Generic helpers so individual pages/components don't need their own
    // fetch/auth/error-handling boilerplate for backend-backed features.
    async get<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint);
    }

    async post<T>(endpoint: string, body?: unknown): Promise<T> {
        return this.request<T>(endpoint, {
            method: "POST",
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    }
}

export const api = new ApiClient(API_URL);
