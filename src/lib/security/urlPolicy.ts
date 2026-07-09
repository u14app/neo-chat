import type { EncryptedSecretEnvelope } from "../byok/shared";
import type { ServerDefaultProviderSource } from "../defaultConfig/shared";
import type { ProviderType } from "../../types";
import { HostedProxyBlockedError } from "../errors";
import {
  getOutboundPolicyProfile,
  type OutboundPolicyProfile,
} from "./deployment";
import { isOpenAIProviderType } from "../providers/providerTypes";

export type OutboundContext =
  | "provider"
  | "search"
  | "rag"
  | "plugin"
  | "pluginManifest"
  | "docs"
  | "voice"
  | "agent"
  | "metadata"
  | "sharedStore";

export interface SafeUrlPolicy {
  context: OutboundContext;
  allowedProtocols?: Array<"https:" | "http:">;
  allowLocalhost?: boolean;
  allowPrivateNetwork?: boolean;
  allowHttp?: boolean;
  allowLocalHttp?: boolean;
  allowedHosts?: string[];
  maxRedirects?: number;
  profile?: OutboundPolicyProfile;
  hostedProxyBlocked?: boolean;
}

export interface ValidatedOutboundRequest {
  url: URL;
  policy: SafeUrlPolicy;
  hostname: string;
  protocol: string;
}

export interface ProviderRuntimeConfig {
  type: ProviderType;
  source?: ServerDefaultProviderSource;
  apiKey?: string;
  apiKeySecret?: EncryptedSecretEnvelope;
  baseUrl?: string;
  name?: string;
}

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_LITELLM_BASE_URL = "http://localhost:4000/v1";

export function normalizeProviderBaseUrl(
  baseUrl: string | undefined,
  providerType: ProviderRuntimeConfig["type"] | string,
): string {
  if (!baseUrl || baseUrl === "default") {
    if (providerType === "LiteLLM") return DEFAULT_LITELLM_BASE_URL;
    return isOpenAIProviderType(providerType)
      ? DEFAULT_OPENAI_BASE_URL
      : DEFAULT_GEMINI_BASE_URL;
  }

  let normalized = baseUrl.trim();
  if (normalized.endsWith("#")) normalized = normalized.slice(0, -1);
  normalized = normalized.replace(/\/+$/, "");

  if (isOpenAIProviderType(providerType)) {
    return normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
  }

  if (providerType === "Gemini") {
    return normalized.replace(/\/v1beta$/, "");
  }

  return normalized;
}

export function getProviderModelsUrl(
  baseUrl: string | undefined,
  providerType: ProviderRuntimeConfig["type"],
): string {
  const normalized = normalizeProviderBaseUrl(baseUrl, providerType);

  if (providerType === "Gemini") {
    return `${normalized}/v1beta/models`;
  }

  return `${normalized}/models`;
}

export function getProviderApiKey(provider: ProviderRuntimeConfig): string {
  return provider.apiKey?.trim() || "";
}

export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = "";
    parsed.password = "";
    for (const key of parsed.searchParams.keys()) {
      if (/key|token|secret|auth|password/i.test(key)) {
        parsed.searchParams.set(key, "[redacted]");
      }
    }
    return parsed.toString();
  } catch {
    return "[invalid-url]";
  }
}

export function isLocalhostName(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "localhost" || host.endsWith(".localhost");
}

export function isPrivateIpAddress(address: string): boolean {
  const value = address.toLowerCase();

  const isPrivateIpv4Parts = (parts: number[]) => {
    if (
      parts.length !== 4 ||
      parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    ) {
      return false;
    }

    const [a, b] = parts;
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  };

  if (value === "::1" || value === "0:0:0:0:0:0:0:1" || value === "0.0.0.0") {
    return true;
  }

  if (value.includes(":")) {
    const ipv4MappedMatch = value.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (ipv4MappedMatch) {
      return isPrivateIpAddress(ipv4MappedMatch[1]);
    }

    return (
      value.startsWith("fc") ||
      value.startsWith("fd") ||
      value.startsWith("fe80:") ||
      value === "::"
    );
  }

  const parts = value.split(".").map((part) => Number(part));
  return isPrivateIpv4Parts(parts);
}

