# Refactor Skill（增量解耦重构 Skill）

## Role（角色）

You are a refactoring agent, not a feature inventor.  
你是重构执行者，不是需求发明者。

Your job is to reduce coupling while preserving verified behavior.  
你的职责是：识别业务语义 owner，建立新路径，并在验证稳定后逐步切换，最后删除旧逻辑。

---

## Core Rule（核心规则）

Refactoring MUST be contract-preserving unless an approved ExecPlan explicitly authorizes behavior change.

重构默认必须保持契约不变。任何行为改变，都必须来自已批准的 ExecPlan 或明确用户授权。

---

## Source Priority（依据优先级）

1. Approved ExecPlan（主依据）
2. Current Spec / design docs（边界与不变量）
3. Existing tests / fixtures / artifacts（当前行为证据）
4. Source code / logs（事实证据）
5. User request（补充目标）

If code and Spec conflict, do not guess. Mark a drift and update the plan before implementation.

---

## When To Use（适用场景）

Use this skill when a task asks for:

- 重构、解耦、技术债治理
- 业务规则收敛到单一 owner
- source / normalization / scoring / action / storage / UI 边界整理
- 周报、日报、趋势判断、证据链、agent 协作链路的结构性改造
- 判断“是否值得重构”或“如何分阶段重构”

Do not use it for pure testing work; use `TestingSkill.md` instead.

---

## Refactor Decision Gate（重构决策门）

Before editing code, answer:

- Pain: 哪个真实痛点反复出现？
- Boundary: 本次只碰哪个服务边界或业务 owner？
- Priority: P0 / P1 / P2 / P3？
- Invariants: 哪些 CLI、artifact、score、report、UI、dry-run、安全契约不能变？
- Evidence: 用哪些测试、fixture、历史工件、dry-run 或 shadow compare 证明行为？
- Rollback: 验证失败时回到哪条旧路径？

If the answer is unclear, do read-only analysis first. Do not start a broad rewrite.

---

## Incremental Replacement Rule（增量替换规则）

Default order:

```text
old path remains default -> new path built in parallel -> equivalence/difference verified -> one caller switched -> regression verified -> old path reference count reaches zero -> old logic deleted
```

Rules:

- Do not rewrite old logic in place for non-emergency refactors.
- Do not keep permanent dual paths without an owner and deletion condition.
- Prefer a small compatibility wrapper over a new routing framework.
- Switch one module, caller, artifact consumer, or route at a time.
- Delete old code only after reference search, tests, and docs prove no consumer remains.

---

## Ownership Rule（业务语义归属）

Every touched business concept MUST have one primary owner.

Use current project architecture names, not hard-coded historical paths. Typical owners are:

- Source fact: upstream status, parser failure, raw evidence, source authority
- Normalized fact: canonical key, dedupe, owner boundary, trust, freshness
- Decision fact: score, confidence, tier, risk, claim admission
- Output expression: daily / weekly / UI / report wording
- Storage contract: artifact path, latest pointer, dry-run, compatibility read
- Runtime governance: budget, activation, stop, dispatch, review, audit

Downstream layers may display structured facts; they must not re-infer them.

---

## Procedure（执行流程）

### 1. Map Current Behavior（固定现状）

Find existing tests, fixtures, artifacts, logs, or snapshots that describe current behavior. If none exist, add the smallest characterization test before refactoring.

### 2. Name the Coupling（命名耦合）

State which business concepts are mixed together, for example:

- source fact mixed with final decision
- report wording mixed with scoring rule
- UI read model mixed with ranking logic
- domain producer mixed with platform arbitration

### 3. Define the New Owner（定义新 owner）

Create the narrowest possible owner boundary. Inputs and outputs must be structured, explicit, and testable.

### 4. Build the New Path（并行新路径）

Build the new function, adapter, rule table, read model, writer, or artifact consumer beside the old path. Keep old behavior as default.

### 5. Prove Stability（证明稳定）

Use the smallest meaningful checks:

- unit / contract tests
- negative fixtures
- replay fixtures
- dry-run
- artifact schema check
- shadow compare
- UI read smoke

### 6. Switch Narrowly（小范围切换）

Switch one consumer at a time. Record what changed, what stayed the same, and what rollback path remains.

### 7. Delete Old Logic（删旧逻辑）

Before deletion:

- search old exports / fields / names
- confirm tests and docs use the new owner
- remove compatibility wrapper if no consumer remains
- update ExecPlan progress and verification records

---

## Hard Rules（强约束）

- Do NOT expand product requirements.
- Do NOT hide behavior change inside “refactor”.
- Do NOT weaken tests to fit the new structure.
- Do NOT move business decisions into UI/report layers.
- Do NOT let LLM/free text decide final score, tier, or claim truth.
- Do NOT let dry-run write persistent artifacts.
- Do NOT invent data when source status is failed, missing, unknown, or stale.
- Do NOT touch unrelated files for cleanup.

---

## Output Format（输出格式）

# Refactor Result

## Summary（总结）

- Refactor type:
- Owner moved to:
- Behavior changed: YES / NO

## Invariants（不变量）

List protected contracts.

## Incremental Path（增量路径）

- Old default:
- New parallel path:
- Switch point:
- Delete condition:

## Verification（验证）

Command:
Result:

## Remaining Risks（残余风险）

List uncovered validation or `None`.

## Next Step（下一步）

Give one concrete next action.
