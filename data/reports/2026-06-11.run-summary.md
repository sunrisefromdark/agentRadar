# Agent Trend Radar 运行摘要 2026-06-11

> 生成时间 2026-06-11T23:27:36+08:00

## 新鲜度摘要

- overall_daily_status: 数据新鲜，可直接阅读
- main_board_mode: fresh_today_only
- today_fresh_candidate_count: 127
- today_star_count: 68
- context_candidate_count: 28
- pending_confirmation_count: 59
- agents-radar 历史上下文 [context]: fresh_today | effective_date=2026-06-11 | realtime=true | agents-radar 仓库已同步，可读取 2026-06-11 的最新 digest
- Trendshift 当日命中 [freshness-driving]: fresh_today | effective_date=2026-06-11 | realtime=true | Trendshift 实时抓取成功，发现 25 个候选
- GitHub Trending [freshness-driving]: fresh_today | effective_date=2026-06-11 | realtime=true | GitHub Trending 实时发现成功，发现 25 个候选
- 重点观察清单动态 [freshness-driving]: fresh_today | effective_date=2026-06-11 | realtime=true | 重点观察清单实时活动抓取成功，发现 83 个候选
- GitHub 当日涨星信号 [freshness-driving]: fresh_today | effective_date=2026-06-11 | realtime=true | GitHub 当日涨星信号实时解析成功，发现 5 个候选

## LLM 诊断

- enabled: false
- provider: none
- mode: rules-only
- classification_cache_hit_count: 66
- classification_attempt_count: 0
- classification_success_count: 0
- classification_failure_count: 0
- summary_attempt_count: 0
- summary_success_count: 0
- summary_failure_count: 0
- judge_attempt_count: 0
- judge_success_count: 0
- judge_failure_count: 0

## MVP 完成信号

- 是否完成: 是
- dry_run: false
- 原始信号阶段完成，共 192 条
- 归一化阶段完成，共 155 个项目
- 评分阶段完成，共 155 个已评分项目
- 本次运行活跃信号面: 5/5
- 仍有 3 个项目处于低置信度，需要后续验证
- 本次运行已成功写盘

## 阶段计数

- 原始信号: 192
- 归一化项目: 155
- 已评分项目: 155
- 高分项目: 24
- 异常增长项目: 16
- 新项目: 155
- classifications: 66

## 数据源状态

- agents-radar: active | enabled=true | items=54 | projects=51
- trendshift: active | enabled=true | items=25 | projects=25
- github_trending: active | enabled=true | items=25 | projects=25
- watchlist_live_activity: active | enabled=true | items=83 | projects=83
- github-enrichment: active | enabled=true | items=186 | projects=158

## Observer Status

- ecosystem_focus: active
- observer_candidate_count: 13
- observer_ecosystem_counts: eval-observability-governance=5, skills-tools-mcp=6, memory-knowledge=5, agent-runtime=4, coding-agents=4
- #1 langfuse/langfuse-docs: score=106; tier=proven; history=validated; qualification=unknown; ecosystems=eval-observability-governance; keywords=observability; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-72h, history:validated, pedigree:company, tier:proven
- #2 langfuse/langfuse-js: score=103; tier=proven; history=validated; qualification=unknown; ecosystems=eval-observability-governance; keywords=observability; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:validated, pedigree:company, tier:proven
- #3 awslabs/iam-policy-autopilot: score=101; tier=core; history=mixed; qualification=unknown; ecosystems=eval-observability-governance, skills-tools-mcp; keywords=mcp, policy; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:mixed, pedigree:company, tier:core
- #4 OpenBMB/UltraRAG: score=97; tier=proven; history=mixed; qualification=unknown; ecosystems=memory-knowledge, skills-tools-mcp; keywords=mcp, rag; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:mixed, pedigree:company, tier:proven
- #5 moltis-org/moltis: score=96; tier=none; history=mixed; qualification=unknown; ecosystems=agent-runtime, memory-knowledge, skills-tools-mcp; keywords=execution, mcp, memory; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:active-today, history:mixed, tier:none
- #6 roackb2/heddle: score=77; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, coding-agents, memory-knowledge; keywords=runtime; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:active-today, history:none, tier:none
- #7 eleboucher/memini: score=74; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge, skills-tools-mcp; keywords=mcp, memory, retrieval; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-72h, history:none, tier:none
- #8 alexherrero/crickets: score=71; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, coding-agents, eval-observability-governance; keywords=claude code, code review, execution, review; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:active-today, history:none, tier:none
- #9 memtomem/memtomem: score=67; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge, skills-tools-mcp; keywords=mcp, memory; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #10 terrene-foundation/kailash-py: score=61; tier=none; history=emerging; qualification=unknown; ecosystems=agent-runtime; keywords=execution, orchestration, workflow; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:emerging, tier:none
- #11 ascending-llc/jarvis-registry: score=61; tier=none; history=none; qualification=unknown; ecosystems=eval-observability-governance, skills-tools-mcp; keywords=mcp, observability; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #12 0bserver07/chimera: score=53; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=aider, codex; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #13 Yash-Koladiya30/fixfleet: score=51; tier=none; history=emerging; qualification=unknown; ecosystems=coding-agents; keywords=aider, claude code, codex, cursor; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:active-today, history:emerging, tier:none

