export type ProjectsWorkbenchSortMode = "score" | "growth";

export interface ProjectsWorkbenchState {
  search: string;
  sort: ProjectsWorkbenchSortMode;
  paradigm: string;
  persistence: string;
  page?: number;
  pageSize?: number;
}

export interface ProjectsWorkbenchCardRecord {
  searchName: string;
  searchDescription: string;
  searchMeta: string;
  score: number;
  growth: number;
  order: number;
  paradigm: string;
  persistence: string;
}

export interface ProjectsWorkbenchPagination<T> {
  items: T[];
  currentPage: number;
  pageCount: number;
  pageSize: number;
  totalCount: number;
  startIndex: number;
  endIndex: number;
}

export const DIRECT_SEARCH_QUALITY_SAMPLE_SIZE = 3;
export const GENERIC_DIRECT_SEARCH_TOKENS = new Set([
  "agent",
  "agents",
  "agentic",
  "ai",
  "llm",
  "llms",
  "project",
  "projects",
  "repo",
  "repos",
  "tool",
  "tools",
  "app",
  "apps",
  "system",
  "systems",
  "assistant",
  "assistants",
  "智能体",
  "代理",
  "助手",
  "项目",
  "工具",
  "应用",
  "系统",
  "开源",
  "仓库",
]);

export const CJK_QUERY_NOISE_PATTERNS = [
  "能不能",
  "可以",
  "有没有",
  "有哪些",
  "有什么",
  "怎么样",
  "今天",
  "最近",
  "当前",
  "现在",
  "目前",
  "值得看",
  "关注",
  "推荐",
  "查询",
  "搜索",
  "看看",
  "帮我",
  "适合",
  "相关",
  "一些",
  "一个",
  "这个",
  "那个",
  "哪些",
  "什么",
  "哪个",
  "哪类",
  "怎么",
  "如何",
  "能",
  "帮",
  "找",
  "做",
  "的",
];

