import { getSafeUrlPolicy } from "./urlPolicy";

export type SearchProvider =
  "tavily" | "firecrawl" | "exa" | "bocha" | "searxng" | "you";

export function getSearchProviderPolicy(provider: SearchProvider) {
  void provider;
  return getSafeUrlPolicy("search");
}
