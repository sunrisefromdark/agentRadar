# Agent Trend Radar 运行摘要 2026-06-13

> 生成时间 2026-06-13T22:45:44+08:00

## 新鲜度摘要

- overall_daily_status: 数据新鲜，可直接阅读
- main_board_mode: fresh_today_only
- today_fresh_candidate_count: 103
- today_star_count: 4
- context_candidate_count: 204
- pending_confirmation_count: 32
- agents-radar 历史上下文 [context]: fresh_today | effective_date=2026-06-13 | realtime=true | agents-radar 仓库已同步，可读取 2026-06-13 的最新 digest
- Trendshift 当日命中 [freshness-driving]: fresh_today | effective_date=2026-06-13 | realtime=true | Trendshift 实时抓取成功，发现 25 个候选
- GitHub Trending [freshness-driving]: fresh_today | effective_date=2026-06-13 | realtime=true | GitHub Trending 实时发现成功，发现 25 个候选
- 重点观察清单动态 [freshness-driving]: fresh_today | effective_date=2026-06-13 | realtime=true | 重点观察清单实时活动抓取成功，发现 58 个候选
- GitHub 当日涨星信号 [freshness-driving]: fresh_today | effective_date=2026-06-13 | realtime=true | GitHub 当日涨星信号实时解析成功，发现 3 个候选

## LLM 诊断

- enabled: true
- provider: deepseek
- mode: semantic-classification
- classification_cache_hit_count: 262
- classification_attempt_count: 45
- classification_success_count: 45
- classification_failure_count: 0
- summary_attempt_count: 46
- summary_success_count: 44
- summary_failure_count: 2
- judge_attempt_count: 1
- judge_success_count: 1
- judge_failure_count: 0
- latest_summary_error: daily summary returned no structured projects

## MVP 完成信号

- 是否完成: 是
- dry_run: false
- 原始信号阶段完成，共 338 条
- 归一化阶段完成，共 307 个项目
- 评分阶段完成，共 307 个已评分项目
- 本次运行活跃信号面: 5/5
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

- agents-radar: active | enabled=true | items=47 | projects=44
- trendshift: active | enabled=true | items=25 | projects=25
- github_trending: active | enabled=true | items=25 | projects=25
- watchlist_live_activity: active | enabled=true | items=58 | projects=58
- github-enrichment: active | enabled=true | items=155 | projects=134

## Mission Discovery

- mission_discovery_status: active
- mission_degraded_reason_codes: none
- today_pulse_count: 4
- mission_match_count: 4
- explore_ribbon_count: 0
- coverage_atlas_count: 16
- gap_ledger_count: 7
- deep_upgrade_direction_count: 0
- search_exhausted_direction_count: 0
- quantity_target_met_count: 9
- observer_promotion_candidate_count: 0
- rolling_30d_searchable_catalog_count: 1138
- rolling_30d_vertical_or_task_oriented_count: 263
- rolling_7d_qualified_non_head_count: 426
- outcome_distribution: matched=9, search_failed=7
- pressure_state_distribution: normal=16
- coverage coding-agent: outcome=matched; pressure=normal; next_action=keep_watching; search_exhausted=false
- coverage browser-computer-use: outcome=matched; pressure=normal; next_action=keep_watching; search_exhausted=false
- coverage workflow-automation-agent: outcome=matched; pressure=normal; next_action=keep_watching; search_exhausted=false
- coverage research-knowledge-agent: outcome=matched; pressure=normal; next_action=keep_watching; search_exhausted=false
- coverage shopping-commerce-agent: outcome=matched; pressure=normal; next_action=keep_watching; search_exhausted=false
- coverage sales-prospecting-agent: outcome=matched; pressure=normal; next_action=keep_watching; search_exhausted=false
- coverage customer-support-agent: outcome=matched; pressure=normal; next_action=keep_watching; search_exhausted=false
- coverage marketing-content-ops-agent: outcome=matched; pressure=normal; next_action=keep_watching; search_exhausted=false
- gap data-analytics-bi-agent: reasons=search_failed; next_action=needs_human_seed_refinement
- gap legal-compliance-agent: reasons=search_failed; next_action=needs_human_seed_refinement
- gap security-soc-agent: reasons=search_failed; next_action=needs_human_seed_refinement
- gap healthcare-ops-agent: reasons=search_failed; next_action=needs_human_seed_refinement
- gap recruiting-hr-agent: reasons=search_failed; next_action=needs_human_seed_refinement
- gap supply-chain-procurement-agent: reasons=search_failed; next_action=needs_human_seed_refinement
- gap industrial-field-ops-agent: reasons=search_failed; next_action=needs_human_seed_refinement

