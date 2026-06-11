# 代码质量基线审计

> 生成时间 2026-05-11T08:25:40.091Z

## 审计范围

- 扫描文件数: 81
- 生产代码文件数: 53
- 函数复杂度阈值: 10
- 函数长度阈值: 60

## 摘要

- 缺少中文注释的热点文件: 0
- 超过复杂度阈值的文件: 14
- 超过函数长度阈值的文件: 8
- 超过复杂度阈值的函数: 36
- 超过长度阈值的函数: 14

## 复杂度热点函数

- src/action/weeklyEnhancement.ts:1056 | applyWeeklyEnhancement | complexity=101 | length=269
- src/action/dailyReport.ts:746 | applyDailyEnhancement | complexity=59 | length=133
- src/action/projectBriefs.ts:540 | buildFamilySpecificBrief | complexity=28 | length=26
- src/action/dailyVerification.ts:185 | freshnessChecks | complexity=27 | length=62
- src/visualConsole/build.ts:251 | buildWeeklyView | complexity=25 | length=67
- src/visualConsole/build.ts:359 | buildKnowledgeBaseView | complexity=23 | length=56
- src/visualConsole/build.ts:185 | buildProjectsView | complexity=22 | length=65
- src/visualConsole/weeklyMarkdown.ts:31 | parseSupportProject | complexity=21 | length=50
- src/visualConsole/build.ts:124 | buildOverviewView | complexity=18 | length=60
- src/visualConsole/index.ts:26 | renderVisualConsole | complexity=18 | length=24
- src/signal/agentsRadarConnector.ts:434 | fetchAgentsRadarSignalsDetailed | complexity=17 | length=85
- src/jsonObject.ts:41 | completeLikelyTruncatedJson | complexity=17 | length=47
- src/visualConsole/weeklyMarkdown.ts:82 | parseCoreTrendCards | complexity=16 | length=48
- src/signal/index.ts:127 | freshnessSummaryCn | complexity=16 | length=42
- src/jsonObject.ts:109 | extractBalancedJsonValues | complexity=15 | length=45

## 长函数热点

- src/action/weeklyEnhancement.ts:1056 | applyWeeklyEnhancement | length=269 | complexity=101
- src/action/weeklyEnhancement.ts:808 | buildWeeklyEnhancementPrompt | length=167 | complexity=1
- src/action/dailyReport.ts:746 | applyDailyEnhancement | length=133 | complexity=59
- src/signal/agentsRadarConnector.ts:434 | fetchAgentsRadarSignalsDetailed | length=85 | complexity=17
- src/signal/index.ts:261 | collectSourceSignalsDetailed | length=83 | complexity=6
- src/action/weeklyEnhancement.ts:976 | buildWeeklyEnhancementDraft | length=79 | complexity=9
- src/signal/index.ts:686 | collectRawSignalsDetailed | length=69 | complexity=3
- src/visualConsole/build.ts:251 | buildWeeklyView | length=67 | complexity=25
- src/cli.ts:302 | runDaily | length=67 | complexity=3
- src/signal/githubRealtimeConnectors.ts:438 | fetchWatchlistLiveActivitySignals | length=66 | complexity=11
- src/visualConsole/build.ts:185 | buildProjectsView | length=65 | complexity=22
- src/signal/agentsRadarConnector.ts:331 | tryGitHubRepoSync | length=65 | complexity=13
- src/action/dailyVerification.ts:185 | freshnessChecks | length=62 | complexity=27
- src/signal/index.ts:353 | collectPrimarySourceSignals | length=61 | complexity=2
- src/visualConsole/build.ts:124 | buildOverviewView | length=60 | complexity=18

## 大文件热点

- src/action/weeklyEnhancement.ts | total_lines=1386 | code_lines=1270 | max_complexity=101 | max_length=269
- src/action/dailyReport.ts | total_lines=1018 | code_lines=924 | max_complexity=59 | max_length=133
- src/signal/githubMetrics.ts | total_lines=974 | code_lines=850 | max_complexity=14 | max_length=60
- src/signal/index.ts | total_lines=755 | code_lines=692 | max_complexity=16 | max_length=83
- src/action/projectBriefs.ts | total_lines=675 | code_lines=618 | max_complexity=28 | max_length=38
- src/action/runSummary.ts | total_lines=665 | code_lines=609 | max_complexity=9 | max_length=59
- src/signal/agentsRadarConnector.ts | total_lines=527 | code_lines=458 | max_complexity=17 | max_length=85
- src/cli.ts | total_lines=520 | code_lines=453 | max_complexity=8 | max_length=67
- src/signal/githubRealtimeConnectors.ts | total_lines=504 | code_lines=448 | max_complexity=11 | max_length=66
- src/types.ts | total_lines=438 | code_lines=402 | max_complexity=0 | max_length=0
- src/visualConsole/build.ts | total_lines=415 | code_lines=390 | max_complexity=25 | max_length=67
- src/config.ts | total_lines=401 | code_lines=356 | max_complexity=7 | max_length=45
- src/action/dailyVerification.ts | total_lines=386 | code_lines=351 | max_complexity=27 | max_length=62
- src/llmClassification.ts | total_lines=321 | code_lines=286 | max_complexity=9 | max_length=47
- src/filter/scoreComponents.ts | total_lines=306 | code_lines=276 | max_complexity=9 | max_length=44

## 缺少中文注释的热点文件

- 当前热点文件都已包含中文注释

## 建议优先治理目标

- src/action/weeklyEnhancement.ts
- src/action/dailyReport.ts
- src/action/projectBriefs.ts
- src/action/dailyVerification.ts
- src/visualConsole/build.ts
- src/signal/agentsRadarConnector.ts
- src/signal/index.ts

