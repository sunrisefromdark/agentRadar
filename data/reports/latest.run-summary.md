# Agent Trend Radar 运行摘要 2026-06-13

> 生成时间 2026-06-20T01:37:39+08:00

## 新鲜度摘要

- overall_daily_status: 数据新鲜，可直接阅读
- main_board_mode: fresh_today_only
- today_fresh_candidate_count: 103
- today_star_count: 71
- context_candidate_count: 204
- pending_confirmation_count: 32
- agents-radar 历史上下文 [context]: fresh_today | effective_date=2026-06-13 | realtime=false | agents-radar 已同步，可读取 2026-06-13 的上下文摘要
- Trendshift 当日命中 [freshness-driving]: fresh_today | effective_date=2026-06-13 | realtime=false | Trendshift 快照可用，已恢复 2026-06-13 的趋势信号
- GitHub Trending [freshness-driving]: fresh_today | effective_date=2026-06-13 | realtime=false | GitHub Trending 快照可用，已恢复 2026-06-13 的热度信号
- GitHub 当日涨星信号 [freshness-driving]: fresh_today | effective_date=2026-06-13 | realtime=false | GitHub star delta 快照可用，已恢复 2026-06-13 的增量信号
- 重点观察清单动态 [freshness-driving]: fresh_today | effective_date=2026-06-13 | realtime=false | Watchlist 活动快照可用，已恢复 2026-06-13 的观察清单信号

## LLM 诊断

- enabled: true
- provider: deepseek
- mode: semantic-classification
- classification_cache_hit_count: 0
- classification_attempt_count: 0
- classification_success_count: 0
- classification_failure_count: 0
- summary_attempt_count: 46
- summary_success_count: 46
- summary_failure_count: 0
- judge_attempt_count: 1
- judge_success_count: 1
- judge_failure_count: 0

## MVP 完成信号

- 是否完成: 是
- dry_run: false
- 原始信号阶段完成，共 338 条
- 归一化阶段完成，共 307 个项目
- 评分阶段完成，共 307 个已评分项目
- 本次运行活跃信号面: 6/6
- 本次运行已成功写盘

## 阶段计数

- 原始信号: 338
- 归一化项目: 307
- 已评分项目: 307
- 高分项目: 28
- 异常增长项目: 2
- 新项目: 307
- classifications: 307

## 数据源状态

- agents-radar: active | enabled=true | items=47 | projects=40
- trendshift: active | enabled=true | items=25 | projects=25
- github_trending: active | enabled=true | items=25 | projects=25
- watchlist_live_activity: active | enabled=true | items=58 | projects=58
- mission_github_search: active | enabled=true | items=180 | projects=177
- github-enrichment: active | enabled=true | items=244 | projects=244

## Mission Discovery

- mission_discovery_status: degraded
- mission_degraded_reason_codes: mission_not_run
- today_pulse_count: 71
- mission_match_count: 0
- explore_ribbon_count: 0
- coverage_atlas_count: 0
- gap_ledger_count: 0
- deep_upgrade_direction_count: 0
- search_exhausted_direction_count: 0
- quantity_target_met_count: 0
- observer_promotion_candidate_count: 0
- rolling_30d_searchable_catalog_count: 0
- rolling_30d_vertical_or_task_oriented_count: 0
- rolling_7d_qualified_non_head_count: 0
- outcome_distribution: none
- pressure_state_distribution: none

## Observer Status

- ecosystem_focus: unavailable

## 质量快照

- watchlist 命中: 63
- 低置信度项目: 0
- 中等置信度项目: 278
- 缺少描述: 3
- 缺少结构化指标: 0
- 可疑增长项目: 0
- 单一信号源项目: 274
- 单日出现项目: 156
- emerging 项目: 91
- persistent 项目: 60

## 诊断信息

- anomaly_share: 0.0065
- uniform_star_velocity_detected: false
- metrics_source_distribution: api=307, html=0, cache=0, embedded=0, unavailable=0
- star_delta_source_distribution: live=0, snapshot=0, signal=81, unavailable=226
- github_star_delta: live_attempts=0, live_success=0, snapshot_success=0, token_missing=0, auth_invalid=0, rate_limit=0, network_blocked=0

## Top 项目

- [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) | 分数 100 | 置信度 high | 范式 agent runtime + persistent memory + tool/skill ecosystem
  - 排名裁决: base_final_rank=105 | final_rank=105 | qualification=keep-observing | judge_delta=0
  - 位置理由: 命中GitHub Trending且多源确认，单日215星，完成度高，持久记忆+技能生态明确，why-now成立，无风险标记，合理保持首位。
  - 入选原因: paradigm=agent runtime + persistent memory + tool/skill ecosystem | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=215) | engagement_score=100 (forks=33562) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无
- [anthropics/claude-code](https://github.com/anthropics/claude-code) | 分数 100 | 置信度 high | 范式 agent runtime + persistent memory
  - 排名裁决: base_final_rank=105 | final_rank=105 | qualification=keep-observing | judge_delta=0
  - 位置理由: 170星，多源确认，终端AI编码助手概念清晰，why-now成立，无风险标记，与hermes-agent同属高热度，并列105合理。
  - 入选原因: paradigm=agent runtime + persistent memory | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=170) | engagement_score=100 (forks=21400) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无
- [openai/codex](https://github.com/openai/codex) | 分数 100 | 置信度 high | 范式 agent runtime + persistent memory
  - 排名裁决: base_final_rank=102.5 | final_rank=100 | qualification=keep-observing | judge_delta=-2.5
  - 位置理由: 仅26星增长，虽多源确认但热度远低于前两名，品牌光环明显，实际信号强度不足，应小幅下移。
  - 入选原因: paradigm=agent runtime + persistent memory | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=26) | engagement_score=100 (forks=13400) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无
- [openclaw/openclaw](https://github.com/openclaw/openclaw) | 分数 98.5 | 置信度 high | 范式 agent runtime + persistent memory + tool/skill ecosystem
  - 排名裁决: base_final_rank=101 | final_rank=100 | qualification=keep-observing | judge_delta=-1
  - 位置理由: 46星增长，自托管概念有一定区分度，但热度一般，无风险标记，可微调降低以反映真实信号强度。
  - 入选原因: paradigm=agent runtime + persistent memory + tool/skill ecosystem | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=46) | engagement_score=100 (forks=79200) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无
- [langgenius/dify](https://github.com/langgenius/dify) | 分数 94.75 | 置信度 high | 范式 agent runtime
  - 排名裁决: base_final_rank=94.75 | final_rank=94.75 | qualification=keep-observing | judge_delta=0
  - 位置理由: 登顶GitHub Trending，63星，生产级工作流平台，概念清晰，why-now成立，位置合理。
  - 入选原因: paradigm=agent runtime | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=63) | engagement_score=100 (forks=22828) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无

## 风险提示

- 仍有 274 个项目只有单一信号源，需要跨源或跨天确认
- 有 3 个项目缺少描述，语义判断会受限

## 下一步重点

- 在提升弱信号前，先确认跨天 persistence 或第二信号源

## 建议动作

- 单源项目先等第二信号源或第二天 persistence，再考虑升级判断
- 可以把这次运行当作稳定基线，继续推进更强的 GitHub enrichment 或 weekly 汇总