export function normalizeProjectSearchText(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function tokenizeProjectSearchText(value: string): string[] {
  return normalizeProjectSearchText(value)
    .split(/[\s,.;:!?()[\]{}"'`]+/)
    .filter(Boolean);
}

export function projectSearchTextHasCjk(value: string): boolean {
  return /[\u3400-\u9fff]/u.test(value);
}

export function extractMeaningfulProjectSearchCjkTerms(value: string): string[] {
  const terms: string[] = [];
  for (const match of value.matchAll(/[\u3400-\u9fff]+/gu)) {
    let segment = match[0];
    for (const pattern of CJK_QUERY_NOISE_PATTERNS) {
      segment = segment.split(pattern).join(" ");
    }
    terms.push(...segment.split(/\s+/).map((term) => term.trim()).filter((term) => term.length >= 2));
  }
  return terms;
}

export function projectSearchRecordContainsTerm(card: Pick<ProjectsWorkbenchCardRecord, "searchName" | "searchDescription" | "searchMeta">, term: string): boolean {
  const normalizedTerm = normalizeProjectSearchText(term);
  if (!normalizedTerm) return false;
  const haystacks = [card.searchName, card.searchDescription, card.searchMeta].map((value) => normalizeProjectSearchText(value));
  if (projectSearchTextHasCjk(normalizedTerm) && haystacks.some((haystack) => haystack.includes(normalizedTerm))) return true;

  const termParts = tokenizeProjectSearchText(normalizedTerm);
  if (termParts.length === 0) return false;
  return termParts.every((part) => haystacks.some((haystack) => tokenizeProjectSearchText(haystack).includes(part)));
}

export function directSearchTokenRecordCount<T extends Pick<ProjectsWorkbenchCardRecord, "searchName" | "searchDescription" | "searchMeta">>(records: T[], token: string): number {
  return records.reduce((count, record) => count + (projectSearchRecordContainsTerm(record, token) ? 1 : 0), 0);
}

export function isCommonDirectSearchToken<T extends Pick<ProjectsWorkbenchCardRecord, "searchName" | "searchDescription" | "searchMeta">>(records: T[], token: string): boolean {
  if (records.length === 0) return false;
  const count = directSearchTokenRecordCount(records, token);
  const commonCount = Math.max(3, Math.ceil(records.length * 0.22));
  return count >= commonCount;
}

export function directSearchLooksNaturalLanguage(rawQuery: string, tokens: string[]): boolean {
  if (projectSearchTextHasCjk(rawQuery) && CJK_QUERY_NOISE_PATTERNS.some((pattern) => rawQuery.includes(pattern))) return true;
  if (projectSearchTextHasCjk(rawQuery) && tokens.some((token) => GENERIC_DIRECT_SEARCH_TOKENS.has(token))) return true;
  return tokens.length >= 3;
}

export function informativeDirectSearchTerms<T extends Pick<ProjectsWorkbenchCardRecord, "searchName" | "searchDescription" | "searchMeta">>(records: T[], rawQuery: string): string[] {
  const normalizedTokens = tokenizeProjectSearchText(rawQuery);
  const candidates = new Set<string>([...normalizedTokens, ...extractMeaningfulProjectSearchCjkTerms(rawQuery).map((term) => normalizeProjectSearchText(term))]);
  return Array.from(candidates).filter((token) => {
    if (!token || token.length < 2) return false;
    if (GENERIC_DIRECT_SEARCH_TOKENS.has(token)) return false;
    return !isCommonDirectSearchToken(records, token);
  });
}

export function shouldUseDirectProjectSearch<T extends Pick<ProjectsWorkbenchCardRecord, "searchName" | "searchDescription" | "searchMeta">>(
  records: T[],
  rawQuery: string,
  directRecords: T[],
): boolean {
  if (directRecords.length === 0) return false;

  const queryTokens = tokenizeProjectSearchText(rawQuery);
  const looksNaturalLanguage = directSearchLooksNaturalLanguage(rawQuery, queryTokens);
  if (!looksNaturalLanguage) return true;

  const informativeTerms = informativeDirectSearchTerms(records, rawQuery);
  if (informativeTerms.length === 0) return false;

  const sampledDirect = directRecords.slice(0, DIRECT_SEARCH_QUALITY_SAMPLE_SIZE);
  return informativeTerms.some((term) => sampledDirect.some((record) => projectSearchRecordContainsTerm(record, term)));
}

export function scoreProjectSearchField(
  value: string,
  query: string,
  queryTokens: string[],
  weights: { exact: number; prefix: number; substring: number; tokenExact: number; tokenPrefix: number; tokenSubstring: number },
): number {
  const normalizedValue = normalizeProjectSearchText(value);
  if (!normalizedValue) return 0;

  let score = 0;
  if (normalizedValue === query) score += weights.exact;
  else if (normalizedValue.startsWith(query)) score += weights.prefix;
  else if (normalizedValue.includes(query)) score += weights.substring;

  const valueTokens = tokenizeProjectSearchText(normalizedValue);
  queryTokens.forEach((token) => {
    if (valueTokens.includes(token)) score += weights.tokenExact;
    else if (valueTokens.some((candidate) => candidate.startsWith(token))) score += weights.tokenPrefix;
    else if (valueTokens.some((candidate) => candidate.includes(token))) score += weights.tokenSubstring;
  });

  return score;
}

export function rankProjectSearchMatch(card: Pick<ProjectsWorkbenchCardRecord, "searchName" | "searchDescription" | "searchMeta">, query: string): number {
  const normalizedQuery = normalizeProjectSearchText(query);
  if (!normalizedQuery) return 0;

  const queryTokens = tokenizeProjectSearchText(normalizedQuery);
  return (
    scoreProjectSearchField(card.searchName, normalizedQuery, queryTokens, {
      exact: 1600,
      prefix: 1300,
      substring: 1050,
      tokenExact: 320,
      tokenPrefix: 240,
      tokenSubstring: 170,
    }) +
    scoreProjectSearchField(card.searchDescription, normalizedQuery, queryTokens, {
      exact: 520,
      prefix: 420,
      substring: 320,
      tokenExact: 140,
      tokenPrefix: 100,
      tokenSubstring: 70,
    }) +
    scoreProjectSearchField(card.searchMeta, normalizedQuery, queryTokens, {
      exact: 260,
      prefix: 200,
      substring: 150,
      tokenExact: 90,
      tokenPrefix: 60,
      tokenSubstring: 45,
    })
  );
}

export function filterAndSortProjectCards<T extends ProjectsWorkbenchCardRecord>(cards: T[], state: ProjectsWorkbenchState): T[] {
  const normalizedSearch = normalizeProjectSearchText(state.search);

  return cards
    .filter((card) => {
      const relevance = normalizedSearch ? rankProjectSearchMatch(card, normalizedSearch) : 0;
      const matchesSearch = !normalizedSearch || relevance > 0;
      const matchesParadigm = state.paradigm === "all" || card.paradigm === state.paradigm;
      const matchesPersistence = state.persistence === "all" || card.persistence === state.persistence;
      return matchesSearch && matchesParadigm && matchesPersistence;
    })
    .sort((left, right) => {
      if (normalizedSearch) {
        const leftRelevance = rankProjectSearchMatch(left, normalizedSearch);
        const rightRelevance = rankProjectSearchMatch(right, normalizedSearch);
        if (rightRelevance !== leftRelevance) return rightRelevance - leftRelevance;
      }
      const leftValue = state.sort === "growth" ? left.growth : left.score;
      const rightValue = state.sort === "growth" ? right.growth : right.score;
      if (rightValue !== leftValue) return rightValue - leftValue;
      return left.order - right.order;
    })
    .map((card) => card);
}

export function paginateProjectCards<T>(cards: T[], page: number, pageSize: number): ProjectsWorkbenchPagination<T> {
  const safePageSize = Math.max(1, Math.floor(pageSize) || 1);
  const totalCount = cards.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / safePageSize));
  const currentPage = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * safePageSize;
  const endIndex = totalCount === 0 ? 0 : Math.min(startIndex + safePageSize, totalCount);

  return {
    items: cards.slice(startIndex, endIndex),
    currentPage,
    pageCount,
    pageSize: safePageSize,
    totalCount,
    startIndex,
    endIndex,
  };
}
