# 代码质量基线审计

> 生成时间 2026-04-26T15:57:52.160Z

## 审计范围

- 扫描文件数: 48
- 生产代码文件数: 31
- 函数复杂度阈值: 10
- 函数长度阈值: 60

## 摘要

- 缺少中文注释的热点文件: 6
- 超过复杂度阈值的文件: 9
- 超过函数长度阈值的文件: 9
- 超过复杂度阈值的函数: 14
- 超过长度阈值的函数: 11

## 复杂度热点函数

- src/filter/scoring.ts:125 | inferConfidence | complexity=42 | length=51
- src/signal/rawSignalSchema.ts:37 | validateRawSignal | complexity=30 | length=81
- src/action/runSummary.ts:265 | recommendedActions | complexity=25 | length=67
- src/signal/index.ts:142 | collectRawSignalsDetailed | complexity=24 | length=148
- src/action/dailyVerification.ts:24 | buildVerifyDailyResult | complexity=20 | length=101
- src/filter/scoring.ts:99 | inferAntiNoiseFlags | complexity=20 | length=25
- src/signal/trendshiftConnector.ts:115 | fetchTrendshiftSignalsDetailed | complexity=18 | length=80
- src/filter/scoring.ts:451 | inferRisks | complexity=18 | length=25
- src/filter/scoring.ts:422 | inferParadigm | complexity=15 | length=28
- src/signal/githubMetrics.ts:283 | seedGitHubRepoMetricsCacheFromSignal | complexity=14 | length=19
- src/signal/trendshiftParser.ts:150 | parseNextFlightPayload | complexity=13 | length=37
- src/action/runSummary.ts:194 | watchouts | complexity=13 | length=34
- src/cli.ts:34 | parseArgs | complexity=13 | length=23
- src/signal/githubMetrics.ts:199 | fetchGitHubRepoMetricsFromHtml | complexity=12 | length=62
- src/signal/githubMetrics.ts:303 | fetchGitHubRepoMetricsDetailed | complexity=10 | length=66

## 长函数热点

- src/signal/index.ts:142 | collectRawSignalsDetailed | length=148 | complexity=24
- src/action/dailyVerification.ts:24 | buildVerifyDailyResult | length=101 | complexity=20
- src/signal/rawSignalSchema.ts:37 | validateRawSignal | length=81 | complexity=30
- src/signal/trendshiftConnector.ts:115 | fetchTrendshiftSignalsDetailed | length=80 | complexity=18
- src/config.ts:179 | loadConfig | length=79 | complexity=5
- src/filter/scoring.ts:254 | scoreArchitectureShift | length=73 | complexity=9
- src/action/runSummary.ts:393 | renderDailyRunSummary | length=72 | complexity=6
- src/action/runSummary.ts:265 | recommendedActions | length=67 | complexity=25
- src/normalize.ts:147 | normalizeSignals | length=67 | complexity=4
- src/signal/githubMetrics.ts:303 | fetchGitHubRepoMetricsDetailed | length=66 | complexity=10
- src/signal/githubMetrics.ts:199 | fetchGitHubRepoMetricsFromHtml | length=62 | complexity=12
- src/cli.ts:96 | runDaily | length=59 | complexity=3
- src/normalize.ts:159 | <anonymous> | length=53 | complexity=9
- src/signal/agentsRadarConnector.ts:41 | pickDate | length=52 | complexity=9
- src/action/runSummary.ts:333 | buildDailyRunSummary | length=52 | complexity=4

## 大文件热点

- src/filter/scoring.ts | total_lines=543 | code_lines=493 | max_complexity=42 | max_length=73
- src/action/runSummary.ts | total_lines=465 | code_lines=418 | max_complexity=25 | max_length=72
- src/signal/githubMetrics.ts | total_lines=374 | code_lines=326 | max_complexity=14 | max_length=66
- src/signal/index.ts | total_lines=290 | code_lines=271 | max_complexity=24 | max_length=148
- src/config.ts | total_lines=258 | code_lines=236 | max_complexity=5 | max_length=79
- src/cli.ts | total_lines=255 | code_lines=218 | max_complexity=13 | max_length=59
- src/normalize.ts | total_lines=214 | code_lines=188 | max_complexity=9 | max_length=67
- src/signal/trendshiftConnector.ts | total_lines=203 | code_lines=184 | max_complexity=18 | max_length=80
- src/signal/trendshiftParser.ts | total_lines=195 | code_lines=169 | max_complexity=13 | max_length=43
- src/types.ts | total_lines=191 | code_lines=173 | max_complexity=0 | max_length=0
- src/llmClassification.ts | total_lines=176 | code_lines=153 | max_complexity=5 | max_length=32
- src/action/dailyReport.ts | total_lines=153 | code_lines=136 | max_complexity=3 | max_length=46
- src/signal/agentsRadarConnector.ts | total_lines=147 | code_lines=129 | max_complexity=9 | max_length=52
- src/action/dailyVerification.ts | total_lines=146 | code_lines=129 | max_complexity=20 | max_length=101
- src/signal/rawSignalSchema.ts | total_lines=122 | code_lines=106 | max_complexity=30 | max_length=81

## 缺少中文注释的热点文件

- src/action/runSummary.ts | chinese_comment_blocks=0 | max_complexity=25
- src/filter/scoring.ts | chinese_comment_blocks=0 | max_complexity=42
- src/providers/anthropic.ts | chinese_comment_blocks=0 | max_complexity=3
- src/providers/index.ts | chinese_comment_blocks=0 | max_complexity=4
- src/providers/openai-compatible.ts | chinese_comment_blocks=0 | max_complexity=2
- src/signal/githubMetrics.ts | chinese_comment_blocks=0 | max_complexity=14

## 建议优先治理目标

- src/filter/scoring.ts
- src/signal/rawSignalSchema.ts
- src/action/runSummary.ts
- src/signal/index.ts
- src/action/dailyVerification.ts
- src/signal/trendshiftConnector.ts
- src/config.ts
- src/providers/anthropic.ts

