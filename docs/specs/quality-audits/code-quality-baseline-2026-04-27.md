# 代码质量基线审计

> 生成时间 2026-04-27T05:28:55.681Z

## 审计范围

- 扫描文件数: 54
- 生产代码文件数: 36
- 函数复杂度阈值: 10
- 函数长度阈值: 60

## 摘要

- 缺少中文注释的热点文件: 0
- 超过复杂度阈值的文件: 1
- 超过函数长度阈值的文件: 0
- 超过复杂度阈值的函数: 1
- 超过长度阈值的函数: 0

## 复杂度热点函数

- src/signal/githubMetrics.ts:302 | seedGitHubRepoMetricsCacheFromSignal | complexity=14 | length=19
- src/llm.ts:36 | callLlm | complexity=10 | length=29
- src/signal/agentsRadarConnector.ts:41 | pickDate | complexity=9 | length=52
- src/filter/scoreComponents.ts:225 | scoreAutonomy | complexity=9 | length=44
- src/normalize.ts:98 | trustFlags | complexity=9 | length=18
- src/signal/index.ts:72 | mergeSignalWithMetrics | complexity=9 | length=17
- src/filter/projectNarrative.ts:34 | classificationParadigm | complexity=9 | length=13
- src/normalize.ts:117 | descriptionQuality | complexity=9 | length=13
- src/signal/trendshiftParser.ts:106 | parseArticleCards | complexity=8 | length=43
- src/filter/scoreComponents.ts:183 | scoreCompounding | complexity=8 | length=41
- src/signal/index.ts:53 | annotateSignalMetricsTrust | complexity=8 | length=11
- src/signal/trendshiftConnector.ts:188 | readTrendshiftHtml | complexity=7 | length=38
- src/signal/parse.ts:49 | signalsFromMarkdown | complexity=7 | length=31
- src/signal/trendshiftConnector.ts:231 | fetchTrendshiftSignalsDetailed | complexity=7 | length=23
- src/action/dailyVerification.ts:77 | qualityChecks | complexity=7 | length=22

## 长函数热点

- src/cli.ts:120 | runDaily | length=59 | complexity=3
- src/signal/agentsRadarConnector.ts:41 | pickDate | length=52 | complexity=9
- src/action/runSummary.ts:363 | buildDailyRunSummary | length=51 | complexity=4
- src/normalize.ts:182 | buildNormalizedProject | length=47 | complexity=5
- src/action/runSummary.ts:458 | renderDailyRunSummary | length=46 | complexity=3
- src/action/dailyReport.ts:107 | renderDailyReport | length=46 | complexity=2
- src/signal/agentsRadarConnector.ts:94 | fetchAgentsRadarSignalsDetailed | length=45 | complexity=6
- src/filter/scoreComponents.ts:225 | scoreAutonomy | length=44 | complexity=9
- src/signal/trendshiftParser.ts:106 | parseArticleCards | length=43 | complexity=8
- src/filter/scoreComponents.ts:183 | scoreCompounding | length=41 | complexity=8
- src/signal/githubMetrics.ts:239 | fetchGitHubRepoMetricsFromHtml | length=41 | complexity=6
- src/action/weeklyReport.ts:21 | renderWeeklyReport | length=41 | complexity=4
- src/signal/trendshiftConnector.ts:188 | readTrendshiftHtml | length=38 | complexity=7
- src/action/runSummary.ts:138 | sourceStatuses | length=37 | complexity=3
- src/signal/index.ts:346 | collectRawSignalsDetailed | length=37 | complexity=2

## 大文件热点

- src/action/runSummary.ts | total_lines=504 | code_lines=456 | max_complexity=6 | max_length=51
- src/signal/githubMetrics.ts | total_lines=402 | code_lines=346 | max_complexity=14 | max_length=41
- src/signal/index.ts | total_lines=383 | code_lines=347 | max_complexity=9 | max_length=37
- src/filter/scoreComponents.ts | total_lines=302 | code_lines=272 | max_complexity=9 | max_length=44
- src/config.ts | total_lines=275 | code_lines=246 | max_complexity=4 | max_length=16
- src/cli.ts | total_lines=272 | code_lines=233 | max_complexity=5 | max_length=59
- src/signal/trendshiftConnector.ts | total_lines=262 | code_lines=228 | max_complexity=7 | max_length=38
- src/normalize.ts | total_lines=238 | code_lines=206 | max_complexity=9 | max_length=47
- src/signal/trendshiftParser.ts | total_lines=210 | code_lines=180 | max_complexity=8 | max_length=43
- src/providers/providerErrors.ts | total_lines=195 | code_lines=172 | max_complexity=5 | max_length=18
- src/types.ts | total_lines=191 | code_lines=173 | max_complexity=0 | max_length=0
- src/llmClassification.ts | total_lines=178 | code_lines=154 | max_complexity=5 | max_length=32
- src/filter/confidencePolicy.ts | total_lines=173 | code_lines=158 | max_complexity=6 | max_length=12
- src/action/dailyVerification.ts | total_lines=172 | code_lines=153 | max_complexity=7 | max_length=22
- src/signal/rawSignalSchema.ts | total_lines=165 | code_lines=144 | max_complexity=6 | max_length=22

## 缺少中文注释的热点文件

- 当前热点文件都已包含中文注释

## 建议优先治理目标

- src/signal/githubMetrics.ts
- src/llm.ts
- src/signal/agentsRadarConnector.ts
- src/filter/scoreComponents.ts
- src/normalize.ts
- src/cli.ts
- src/action/runSummary.ts

