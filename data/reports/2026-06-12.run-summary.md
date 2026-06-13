# Agent Trend Radar 运行摘要 2026-06-12

> 生成时间 2026-06-13T17:11:19+08:00

## 新鲜度摘要

- overall_daily_status: 数据部分回退，谨慎参考
- main_board_mode: fresh_today_only
- today_fresh_candidate_count: 49
- today_star_count: 4
- context_candidate_count: 390
- pending_confirmation_count: 22
- agents-radar 历史上下文 [context]: fresh_today | effective_date=2026-06-12 | realtime=true | agents-radar 仓库已同步，可读取 2026-06-12 的最新 digest
- Trendshift 当日命中 [freshness-driving]: fresh_today | effective_date=2026-06-12 | realtime=true | Trendshift 实时抓取成功，发现 25 个候选
- GitHub Trending [freshness-driving]: fresh_today | effective_date=2026-06-12 | realtime=true | GitHub Trending 实时发现成功，发现 25 个候选
- 重点观察清单动态 [freshness-driving]: fallback_recent | effective_date=2026-06-11 | realtime=false | 重点观察清单动态实时抓取不可用，已回退到 2026-06-11 的最近结果（83 个成功）
- GitHub 当日涨星信号 [freshness-driving]: fallback_recent | effective_date=2026-06-12 | realtime=false | GitHub 当日涨星信号当前不可用，已回退到快照结果（148 个成功）

## LLM 诊断

- enabled: true
- provider: deepseek
- mode: semantic-classification
- classification_cache_hit_count: 33
- classification_attempt_count: 406
- classification_success_count: 0
- classification_failure_count: 406
- summary_attempt_count: 70
- summary_success_count: 0
- summary_failure_count: 70
- judge_attempt_count: 6
- judge_success_count: 0
- judge_failure_count: 6
- latest_provider_error: Missing DEEPSEEK_API_KEY for DeepSeek provider. [auth]
- latest_summary_error: daily summary returned no structured projects
- latest_judge_error: position judge returned no structured adjustments for window=1

## MVP 完成信号

- 是否完成: 是
- dry_run: false
- 原始信号阶段完成，共 459 条
- 归一化阶段完成，共 439 个项目
- 评分阶段完成，共 439 个已评分项目
- 本次运行活跃信号面: 5/5
- 仍有 15 个项目处于低置信度，需要后续验证
- 本次运行已成功写盘

## 阶段计数

- 原始信号: 459
- 归一化项目: 439
- 已评分项目: 439
- 高分项目: 23
- 异常增长项目: 13
- 新项目: 439
- classifications: 33

## 数据源状态

- agents-radar: active | enabled=true | items=47 | projects=43
- trendshift: active | enabled=true | items=25 | projects=25
- github_trending: active | enabled=true | items=25 | projects=25
- watchlist_live_activity: active | enabled=true | items=83 | projects=83
- github-enrichment: active | enabled=true | items=180 | projects=162

## Mission Discovery

- mission_discovery_status: active
- mission_degraded_reason_codes: none
- today_pulse_count: 4
- mission_match_count: 2
- explore_ribbon_count: 2
- coverage_atlas_count: 16
- gap_ledger_count: 13
- deep_upgrade_direction_count: 13
- search_exhausted_direction_count: 0
- quantity_target_met_count: 3
- observer_promotion_candidate_count: 0
- rolling_30d_searchable_catalog_count: 1012
- rolling_30d_vertical_or_task_oriented_count: 216
- rolling_7d_qualified_non_head_count: 312
- outcome_distribution: matched=3, weak_signal=13
- pressure_state_distribution: normal=16
- coverage coding-agent: outcome=matched; pressure=normal; next_action=keep_watching; search_exhausted=false
- coverage browser-computer-use: outcome=matched; pressure=normal; next_action=keep_watching; search_exhausted=false
- coverage workflow-automation-agent: outcome=weak_signal; pressure=normal; next_action=upgrade_to_deep; search_exhausted=false
- coverage research-knowledge-agent: outcome=matched; pressure=normal; next_action=keep_watching; search_exhausted=false
- coverage shopping-commerce-agent: outcome=weak_signal; pressure=normal; next_action=upgrade_to_deep; search_exhausted=false
- coverage sales-prospecting-agent: outcome=weak_signal; pressure=normal; next_action=upgrade_to_deep; search_exhausted=false
- coverage customer-support-agent: outcome=weak_signal; pressure=normal; next_action=upgrade_to_deep; search_exhausted=false
- coverage marketing-content-ops-agent: outcome=weak_signal; pressure=normal; next_action=upgrade_to_deep; search_exhausted=false
- gap workflow-automation-agent: reasons=quantity_target_unmet; next_action=upgrade_to_deep
- gap shopping-commerce-agent: reasons=quantity_target_unmet; next_action=upgrade_to_deep
- gap sales-prospecting-agent: reasons=quantity_target_unmet; next_action=upgrade_to_deep
- gap customer-support-agent: reasons=quantity_target_unmet; next_action=upgrade_to_deep
- gap marketing-content-ops-agent: reasons=quantity_target_unmet; next_action=upgrade_to_deep
- gap finance-investment-research-agent: reasons=quantity_target_unmet; next_action=upgrade_to_deep
- gap data-analytics-bi-agent: reasons=quantity_target_unmet; next_action=upgrade_to_deep
- gap legal-compliance-agent: reasons=quantity_target_unmet; next_action=upgrade_to_deep

