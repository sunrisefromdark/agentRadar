import type {
  KnowledgeBaseViewModel,
  ObserverViewModel,
  OverviewViewModel,
  ProjectsViewModel,
  RunHealthViewModel,
  WeeklyViewModel,
} from "../../src/visualConsole/types.ts";

export type WebRoute = "overview" | "projects" | "weekly" | "run-health" | "observer" | "kb";

export type UiLang = "zh" | "en";
export type UiTheme = "light" | "dark";

export type RenderedRoute =
  | { route: "overview"; model: OverviewViewModel }
  | { route: "projects"; model: ProjectsViewModel }
  | { route: "weekly"; model: WeeklyViewModel }
  | { route: "run-health"; model: RunHealthViewModel }
  | { route: "observer"; model: ObserverViewModel }
  | { route: "kb"; model: KnowledgeBaseViewModel };