## Observer Status

- ecosystem_focus: active
- observer_candidate_count: 122
- observer_ecosystem_counts: browser-computer-use=35, skills-tools-mcp=35, coding-agents=32, eval-observability-governance=8, multi-agent-coordination=18, agent-runtime=23, memory-knowledge=40, agentic-rl=3, agent-ui-workbench=1
- incubating_direction memory-knowledge: hits_7d=7; repos=40; promotion_candidate=false; unmet_gates=missing_gap_pressure_or_feedback
- incubating_direction skills-tools-mcp: hits_7d=7; repos=35; promotion_candidate=false; unmet_gates=missing_gap_pressure_or_feedback
- incubating_direction coding-agents: hits_7d=7; repos=32; promotion_candidate=false; unmet_gates=duplicate_must_cover_direction | missing_gap_pressure_or_feedback
- incubating_direction agent-runtime: hits_7d=7; repos=23; promotion_candidate=false; unmet_gates=missing_gap_pressure_or_feedback
- incubating_direction eval-observability-governance: hits_7d=7; repos=8; promotion_candidate=false; unmet_gates=missing_gap_pressure_or_feedback
- incubating_direction browser-computer-use: hits_7d=5; repos=35; promotion_candidate=false; unmet_gates=duplicate_must_cover_direction | missing_gap_pressure_or_feedback
- incubating_direction agent-ui-workbench: hits_7d=4; repos=1; promotion_candidate=false; unmet_gates=missing_gap_pressure_or_feedback
- incubating_direction multi-agent-coordination: hits_7d=3; repos=18; promotion_candidate=false; unmet_gates=missing_gap_pressure_or_feedback
- incubating_direction agentic-rl: hits_7d=3; repos=3; promotion_candidate=false; unmet_gates=missing_gap_pressure_or_feedback
- #1 awslabs/mcp: score=110; tier=core; history=mixed; qualification=top-tier-now; ecosystems=browser-computer-use, skills-tools-mcp; keywords=mcp; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:mixed, pedigree:company, tier:core
- #2 alibaba/open-code-review: score=110; tier=proven; history=validated; qualification=top-tier-now; ecosystems=coding-agents, eval-observability-governance; keywords=code review, review; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:validated, pedigree:company, tier:proven
- #3 HKUDS/Vibe-Trading: score=102; tier=proven; history=none; qualification=top-tier-now; ecosystems=multi-agent-coordination, skills-tools-mcp; keywords=none; labels=breakout:watch, ecosystem-depth:topic-backed, freshness:new-72h, history:none, pedigree:company, tier:proven
- #4 getaero-io/gtm-eng-skills: score=97; tier=none; history=mixed; qualification=strong-watch; ecosystems=browser-computer-use, coding-agents, skills-tools-mcp; keywords=automation, claude code, skills; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:mixed, tier:none
- #5 daintreehq/daintree: score=97; tier=none; history=mixed; qualification=strong-watch; ecosystems=agent-runtime, browser-computer-use, coding-agents, memory-knowledge; keywords=automation, codex, context, workflow; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:mixed, tier:none
- #6 moltis-org/moltis: score=96; tier=none; history=mixed; qualification=keep-observing; ecosystems=agent-runtime, memory-knowledge, skills-tools-mcp; keywords=execution, mcp, memory; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:active-today, history:mixed, tier:none
- #7 JKHeadley/instar: score=95; tier=none; history=none; qualification=strong-watch; ecosystems=coding-agents, memory-knowledge, skills-tools-mcp; keywords=claude code, memory; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #8 majiayu000/spellbook: score=95; tier=none; history=none; qualification=strong-watch; ecosystems=agent-runtime, coding-agents, multi-agent-coordination, skills-tools-mcp; keywords=claude code, codex, multi-agent, runtime, skills; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #9 oliver-kriska/claude-elixir-phoenix: score=95; tier=none; history=none; qualification=strong-watch; ecosystems=coding-agents, eval-observability-governance, memory-knowledge, skills-tools-mcp; keywords=claude code, knowledge, mcp, plugin, review; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #10 agent-sandbox/agent-sandbox: score=91; tier=none; history=none; qualification=strong-watch; ecosystems=agent-runtime, browser-computer-use, skills-tools-mcp; keywords=computer use, sandbox; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #11 langchain-ai/open-swe: score=90; tier=proven; history=emerging; qualification=top-tier-now; ecosystems=agent-runtime, memory-knowledge; keywords=none; labels=breakout:steady, ecosystem-depth:seed-adjacent, freshness:new-24h, history:emerging, pedigree:company, tier:proven
- #12 the-open-agent/openagent: score=87; tier=none; history=none; qualification=strong-watch; ecosystems=memory-knowledge, multi-agent-coordination, skills-tools-mcp; keywords=rag; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #13 DekaPrayoga/AurixAgent: score=85; tier=none; history=mixed; qualification=keep-observing; ecosystems=coding-agents, multi-agent-coordination, skills-tools-mcp; keywords=multi-agent, skills; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:mixed, tier:none
- #14 charliee1w/consolidation-memory: score=85; tier=none; history=none; qualification=keep-observing; ecosystems=coding-agents, memory-knowledge, skills-tools-mcp; keywords=knowledge, mcp, memory; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #15 iliaal/whetstone: score=85; tier=none; history=none; qualification=keep-observing; ecosystems=agent-runtime, browser-computer-use, coding-agents, eval-observability-governance, skills-tools-mcp; keywords=automation, code review, mcp, review, skills, workflow; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #16 limecloud/lime: score=85; tier=none; history=none; qualification=strong-watch; ecosystems=browser-computer-use, memory-knowledge, skills-tools-mcp; keywords=desktop, knowledge; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #17 awslabs/aidlc-workflows: score=83; tier=core; history=mixed; qualification=top-tier-now; ecosystems=agent-runtime; keywords=workflow; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:active-today, history:mixed, pedigree:company, tier:core
- #18 1850298154/memory_agent_hub: score=83; tier=none; history=none; qualification=keep-observing; ecosystems=agentic-rl, coding-agents, memory-knowledge, multi-agent-coordination; keywords=agentic rl, memory, swarm, team; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #19 anthropics/knowledge-work-plugins: score=80; tier=core; history=none; qualification=top-tier-now; ecosystems=memory-knowledge; keywords=knowledge; labels=breakout:watch, ecosystem-depth:keyword-backed, freshness:new-72h, history:none, pedigree:company, tier:core
- #20 chopratejas/headroom: score=80; tier=none; history=none; qualification=strong-watch; ecosystems=memory-knowledge, skills-tools-mcp; keywords=mcp, rag; labels=breakout:watch, ecosystem-depth:topic-backed, freshness:new-72h, history:none, tier:none
- #21 Wide-Moat/open-computer-use: score=79; tier=none; history=none; qualification=keep-observing; ecosystems=agent-runtime, browser-computer-use, skills-tools-mcp; keywords=execution, mcp, skills; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #22 BuyWhere/buywhere-mcp: score=77; tier=none; history=mixed; qualification=keep-observing; ecosystems=memory-knowledge, skills-tools-mcp; keywords=context, mcp; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:mixed, tier:none
- #23 markoblogo/AGENTS.md_generator: score=77; tier=none; history=none; qualification=keep-observing; ecosystems=agent-runtime, coding-agents, memory-knowledge, skills-tools-mcp; keywords=context, diff, mcp, workflow; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #24 coasty-ai/open-cowork: score=75; tier=none; history=mixed; qualification=keep-observing; ecosystems=browser-computer-use; keywords=automation, desktop; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:mixed, tier:none
- #25 itohnobue/research-agent-claude-code: score=74; tier=none; history=none; qualification=keep-observing; ecosystems=agent-ui-workbench, coding-agents, memory-knowledge; keywords=claude code, knowledge; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #26 mem0ai/memory-benchmarks: score=73; tier=proven; history=none; qualification=keep-observing; ecosystems=memory-knowledge; keywords=memory; labels=breakout:steady, ecosystem-depth:seed-adjacent, freshness:new-24h, history:none, pedigree:company, tier:proven
- #27 infinitywings/rka: score=73; tier=none; history=none; qualification=keep-observing; ecosystems=agent-runtime, memory-knowledge, skills-tools-mcp; keywords=knowledge, mcp, orchestration; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #28 DanMcInerney/architect-loop: score=67; tier=none; history=mixed; qualification=keep-observing; ecosystems=coding-agents, memory-knowledge; keywords=claude code, codex, memory; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:mixed, tier:none
- #29 linny006/agent-eval-harness: score=67; tier=none; history=emerging; qualification=keep-observing; ecosystems=coding-agents, eval-observability-governance; keywords=eval; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:emerging, tier:none
- #30 pwrdrvr/PwrAgent: score=67; tier=none; history=none; qualification=keep-observing; ecosystems=browser-computer-use, coding-agents; keywords=codex, desktop; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #31 amitse/uiacli: score=65; tier=none; history=mixed; qualification=unknown; ecosystems=browser-computer-use; keywords=automation; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:mixed, tier:none
- #32 meyz664K/auto-re-agent: score=65; tier=none; history=none; qualification=unknown; ecosystems=agentic-rl, multi-agent-coordination; keywords=none; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #33 cipher813/alpha-engine: score=63; tier=none; history=mixed; qualification=unknown; ecosystems=agent-runtime, multi-agent-coordination; keywords=execution, multi-agent; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:mixed, tier:none
- #34 ibahgat/oh-my-iflow: score=63; tier=none; history=mixed; qualification=unknown; ecosystems=browser-computer-use, multi-agent-coordination; keywords=automation, multi-agent; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:mixed, tier:none
- #35 limuran117-coder/Scenic-Area-Marketing-CN: score=63; tier=none; history=mixed; qualification=unknown; ecosystems=browser-computer-use, memory-knowledge; keywords=automation, knowledge; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:mixed, tier:none
- #36 ericosiu/ai-marketing-skills: score=63; tier=none; history=mixed; qualification=unknown; ecosystems=browser-computer-use, skills-tools-mcp; keywords=automation, skills; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:mixed, tier:none
- #37 Rayyan-Oumlil/CustoFlow: score=63; tier=none; history=none; qualification=unknown; ecosystems=eval-observability-governance, multi-agent-coordination; keywords=multi-agent; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #38 jammsen/docker-coding-agent-sandbox: score=63; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, coding-agents; keywords=sandbox; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #39 KyaniteLabs/tastecheck: score=63; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=skills; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #40 thuanhd2/auto-devs: score=63; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, coding-agents; keywords=workflow; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #41 josephfung/curia: score=63; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge, multi-agent-coordination; keywords=knowledge; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #42 sahil87/fab-kit: score=63; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, coding-agents; keywords=workflow; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #43 NPC-Worldwide/npcpy: score=63; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge, skills-tools-mcp; keywords=knowledge; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #44 DuqueOM/ML-MLOps-Production-Template: score=61; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=claude code, cursor; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #45 TonyWang-hub/mcp-cn-commerce: score=57; tier=none; history=none; qualification=unknown; ecosystems=skills-tools-mcp; keywords=mcp; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #46 Toufumind/mind-agency: score=57; tier=none; history=none; qualification=unknown; ecosystems=multi-agent-coordination; keywords=multi-agent; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #47 DeadWaveWave/opencove: score=57; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, memory-knowledge; keywords=claude code, codex, knowledge; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #48 Atum246/keelead: score=55; tier=none; history=none; qualification=unknown; ecosystems=skills-tools-mcp; keywords=mcp; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #49 mason-cao/multi-agent-customer-intelligence-dashboard: score=55; tier=none; history=none; qualification=unknown; ecosystems=multi-agent-coordination; keywords=multi-agent; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #50 stoa-hq/stoa: score=55; tier=none; history=none; qualification=unknown; ecosystems=skills-tools-mcp; keywords=mcp; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #51 vegedon/open-computer-use: score=55; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=desktop; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #52 ivankuznetsov/hive: score=55; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=codex; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #53 auto-use/Auto-Use: score=55; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=computer use; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #54 gojue/moling: score=55; tier=none; history=none; qualification=unknown; ecosystems=skills-tools-mcp; keywords=mcp; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #55 NVIDIA/SkillSpector: score=55; tier=none; history=none; qualification=unknown; ecosystems=skills-tools-mcp; keywords=skills; labels=breakout:watch, ecosystem-depth:keyword-backed, freshness:new-72h, history:none, tier:none
- #56 netease-youdao/LobsterAI: score=54; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime; keywords=none; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #57 nullclaw/nullclaw: score=54; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime; keywords=none; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #58 Cashed-gravity8670/qyclaw: score=53; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, memory-knowledge; keywords=execution, memory; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #59 noxwei/LibraryOfBabel: score=53; tier=none; history=none; qualification=unknown; ecosystems=eval-observability-governance, memory-knowledge; keywords=knowledge, review; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #60 sinclarespeaking143/openclaw-superagent: score=53; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, memory-knowledge; keywords=automation, memory; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #61 jrr996shujin-png/kol-ops-suite: score=53; tier=none; history=none; qualification=unknown; ecosystems=eval-observability-governance, skills-tools-mcp; keywords=review, skills; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #62 linroger/DeepResearchForecast: score=53; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge, multi-agent-coordination; keywords=knowledge, multi-agent; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #63 TirupMehta/trace-guard: score=53; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, eval-observability-governance; keywords=computer use, trace; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #64 434media/bizdev-agent: score=53; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, browser-computer-use; keywords=automation, workflow; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #65 zfy465914233/scholar-agent: score=53; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge, skills-tools-mcp; keywords=knowledge, mcp; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #66 DemonDamon/AgenticX-DeepResearch: score=53; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge, multi-agent-coordination; keywords=knowledge, multi-agent; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #67 Divyansh487/TradingAgents-CN: score=53; tier=none; history=none; qualification=unknown; ecosystems=agentic-rl; keywords=none; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #68 get-zeked/perplexity-super-skills: score=53; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=claude code, skills; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #69 eve0415/cella: score=51; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=none; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #70 dipankar/apollo-io-cli: score=51; tier=none; history=none; qualification=unknown; ecosystems=skills-tools-mcp; keywords=none; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #71 warwickwood-cell/gengeo-agent-registry: score=51; tier=none; history=none; qualification=unknown; ecosystems=skills-tools-mcp; keywords=none; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #72 nomad-prime/hoosh: score=51; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=none; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #73 josephsenior/Grinta-Coding-Agent: score=51; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=none; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #74 itmisx/deepx-code: score=51; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=none; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #75 robzilla1738/harness-terminal: score=51; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=none; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #76 boldsoftware/shelley: score=51; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=none; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #77 zhukunpenglinyutong/desktop-cc-gui: score=47; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=desktop, gui; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #78 changw98ic/codepatchbay: score=45; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=claude code, codex; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #79 danilo1003/agent-team-orchestrator: score=45; tier=none; history=none; qualification=unknown; ecosystems=multi-agent-coordination; keywords=multi-agent, team; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #80 raviMakes/ai-helpdesk: score=45; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge; keywords=knowledge, rag; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #81 ChenVoid/Awesome-GUI-Agent: score=45; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=computer use, gui; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #82 kernel/ts-stagehand-google-cua-agent: score=45; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=automation, computer use; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #83 ryunzz/sb_hacks: score=45; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=automation, computer use; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #84 oasis-surveys/oasis-platform: score=45; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge; keywords=knowledge, rag; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #85 haoyiyin/basjoo: score=45; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge; keywords=knowledge, rag; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #86 qhkm/zeptoclaw: score=44; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge; keywords=memory; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:active-today, history:none, tier:none
- #87 anhb1/sales-outreach-automation-langgraph: score=43; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=automation; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #88 basilsajeev987/AI-Hedge-Fund-OS: score=43; tier=none; history=none; qualification=unknown; ecosystems=multi-agent-coordination; keywords=multi-agent; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #89 DuhanJishnu/support-ai: score=43; tier=none; history=none; qualification=unknown; ecosystems=multi-agent-coordination; keywords=multi-agent; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #90 Nijamudin/automated-business-analysis-workflow: score=43; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime; keywords=workflow; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #91 Poi5eN/Nexus: score=43; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime; keywords=orchestration; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #92 Fxsin/Scientra-Copilot: score=43; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge; keywords=knowledge; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #93 Mdirman/Notion-AI-CRM-Agents: score=43; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime; keywords=workflow; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #94 ronitg1/alpha-terminal: score=43; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime; keywords=execution; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #95 quysto/QUYQUY-Database-Automation-Coffee: score=43; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=automation; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #96 sandhere01/meta-ads-automation-ai: score=43; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=automation; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #97 Bigdata-com/bigdata-cookbook: score=43; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge; keywords=rag; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #98 ALAGENT-HKU/x2strategy: score=43; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=claude code; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #99 nexscope-ai/eCommerce-Skills: score=43; tier=none; history=none; qualification=unknown; ecosystems=skills-tools-mcp; keywords=skills; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #100 brokermr810/QuantDinger: score=43; tier=none; history=none; qualification=unknown; ecosystems=multi-agent-coordination; keywords=multi-agent; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #101 duelHunter/whatsapp-agent-support: score=41; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge; keywords=rag; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #102 dungnotnull/phishing-immune-agent: score=41; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=automation; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #103 riverfr/link-building-automation-tool: score=41; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=automation; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #104 TapPay/tappay-agentic-commerce: score=41; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime; keywords=execution; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #105 itohnobue/research-agent-opencode: score=41; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge; keywords=knowledge; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #106 NorceTech/commerce-agent-sdk: score=41; tier=none; history=none; qualification=unknown; ecosystems=skills-tools-mcp; keywords=mcp; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #107 Shivam00980/Telegram-Automation-Toolkit: score=41; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=automation; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #108 simonesiega/get-agents: score=41; tier=none; history=none; qualification=unknown; ecosystems=skills-tools-mcp; keywords=skills; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #109 sushilk1991/mastisk: score=41; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge; keywords=knowledge; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #110 bettyguo/computer_use_agent: score=41; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=browser agent; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #111 oldestlivingboy/reliableagents: score=41; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=computer use; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #112 opena2a-org/ai-browserguard: score=41; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=computer use; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #113 shimo4228/contemplative-agent: score=41; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge; keywords=knowledge; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #114 XXXaber/Deepagent-research-context-engineering: score=41; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge; keywords=context; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #115 Saurabh22111998/Hollywood-Quality-UGC-Ad-Generator: score=41; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=automation; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #116 aasmaagh/social-media-automation: score=41; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=automation; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #117 ethanplusai/harvey: score=41; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=claude code; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #118 leeguooooo/iphone-use: score=41; tier=none; history=none; qualification=unknown; ecosystems=skills-tools-mcp; keywords=mcp; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #119 ClicShopping/ClicShopping: score=41; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=desktop; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #120 openJiuwen-ai/deepsearch: score=41; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge; keywords=knowledge; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #121 GoogleCloudPlatform/knowledge-catalog: score=41; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge; keywords=knowledge; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #122 eracle/OpenOutreach: score=41; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=automation; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none

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
- github_star_delta: live_attempts=20, live_success=3, snapshot_success=0, token_missing=0, auth_invalid=0, rate_limit=0, network_blocked=0