## Observer Status

- ecosystem_focus: active
- observer_candidate_count: 162
- observer_ecosystem_counts: eval-observability-governance=19, skills-tools-mcp=73, agent-runtime=42, memory-knowledge=23, browser-computer-use=44, coding-agents=74, multi-agent-coordination=29, agentic-rl=2, agent-ui-workbench=1
- incubating_direction coding-agents: hits_7d=7; repos=74; promotion_candidate=false; unmet_gates=duplicate_must_cover_direction | missing_gap_pressure_or_feedback
- incubating_direction skills-tools-mcp: hits_7d=7; repos=73; promotion_candidate=false; unmet_gates=missing_gap_pressure_or_feedback
- incubating_direction agent-runtime: hits_7d=7; repos=42; promotion_candidate=false; unmet_gates=missing_gap_pressure_or_feedback
- incubating_direction eval-observability-governance: hits_7d=7; repos=19; promotion_candidate=false; unmet_gates=missing_gap_pressure_or_feedback
- incubating_direction memory-knowledge: hits_7d=6; repos=23; promotion_candidate=false; unmet_gates=missing_gap_pressure_or_feedback
- incubating_direction browser-computer-use: hits_7d=4; repos=44; promotion_candidate=false; unmet_gates=duplicate_must_cover_direction | missing_gap_pressure_or_feedback
- incubating_direction agent-ui-workbench: hits_7d=3; repos=1; promotion_candidate=false; unmet_gates=missing_gap_pressure_or_feedback
- incubating_direction multi-agent-coordination: hits_7d=2; repos=29; promotion_candidate=false; unmet_gates=observer_hits_7d<3 | missing_gap_pressure_or_feedback
- incubating_direction agentic-rl: hits_7d=2; repos=2; promotion_candidate=false; unmet_gates=observer_hits_7d<3 | missing_gap_pressure_or_feedback
- #1 langfuse/langfuse-js: score=103; tier=proven; history=validated; qualification=unknown; ecosystems=eval-observability-governance; keywords=observability; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:validated, pedigree:company, tier:proven
- #2 langfuse/langfuse-docs: score=103; tier=proven; history=validated; qualification=unknown; ecosystems=eval-observability-governance; keywords=observability; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:validated, pedigree:company, tier:proven
- #3 awslabs/iam-policy-autopilot: score=101; tier=core; history=mixed; qualification=unknown; ecosystems=eval-observability-governance, skills-tools-mcp; keywords=mcp, policy; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:mixed, pedigree:company, tier:core
- #4 moltis-org/moltis: score=96; tier=none; history=mixed; qualification=unknown; ecosystems=agent-runtime, memory-knowledge, skills-tools-mcp; keywords=execution, mcp, memory; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:active-today, history:mixed, tier:none
- #5 OpenBMB/UltraRAG: score=94; tier=proven; history=mixed; qualification=unknown; ecosystems=memory-knowledge, skills-tools-mcp; keywords=mcp, rag; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-72h, history:mixed, pedigree:company, tier:proven
- #6 browser-use/bux: score=92; tier=proven; history=none; qualification=unknown; ecosystems=browser-computer-use, coding-agents; keywords=automation, claude code; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, pedigree:company, tier:proven
- #7 google/agents-cli: score=89; tier=core; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=skills; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, pedigree:company, tier:core
- #8 langfuse/langfuse-python: score=89; tier=proven; history=validated; qualification=unknown; ecosystems=eval-observability-governance; keywords=observability; labels=breakout:steady, ecosystem-depth:seed-adjacent, freshness:new-72h, history:validated, pedigree:company, tier:proven
- #9 manishiitg/mcp-agent-builder-go: score=85; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, browser-computer-use, multi-agent-coordination, skills-tools-mcp; keywords=automation, mcp, workflow; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #10 kage-core/Kage: score=85; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, memory-knowledge, skills-tools-mcp; keywords=mcp, memory; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #11 vishal2559/supply-chain-control-tower: score=85; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, multi-agent-coordination, skills-tools-mcp; keywords=mcp, multi-agent, workflow; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #12 Aryia-Behroziuan/References: score=85; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, agentic-rl, eval-observability-governance, memory-knowledge, multi-agent-coordination, skills-tools-mcp; keywords=coordination, execution, knowledge, multi-agent, reinforcement learning, retrieval, review, skills; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #13 Rastaman4e/-1: score=85; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, eval-observability-governance, memory-knowledge, skills-tools-mcp; keywords=execution, knowledge, memory, plugin, policy, review; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #14 Sfedfcv/redesigned-pancake: score=85; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, browser-computer-use, coding-agents, eval-observability-governance, memory-knowledge, multi-agent-coordination, skills-tools-mcp; keywords=automation, context, desktop, diff, execution, patch, policy, review, skills, team, workflow; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #15 minamagdyyyy/agentic-marketing: score=81; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, browser-computer-use, coding-agents, skills-tools-mcp; keywords=automation, claude code, execution, skills, workflow; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #16 blacklettertimeoff432/be-my-butler: score=81; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, coding-agents, multi-agent-coordination; keywords=automation, claude code; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #17 mickeyyaya/evolve-loop: score=79; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, eval-observability-governance, skills-tools-mcp; keywords=claude code, eval, plugin; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #18 over7-maker/Advanced-Multi-Agent-Intelligence-System: score=79; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, browser-computer-use, multi-agent-coordination; keywords=automation, multi-agent, orchestration; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #19 coalesce-labs/catalyst: score=79; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, coding-agents, memory-knowledge; keywords=claude code, memory, workflow; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #20 getaero-io/gtm-eng-skills: score=79; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, coding-agents, skills-tools-mcp; keywords=automation, claude code, skills; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #21 MECHANICALXXCODER/KISANBANDHU: score=77; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, eval-observability-governance, memory-knowledge, multi-agent-coordination; keywords=automation, knowledge, policy, team; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #22 chethanad5372/TradingAgents: score=77; tier=none; history=none; qualification=unknown; ecosystems=agentic-rl, multi-agent-coordination, skills-tools-mcp; keywords=multi-agent; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #23 Gratianahydrokinetic908/Adrian: score=77; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, eval-observability-governance, skills-tools-mcp; keywords=runtime; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #24 mo1st/Quorlyx: score=77; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, memory-knowledge, skills-tools-mcp; keywords=automation, context, knowledge, plugin; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #25 daintreehq/daintree: score=77; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, browser-computer-use, coding-agents, memory-knowledge; keywords=automation, codex, context, workflow; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #26 HetCreep/CoalMine: score=75; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, eval-observability-governance, skills-tools-mcp; keywords=observability, skills; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #27 Ju571nK/sigil: score=75; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=claude code, codex, cursor, mcp; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #28 iFurySt/open-browser-use: score=74; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, skills-tools-mcp; keywords=automation; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #29 blackKnight087/LegalEase.Ai: score=73; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, browser-computer-use, memory-knowledge; keywords=automation, rag, workflow; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #30 rudraofficial09052003/lead-generation-workflow-automation: score=73; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, browser-computer-use, multi-agent-coordination; keywords=automation, team, workflow; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #31 devopsyokesh/Jenkins-on-CentOS: score=73; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, browser-computer-use, multi-agent-coordination; keywords=automation, team, workflow; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #32 leuz9/Tekki: score=73; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, browser-computer-use, skills-tools-mcp; keywords=automation, skills, workflow; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #33 optimus-a1/agent-wiki-hub: score=73; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, eval-observability-governance, memory-knowledge; keywords=codex, rag, review; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #34 vinodkadli7022/Recruiting-Agent: score=73; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, eval-observability-governance, multi-agent-coordination; keywords=multi-agent, observability, orchestration; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #35 NEXARA-oss/PulseStack: score=73; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, browser-computer-use, eval-observability-governance; keywords=automation, observability, runtime; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #36 hixuanxuan/browser-automation: score=73; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, coding-agents, skills-tools-mcp; keywords=automation, diff, skills; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #37 Aryia-Behroziuan/Other-sources: score=73; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, eval-observability-governance, memory-knowledge; keywords=automation, knowledge, review; labels=breakout:steady, ecosystem-depth:cross-ecosystem, freshness:new-24h, history:none, tier:none
- #38 1146345502/reddit-skills: score=73; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, skills-tools-mcp; keywords=automation, skills; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #39 floomhq/openbrowser: score=73; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, skills-tools-mcp; keywords=automation, mcp; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #40 seehiong/autonomous-hdb-deepagents: score=73; tier=none; history=none; qualification=unknown; ecosystems=multi-agent-coordination, skills-tools-mcp; keywords=mcp, multi-agent; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #41 KonghaYao/peri: score=73; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=claude code, mcp; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #42 commitshow/commitshow: score=71; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=none; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #43 LeadMagic/gtm-skills: score=71; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, skills-tools-mcp; keywords=automation, mcp, skills; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #44 hoangsonww/GitIntel-MCP-Server: score=71; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge, skills-tools-mcp; keywords=context, knowledge, mcp; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #45 Peuqui/AIfred-Intelligence: score=71; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge, multi-agent-coordination; keywords=memory, multi-agent, rag; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #46 Mauritiusllewelynpowys919/codex-review: score=70; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=claude code, code review, codex; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #47 KLN77350/lexwiki: score=69; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge, skills-tools-mcp; keywords=knowledge; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #48 scottgl9/skelm: score=69; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, skills-tools-mcp; keywords=workflow; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #49 xbtlin/ai-berkshire: score=69; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=claude code; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #50 PushpenderIndia/browsegenie: score=69; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, skills-tools-mcp; keywords=automation; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #51 huyukun662-crypto/guanlan-regime-factor: score=67; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=claude code, skills; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #52 Elfredaaroused655/claude-skills: score=67; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=claude code, skills; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #53 BuyWhere/buywhere-mcp: score=67; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge, skills-tools-mcp; keywords=context, mcp; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #54 msaleme/red-team-blue-team-agent-fabric: score=67; tier=none; history=none; qualification=unknown; ecosystems=multi-agent-coordination, skills-tools-mcp; keywords=mcp, team; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #55 msaad00/agent-bom: score=67; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, skills-tools-mcp; keywords=mcp, runtime; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #56 MervinPraison/PraisonAI: score=67; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge, multi-agent-coordination; keywords=memory, rag; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #57 commonplace-middledistance109/awesome-codex-cli: score=66; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=codex, skills; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #58 tayyabexe/skills: score=65; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=claude code, codex, skills; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #59 coasty-ai/open-cowork: score=65; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=automation, desktop; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #60 langbot-app/langbot-plugin-sdk: score=65; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, skills-tools-mcp; keywords=plugin, runtime, sandbox; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #61 crevideo/crevideo-reach: score=63; tier=none; history=none; qualification=unknown; ecosystems=skills-tools-mcp; keywords=mcp, plugin, skills; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #62 LinXueyuanStdio/viben: score=63; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, multi-agent-coordination; keywords=swarm; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #63 dougwithseismic/hogsend: score=63; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, coding-agents; keywords=automation; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #64 Faiz07yo/digital-marketing-pro: score=63; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, skills-tools-mcp; keywords=automation; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #65 MatheusWinkler/knowledge-pipeline: score=63; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge, multi-agent-coordination; keywords=knowledge; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #66 DrakoLabs/drako: score=63; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, skills-tools-mcp; keywords=runtime; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #67 raid708/ai-dev-tasks: score=63; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=cursor; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #68 sanathanantha08-star/HR-Workflow-Agent-LangGraph: score=62; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, multi-agent-coordination; keywords=multi-agent, workflow; labels=breakout:steady, ecosystem-depth:seed-adjacent, freshness:new-24h, history:none, tier:none
- #69 terrene-foundation/kailash-py: score=61; tier=none; history=emerging; qualification=unknown; ecosystems=agent-runtime; keywords=execution, orchestration, workflow; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:emerging, tier:none
- #70 KbWen/agentic-os: score=61; tier=none; history=emerging; qualification=unknown; ecosystems=coding-agents; keywords=claude code, codex, cursor; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:emerging, tier:none
- #71 John-droid-coder/just_say_no: score=61; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=claude code, codex; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #72 davepoon/buildwithclaude: score=61; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=claude code, skills; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #73 eljulians/skillfile: score=61; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=claude code, codex, cursor, skills; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #74 MrWong99/zhi: score=59; tier=none; history=emerging; qualification=unknown; ecosystems=skills-tools-mcp; keywords=plugin; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:emerging, tier:none
- #75 jeremylongshore/claude-code-plugins-plus-skills: score=59; tier=none; history=emerging; qualification=unknown; ecosystems=skills-tools-mcp; keywords=skills; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:emerging, tier:none
- #76 Basic-XYZ/baku-skills: score=59; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=claude code, codex; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #77 getagentseal/agentseal: score=59; tier=none; history=none; qualification=unknown; ecosystems=skills-tools-mcp; keywords=mcp, skills; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #78 markyy101/conductor-orchestrator-superpowers: score=57; tier=none; history=emerging; qualification=unknown; ecosystems=agent-runtime; keywords=execution, orchestration; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:emerging, tier:none
- #79 sherry255/BeamTrail: score=57; tier=none; history=emerging; qualification=unknown; ecosystems=agent-runtime; keywords=runtime, workflow; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:emerging, tier:none
- #80 mobius-os/mobius: score=57; tier=none; history=emerging; qualification=unknown; ecosystems=coding-agents; keywords=claude code, codex; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:emerging, tier:none
- #81 linny006/trending-claude-skills: score=57; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=skills; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #82 chamuka-inc/vmette: score=57; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, skills-tools-mcp; keywords=sandbox; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #83 RBraga01/a-team: score=57; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=claude code, codex, cursor; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #84 eugenelim/agent-ready-repo: score=57; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=claude code, codex, cursor; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #85 madderangelfoodcake950/OpenMOSS: score=57; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, multi-agent-coordination; keywords=automation, coordination, multi-agent; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #86 sentrysurface/surfaceproxy-core: score=57; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, coding-agents; keywords=automation, claude code, cursor; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #87 JeffBrines/openfpa: score=57; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, memory-knowledge; keywords=claude code, codex, memory; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #88 DanMcInerney/architect-loop: score=57; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, memory-knowledge; keywords=claude code, codex, memory; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #89 WorldBrain/memex-codex: score=56; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=codex, plugin; labels=breakout:steady, ecosystem-depth:seed-adjacent, freshness:active-today, history:none, tier:none
- #90 venkathub/atlas-compliance-copilot: score=55; tier=none; history=none; qualification=unknown; ecosystems=skills-tools-mcp; keywords=mcp; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #91 amitse/uiacli: score=55; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use; keywords=automation; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:new-24h, history:none, tier:none
- #92 wwind123/coding-review-agent-loop: score=55; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=codex; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #93 jianshuo/claude-skills: score=55; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=claude code, codex, cursor, skills; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:active-today, history:none, tier:none
- #94 maatini/bpmninja: score=53; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime; keywords=execution, workflow; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #95 mupozg823/codelens-mcp-plugin: score=53; tier=none; history=none; qualification=unknown; ecosystems=skills-tools-mcp; keywords=mcp, plugin; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #96 jmagly/agentic-sandbox: score=53; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime; keywords=runtime, sandbox; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #97 dazuiba/handoff: score=53; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=claude code, codex; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #98 cipher813/alpha-engine: score=53; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, multi-agent-coordination; keywords=execution, multi-agent; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #99 ibahgat/oh-my-iflow: score=53; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, multi-agent-coordination; keywords=automation, multi-agent; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #100 KumarSambhav01/AstraQuant-AI: score=53; tier=none; history=none; qualification=unknown; ecosystems=memory-knowledge, multi-agent-coordination; keywords=multi-agent, rag; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #101 Leonidaspeanut117/Multi-Agent-Newsletter-Automation: score=53; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, multi-agent-coordination; keywords=automation, multi-agent; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #102 LOLA0786/PrivateVault.ai: score=53; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, multi-agent-coordination; keywords=automation, multi-agent; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #103 Tubby0895/awesome-agents: score=53; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, multi-agent-coordination; keywords=automation, multi-agent; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #104 limuran117-coder/Scenic-Area-Marketing-CN: score=53; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, memory-knowledge; keywords=automation, knowledge; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #105 AustinZ21/EggHatch-AI: score=53; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, eval-observability-governance; keywords=review, workflow; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #106 openmobilehub/mcp-apps-shopping-demo: score=53; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, skills-tools-mcp; keywords=desktop, mcp; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #107 saint-viperx/SCR_Bench: score=53; tier=none; history=none; qualification=unknown; ecosystems=eval-observability-governance, skills-tools-mcp; keywords=review, skills; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #108 sibsankarb4/DevOps-Docker-Jenkins-GIT-CI-Pipeline-and-Maven: score=53; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, multi-agent-coordination; keywords=automation, team; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #109 501Commons/Salesforce-Importer: score=53; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, eval-observability-governance; keywords=automation, review; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #110 O0000-code/awesome-academic-skills: score=53; tier=none; history=none; qualification=unknown; ecosystems=eval-observability-governance, skills-tools-mcp; keywords=review, skills; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #111 zubair-trabzada/ai-recruiter-claude: score=53; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=claude code, skills; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #112 psyb0t/aigate: score=53; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, browser-computer-use; keywords=automation, execution; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #113 DekaPrayoga/AurixAgent: score=53; tier=none; history=none; qualification=unknown; ecosystems=multi-agent-coordination, skills-tools-mcp; keywords=multi-agent, skills; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #114 reason-healthcare/rh-skills: score=53; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, skills-tools-mcp; keywords=skills, workflow; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #115 galyarderlabs/galyarder-framework: score=53; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, skills-tools-mcp; keywords=execution, skills; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #116 ngocsangyem/MeowKit: score=53; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, coding-agents; keywords=claude code, workflow; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #117 miao4ai/open_recruiter: score=53; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, browser-computer-use; keywords=automation, workflow; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #118 Linked-API/linkedin-skills: score=53; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, skills-tools-mcp; keywords=automation, skills; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #119 georgevetticaden/multi-agent-health-insight-system: score=53; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, multi-agent-coordination; keywords=desktop, multi-agent; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #120 iamramanarora/TopAutomationTools: score=53; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, browser-computer-use; keywords=automation, workflow; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #121 kadevin/ilab-gpt-conjure: score=53; tier=none; history=none; qualification=unknown; ecosystems=agent-ui-workbench, coding-agents; keywords=codex, workbench; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #122 pocketpaw/pocketpaw: score=53; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, multi-agent-coordination; keywords=desktop, multi-agent; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #123 ericosiu/ai-marketing-skills: score=53; tier=none; history=none; qualification=unknown; ecosystems=browser-computer-use, skills-tools-mcp; keywords=automation, skills; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #124 pipeshub-ai/pipeshub-ai: score=53; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, browser-computer-use; keywords=automation, workflow; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #125 Haldiram1937/CodexBar-Win: score=52; tier=none; history=emerging; qualification=unknown; ecosystems=coding-agents; keywords=claude code, codex; labels=breakout:steady, ecosystem-depth:seed-adjacent, freshness:active-today, history:emerging, tier:none
- #126 Yeachan-Heo/oh-my-codex-website: score=52; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=codex; labels=breakout:steady, ecosystem-depth:seed-adjacent, freshness:active-today, history:none, tier:none
- #127 panando/CodexAdaptor: score=50; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=codex; labels=breakout:steady, ecosystem-depth:seed-adjacent, freshness:new-24h, history:none, tier:none
- #128 bozkurtonur3-lgtm/magi-workflow: score=49; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=claude code; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #129 domty99/crucible_kitchen: score=49; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime; keywords=workflow; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #130 drippy-passport968/agent-supervision-skills: score=49; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=codex; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #131 q-j0k/sprintloop-orchestration: score=49; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime; keywords=orchestration; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #132 samuelnp/centinela: score=49; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=claude code; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #133 SevFle/nexus-trade-engine: score=49; tier=none; history=none; qualification=unknown; ecosystems=skills-tools-mcp; keywords=plugin; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #134 Vani2130/mcp_ctl: score=49; tier=none; history=none; qualification=unknown; ecosystems=skills-tools-mcp; keywords=mcp; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #135 xraph/dispatch: score=49; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime; keywords=execution; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #136 yhyzgn/tikeo: score=49; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime; keywords=orchestration; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #137 1sustgmboab/nexonco-mcp: score=49; tier=none; history=none; qualification=unknown; ecosystems=skills-tools-mcp; keywords=mcp; labels=breakout:steady, ecosystem-depth:topic-backed, freshness:active-today, history:none, tier:none
- #138 congvmit/awesome-llm-token-reduction: score=49; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=aider, claude code, cursor; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #139 masuP9/codex-collab: score=48; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=claude code, codex; labels=breakout:steady, ecosystem-depth:seed-adjacent, freshness:active-today, history:none, tier:none
- #140 Unblushing-redmeat709/claude-codex-handoff: score=48; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=claude code, codex; labels=breakout:steady, ecosystem-depth:seed-adjacent, freshness:active-today, history:none, tier:none
- #141 manufosela/karajan-code: score=47; tier=none; history=emerging; qualification=unknown; ecosystems=coding-agents; keywords=aider, code review, codex; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:active-today, history:emerging, tier:none
- #142 askalf/dario: score=47; tier=none; history=emerging; qualification=unknown; ecosystems=coding-agents; keywords=aider, claude code, cursor; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:active-today, history:emerging, tier:none
- #143 TarasTsavolyk/claude-code-frontend: score=47; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=claude code, skills; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:active-today, history:none, tier:none
- #144 johanolofsson72/Claude: score=47; tier=none; history=none; qualification=unknown; ecosystems=coding-agents, skills-tools-mcp; keywords=claude code, skills; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:active-today, history:none, tier:none
- #145 Surya-Hariharan/Velune-CLI: score=47; tier=none; history=none; qualification=unknown; ecosystems=agent-runtime, skills-tools-mcp; keywords=execution, mcp; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:active-today, history:none, tier:none
- #146 yzhao062/agent-style: score=47; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=aider, claude code, codex, cursor; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:active-today, history:none, tier:none
- #147 Livin21/pitstop: score=45; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=claude code, codex; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:new-24h, history:none, tier:none
- #148 andreasvesaliusfringedpolygala893/codex-manager: score=44; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=codex; labels=breakout:steady, ecosystem-depth:seed-adjacent, freshness:active-today, history:none, tier:none
- #149 Aries-Serpent/_codex_: score=44; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=codex; labels=breakout:steady, ecosystem-depth:seed-adjacent, freshness:active-today, history:none, tier:none
- #150 Cheewye/iuri-react-codex: score=44; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=codex; labels=breakout:steady, ecosystem-depth:seed-adjacent, freshness:active-today, history:none, tier:none
- #151 Rchrdgt/codex-prompt-refinery: score=44; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=codex; labels=breakout:steady, ecosystem-depth:seed-adjacent, freshness:active-today, history:none, tier:none
- #152 Superordinate-complacence439/awesome-codex-pets: score=44; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=codex; labels=breakout:steady, ecosystem-depth:seed-adjacent, freshness:active-today, history:none, tier:none
- #153 ThukuElvis/codex-assistant: score=44; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=codex; labels=breakout:steady, ecosystem-depth:seed-adjacent, freshness:active-today, history:none, tier:none
- #154 vxctorrdrgzzz/codex-yolo: score=44; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=codex; labels=breakout:steady, ecosystem-depth:seed-adjacent, freshness:active-today, history:none, tier:none
- #155 Worldshattering-woodshed125/cline-aider: score=44; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=aider; labels=breakout:steady, ecosystem-depth:seed-adjacent, freshness:active-today, history:none, tier:none
- #156 alexherrero/crickets: score=43; tier=none; history=emerging; qualification=unknown; ecosystems=coding-agents; keywords=claude code, code review; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:active-today, history:emerging, tier:none
- #157 ymeiri/engram: score=43; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=claude code, codex, cursor; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:active-today, history:none, tier:none
- #158 Jason-Vaughan/TangleClaw: score=43; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=aider, claude code, codex; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:active-today, history:none, tier:none
- #159 logly/mureo: score=43; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=claude code, codex, cursor; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:active-today, history:none, tier:none
- #160 gossipcat-ai/gossipcat-ai: score=43; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=claude code, code review, cursor; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:active-today, history:none, tier:none
- #161 whut09/Repo-to-Agent-Context: score=43; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=claude code, codex, cursor; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:active-today, history:none, tier:none
- #162 HarikaMhae/claude-terminal-panel: score=39; tier=none; history=none; qualification=unknown; ecosystems=coding-agents; keywords=claude code, codex; labels=breakout:steady, ecosystem-depth:keyword-backed, freshness:active-today, history:none, tier:none

