# Agent Trend Radar 运行摘要 2026-06-09

> 生成时间 2026-06-09T22:46:33+08:00

## 新鲜度摘要

- overall_daily_status: 数据新鲜，可直接阅读
- main_board_mode: fresh_today_only
- today_fresh_candidate_count: 125
- today_star_count: 60
- context_candidate_count: 40
- pending_confirmation_count: 65
- agents-radar 历史上下文 [context]: fresh_today | effective_date=2026-06-09 | realtime=true | agents-radar 仓库已同步，可读取 2026-06-09 的最新 digest
- Trendshift 当日命中 [freshness-driving]: fresh_today | effective_date=2026-06-09 | realtime=true | Trendshift 实时抓取成功，发现 25 个候选
- GitHub Trending [freshness-driving]: fresh_today | effective_date=2026-06-09 | realtime=true | GitHub Trending 实时发现成功，发现 25 个候选
- 重点观察清单动态 [freshness-driving]: fresh_today | effective_date=2026-06-09 | realtime=true | 重点观察清单实时活动抓取成功，发现 79 个候选
- GitHub 当日涨星信号 [freshness-driving]: fresh_today | effective_date=2026-06-09 | realtime=true | GitHub 当日涨星信号实时解析成功，发现 5 个候选

## LLM 诊断

- enabled: true
- provider: deepseek
- mode: semantic-classification
- classification_cache_hit_count: 87
- classification_attempt_count: 78
- classification_success_count: 78
- classification_failure_count: 0
- summary_attempt_count: 17
- summary_success_count: 17
- summary_failure_count: 0
- judge_attempt_count: 1
- judge_success_count: 1
- judge_failure_count: 0

## MVP 完成信号

- 是否完成: 是
- dry_run: false
- 原始信号阶段完成，共 202 条
- 归一化阶段完成，共 165 个项目
- 评分阶段完成，共 165 个已评分项目
- 本次运行活跃信号面: 5/5
- 仍有 4 个项目处于低置信度，需要后续验证
- 本次运行已成功写盘

## 阶段计数

- 原始信号: 202
- 归一化项目: 165
- 已评分项目: 165
- 高分项目: 31
- 异常增长项目: 15
- 新项目: 165
- classifications: 165

## 数据源状态

- agents-radar: active | enabled=true | items=68 | projects=64
- trendshift: active | enabled=true | items=25 | projects=25
- github_trending: active | enabled=true | items=25 | projects=25
- watchlist_live_activity: active | enabled=true | items=79 | projects=79
- github-enrichment: active | enabled=true | items=195 | projects=169

## Observer Status

- ecosystem_focus: active
- observer_candidate_count: 14
- observer_ecosystem_counts: agent-runtime=4, agent-ui-workbench=1, agentic-rl=1, coding-agents=7, eval-observability-governance=5, multi-agent-coordination=1, skills-tools-mcp=6, browser-computer-use=1, memory-knowledge=2
- #1 openai/role-specific-plugins: score=140; tier=core; history=validated; qualification=top-tier-now; ecosystems=agent-runtime, agent-ui-workbench, agentic-rl, coding-agents, eval-observability-governance, multi-agent-coordination, skills-tools-mcp; keywords=codex, plugin; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:validated, pedigree:company, tier:core
- #2 alibaba/open-code-review: score=140; tier=proven; history=validated; qualification=top-tier-now; ecosystems=coding-agents, eval-observability-governance; keywords=code review, review; labels=breakout:watch, ecosystem-depth:topic-backed, freshness:active-today, history:validated, pedigree:company, tier:proven
- #3 awslabs/mcp: score=127; tier=core; history=mixed; qualification=top-tier-now; ecosystems=browser-computer-use, skills-tools-mcp; keywords=mcp; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:mixed, pedigree:company, tier:core
- #4 moltis-org/moltis: score=106; tier=none; history=mixed; qualification=strong-watch; ecosystems=agent-runtime, memory-knowledge, skills-tools-mcp; keywords=execution, mcp, memory; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:active-today, history:mixed, tier:none
- #5 langfuse/claude-observability-plugin: score=104; tier=proven; history=mixed; qualification=strong-watch; ecosystems=coding-agents, eval-observability-governance, skills-tools-mcp; keywords=claude code, observability, plugin; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:mixed, pedigree:company, tier:proven
- #6 modelcontextprotocol/csharp-sdk: score=101; tier=proven; history=mixed; qualification=strong-watch; ecosystems=memory-knowledge, skills-tools-mcp; keywords=context; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:mixed, pedigree:company, tier:proven
- #7 pydantic/logfire: score=99; tier=proven; history=validated; qualification=strong-watch; ecosystems=eval-observability-governance; keywords=observability; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-72h, history:validated, pedigree:company, tier:proven
- #8 langfuse/langfuse-js: score=96; tier=proven; history=mixed; qualification=keep-observing; ecosystems=eval-observability-governance; keywords=observability; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:mixed, pedigree:company, tier:proven
- #9 osaurus-ai/osaurus: score=72; tier=none; history=none; qualification=strong-watch; ecosystems=agent-runtime, skills-tools-mcp; keywords=execution; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #10 raullenchai/Rapid-MLX: score=58; tier=none; history=none; qualification=strong-watch; ecosystems=coding-agents; keywords=aider, claude code, cursor; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:active-today, history:none, tier:none
- #11 hlsitechio/agentic-swarm: score=57; tier=none; history=none; qualification=keep-observing; ecosystems=coding-agents; keywords=claude code, codex, cursor; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #12 markyy101/conductor-orchestrator-superpowers: score=53; tier=none; history=none; qualification=keep-observing; ecosystems=agent-runtime; keywords=execution, orchestration; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #13 himkt/cafleet: score=53; tier=none; history=none; qualification=keep-observing; ecosystems=coding-agents; keywords=claude code, codex; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #14 Soul-Brews-Studio/maw-js: score=43; tier=none; history=none; qualification=keep-observing; ecosystems=coding-agents; keywords=aider, claude code, codex; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:active-today, history:none, tier:none

