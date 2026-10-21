/**
 * API 配置文件
 * 集中管理所有 API 路由、外部服务 URL 和请求配置
 */

// ============================================================================
// 内部 API 路由
// ============================================================================

/**
 * 内部 API 路由配置
 * 用于前端调用后端 API
 */
export const API_ROUTES = {
  // 聊天相关
  chat: {
    stream: "/api/chat",
    generate: "/api/chat/generate",
    executeCode: "/api/chat/execute-code",
    generateTitle: "/api/chat/generate-title",
    relatedQuestions: "/api/chat/related-questions",
    ragQueries: "/api/chat/rag-queries",
    generateImage: "/api/chat/generate-image",
  },

  // Agent 相关
  agents: {
    list: "/api/agents",
    detail: (identifier: string) => `/api/agents/${identifier}`,
  },

  // 插件相关
  plugins: {
    list: "/api/plugins/list",
    install: "/api/plugins/install",
  },

  // RAG 相关
  rag: {
    query: "/api/rag/query",
    upsert: "/api/rag/upsert",
  },

  // 搜索相关
  search: {
    query: "/api/search",
  },

  // 语音相关
  voice: {
    transcribe: "/api/voice/transcribe",
    synthesize: "/api/voice/synthesize",
  },

  // 文档解析
  docParse: {
    parse: "/api/doc-parse",
  },
} as const;

// ============================================================================
// 外部服务 URL
// ============================================================================

/**
 * 搜索服务 URL
 */
export const SEARCH_SERVICE_URLS = {
  tavily: "https://api.tavily.com",
  firecrawl: "https://api.firecrawl.dev",
  exa: "https://api.exa.ai",
  bocha: "https://api.bochaai.com",
  youcom: "https://api.you.com",
  searxng: "http://localhost:8080",
} as const;

/**
 * AI 服务 URL
 */
export const AI_SERVICE_URLS = {
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com",
  elevenlabs: "https://api.elevenlabs.io/v1",
} as const;

/**
 * 数据服务 URL
 */
export const DATA_SERVICE_URLS = {
  llamaParse: "https://api.cloud.llamaindex.ai/api/v2/parse",
  lobeAgents:
    "https://registry.npmmirror.com/@lobehub/agents-index/v1/files/public",
  apisGuru: "https://api.apis.guru/v2/list.json",
} as const;

/**
 * 所有外部 API URL（向后兼容）
 */
export const EXTERNAL_API_URLS = {
  ...SEARCH_SERVICE_URLS,
  ...AI_SERVICE_URLS,
  ...DATA_SERVICE_URLS,
} as const;

// ============================================================================
// 请求配置
// ============================================================================

/**
 * API 请求超时配置（毫秒）
 */
export const API_TIMEOUTS = {
  default: 60000, // 60 秒
  short: 10000, // 10 秒（快速操作）
  long: 300000, // 5 分钟（长时间操作，如文档解析）
  streaming: 0, // 流式请求不设超时
} as const;

/**
 * API 重试配置
 */
export const API_RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // 1 秒
  retryableStatusCodes: [408, 429, 500, 502, 503, 504] as number[],
};

/**
 * API 请求配置（向后兼容）
 */
export const API_CONFIG = {
  timeout: API_TIMEOUTS.default,
  retries: API_RETRY_CONFIG.maxRetries,
  retryDelay: API_RETRY_CONFIG.retryDelay,
} as const;

// ============================================================================
// 缓存配置
// ============================================================================

/**
 * 缓存过期时间配置（毫秒）
 */
export const CACHE_DURATIONS = {
  short: 5 * 60 * 1000, // 5 分钟
  medium: 60 * 60 * 1000, // 1 小时
  long: 24 * 60 * 60 * 1000, // 24 小时
  threeDays: 72 * 60 * 60 * 1000, // 72 小时
  week: 7 * 24 * 60 * 60 * 1000, // 7 天
} as const;

/**
 * 各功能模块的缓存配置
 */
export const CACHE_CONFIG = {
  agents: CACHE_DURATIONS.threeDays, // 72 小时
  plugins: CACHE_DURATIONS.threeDays, // 72 小时
  skills: CACHE_DURATIONS.threeDays, // 72 小时
  modelMetadata: CACHE_DURATIONS.threeDays, // 72 小时
  searchResults: CACHE_DURATIONS.short, // 5 分钟
} as const;

// ============================================================================
// 限流配置
// ============================================================================

/**
 * API 限流配置
 */
export const RATE_LIMIT_CONFIG = {
  chat: {
    maxRequests: 60,
    windowMs: 60000, // 1 分钟
  },
  search: {
    maxRequests: 30,
    windowMs: 60000, // 1 分钟
  },
  voice: {
    maxRequests: 20,
    windowMs: 60000, // 1 分钟
  },
} as const;

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 获取完整的 API URL
 */
export function getApiUrl(route: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  return `${baseUrl}${route}`;
}

/**
 * 获取外部服务 URL
 */
export function getExternalUrl(
  service: keyof typeof EXTERNAL_API_URLS,
): string {
  return EXTERNAL_API_URLS[service];
}

/**
 * 检查状态码是否可重试
 */
export function isRetryableStatusCode(statusCode: number): boolean {
  return (API_RETRY_CONFIG.retryableStatusCodes as readonly number[]).includes(
    statusCode,
  );
}
