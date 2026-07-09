import { describe, expect, it } from "vitest";
import {
  PROVIDER_CONFIG_LIMITS,
  PROVIDER_MODEL_LIMITS,
} from "../config/limits";
import {
  migrateCoreSettingsState,
  normalizeModelProvider,
  normalizeModelProviders,
} from "../lib/providers/config";

describe("provider config normalization", () => {
  it("trims provider fields and normalizes models", () => {
    const provider = normalizeModelProvider({
      id: " PROVIDER ",
      name: "x".repeat(PROVIDER_CONFIG_LIMITS.maxProviderNameChars + 10),
      type: "Other",
      baseUrl: ` https://example.com/${"b".repeat(
        PROVIDER_CONFIG_LIMITS.maxBaseUrlChars,
      )}`,
      apiKey: "k".repeat(PROVIDER_CONFIG_LIMITS.maxApiKeyChars + 10),
      enabled: "yes",
      models: [" models/gemini-pro ", "gemini-pro", "", 42, "custom-model"],
      modelsList: ["gemini-pro"],
    });

    expect(provider).toMatchObject({
      id: "PROVIDER",
      type: "OpenAI Compatible",
      enabled: true,
      models: ["gemini-pro"],
      modelsList: ["gemini-pro"],
    });
    expect(provider?.name).toHaveLength(
      PROVIDER_CONFIG_LIMITS.maxProviderNameChars,
    );
    expect(provider?.baseUrl).toHaveLength(
      PROVIDER_CONFIG_LIMITS.maxBaseUrlChars,
    );
    expect(provider?.apiKey).toHaveLength(
      PROVIDER_CONFIG_LIMITS.maxApiKeyChars,
    );
  });

  it("keeps selected models when no fetched model list exists", () => {
    const provider = normalizeModelProvider({
      id: "A",
      type: "Gemini",
      models: ["model-a"],
      modelsList: [],
    });

    expect(provider?.models).toEqual(["model-a"]);
    expect(provider?.modelsList).toEqual([]);
  });

  it("accepts OpenAI Compatible as a provider type", () => {
    expect(
      normalizeModelProvider({
        id: "COMPAT",
        type: "OpenAI Compatible",
      })?.type,
    ).toBe("OpenAI Compatible");
  });

  it("accepts LiteLLM as a valid provider type", () => {
    const provider = normalizeModelProvider({
      id: "LITELLM",
      name: "LiteLLM Proxy",
      type: "LiteLLM",
      baseUrl: "http://localhost:4000",
      apiKey: "sk-litellm-key",
      models: ["gpt-4o", "claude-sonnet-4-20250514"],
      modelsList: ["gpt-4o", "claude-sonnet-4-20250514"],
    });

    expect(provider).toMatchObject({
      id: "LITELLM",
      name: "LiteLLM Proxy",
      type: "LiteLLM",
      baseUrl: "http://localhost:4000",
      apiKey: "sk-litellm-key",
      models: ["gpt-4o", "claude-sonnet-4-20250514"],
      modelsList: ["gpt-4o", "claude-sonnet-4-20250514"],
    });
  });

  it("defaults unknown provider types to OpenAI Compatible", () => {
    expect(
      normalizeModelProvider({
        id: "FALLBACK",
        type: "Other",
      })?.type,
    ).toBe("OpenAI Compatible");
  });

  it("preserves persisted OpenAI providers", async () => {
    const migrated = await migrateCoreSettingsState({
      providers: [
        {
          id: "OLD",
          type: "OpenAI",
          models: ["gpt-4o-mini"],
          modelsList: ["gpt-4o-mini"],
        },
      ],
    });

    expect(migrated.providers?.[0]?.type).toBe("OpenAI");
  });

  it("filters invalid providers and caps provider/model counts", () => {
    const providers = Array.from(
      { length: PROVIDER_CONFIG_LIMITS.maxProviders + 5 },
      (_, index) => ({
        id: `P${index}`,
        type: "OpenAI",
        models: Array.from(
          { length: PROVIDER_MODEL_LIMITS.maxModels + 5 },
          (__, modelIndex) => `model-${modelIndex}`,
        ),
      }),
    );

    const normalized = normalizeModelProviders([
      null,
      { id: "" },
      ...providers,
      { id: "P1", type: "OpenAI" },
    ]);

    expect(normalized).toHaveLength(PROVIDER_CONFIG_LIMITS.maxProviders);
    expect(normalized[0]?.models).toHaveLength(PROVIDER_MODEL_LIMITS.maxModels);
    expect(normalized[1]?.id).toBe("P1");
  });
});