## 质量快照

- watchlist 命中: 83
- 低置信度项目: 4
- 中等置信度项目: 131
- 缺少描述: 5
- 缺少结构化指标: 3
- 可疑增长项目: 0
- 单一信号源项目: 124
- 单日出现项目: 78
- emerging 项目: 33
- persistent 项目: 54

## 诊断信息

- anomaly_share: 0.0909
- uniform_star_velocity_detected: false
- metrics_source_distribution: api=163, html=0, cache=0, embedded=0, unavailable=2
- star_delta_source_distribution: live=0, snapshot=0, signal=92, unavailable=73
- github_star_delta: live_attempts=20, live_success=5, snapshot_success=0, token_missing=0, auth_invalid=0, rate_limit=0, network_blocked=0

## Top 项目

- [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) | 分数 100 | 置信度 high | 范式 agent runtime + persistent memory + tool/skill ecosystem
  - 排名裁决: base_final_rank=105 | final_rank=105 | qualification=keep-observing | judge_delta=0
  - 位置理由: 高增长1677星，记忆与技能生态系统，para完整，基础分合理，位居榜首合理。
  - 入选原因: paradigm=agent runtime + persistent memory + tool/skill ecosystem | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=1677) | engagement_score=100 (forks=32472) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无
- [anthropics/claude-code](https://github.com/anthropics/claude-code) | 分数 100 | 置信度 high | 范式 agent runtime + persistent memory
  - 排名裁决: base_final_rank=105 | final_rank=105 | qualification=keep-observing | judge_delta=0
  - 位置理由: 多天确认高信任项目，命中重点观察清单，基础分与hermes-agent并列，位置稳固。
  - 入选原因: paradigm=agent runtime + persistent memory | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=255) | engagement_score=100 (forks=21269) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无
- [affaan-m/ECC](https://github.com/affaan-m/ECC) | 分数 95 | 置信度 high | 范式 agent system
  - 排名裁决: base_final_rank=102.5 | final_rank=102.5 | qualification=keep-observing | judge_delta=0
  - 位置理由: 星增1249，兼容主流代理框架，与上下文契合度高，距前两名差距合理。
  - 入选原因: paradigm=agent system | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=1249) | engagement_score=100 (forks=32462) | architecture_shift=75 (baseline=default_agent_capability)
  - 风险: 无
- [openclaw/openclaw](https://github.com/openclaw/openclaw) | 分数 98.5 | 置信度 high | 范式 agent runtime + persistent memory + tool/skill ecosystem
  - 排名裁决: base_final_rank=101 | final_rank=101 | qualification=keep-observing | judge_delta=0
  - 位置理由: 星增257但fork量极高，社区活跃，自托管助手定位鲜明，基础分符合表现。
  - 入选原因: paradigm=agent runtime + persistent memory + tool/skill ecosystem | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=257) | engagement_score=100 (forks=78991) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无
- [langgenius/dify](https://github.com/langgenius/dify) | 分数 94.75 | 置信度 high | 范式 agent runtime
  - 排名裁决: base_final_rank=94.75 | final_rank=95.75 | qualification=keep-observing | judge_delta=1
  - 位置理由: 成熟agentic框架，星增161，RAG编排优势明显，基础分略保守，可微升。
  - 入选原因: paradigm=agent runtime | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=161) | engagement_score=100 (forks=22748) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无

## 风险提示

- 低置信度项目占比为 4/165
- 仍有 124 个项目只有单一信号源，需要跨源或跨天确认
- 有 5 个项目缺少描述，语义判断会受限

## 下一步重点

- 为低置信度项目补足描述或结构化 repo 指标
- 在提升弱信号前，先确认跨天 persistence 或第二信号源

## 建议动作

- 在信任低置信度排序前，优先补有缺失描述或缺失 metrics 的项目
- 单源项目先等第二信号源或第二天 persistence，再考虑升级判断
- 可以把这次运行当作稳定基线，继续推进更强的 GitHub enrichment 或 weekly 汇总