## Top 项目

- [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) | 分数 100 | 置信度 high | 范式 agent runtime + persistent memory + tool/skill ecosystem
  - 排名裁决: base_final_rank=105 | final_rank=105 | qualification=keep-observing | judge_delta=0
  - 位置理由: 热度高（日增215星），范式匹配度高，无明显风险，当前排名合理。
  - 入选原因: paradigm=agent runtime + persistent memory + tool/skill ecosystem | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=215) | engagement_score=100 (forks=33562) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无
- [anthropics/claude-code](https://github.com/anthropics/claude-code) | 分数 100 | 置信度 high | 范式 agent runtime + persistent memory
  - 排名裁决: base_final_rank=105 | final_rank=105 | qualification=keep-observing | judge_delta=0
  - 位置理由: 热度高（日增170星），终端编程助手范式匹配，持续火热，排名合理。
  - 入选原因: paradigm=agent runtime + persistent memory | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=170) | engagement_score=100 (forks=21400) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无
- [openclaw/openclaw](https://github.com/openclaw/openclaw) | 分数 98.5 | 置信度 high | 范式 agent runtime + persistent memory + tool/skill ecosystem
  - 排名裁决: base_final_rank=101 | final_rank=101 | qualification=keep-observing | judge_delta=0
  - 位置理由: 日增46星，自托管特性有一定差异化，排名合理。
  - 入选原因: paradigm=agent runtime + persistent memory + tool/skill ecosystem | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=46) | engagement_score=100 (forks=79200) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无
