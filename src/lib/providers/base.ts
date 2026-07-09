/**
 * Provider 基础抽象层
 */

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { AuthenticationError } from "../errors";
import {
  getProviderApiKey,
  normalizeProviderBaseUrl,
  ProviderRuntimeConfig,
  validateOutboundUrl,
  getSafeUrlPolicy,
} from "../security/urlPolicy";
import { assertOutboundUrlAllowed } from "../security/safeFetch";
import { isOpenAIProviderType } from "./providerTypes";

export type ProviderConfig = ProviderRuntimeConfig;

export interface StreamSender {
  (data: any): void;
}

/**
 * Provider 工厂类
 */
export class ProviderFactory {
  /**
   * 获取有效的 Base URL
   */
  static getEffectiveBaseUrl(
    baseUrl: string | undefined,
    providerType: string,
  ): string | undefined {
    return normalizeProviderBaseUrl(baseUrl, providerType);
  }

  /**
   * 验证并获取 API Key
   */
  static validateApiKey(provider: ProviderConfig): string {
    const apiKey = getProviderApiKey(provider);

    if (!apiKey.trim()) {
      throw new AuthenticationError(
        `${provider.type} API key is not configured. Please add your API key in Settings.`,
      );
    }

    return apiKey;
  }

  static async assertProviderOutboundAllowed(
    provider: ProviderConfig,
  ): Promise<void> {
    const baseUrl = this.getEffectiveBaseUrl(provider.baseUrl, provider.type);
    if (!baseUrl) return;

    await assertOutboundUrlAllowed(baseUrl, {
      policy: getSafeUrlPolicy("provider"),
      timeoutMs: 10_000,
    });
  }

  /**
   * 创建 OpenAI 客户端
   */
  static createOpenAIClient(provider: ProviderConfig): OpenAI {
    const apiKey = this.validateApiKey(provider);
    const baseURL = this.getEffectiveBaseUrl(provider.baseUrl, provider.type);
    if (baseURL) {
      validateOutboundUrl(baseURL, getSafeUrlPolicy("provider"));
    }

    return new OpenAI({ apiKey, baseURL });
  }

  /**
   * 创建 Gemini 客户端
   */
  static createGeminiClient(provider: ProviderConfig): GoogleGenAI {
    const apiKey = this.validateApiKey(provider);
    const baseUrl = this.getEffectiveBaseUrl(provider.baseUrl, "Gemini");
    if (baseUrl) {
      validateOutboundUrl(baseUrl, getSafeUrlPolicy("provider"));
    }

    return new GoogleGenAI({
      apiKey,
      httpOptions: { baseUrl },
    });
  }

  /**
   * 创建客户端（自动选择类型）
   */
  static createClient(provider: ProviderConfig): OpenAI | GoogleGenAI {
    return isOpenAIProviderType(provider.type)
      ? this.createOpenAIClient(provider)
      : this.createGeminiClient(provider);
  }
}
