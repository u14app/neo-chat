import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { runSearchProvider } from "../lib/search/providerAdapters";

describe("search provider adapters", () => {
  it("builds Tavily requests and normalizes source and image results", async () => {
    const controller = new AbortController();
    const fetchJson = vi.fn().mockResolvedValue({
      response: new Response(null, { status: 200 }),
      data: {
        results: [
          {
            title: "Neo",
            content: "fallback content",
            raw_content: "markdown content",
            url: "https://example.com/neo",
          },
          {
            title: "Missing content",
            url: "https://example.com/empty",
          },
        ],
        images: [
          {
            url: "https://example.com/neo.png",
            description: "Neo",
            sourceUrl: "https://example.com/neo",
          },
        ],
      },
    });

    const result = await runSearchProvider({
      provider: "tavily",
      query: '"neo\\chat"',
      scope: "news",
      apiKey: "tvly-key",
      maxResultNumber: 2,
      fetchJson,
      signal: controller.signal,
    });

    expect(fetchJson).toHaveBeenCalledOnce();
    const [url, init, options] = fetchJson.mock.calls[0]!;
    expect(url).toBe("https://api.tavily.com/search");
    expect(init).toMatchObject({
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer tvly-key",
      },
    });
    expect(JSON.parse(init.body as string)).toMatchObject({
      query: "neochat",
      topic: "news",
      max_results: 2,
      include_images: true,
    });
    expect(options).toMatchObject({ timeoutMs: 30_000 });
    expect(result).toEqual({
      sources: [
        {
          title: "Neo",
          content: "markdown content",
          url: "https://example.com/neo",
        },
      ],
      images: [
        {
          url: "https://example.com/neo.png",
          description: "Neo",
          sourceUrl: "https://example.com/neo",
        },
      ],
    });
  });

  it("maps Bocha image descriptions from matching web results", async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      response: new Response(null, { status: 200 }),
      data: {
        data: {
          webPages: {
            value: [
              {
                name: "Bocha Result",
                summary: "summary",
                snippet: "snippet",
                url: "https://example.com/result",
              },
            ],
          },
          images: {
            value: [
              {
                contentUrl: "https://example.com/image.jpg",
                hostPageUrl: "https://example.com/result",
              },
            ],
          },
        },
      },
    });

    const result = await runSearchProvider({
      provider: "bocha",
      query: "neo chat",
      maxResultNumber: 3,
      fetchJson,
    });

    expect(result.images).toEqual([
      {
        url: "https://example.com/image.jpg",
        description: "Bocha Result",
        sourceUrl: "https://example.com/result",
      },
    ]);
  });

  it("builds Firecrawl v2 requests without an API key and maps web and image results", async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      response: new Response(null, { status: 200 }),
      data: {
        data: {
          web: [
            {
              title: "Firecrawl Result",
              description: "snippet",
              markdown: "# Full result",
              url: "https://example.com/firecrawl",
            },
            {
              title: "Missing URL",
              description: "skip",
            },
          ],
          images: [
            {
              title: "Firecrawl image",
              imageUrl: "https://example.com/firecrawl.png",
              url: "https://example.com/firecrawl",
            },
          ],
        },
      },
    });

    const result = await runSearchProvider({
      provider: "firecrawl",
      query: "neo chat",
      maxResultNumber: 4,
      fetchJson,
    });

    expect(fetchJson).toHaveBeenCalledOnce();
    const [url, init] = fetchJson.mock.calls[0]!;
    expect(url).toBe("https://api.firecrawl.dev/v2/search");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    expect((init.headers as Record<string, string>).Authorization).toBe(
      undefined,
    );
    expect(JSON.parse(init.body as string)).toMatchObject({
      query: "neo chat",
      limit: 4,
      sources: ["web", "images"],
    });
    expect(JSON.parse(init.body as string)).not.toHaveProperty("tbs");
    expect(result).toEqual({
      sources: [
        {
          title: "Firecrawl Result",
          content: "# Full result",
          url: "https://example.com/firecrawl",
        },
      ],
      images: [
        {
          url: "https://example.com/firecrawl.png",
          description: "Firecrawl image",
          sourceUrl: "https://example.com/firecrawl",
        },
      ],
    });
  });

  it("sends an explicit Firecrawl time filter when configured", async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      response: new Response(null, { status: 200 }),
      data: { data: { web: [], images: [] } },
    });

    await runSearchProvider({
      provider: "firecrawl",
      query: "recent docs",
      timeRange: "month",
      maxResultNumber: 4,
      fetchJson,
    });

    const [, init] = fetchJson.mock.calls[0]!;
    expect(JSON.parse(init.body as string)).toMatchObject({ tbs: "qdr:m" });
  });

  it("adds Firecrawl authentication only when an optional key is configured", async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      response: new Response(null, { status: 200 }),
      data: { data: { web: [], images: [] } },
    });

    await runSearchProvider({
      provider: "firecrawl",
      query: "neo chat",
      apiKey: "firecrawl-key",
      baseUrl: "http://firecrawl.internal",
      maxResultNumber: 4,
      fetchJson,
    });

    const [url, init] = fetchJson.mock.calls[0]!;
    expect(url).toBe("http://firecrawl.internal/v2/search");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer firecrawl-key",
    });
  });

  it("explains when Firecrawl rejects keyless public-service traffic", async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      response: new Response(null, { status: 403 }),
      data: {
        success: false,
        error:
          "Your IP address looks suspicious, so Firecrawl cannot be used without an API key.",
      },
    });

    await expect(
      runSearchProvider({
        provider: "firecrawl",
        query: "neo chat",
        maxResultNumber: 5,
        fetchJson,
      }),
    ).rejects.toMatchObject({
      name: "SearchProviderError",
      status: 403,
      message: expect.stringMatching(/add a Firecrawl API key/i),
    });
  });

  it("throws provider errors with the upstream status", async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      response: new Response(null, { status: 503 }),
      data: {},
    });

    await expect(
      runSearchProvider({
        provider: "firecrawl",
        query: "neo chat",
        maxResultNumber: 5,
        fetchJson,
      }),
    ).rejects.toMatchObject({
      name: "SearchProviderError",
      message: "Firecrawl search failed",
      status: 503,
    });
  });
});

