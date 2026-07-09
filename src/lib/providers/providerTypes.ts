import type { ProviderType } from "../../types";

export const OPENAI_PROVIDER_TYPE = "OpenAI" as const;
export const OPENAI_COMPATIBLE_PROVIDER_TYPE = "OpenAI Compatible" as const;
export const GEMINI_PROVIDER_TYPE = "Gemini" as const;
export const LITELLM_PROVIDER_TYPE = "LiteLLM" as const;

export function isProviderType(value: unknown): value is ProviderType {
  return (
    value === GEMINI_PROVIDER_TYPE ||
    value === OPENAI_PROVIDER_TYPE ||
    value === OPENAI_COMPATIBLE_PROVIDER_TYPE ||
    value === LITELLM_PROVIDER_TYPE
  );
}

export function isOpenAIProviderType(
  value: unknown,
): value is
  | typeof OPENAI_PROVIDER_TYPE
  | typeof OPENAI_COMPATIBLE_PROVIDER_TYPE
  | typeof LITELLM_PROVIDER_TYPE {
  return (
    value === OPENAI_PROVIDER_TYPE ||
    value === OPENAI_COMPATIBLE_PROVIDER_TYPE ||
    value === LITELLM_PROVIDER_TYPE
  );
}