## 质量快照

- watchlist 命中: 88
- 低置信度项目: 3
- 中等置信度项目: 117
- 缺少描述: 5
- 缺少结构化指标: 3
- 可疑增长项目: 0
- 单一信号源项目: 113
- 单日出现项目: 69
- emerging 项目: 29
- persistent 项目: 57

## 诊断信息

- anomaly_share: 0.1032
- uniform_star_velocity_detected: false
- metrics_source_distribution: api=154, html=0, cache=0, embedded=0, unavailable=1
- star_delta_source_distribution: live=0, snapshot=0, signal=90, unavailable=65
- github_star_delta: live_attempts=20, live_success=5, snapshot_success=0, token_missing=0, auth_invalid=0, rate_limit=0, network_blocked=0

## Top 项目

- [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) | 分数 100 | 置信度 high | 范式 agent runtime + persistent memory + tool/skill ecosystem
  - 排名裁决: base_final_rank=105 | final_rank=105 | qualification=strong-watch | judge_delta=0
  - 入选原因: paradigm=agent runtime + persistent memory + tool/skill ecosystem | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=1117) | engagement_score=100 (forks=33086) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无
- [anthropics/claude-code](https://github.com/anthropics/claude-code) | 分数 100 | 置信度 high | 范式 agent runtime + persistent memory
  - 排名裁决: base_final_rank=105 | final_rank=105 | qualification=strong-watch | judge_delta=0
  - 入选原因: paradigm=agent runtime + persistent memory | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=243) | engagement_score=100 (forks=21340) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无
- [openai/codex](https://github.com/openai/codex) | 分数 100 | 置信度 high | 范式 agent runtime + persistent memory
  - 排名裁决: base_final_rank=102.5 | final_rank=102.5 | qualification=strong-watch | judge_delta=0
  - 入选原因: paradigm=agent runtime + persistent memory | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=263) | engagement_score=100 (forks=13315) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无
- [affaan-m/ECC](https://github.com/affaan-m/ECC) | 分数 95 | 置信度 high | 范式 agent system
  - 排名裁决: base_final_rank=102.5 | final_rank=102.5 | qualification=strong-watch | judge_delta=0
  - 入选原因: paradigm=agent system | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=832) | engagement_score=100 (forks=32763) | architecture_shift=75 (baseline=default_agent_capability)
  - 风险: 无
- [anthropics/skills](https://github.com/anthropics/skills) | 分数 96.25 | 置信度 high | 范式 agent infra
  - 排名裁决: base_final_rank=101.25 | final_rank=101.25 | qualification=strong-watch | judge_delta=0
  - 入选原因: paradigm=agent infra | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=903) | engagement_score=100 (forks=17751) | architecture_shift=85 (baseline=default_agent_capability)
  - 风险: 无

## 风险提示

- 低置信度项目占比为 3/155
- 仍有 113 个项目只有单一信号源，需要跨源或跨天确认
- 有 5 个项目缺少描述，语义判断会受限

## 下一步重点

- 为低置信度项目补足描述或结构化 repo 指标
- 在提升弱信号前，先确认跨天 persistence 或第二信号源

## 建议动作

- 在信任低置信度排序前，优先补有缺失描述或缺失 metrics 的项目
- 单源项目先等第二信号源或第二天 persistence，再考虑升级判断
- 可以把这次运行当作稳定基线，继续推进更强的 GitHub enrichment 或 weekly 汇总
