import { describe, expect, it } from "vitest";
import { ProviderRuntimeConfigSchema } from "../lib/api/schemas";

describe("provider runtime schema", () => {
  it("accepts Gemini, OpenAI, LiteLLM, and OpenAI Compatible provider types", () => {
    expect(ProviderRuntimeConfigSchema.parse({ type: "Gemini" }).type).toBe(
      "Gemini",
    );
    expect(ProviderRuntimeConfigSchema.parse({ type: "OpenAI" }).type).toBe(
      "OpenAI",
    );
    expect(ProviderRuntimeConfigSchema.parse({ type: "LiteLLM" }).type).toBe(
      "LiteLLM",
    );
    expect(
      ProviderRuntimeConfigSchema.parse({ type: "OpenAI Compatible" }).type,
    ).toBe("OpenAI Compatible");
  });
});