## 质量快照

- watchlist 命中: 88
- 低置信度项目: 15
- 中等置信度项目: 395
- 缺少描述: 1
- 缺少结构化指标: 2
- 可疑增长项目: 0
- 单一信号源项目: 405
- 单日出现项目: 358
- emerging 项目: 27
- persistent 项目: 54

## 诊断信息

- anomaly_share: 0.0296
- uniform_star_velocity_detected: false
- metrics_source_distribution: api=410, html=29, cache=0, embedded=0, unavailable=0
- star_delta_source_distribution: live=0, snapshot=0, signal=131, unavailable=308
- github_star_delta: live_attempts=20, live_success=0, snapshot_success=0, token_missing=20, auth_invalid=0, rate_limit=0, network_blocked=0

## Top 项目

- [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) | 分数 100 | 置信度 high | 范式 agent runtime + persistent memory + tool/skill ecosystem
  - 排名裁决: base_final_rank=105 | final_rank=105 | qualification=strong-watch | judge_delta=0
  - 入选原因: paradigm=agent runtime + persistent memory + tool/skill ecosystem | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=1550) | engagement_score=100 (forks=33518) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无
- [openclaw/openclaw](https://github.com/openclaw/openclaw) | 分数 98.5 | 置信度 high | 范式 agent runtime + persistent memory + tool/skill ecosystem
  - 排名裁决: base_final_rank=101 | final_rank=101 | qualification=strong-watch | judge_delta=0
  - 入选原因: paradigm=agent runtime + persistent memory + tool/skill ecosystem | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=298) | engagement_score=100 (forks=79200) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无