- [openai/codex](https://github.com/openai/codex) | 分数 100 | 置信度 high | 范式 agent runtime + persistent memory
  - 排名裁决: base_final_rank=102.5 | final_rank=100.5 | qualification=keep-observing | judge_delta=-2
  - 位置理由: 日增仅26星，热度明显低于前两名，尽管品牌强，但当前排名偏高，建议微调下降。
  - 入选原因: paradigm=agent runtime + persistent memory | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=26) | engagement_score=100 (forks=13400) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无
- [anthropics/skills](https://github.com/anthropics/skills) | 分数 96.25 | 置信度 high | 范式 agent infra
  - 排名裁决: base_final_rank=101.25 | final_rank=101.25 | qualification=keep-observing | judge_delta=0
  - 入选原因: paradigm=agent infra | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=183) | engagement_score=100 (forks=17751) | architecture_shift=85 (baseline=default_agent_capability)
  - 风险: 无

## 风险提示

- 仍有 274 个项目只有单一信号源，需要跨源或跨天确认
- 有 3 个项目缺少描述，语义判断会受限

## 下一步重点

- 在提升弱信号前，先确认跨天 persistence 或第二信号源

## 建议动作

- 单源项目先等第二信号源或第二天 persistence，再考虑升级判断
- 可以把这次运行当作稳定基线，继续推进更强的 GitHub enrichment 或 weekly 汇总
