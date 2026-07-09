import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getProviderApiKey,
  getProviderModelsUrl,
  getSafeUrlPolicy,
  isPrivateIpAddress,
  normalizeProviderBaseUrl,
  validateOutboundUrl,
} from "../lib/security/urlPolicy";
import { toPublicErrorPayload } from "../lib/errors";

vi.mock("server-only", () => ({}));

describe("url policy and provider runtime helpers", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("normalizes OpenAI-compatible base URLs without duplicating /v1", () => {
    expect(normalizeProviderBaseUrl("https://api.example.com", "OpenAI")).toBe(
      "https://api.example.com/v1",
    );
    expect(
      normalizeProviderBaseUrl("https://api.example.com/v1/", "OpenAI"),
    ).toBe("https://api.example.com/v1");
  });

  it("normalizes OpenAI Compatible base URLs like OpenAI", () => {
    expect(
      normalizeProviderBaseUrl(
        "https://compat.example.com",
        "OpenAI Compatible",
      ),
    ).toBe("https://compat.example.com/v1");
  });

  it("returns default LiteLLM base URL when no URL is provided", () => {
    expect(normalizeProviderBaseUrl(undefined, "LiteLLM")).toBe(
      "http://localhost:4000/v1",
    );
    expect(normalizeProviderBaseUrl("default", "LiteLLM")).toBe(
      "http://localhost:4000/v1",
    );
  });

  it("preserves /v1 suffix on custom LiteLLM base URLs", () => {
    expect(
      normalizeProviderBaseUrl("https://litellm.example.com/v1", "LiteLLM"),
    ).toBe("https://litellm.example.com/v1");
  });

  it("appends /v1 to custom LiteLLM base URLs without it", () => {
    expect(
      normalizeProviderBaseUrl("https://litellm.example.com", "LiteLLM"),
    ).toBe("https://litellm.example.com/v1");
  });

  it("returns LiteLLM models URL under /v1/models", () => {
    expect(getProviderModelsUrl(undefined, "LiteLLM")).toBe(
      "http://localhost:4000/v1/models",
    );
    expect(getProviderModelsUrl("https://litellm.example.com", "LiteLLM")).toBe(
      "https://litellm.example.com/v1/models",
    );
  });

  it("keeps Gemini SDK base URL at the service root", () => {
    expect(
      normalizeProviderBaseUrl(
        "https://generativelanguage.googleapis.com/v1beta",
        "Gemini",
      ),
    ).toBe("https://generativelanguage.googleapis.com");
    expect(
      getProviderModelsUrl(
        "https://generativelanguage.googleapis.com",
        "Gemini",
      ),
    ).toBe("https://generativelanguage.googleapis.com/v1beta/models");
  });

  it("does not use legacy provider environment variables as API key fallbacks", () => {
    process.env.GEMINI_API_KEY = "gemini-env-secret";
    process.env.API_KEY = "api-env-secret";
    process.env.OPENAI_API_KEY = "openai-env-secret";

    expect(getProviderApiKey({ type: "Gemini" })).toBe("");
    expect(getProviderApiKey({ type: "OpenAI" })).toBe("");
    expect(getProviderApiKey({ type: "OpenAI Compatible" })).toBe("");
  });

  it("blocks unsafe plugin URLs by default", () => {
    expect(() =>
      validateOutboundUrl(
        "http://example.com/openapi.json",
        getSafeUrlPolicy("plugin"),
      ),
    ).toThrow(/Protocol|HTTP/i);
    expect(() =>
      validateOutboundUrl(
        "https://127.0.0.1/openapi.json",
        getSafeUrlPolicy("plugin"),
      ),
    ).toThrow(/Private network|Localhost/i);
  });

  it("allows configured voice provider hosts only", () => {
    expect(
      validateOutboundUrl(
        "https://api.elevenlabs.io/v1/text-to-speech/voice-id",
        getSafeUrlPolicy("voice"),
      ).hostname,
    ).toBe("api.elevenlabs.io");
    expect(
      validateOutboundUrl(
        "https://api.xiaomimimo.com/v1/chat/completions",
        getSafeUrlPolicy("voice"),
      ).hostname,
    ).toBe("api.xiaomimimo.com");
    expect(() =>
      validateOutboundUrl(
        "https://example.com/v1/chat/completions",
        getSafeUrlPolicy("voice"),
      ),
    ).toThrow(/not trusted for voice/i);
  });

  it("allows explicitly self-hosted provider URLs", () => {
    const result = validateOutboundUrl(
      "http://localhost:11434/v1",
      getSafeUrlPolicy("provider"),
    );
    expect(result.hostname).toBe("localhost");
  });

  it("blocks local provider proxying in hosted mode with a public error code", () => {
    process.env.DEPLOYMENT_MODE = "hosted";
    delete process.env.ALLOW_LOCAL_NETWORK_PROXY;

    let thrown: unknown;
    try {
      validateOutboundUrl(
        "http://localhost:11434/v1",
        getSafeUrlPolicy("provider"),
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(toPublicErrorPayload(thrown)).toMatchObject({
      code: "HOSTED_PROXY_BLOCKED",
      statusCode: 403,
    });
  });

  it("allows explicit local provider proxy opt-in in hosted mode", () => {
    process.env.DEPLOYMENT_MODE = "hosted";
    process.env.ALLOW_LOCAL_NETWORK_PROXY = "true";

    const result = validateOutboundUrl(
      "http://localhost:11434/v1",
      getSafeUrlPolicy("provider"),
    );

    expect(result.hostname).toBe("localhost");
  });

  it("detects private IPv4-mapped IPv6 and CGNAT addresses", () => {
    expect(isPrivateIpAddress("::ffff:172.16.0.2")).toBe(true);
    expect(isPrivateIpAddress("::ffff:169.254.10.20")).toBe(true);
    expect(isPrivateIpAddress("100.64.0.1")).toBe(true);
  });

  it("blocks redirects from trusted plugin URLs to private network targets", async () => {
    const { safeFetch } = await import("../lib/security/safeFetch");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: {
          location: "https://127.0.0.1/admin",
        },
      }),
    );

    await expect(
      safeFetch(
        "https://93.184.216.34/openapi.json",
        { method: "GET" },
        { policy: getSafeUrlPolicy("plugin") },
      ),
    ).rejects.toThrow(/Private network|Localhost/i);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("strips sensitive headers on cross-origin redirects", async () => {
    const { safeFetch } = await import("../lib/security/safeFetch");
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location: "https://93.184.216.35/next",
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
        }),
      );

    await safeFetch(
      "https://93.184.216.34/start",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer secret",
          "X-API-Key": "secret",
          "X-Goog-API-Key": "secret",
          "Content-Type": "application/json",
        },
      },
      { policy: getSafeUrlPolicy("plugin") },
    );

    const redirectedInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const redirectedHeaders = new Headers(redirectedInit.headers);

    expect(redirectedHeaders.get("authorization")).toBeNull();
    expect(redirectedHeaders.get("x-api-key")).toBeNull();
    expect(redirectedHeaders.get("x-goog-api-key")).toBeNull();
    expect(redirectedHeaders.get("content-type")).toBe("application/json");
  });

  it("removes merged user abort listeners after successful safe fetches", async () => {
    const { safeFetch } = await import("../lib/security/safeFetch");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ ok: true }),
    );
    const userController = new AbortController();
    const addSpy = vi.spyOn(userController.signal, "addEventListener");
    const removeSpy = vi.spyOn(userController.signal, "removeEventListener");

    await safeFetch(
      "https://93.184.216.34/openapi.json",
      { method: "GET", signal: userController.signal },
      { policy: getSafeUrlPolicy("plugin") },
    );

    expect(addSpy).toHaveBeenCalledWith("abort", expect.any(Function), {
      once: true,
    });
    expect(removeSpy).toHaveBeenCalledWith("abort", addSpy.mock.calls[0]?.[1]);
  });

  it("times out while reading stalled safe fetch response bodies", async () => {
    vi.useFakeTimers();
    const { safeFetchText } = await import("../lib/security/safeFetch");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(new ReadableStream()),
    );

    const result = safeFetchText(
      "https://93.184.216.34/openapi.json",
      { method: "GET" },
      { policy: getSafeUrlPolicy("plugin"), timeoutMs: 25 },
    );
    const expectation = expect(result).rejects.toThrow(
      /Request timed out after 25ms/i,
    );

    await vi.advanceTimersByTimeAsync(25);

    await expectation;
  });
});