describe("You.com search adapter", () => {
  const youResponse = {
    results: {
      web: [
        {
          title: "Neo",
          url: "https://example.com/neo",
          description: "Neo description",
          snippets: ["first snippet"],
          thumbnail_url: "https://example.com/neo.png",
        },
        { title: "Empty", url: "https://example.com/empty" },
      ],
      news: [
        {
          title: "News",
          url: "https://example.com/news",
          description: "News description",
        },
      ],
    },
  };

  it("uses the keyless endpoint without an API key", async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      response: new Response(null, { status: 200 }),
      data: youResponse,
    });

    const result = await runSearchProvider({
      provider: "youcom",
      query: "neo chat",
      timeRange: "week",
      maxResultNumber: 5,
      fetchJson,
    });

    const [url, init] = fetchJson.mock.calls[0]!;
    const parsed = new URL(url as string);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://api.you.com/v1/agents/search",
    );
    expect(parsed.searchParams.get("query")).toBe("neo chat");
    expect(parsed.searchParams.get("count")).toBe("5");
    expect(parsed.searchParams.get("freshness")).toBe("week");
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({
      "User-Agent": "youdotcom-integration/u14app-neo-chat",
    });
    expect(init.headers).not.toHaveProperty("X-API-Key");
    expect(result.sources).toEqual([
      {
        title: "Neo",
        url: "https://example.com/neo",
        content: "Neo description\n\nfirst snippet",
      },
      {
        title: "News",
        url: "https://example.com/news",
        content: "News description",
      },
    ]);
    expect(result.images).toEqual([
      {
        url: "https://example.com/neo.png",
        description: "Neo",
        sourceUrl: "https://example.com/neo",
      },
    ]);
  });

  it("uses the keyed endpoint with X-API-Key when a key is set", async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      response: new Response(null, { status: 200 }),
      data: youResponse,
    });

    await runSearchProvider({
      provider: "youcom",
      query: "neo chat",
      apiKey: "ydc-key",
      maxResultNumber: 3,
      fetchJson,
    });

    const [url, init] = fetchJson.mock.calls[0]!;
    expect(url).toBe("https://ydc-index.io/v1/search");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "X-API-Key": "ydc-key",
      "User-Agent": "youdotcom-integration/u14app-neo-chat",
    });
    expect(init.headers).not.toHaveProperty("Authorization");
    expect(JSON.parse(init.body as string)).toEqual({
      query: "neo chat",
      count: 3,
    });
  });

  it.each([
    [401, "You.com keyless search is unavailable"],
    [403, "You.com keyless search is unavailable"],
    [402, "You.com API credits are exhausted"],
    [429, "You.com keyless search limit reached"],
  ])("maps HTTP %i to a provider error", async (status, message) => {
    const fetchJson = vi.fn().mockResolvedValue({
      response: new Response(null, {
        status,
        headers: { "Retry-After": "30" },
      }),
      data: {},
    });

    const error = await runSearchProvider({
      provider: "youcom",
      query: "neo",
      maxResultNumber: 1,
      fetchJson,
    }).catch((e) => e);

    expect(error.name).toBe("SearchProviderError");
    expect(error.status).toBe(status);
    expect(error.message).toContain(message);
    expect(error.retryAfterMs).toBe(30_000);
    if (status === 429) expect(error.code).toBe("SEARCH_RATE_LIMITED");
  });
});
