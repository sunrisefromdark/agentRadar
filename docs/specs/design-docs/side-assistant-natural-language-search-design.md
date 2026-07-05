# 设计文档：侧边助手自然语言搜索

## 文档状态

- 版本：`v0.3`
- 状态：`Approved for ExecPlan`
- 设计输入：
  - [侧边助手自然语言搜索需求分析.md](../product-specs/侧边助手自然语言搜索需求分析.md#L1)
  - [自然语言模糊搜索与推荐需求分析.md](../product-specs/自然语言模糊搜索与推荐需求分析.md#L1)
  - [natural-language-fuzzy-search-recommendation-design.md](natural-language-fuzzy-search-recommendation-design.md#L1)
  - [project-search-system-redesign-design.md](project-search-system-redesign-design.md#L1)
  - [DesignDocument_ReviewSkill.md](DesignDocument_ReviewSkill.md#L1)
- 目标：把现有自然语言 fuzzy search 从“搜索无结果时的隐式能力”包装成一个全局可发现、可连续追问、可在项目库承接结果的侧边助手入口。

## 一句话设计

把侧边助手做成 visual console 全局右侧的会话式服务抽屉：助手负责承接自然语言、多轮上下文和最多 3 个项目链接预览；项目检索仍走现有 `/api/projects/fuzzy-search`，完整结果统一落到 `Projects` 视图承接，`Projects` 页内仍优先复用已有 detail dock。

## 设计 Thesis

这不是做聊天机器人，也不是重做项目搜索页，而是给现有 fuzzy search 加一个更像“导览员”的入口。

核心取舍：

1. 助手是全局入口，不是第二套项目库列表。
2. 多轮记忆是当前浏览器会话能力，不是长期画像。
3. 结果链接来自现有项目库 `project_ids`，不由 LLM 生成项目事实。
4. 在 `Projects` 页点项目链接优先打开当前页详情；在其他页点结果则跳转到 `Projects` 相应位置。
5. 抽屉交互参考华为云 `云宝助手` 的企业服务面板，而不是继续做浮在内容上的聊天气泡。
6. “查看全部结果”替换主列表，但不把完整对话写进 URL。

## 当前问题与修正结论

当前实现和目标之间有 3 个明确偏差：

1. 助手虽然已经被渲染到全局 shell，但事件绑定仍耦合在 `Projects` workbench 初始化里；`app/visualConsole/clientScript.ts` 在 `if (!(search instanceof HTMLInputElement)) return;` 处提前返回，导致其他页面“看得到入口，但点了没反应”。
2. 当前面板是浮层思路，打开后容易盖住正文和详情区，交互上像临时外挂，不像正式工作台能力。
3. 当前样式主要靠内联和局部补丁堆起来，和现有 visual console、也和你给的华为云企业服务助手参考，都不在一个审美系统里。

修正结论只保留 3 条：

1. 助手 runtime 必须从 `Projects` 页逻辑里拆出来，变成 route-agnostic 的全局控制器。
2. 结果承接面仍然只认 `Projects`，但入口要在所有一级视图都可用。
3. UI 不再沿用浮动聊天气泡，而改成华为云 `云宝助手` 那类右侧全高服务抽屉。

## 当前实现基线

本设计复用以下现有能力：

- `/api/projects/fuzzy-search` 已存在，返回 `FuzzyProjectSearchResponse.project_ids`、`explanation_cn`、`boundary_message_cn`、`clarification_options` 和 `diagnostics`。
- 前端已有 `project_ids -> project card records` 的映射逻辑，可按 fuzzy response 顺序过滤项目卡。
- 项目卡链接已有 `data-project-card-link="true"`，并能通过当前页 detail payload 打开项目详情。
- 当前客户端已使用 `sessionStorage` 保存页面级临时状态，适合承载本次会话记忆。

因此 V1 不新增搜索 endpoint、不新增后端会话表、不扩展 fuzzy response 的 preview link 字段。

## 范围

### 包含

- 所有一级视图共享的右侧侧边助手入口与面板。
- 助手入口和面板的位置拖动，位置仅在当前浏览器标签页会话内保留。
- 当前浏览器会话内的多轮搜索上下文。
- 每轮成功结果最多 3 个项目超链接。
- “查看全部结果”把主项目列表切换为该轮结果。
- 在 `Projects` 页点击项目链接时页内打开项目详情；在其他视图点击时跳转到 `Projects` 相应位置。
- 歧义、空结果、失败和敏感领域边界提示。

### 不包含

- 通用聊天问答。
- 长期用户画像、跨设备记忆、账号级同步。
- 新项目详情页。
- 第二套卡片列表、面板内分页、复杂筛选器。
- LLM 生成项目事实、项目排序或站外建议。

## 用户心智

用户应该学会一句话：

> 不管现在在哪一页，都可以在右边问一句；先看 3 条线索，想深看就进项目库对应位置，想铺开就查看全部，还能接着追问。

这个心智要求助手保持三件事稳定：

- 始终是全局自然语言搜索入口。
- 始终先给轻量预览，不抢主列表职责。
- 始终把完整结果承接到 `Projects`，并在结果跳转后继续对话。

## 视觉稿使用方式

这次生成的 5 张图不是“重做整站页面”的视觉稿，而是“侧边助手模块 + 两种联动状态”的说明图。实际实现时，只取与助手相关的那一块，不把它当成主页面全量改版稿。

使用原则：

1. 图只负责说明助手模块、结果预览和页面联动，不替代现有主页面整体结构。
2. 图 1 - 3 只看右侧助手本体，图 4 - 5 只看“助手和主区如何联动”。
3. 开发时只复用图里和助手有关的布局、层级、文案和状态，不照搬整页构图。
4. 现有主列表、顶部导航、左侧导航如果没被图明确表达，默认保持现有实现不动。

### 五张图的用途

| 图号 | 名称 | 用途 | 设计/实现时看什么 |
| --- | --- | --- | --- |
| 图 1 | 收起入口 | 定义右侧侧边助手默认挂载方式 | 右侧贴边 tab、入口文案、收起态可发现性 |
| 图 2 | 展开空态 | 定义助手展开后的基础结构 | 标题、关闭按钮、自然语言输入框、说明文案 |
| 图 3 | 结果态 | 定义助手返回轻量结果的展示方式 | 短回复、最多 3 条项目链接、`查看全部结果` |
| 图 4 | 项目详情联动 | 定义点击项目链接后的页内打开方式 | 主区详情与助手并存、详情不跳页、助手不消失 |
| 图 5 | 结果集联动 | 定义点击 `查看全部结果` 后的主区切换方式 | 主列表完全替换为 AI 结果集、助手继续保留 |

### 怎么落到开发

- 图 1 - 3 主要对应侧边助手状态机里的 `collapsed`、`open_idle`、`success_preview`。
- 图 4 主要对应“点项目进详情”这个联动，不是单独的新页面。
- 图 5 主要对应“查看全部结果”这个联动，不是再画一套新的列表页。
- 如果图里出现了主页面的辅助内容，只把它当作上下文边框，不把它当成重做目标。

## 产品表面

### 桌面端

- 助手入口固定在页面右侧，所有一级视图都可见，默认收起为窄入口。
- 展开后不是悬浮气泡，而是右侧全高服务抽屉，宽度建议 `360px - 420px`。
- 抽屉挂在 app shell 层或 body 级 assistant host，不能挂在 `.primary-content`、项目列表或 `.detail-column` 内。
- `Projects` 的项目详情 dock 仍属于主内容布局；助手作为独立侧边层存在，详情更新不得卸载助手。
- 非 `Projects` 视图里，抽屉负责“找”和“跳”；真正的结果承接统一回到 `Projects`。

### 拖动定位

拖动能力只解决一个问题：当右侧助手遮挡用户正在看的内容时，用户可以临时挪开它。

默认位置仍是右侧入口；拖动不是把助手改成聊天窗口，也不是新增第二套浮层系统。

默认展开态仍是右侧服务抽屉。用户拖动面板头部后，面板进入固定尺寸浮层形态，保持当前宽度和可见高度，不再强制贴右全高；双击拖动区域恢复默认右侧贴边抽屉。

拖动契约：

1. 拖动对象是同一个 assistant host。收起态入口和展开态面板共享同一位置。
2. 收起态只允许从圆形入口触发拖动。
3. 展开态只允许从面板头部触发拖动。
4. 输入框、发送按钮、新对话、关闭、推荐方向、项目链接和 `查看全部结果` 不得触发拖动。
5. 拖动结束后，位置必须被限制在当前视口内，不能把入口或面板拖到屏幕外。
6. 窗口尺寸变化后必须重新 clamp 当前位置，避免响应式布局后找不到助手。
7. 双击拖动区域恢复默认右侧位置。

位置存储：

- 使用 `sessionStorage`，key 与助手会话同域但字段独立。
- 位置只保存 `{ left, top }`，不保存页面路径、query、项目结果或对话内容。
- 新对话不重置位置；关闭当前浏览器标签页后位置自然消失。
- 位置不得写入 `SideAssistantSearchSession`，避免会话重置、schema 修复或结果态恢复误伤拖动位置。

移动端：

- 移动端不要求展开态面板可拖。
- 收起态入口可以保持默认位置；若实现拖动，也必须同样 clamp 到视口内。
- 不允许因为拖动导致底部输入区被系统键盘永久遮挡。

### 移动端

- 助手可退化为底部抽屉或全屏轻面板。
- 点击项目链接后，面板允许自动收起为入口，但当前对话必须保留。
- 不要求移动端同时并排显示详情和助手。

### 面板结构

固定结构：

1. 头部：标题 `AI 搜项目`、状态说明、`新对话`、收起/关闭动作。
2. 欢迎区：一句用途说明和 2 - 4 个快捷问题卡片。
3. 对话区：用户提问、助手简短回复、项目链接预览、边界提示。
4. 操作区：输入框、发送按钮。
5. 结果动作：每轮有结果时展示 `查看全部结果`。

## 视觉方向：参考华为云 `云宝助手`

这次 UI 不继续沿用“右下角浮动聊天框”，而直接借鉴你给的华为云 `云宝助手` 参考图里的 4 个成熟交互决定：

1. 右侧全高抽屉，而不是压在正文上的短浮层。
2. 白底、浅边框、弱阴影、少量品牌强调色，而不是一堆渐变和高饱和发光。
3. 顶部是明确标题和简短说明，中部是快捷问题卡片，底部是固定输入区。
4. 结果卡片是企业服务工作台语言，像“服务建议 / 常见问题 / 快捷入口”，不是聊天消息泡泡堆叠。

### 采纳项

- 抽屉背景以白色和极浅灰为主，边框轻、阴影弱，强调“企业服务台”而不是“AI 玩具”。
- 标题区使用单一主标题 `AI 搜项目`，配一句解释：只搜索站内项目库，不生成项目事实。
- 快捷问题区默认给出 2 - 4 个高频方向卡：如 `浏览器智能体`、`投研 Agent`、`客服自动化`、`Agent IDE`。
- 底部输入区固定吸底，包含输入框、发送按钮、可选字数计数/提示语。
- CTA 强调色收敛为少量品牌色点缀；正常状态更多依赖排版、留白、边框，而不是大面积彩色。

### 不采纳项

- 不复制华为云首页营销内容、吉祥物或品牌素材。
- 不把整个 visual console 改成华为云官网首页。
- 不做多宫格知识问答门户；当前仍然只服务“搜项目”这一个任务。

命名冻结：

- 入口标签、面板标题、结果态状态条统一使用 `AI 搜项目` 作为主名称。
- `找项目助手` 只作为历史讨论中的别名，不作为 UI 正式文案。
- `AI 助手结果` 只用于主列表切换后的状态条，不作为面板标题。

默认输入提示：

```text
描述你想找的项目，例如：金融投研 Agent、客服工单自动化、开源 Browser Agent
```

### 普通搜索框剥离规则

- 主项目搜索框只执行现有关键词过滤，不再触发 `/api/projects/fuzzy-search`。
- 自然语言 fuzzy search、zero-result LLM routing、多轮上下文和结果预览全部只从 `AI 搜项目` 助手入口触发。
- 如果普通搜索框无结果，只显示普通无结果状态和打开 `AI 搜项目` 的引导，不自动调用 fuzzy endpoint。
- 旧的“普通搜索无结果后隐式进入 fuzzy search”路径必须移除或禁用，避免两个自然语言入口并存。

## 会话记忆设计

### 存储选择

V1 使用 `sessionStorage`，不使用 `localStorage`。

原因：

- 刷新页面不丢。
- 关闭再打开助手不丢。
- 浏览器标签页会话结束后自然消失。
- 不产生长期隐式记忆。

### 存储契约

```ts
interface SideAssistantSearchSession {
  schema_version: "side_assistant_search_session.v1";
  conversation_id: string;
  created_at: string;
  updated_at: string;
  panel_state: "collapsed" | "open";
  messages: SideAssistantMessage[];
  search_context: SideAssistantSearchContext | null;
  active_main_result: SideAssistantMainResult | null;
}

interface SideAssistantMessage {
  id: string;
  role: "user" | "assistant";
  text_cn: string;
  created_at: string;
  related_turn_id?: string;
}

interface SideAssistantSearchContext {
  last_user_query: string;
  last_composed_query: string;
  last_project_ids: string[];
  last_preview_project_ids: string[];
  seen_project_ids: string[];
  last_response_source: FuzzyProjectSearchResponse["source"];
  last_boundary_message_cn?: string;
  recent_user_turns: string[];
}

interface SideAssistantResultScope {
  date: string;
  lang: "zh" | "en";
  filters: {
    paradigm?: string;
    persistence?: string;
  };
  sort: "score" | "growth";
  path: string;
}

interface SideAssistantMainResult {
  source_turn_id: string;
  scope_key: string;
  scope: SideAssistantResultScope;
  display_query: string;
  project_ids: string[];
  applied_at: string;
}

interface SideAssistantPlacementState {
  schema_version: "side_assistant_placement.v1";
  left: number;
  top: number;
}
```

字段语义：

- `messages` 只用于还原当前面板显示。
- `search_context` 只用于下一轮 query composition。
- `active_main_result` 只用于刷新后恢复“助手结果态”主列表。
- `project_ids` 只引用现有项目库项目，不保存项目事实副本。
- `seen_project_ids` 记录本会话已经预览给用户的项目，用来避免“再给我几个”重复上一轮 3 条链接。
- `scope_key` 由 `date + lang + filters + sort + path` 稳定生成；只有当前页面作用域一致时，才允许恢复 `active_main_result`。
- `SideAssistantPlacementState` 独立保存助手 host 的当前视口位置，不参与搜索、排序、结果恢复或多轮上下文。

### 新对话

点击 `新对话` 必须：

- 清空 `messages`、`search_context`、`active_main_result`。
- abort 当前未完成请求。
- 将主列表从助手结果态恢复为默认项目库态。

## 多轮查询机制

V1 不新增后端 conversation API。前端把上一轮上下文压缩进本轮 `raw_query`，继续调用现有 `/api/projects/fuzzy-search`。

### 追问分类

提交前先把当前输入归为 4 类：

| followup_mode | 触发表达 | 查询策略 | 结果策略 |
| --- | --- | --- | --- |
| `new_search` | 无上下文，或用户输入完整新主题 | `composed_query = current_user_query` | 清空上一轮 `seen_project_ids` 后展示预览 |
| `refine` | “更偏开源一点”“不要太商业化”“只看金融投研” | `composed_query = last_composed_query + "；" + current_user_query` | 优先展示未在本会话预览过的项目 |
| `more` | “再给我几个”“还有吗”“继续” | `composed_query = last_composed_query` | 必须从预览候选中排除 `seen_project_ids` |
| `switch` | “换成量化方向”“改成客服工单” | `composed_query = current_user_query`，必要时保留上一轮大主题词 | 清空上一轮 `seen_project_ids` 后展示新方向预览 |

基础组成规则：

```text
如果没有 search_context：
  composed_query = current_user_query

如果已有 search_context：
  composed_query = last_composed_query + "；" + current_user_query
```

`more` 是硬约束例外：它不追加“再给我几个”到查询里，而是复用上一轮 `last_composed_query`，并在前端结果投影时排除已经展示过的项目。

显示规则：

- 面板里展示用户原始输入，不展示冗长 `composed_query`。
- 发送给 fuzzy endpoint 的是 `composed_query`。
- `recent_user_turns` 最多保留最近 5 条用户输入，防止 sessionStorage 失控。
- 每次渲染成功预览后，把本轮 `preview_project_ids` 合并进 `seen_project_ids`。

如果 `more` 过滤后没有新的可预览项目，助手必须说明“这轮没有更多未展示项目”，并保留 `查看全部结果`，不得重复上一轮 3 条链接伪装成新推荐。

这条规则刻意简单。它覆盖“再给我几个”“更偏开源一点”“换成量化方向”等 V1 场景；如果后续证明串联查询噪声太高，再新增服务端 conversation summarizer。

## 搜索 API 使用

### 请求

继续调用：

```http
POST /api/projects/fuzzy-search
```

请求体沿用现有字段：

```ts
{
  raw_query: composed_query,
  date,
  lang,
  filters,
  sort,
  page_context
}
```

V1 不新增 `conversation_context` 字段。实现阶段不得为了预览链接扩展后端 response。

### 响应消费

助手只消费现有字段：

- `project_ids`
- `explanation_cn`
- `boundary_message_cn`
- `clarification_options`
- `source`
- `result_mode`
- `diagnostics`

助手不得消费 LLM 原始输出，也不得展示 LLM 生成的项目事实。

## 结果预览设计

### 成功态

当 `project_ids.length > 0`：

1. 展示一段简短助手回复。
2. 从 `project_ids` 按顺序取能映射到现有项目记录的前 3 个。
3. 渲染为项目超链接列表。
4. 展示 `查看全部结果`。

预览链接内容：

- 项目名。
- 可选一句短理由，优先来自现有项目简介或 fuzzy `explanation_cn` 的压缩，不新增 LLM 项目描述。

### 链接来源

链接必须来自现有项目卡或现有项目详情路由能力：

- 优先复用现有 project card href。
- href 必须能触发当前页 detail dock 更新。
- 不允许构造跳到无助手独立页面的链接作为默认行为。

如果某个 `project_id` 映射不到现有项目记录，跳过该预览项，不补造项目。

### 查看全部结果

点击 `查看全部结果`：

- 主项目列表完全切换为该轮 `project_ids` 顺序。
- 页面显示 `AI 助手结果` 状态条。
- 状态条展示本轮用户可见 query。
- 状态条提供 `返回普通项目库`。
- `active_main_result` 写入 `sessionStorage`，刷新后恢复。
- 恢复前必须校验 `scope_key`；若当前 `date/lang/filters/sort/path` 与保存值不一致，清空 `active_main_result`，不恢复旧助手结果态。

### 返回普通项目库

点击 `返回普通项目库`：

- 仅清除 `active_main_result` 与页面上的 `AI 助手结果` 状态条。
- 保留当前会话的 `messages` 和 `search_context`，允许用户继续追问。
- 主列表恢复为默认项目库态，不再使用助手结果集覆盖列表。
- 刷新页面后也必须停留在默认项目库态，直到用户再次点击 `查看全部结果`。

## 结果点击行为

### 当前就在 `Projects` 页

点击助手中的项目链接必须优先走当前页详情路径：

```text
assistant link click on projects
  -> resolve existing project href
  -> apply current projects detail update
  -> update URL project query if existing detail flow already does so
  -> keep assistant host mounted
  -> keep conversation in sessionStorage
```

### 当前不在 `Projects` 页

点击助手中的项目链接必须跳转到 `Projects` 对应位置，而不是在当前页无意义地尝试打开详情：

```text
assistant link click on non-project routes
  -> resolve target project href in projects route
  -> preserve current date/lang/theme and minimal route context
  -> navigate to projects URL
  -> restore assistant conversation from sessionStorage
  -> open target project detail in projects view
```

硬约束：

- 不做独立详情页。
- 不把助手渲染在会被 detail replacement 替换的 DOM 内。
- 若本地 detail snapshot 缺失，允许 fallback 到正常 route fetch；fetch 后助手必须由 `sessionStorage` 恢复。
- URL 可以更新当前项目详情参数，但不得写入完整对话或 thread id。

## URL 与历史记录

V1 URL 只承载现有路由语义：

- `project`
- `date`
- `theme`
- 现有详情 flow 已使用的参数

禁止新增：

- 完整 conversation。
- `conversation_id`。
- 完整 `project_ids` 列表。
- 长自然语言上下文。

原因：这些状态属于当前会话，不应泄漏到分享链接、浏览器历史或服务端日志。

## 状态机

```text
collapsed
  -> open_idle
  -> submitting
  -> success_preview
  -> clarification
  -> empty_or_hot_fallback
  -> error
```

状态语义：

| 状态 | 用户可见行为 |
| --- | --- |
| `open_idle` | 显示输入框和历史对话 |
| `submitting` | 显示正在找项目，禁用重复提交 |
| `success_preview` | 显示说明、最多 3 个链接、查看全部结果 |
| `clarification` | 显示 2-3 个可点击改写选项 |
| `empty_or_hot_fallback` | 显示无结果解释或热门回退链接 |
| `error` | 显示重试入口，不清空当前对话 |

## 失败与降级

| 失败点 | 降级策略 |
| --- | --- |
| endpoint 失败 | 保留用户输入，显示重试，不清空上下文 |
| LLM failed fallback | 展示服务返回的热门/降级说明 |
| `needs_clarification` | 展示 `clarification_options`，点击后作为新用户输入提交 |
| `project_ids` 为空 | 不展示空链接列表，给出改写建议或热门回退 |
| `project_id` 映射不到本地项目 | 跳过该链接，不补造 |
| sessionStorage 不可用 | 本轮对话仍可用，刷新不保证保留，并显示非阻塞提示 |
| placement 超出视口 | 自动 clamp 回可见区域 |
| 拖动中发生 route 切换 | 结束拖动并保留最后一个可见位置 |

敏感领域：

- 若 `boundary_message_cn` 存在，每轮都必须在助手回复中展示。
- 文案必须说明“仅按站内 AI Agent 项目检索，不提供真实专业建议”。

## 实现边界

建议改动集中在：

- `app/visualConsole/clientScript.ts`：把助手 runtime 从 `Projects` workbench 初始化里拆出来，变成全局状态、sessionStorage、请求、预览链接、主列表切换、详情/跳转分流控制器。
- `app/visualConsole/ossPages.ts` 或 shell renderer：assistant host 容器与全局挂载位置。
- `app/visualConsole/ossProjectsPage.ts`：只保留 `Projects` 结果承接和 detail dock 适配，不再拥有助手生命周期。
- 样式文件：右侧全高抽屉、快捷问题卡片、底部输入区、状态条、拖动中的 cursor 和 user-select 状态。

拖动实现约束：

- 复用现有 assistant host，不新增 portal、overlay manager 或第三方拖拽库。
- 使用 Pointer Events，不用 mouse/touch 两套分支。
- 拖动开始时记录 pointer 与 host 左上角偏移；移动时只更新 host 的 `left/top`。
- 第一次拖动后，host 从默认 right/bottom 定位切换为 left/top 定位。
- 拖动逻辑必须先判断最近的可交互控件，避免点击按钮或链接时误触拖动。

不建议改动：

- `src/search/fuzzyQueryTypes.ts`
- `app/server.ts` 的 fuzzy endpoint contract
- LLM prompt schema
- 项目详情数据结构

只有当客户端 query composition 无法满足多轮追问时，才进入 V2 后端会话设计。

## 可测试性

### 单元 / DOM 测试

- `sessionStorage` 能保存并恢复 `messages`、`search_context`、`active_main_result`。
- 拖动助手入口或面板头部后，刷新当前标签页仍能恢复位置；关闭标签页后不要求保留。
- 拖动位置不能超出视口；缩放或调整窗口后助手仍可见。
- 点击输入框、按钮、项目链接、`查看全部结果` 时不得误触拖动。
- `新对话` 会清空会话并恢复默认项目库态。
- `返回普通项目库` 只清除结果态，不清空当前会话对话内容。
- `project_ids` 只映射现有项目记录，映射不到时不生成假链接。
- 最近用户轮次最多保留 5 条。
- `more` 模式不会重复展示 `seen_project_ids` 中的项目。
- `active_main_result.scope_key` 与当前页面作用域不一致时不会恢复旧结果。

### 集成测试

- 在 `AI 搜项目` 中输入自然语言后调用 `/api/projects/fuzzy-search`，成功后展示最多 3 个链接。
- `Overview / Weekly / Observer / KB / Run Health` 中点击 `AI 搜项目` 入口都能展开抽屉，不再出现“只有项目库页有反应”。
- 第二轮输入“更偏开源一点”时，请求体 `raw_query` 包含上一轮上下文和当前输入。
- 第二轮输入“再给我几个”时，不重复上一轮 3 条预览链接。
- 在 `Projects` 页点击项目链接后当前页打开详情，助手仍可见，对话仍存在。
- 在非 `Projects` 页点击项目链接后跳转到 `Projects` 对应位置，并恢复当前会话。
- 点击 `查看全部结果` 后主列表完全切换为该轮结果，并显示 `AI 助手结果` 状态条。
- 存在有效 `active_main_result` 时，刷新页面后助手会话和主列表助手结果态恢复。
- 切换日期、筛选或排序后，旧 `AI 助手结果` 不会被错误恢复。
- 点击 `返回普通项目库` 后主列表恢复默认状态。

### 回归测试

- 普通搜索框仍按原关键词搜索工作。
- 普通搜索框无结果时不调用 `/api/projects/fuzzy-search`，只展示普通无结果状态和 `AI 搜项目` 引导。
- 现有 `/api/projects/fuzzy-search` response schema 不变。
- 现有项目详情 link / dock 行为不被破坏。
- 敏感领域查询仍显示边界提示。

## 实施就绪判断

本设计已冻结：

- 侧边助手是自然语言搜索入口，不是通用聊天产品。
- V1 记忆使用 `sessionStorage`。
- 多轮追问通过客户端 query composition 复用现有 fuzzy endpoint。
- “再给我几个”必须排除本会话已预览项目，不允许重复上一轮链接冒充新结果。
- 预览链接由 `project_ids` 映射现有项目记录得到。
- 助手入口在所有一级视图都可用，不能再绑死在 `Projects` workbench 初始化上。
- 在 `Projects` 页点击链接优先页内开详情；在其他页点击链接则跳到 `Projects` 相应位置。
- “查看全部结果”完全切换主列表，并用 sessionStorage 保存当前助手结果态。
- 助手结果态恢复必须匹配 `date/lang/filters/sort/path` 作用域。
- URL 不保存对话、thread id 或完整结果列表。
- 不新增后端 endpoint、不新增数据库表、不扩展 fuzzy response。
- 原普通搜索框不再触发 fuzzy endpoint；自然语言搜索只从 `AI 搜项目` 进入。
- 视觉方向改为华为云 `云宝助手` 风格的企业服务抽屉，而不是浮动聊天泡泡。

因此下一阶段可以直接进入 ExecPlan；如果 review 要求更强的多轮语义，再单独补 V2 conversation summarizer 设计。
