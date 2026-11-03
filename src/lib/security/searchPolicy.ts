import { getSafeUrlPolicy } from "./urlPolicy";

export type SearchProvider =
  "tavily" | "firecrawl" | "exa" | "keenable" | "bocha" | "searxng";

export function getSearchProviderPolicy(provider: SearchProvider) {
  void provider;
  return getSafeUrlPolicy("search");
}
