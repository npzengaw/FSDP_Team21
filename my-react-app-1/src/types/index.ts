// This file exports TypeScript types and interfaces used throughout the application for better type safety.

export interface ChatMessage {
    id: string;
    userId: string;
    content: string;
    timestamp: Date;
}

export interface User {
    id: string;
    email: string;
    username: string;
}

export interface SupabaseResponse<T> {
    data: T | null;
    error: Error | null;
}

export interface WebSocketMessage {
    type: string;
    payload: any;
}