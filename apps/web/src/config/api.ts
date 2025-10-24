export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  wsURL: import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000/ws',
  timeout: 30000,
}

export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
  },
  market: {
    list: '/market',
    search: '/market/search',
    detail: (id: string) => `/market/${id}`,
  },
  inventory: {
    list: '/inventory',
    create: '/inventory',
    update: (id: string) => `/inventory/${id}`,
    delete: (id: string) => `/inventory/${id}`,
  },
  orders: {
    list: '/orders',
    create: '/orders',
    detail: (id: string) => `/orders/${id}`,
  },
  chat: {
    conversations: '/chat/conversations',
    messages: (conversationId: string) => `/chat/${conversationId}/messages`,
  },
  ai: {
    ask: '/ai/ask',
    suggestions: '/ai/suggestions',
  },
  news: {
    list: '/news',
    latest: '/news/latest',
  },
}