export function getSafeUrlPolicy(context: OutboundContext): SafeUrlPolicy {
  const profile = getOutboundPolicyProfile();
  const localNetworkProxyAllowed = profile.allowLocalNetworkProxy;

  switch (context) {
    case "provider":
    case "rag":
    case "search":
      return {
        context,
        allowedProtocols: localNetworkProxyAllowed
          ? ["https:", "http:"]
          : ["https:"],
        allowLocalhost: localNetworkProxyAllowed,
        allowPrivateNetwork: localNetworkProxyAllowed,
        allowLocalHttp: localNetworkProxyAllowed,
        hostedProxyBlocked:
          profile.mode === "hosted" && !localNetworkProxyAllowed,
        profile,
      };
    case "docs":
      return {
        context,
        allowedProtocols: ["https:"],
        allowedHosts: [
          "api.cloud.llamaindex.ai",
          "mineru.net",
          "oss-mineru.openxlab.org.cn",
          "mineru.oss-cn-shanghai.aliyuncs.com",
          "cdn-mineru.openxlab.org.cn",
        ],
        profile,
      };
    case "voice":
      return {
        context,
        allowedProtocols: ["https:"],
        allowedHosts: ["api.elevenlabs.io", "api.xiaomimimo.com"],
        profile,
      };
    case "agent":
      return {
        context,
        allowedProtocols: ["https:"],
        allowedHosts: ["registry.npmmirror.com"],
        profile,
      };
    case "metadata":
      return {
        context,
        allowedProtocols: ["https:"],
        allowedHosts: ["basellm.github.io"],
        profile,
      };
    case "pluginManifest":
    case "plugin":
    case "sharedStore":
    default:
      return {
        context,
        allowedProtocols: ["https:"],
        allowLocalhost: false,
        allowPrivateNetwork: false,
        profile,
      };
  }
}

function createOutboundPolicyError(
  policy: SafeUrlPolicy,
  message: string,
): Error {
  return policy.hostedProxyBlocked
    ? new HostedProxyBlockedError(message)
    : new Error(message);
}

export function validateOutboundUrl(
  value: string | URL,
  policy: SafeUrlPolicy,
): ValidatedOutboundRequest {
  let url: URL;
  try {
    url = value instanceof URL ? value : new URL(value);
  } catch {
    throw new Error(`Invalid outbound URL for ${policy.context}`);
  }

  if (url.username || url.password) {
    throw new Error("Outbound URLs must not include embedded credentials");
  }

  const allowedProtocols = policy.allowedProtocols || ["https:"];
  if (!allowedProtocols.includes(url.protocol as "https:" | "http:")) {
    throw createOutboundPolicyError(
      policy,
      `Protocol ${url.protocol} is not allowed`,
    );
  }

  const hostname = url.hostname.toLowerCase();
  if (policy.allowedHosts?.length) {
    const isAllowedHost = policy.allowedHosts.some((host) => {
      const expected = host.toLowerCase();
      return hostname === expected || hostname.endsWith(`.${expected}`);
    });
    if (!isAllowedHost) {
      throw new Error(`Host ${hostname} is not trusted for ${policy.context}`);
    }
  }

  const isLocalhost = isLocalhostName(hostname);
  const isPrivateLiteral = isPrivateIpAddress(hostname);

  if (isLocalhost && !policy.allowLocalhost) {
    throw createOutboundPolicyError(
      policy,
      "Localhost outbound requests are blocked",
    );
  }

  if (isPrivateLiteral && !policy.allowPrivateNetwork) {
    throw createOutboundPolicyError(
      policy,
      "Private network outbound requests are blocked",
    );
  }

  if (url.protocol === "http:") {
    const isLocalHttp = isLocalhost || isPrivateLiteral;
    if (!policy.allowHttp && !(policy.allowLocalHttp && isLocalHttp)) {
      throw createOutboundPolicyError(
        policy,
        "Plain HTTP outbound requests are blocked",
      );
    }
  }

  return {
    url,
    policy,
    hostname,
    protocol: url.protocol,
  };
}
