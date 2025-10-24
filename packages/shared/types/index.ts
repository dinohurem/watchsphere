// Shared types that can be used across web and mobile

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface ApiError {
  message: string;
  code: string;
  statusCode: number;
}

// Re-export store types
export type { User } from '../stores/useAuthStore';
export type { Watch } from '../stores/useMarketStore';
export type { Message, Conversation } from '../stores/useChatStore';
