# 代码质量基线审计

> 生成时间 2026-06-03T16:35:01.347Z

## 审计范围

- 扫描文件数: 159
- 生产代码文件数: 94
- 函数复杂度阈值: 12
- 函数长度阈值: 80

## 摘要

- 缺少中文注释的热点文件: 0
- 超过复杂度阈值的文件: 21
- 超过函数长度阈值的文件: 13
- 超过复杂度阈值的函数: 54
- 超过长度阈值的函数: 16

## 复杂度热点函数

- src/action/weeklyEnhancement.ts:1581 | applyWeeklyEnhancement | complexity=101 | length=269
- src/action/dailyReport.ts:1004 | applyDailyEnhancement | complexity=59 | length=132
- src/auth/localSetup.ts:229 | renderLocalAuthSetupGuide | complexity=34 | length=114
- src/signal/ecosystemFocusObserver.ts:1452 | collectEcosystemFocusObserver | complexity=28 | length=157
- src/action/dailyVerification.ts:185 | freshnessChecks | complexity=27 | length=62
- src/agentMemory/receipts.ts:616 | resolveTaskClassification | complexity=23 | length=73
- src/visualConsole/build.ts:1300 | buildKnowledgeBaseView | complexity=23 | length=60
- src/agentMemory/routing.ts:198 | bindTaskScopeGates | complexity=22 | length=49
- src/auth/doctor.ts:57 | buildAuthDoctorReport | complexity=21 | length=91
- src/visualConsole/weeklyMarkdown.ts:49 | parseSupportProject | complexity=21 | length=50
- src/visualConsole/index.ts:28 | renderVisualConsole | complexity=20 | length=26
- src/signal/agentsRadarConnector.ts:434 | fetchAgentsRadarSignalsDetailed | complexity=19 | length=91
- src/signal/ecosystemFocusObserver.ts:785 | scoreObserverEntry | complexity=19 | length=47
- src/visualConsole/build.ts:516 | mergeWeeklyMarkdownWithStructuredReport | complexity=18 | length=41
- src/visualConsole/build.ts:565 | <anonymous> | complexity=18 | length=36

## 长函数热点

- src/action/weeklyEnhancement.ts:1581 | applyWeeklyEnhancement | length=269 | complexity=101
- src/signal/ecosystemFocusObserver.ts:1272 | enhanceObserverEntriesWithAgent | length=179 | complexity=16
- src/action/weeklyEnhancement.ts:1333 | buildWeeklyEnhancementPrompt | length=167 | complexity=1
- src/signal/ecosystemFocusObserver.ts:1452 | collectEcosystemFocusObserver | length=157 | complexity=28
- src/cli.ts:509 | runDaily | length=155 | complexity=6
- src/action/dailyReport.ts:1004 | applyDailyEnhancement | length=132 | complexity=59
- src/auth/localSetup.ts:229 | renderLocalAuthSetupGuide | length=114 | complexity=34
- src/action/runSummary.ts:523 | buildDailyRunSummary | length=108 | complexity=14
- src/config.ts:503 | parseEcosystemFocusConfig | length=99 | complexity=5
- src/signal/ecosystemFocusObserver.ts:833 | finalizeObserverEntries | length=95 | complexity=1
- src/auth/doctor.ts:57 | buildAuthDoctorReport | length=91 | complexity=21
- src/signal/agentsRadarConnector.ts:434 | fetchAgentsRadarSignalsDetailed | length=91 | complexity=19
- src/action/projectBriefs.ts:490 | hasConcreteDescriptionSignal | length=91 | complexity=7
- src/agentMemory/projectFacts.ts:129 | extractAgentReadmeFacts | length=88 | complexity=1
- src/auth/betterAuth.ts:283 | buildBetterAuthRuntime | length=84 | complexity=7

## 大文件热点

- src/action/weeklyEnhancement.ts | total_lines=1954 | code_lines=1805 | max_complexity=101 | max_length=269
- src/signal/ecosystemFocusObserver.ts | total_lines=1622 | code_lines=1490 | max_complexity=28 | max_length=179
- src/action/dailyReport.ts | total_lines=1395 | code_lines=1275 | max_complexity=59 | max_length=132
- src/visualConsole/build.ts | total_lines=1360 | code_lines=1262 | max_complexity=23 | max_length=64
- src/cli.ts | total_lines=1136 | code_lines=1025 | max_complexity=10 | max_length=155
- src/action/projectBriefs.ts | total_lines=1067 | code_lines=969 | max_complexity=13 | max_length=91
- src/agentMemory/workflow.ts | total_lines=1034 | code_lines=964 | max_complexity=11 | max_length=69
- src/signal/githubMetrics.ts | total_lines=1033 | code_lines=899 | max_complexity=11 | max_length=60
- src/agentMemory/receipts.ts | total_lines=843 | code_lines=779 | max_complexity=23 | max_length=73
- src/action/runSummary.ts | total_lines=813 | code_lines=751 | max_complexity=14 | max_length=108
- src/signal/index.ts | total_lines=755 | code_lines=692 | max_complexity=16 | max_length=83
- src/config.ts | total_lines=753 | code_lines=693 | max_complexity=7 | max_length=99
- src/types.ts | total_lines=732 | code_lines=676 | max_complexity=0 | max_length=0
- src/auth/betterAuth.ts | total_lines=629 | code_lines=567 | max_complexity=13 | max_length=84
- src/signal/agentsRadarConnector.ts | total_lines=533 | code_lines=463 | max_complexity=19 | max_length=91

## 缺少中文注释的热点文件

- 当前热点文件都已包含中文注释

## 建议优先治理目标

- src/action/weeklyEnhancement.ts
- src/action/dailyReport.ts
- src/auth/localSetup.ts
- src/signal/ecosystemFocusObserver.ts
- src/action/dailyVerification.ts
- src/cli.ts

