# Agent Trend Radar 运行摘要 2026-06-10

> 生成时间 2026-06-10T22:33:55+08:00

## 新鲜度摘要

- overall_daily_status: 数据新鲜，可直接阅读
- main_board_mode: fresh_today_only
- today_fresh_candidate_count: 118
- today_star_count: 67
- context_candidate_count: 35
- pending_confirmation_count: 51
- agents-radar 历史上下文 [context]: fresh_today | effective_date=2026-06-10 | realtime=true | agents-radar 仓库已同步，可读取 2026-06-10 的最新 digest
- Trendshift 当日命中 [freshness-driving]: fresh_today | effective_date=2026-06-10 | realtime=true | Trendshift 实时抓取成功，发现 25 个候选
- GitHub Trending [freshness-driving]: fresh_today | effective_date=2026-06-10 | realtime=true | GitHub Trending 实时发现成功，发现 25 个候选
- 重点观察清单动态 [freshness-driving]: fresh_today | effective_date=2026-06-10 | realtime=true | 重点观察清单实时活动抓取成功，发现 73 个候选
- GitHub 当日涨星信号 [freshness-driving]: fresh_today | effective_date=2026-06-10 | realtime=true | GitHub 当日涨星信号实时解析成功，发现 3 个候选

## LLM 诊断

- enabled: false
- provider: none
- mode: rules-only
- classification_cache_hit_count: 96
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
- 原始信号阶段完成，共 191 条
- 归一化阶段完成，共 153 个项目
- 评分阶段完成，共 153 个已评分项目
- 本次运行活跃信号面: 5/5
- 仍有 1 个项目处于低置信度，需要后续验证
- 本次运行已成功写盘

## 阶段计数

- 原始信号: 191
- 归一化项目: 153
- 已评分项目: 153
- 高分项目: 32
- 异常增长项目: 15
- 新项目: 153
- classifications: 96

## 数据源状态

- agents-radar: active | enabled=true | items=65 | projects=61
- trendshift: active | enabled=true | items=25 | projects=25
- github_trending: active | enabled=true | items=25 | projects=25
- watchlist_live_activity: active | enabled=true | items=73 | projects=73
- github-enrichment: active | enabled=true | items=188 | projects=157

## Observer Status

- ecosystem_focus: active
- observer_candidate_count: 17
- observer_ecosystem_counts: agent-ui-workbench=1, coding-agents=7, eval-observability-governance=6, skills-tools-mcp=9, browser-computer-use=2, memory-knowledge=3, agent-runtime=2
- #1 langfuse/codex-observability-plugin: score=121; tier=proven; history=validated; qualification=unknown; ecosystems=agent-ui-workbench, coding-agents, eval-observability-governance, skills-tools-mcp; keywords=codex, observability, plugin; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:validated, pedigree:company, tier:proven
- #2 langfuse/claude-observability-plugin: score=118; tier=proven; history=validated; qualification=unknown; ecosystems=coding-agents, eval-observability-governance, skills-tools-mcp; keywords=claude code, observability, plugin; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:validated, pedigree:company, tier:proven
- #3 alibaba/open-code-review: score=115; tier=proven; history=validated; qualification=unknown; ecosystems=coding-agents, eval-observability-governance; keywords=code review, review; labels=breakout:watch, ecosystem-depth:topic-backed, freshness:active-today, history:validated, pedigree:company, tier:proven
- #4 awslabs/mcp: score=104; tier=core; history=mixed; qualification=unknown; ecosystems=browser-computer-use, skills-tools-mcp; keywords=mcp; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:mixed, pedigree:company, tier:core
- #5 langfuse/langfuse-docs: score=104; tier=proven; history=validated; qualification=unknown; ecosystems=eval-observability-governance; keywords=observability; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-72h, history:validated, pedigree:company, tier:proven
- #6 pydantic/logfire: score=98; tier=proven; history=validated; qualification=unknown; ecosystems=eval-observability-governance; keywords=observability; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:validated, pedigree:company, tier:proven
- #7 modelcontextprotocol/go-sdk: score=96; tier=proven; history=mixed; qualification=unknown; ecosystems=memory-knowledge, skills-tools-mcp; keywords=context; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:mixed, pedigree:company, tier:proven
- #8 moltis-org/moltis: score=96; tier=none; history=mixed; qualification=unknown; ecosystems=agent-runtime, memory-knowledge, skills-tools-mcp; keywords=execution, mcp, memory; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:active-today, history:mixed, tier:none
- #9 OpenBMB/UltraRAG: score=95; tier=proven; history=mixed; qualification=unknown; ecosystems=memory-knowledge, skills-tools-mcp; keywords=mcp, rag; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:mixed, pedigree:company, tier:proven
- #10 langfuse/langfuse-python: score=90; tier=proven; history=validated; qualification=unknown; ecosystems=eval-observability-governance; keywords=observability; labels=breakout:steady, ecosystem-depth:seed-adjacent, freshness:new-24h, history:validated, pedigree:company, tier:proven
- #11 QwenLM/open-computer-use: score=82; tier=core; history=none; qualification=unknown; ecosystems=browser-computer-use, skills-tools-mcp; keywords=computer use, mcp; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, pedigree:company, tier:core
- #12 Kaelio/ktx: score=61; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=claude code, codex; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #13 tya5/reyn: score=57; tier=none; history=emerging; qualification=unknown; ecosystems=agent-runtime; keywords=execution, workflow; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:emerging, tier:none
- #14 himkt/cafleet: score=57; tier=none; history=emerging; qualification=unknown; ecosystems=coding-agents; keywords=claude code, codex; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:emerging, tier:none
- #15 jeremylongshore/claude-code-plugins-plus-skills: score=55; tier=none; history=none; qualification=unknown; ecosystems=skills-tools-mcp; keywords=skills; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #16 aegntic/compound-engineering: score=53; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=claude code, code review; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #17 nordbyte/nordrelay: score=53; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=claude code, codex; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none