- [obra/superpowers](https://github.com/obra/superpowers) | 分数 86 | 置信度 high | 范式 agent system
  - 排名裁决: base_final_rank=88.5 | final_rank=88.5 | qualification=strong-watch | judge_delta=0
  - 入选原因: paradigm=agent system | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=1792) | engagement_score=100 (forks=20177) | architecture_shift=75 (baseline=default_agent_capability)
  - 风险: 无
- [anomalyco/opencode](https://github.com/anomalyco/opencode) | 分数 80.5 | 置信度 high | 范式 agent infra
  - 排名裁决: base_final_rank=80.5 | final_rank=80.5 | qualification=strong-watch | judge_delta=0
  - 入选原因: paradigm=agent infra | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=105) | engagement_score=100 (forks=21014) | architecture_shift=85 (baseline=default_agent_capability)
  - 风险: 无
- [anthropics/claude-code](https://github.com/anthropics/claude-code) | 分数 100 | 置信度 high | 范式 agent runtime + persistent memory
  - 排名裁决: base_final_rank=105 | final_rank=105 | qualification=keep-observing | judge_delta=0
  - 入选原因: paradigm=agent runtime + persistent memory | confidence=high | persistence=persistent | star_velocity=100 (daily_delta=242) | engagement_score=100 (forks=21400) | architecture_shift=100 (baseline=default_agent_capability)
  - 风险: 无

## 风险提示

- 低置信度项目占比为 15/439
- 仍有 405 个项目只有单一信号源，需要跨源或跨天确认
- 有 1 个项目缺少描述，语义判断会受限

## 下一步重点

- 为低置信度项目补足描述或结构化 repo 指标
- 在提升弱信号前，先确认跨天 persistence 或第二信号源

## 建议动作

- 在信任低置信度排序前，优先补有缺失描述或缺失 metrics 的项目
- 当前 GitHub live star delta 仍因 token 缺失被跳过，补上 `GITHUB_TOKEN` 后再验证 live / snapshot 优先级
- 当前未设置 `GITHUB_TOKEN`；网络恢复后建议补上 token，减少 GitHub API 403/限流风险
- 当前仍有项目依赖 GitHub HTML fallback，提升优先级恢复 API 指标来源
- 单源项目先等第二信号源或第二天 persistence，再考虑升级判断
- 可以把这次运行当作稳定基线，继续推进更强的 GitHub enrichment 或 weekly 汇总