## 质量快照

- watchlist 命中: 77
- 低置信度项目: 1
- 中等置信度项目: 116
- 缺少描述: 3
- 缺少结构化指标: 0
- 可疑增长项目: 0
- 单一信号源项目: 109
- 单日出现项目: 57
- emerging 项目: 35
- persistent 项目: 61

## 诊断信息

- anomaly_share: 0.098
- uniform_star_velocity_detected: false
- metrics_source_distribution: api=153, html=0, cache=0, embedded=0, unavailable=0
- star_delta_source_distribution: live=0, snapshot=0, signal=99, unavailable=54
- github_star_delta: live_attempts=20, live_success=3, snapshot_success=0, token_missing=0, auth_invalid=0, rate_limit=0, network_blocked=0

## Top 项目

- [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) | 分数 100 | 置信度 high | 范式 agent runtime + persistent memory + tool/skill ecosystem
  - 排名裁决: base_final_rank=105 | final_rank=105 | qualification=strong-watch | judge_delta=0
  - 入选原因: paradigm=agent runtime + persistent memory + tool/skill ecosystem | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=1188) | engagement_score=100 (forks=32790) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无
- [openai/codex](https://github.com/openai/codex) | 分数 100 | 置信度 high | 范式 agent runtime + persistent memory
  - 排名裁决: base_final_rank=102.5 | final_rank=102.5 | qualification=strong-watch | judge_delta=0
  - 入选原因: paradigm=agent runtime + persistent memory | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=283) | engagement_score=100 (forks=13274) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无
- [affaan-m/ECC](https://github.com/affaan-m/ECC) | 分数 95 | 置信度 high | 范式 agent system
  - 排名裁决: base_final_rank=102.5 | final_rank=102.5 | qualification=strong-watch | judge_delta=0
  - 入选原因: paradigm=agent system | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=844) | engagement_score=100 (forks=32617) | architecture_shift=75 (baseline=default_agent_capability)
  - 风险: 无
- [anthropics/skills](https://github.com/anthropics/skills) | 分数 96.25 | 置信度 high | 范式 agent infra
  - 排名裁决: base_final_rank=101.25 | final_rank=101.25 | qualification=strong-watch | judge_delta=0
  - 入选原因: paradigm=agent infra | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=443) | engagement_score=100 (forks=17565) | architecture_shift=85 (baseline=default_agent_capability)
  - 风险: 无
- [openclaw/openclaw](https://github.com/openclaw/openclaw) | 分数 98.5 | 置信度 high | 范式 agent runtime + persistent memory + tool/skill ecosystem
  - 排名裁决: base_final_rank=101 | final_rank=101 | qualification=strong-watch | judge_delta=0
  - 入选原因: paradigm=agent runtime + persistent memory + tool/skill ecosystem | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=135) | engagement_score=100 (forks=79034) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无

## 风险提示

- 低置信度项目占比为 1/153
- 仍有 109 个项目只有单一信号源，需要跨源或跨天确认
- 有 3 个项目缺少描述，语义判断会受限

## 下一步重点

- 为低置信度项目补足描述或结构化 repo 指标
- 在提升弱信号前，先确认跨天 persistence 或第二信号源

## 建议动作

- 在信任低置信度排序前，优先补有缺失描述或缺失 metrics 的项目
- 单源项目先等第二信号源或第二天 persistence，再考虑升级判断
- 可以把这次运行当作稳定基线，继续推进更强的 GitHub enrichment 或 weekly 汇总
