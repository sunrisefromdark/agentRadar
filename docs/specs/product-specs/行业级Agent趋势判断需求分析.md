# 行业级 Agent 趋势判断需求分析

## 文档状态
- 状态：`Frozen for Design`
- 需求级别：`S3 - Large Feature / System Change`
- 分析方法：依据 [需求分析_skill.md](需求分析_skill.md)
- 本文目标：冻结“行业级 Agent 趋势判断”的产品需求边界，让 weekly 趋势从“少量 GitHub 高分项目聚类”升级为“面向整个 AI Agent 行业的多源、可审计、可解释趋势判断”。

## Requirement Size
`S3 - Large Feature / System Change`

判定原因：
- 这不是周报文案优化或权重调参，而是改变趋势判断的证据边界、对象模型和判断标准。
- 该需求跨越信息搜寻、证据归一、趋势候选生成、趋势审计、weekly 输出和多 Agent 协作。
- 该需求要求系统从 repo-centric 视角扩展到行业 intelligence 视角，覆盖研究、产品、社区、资本、政策、机构与开发者生态。

## 1. Background

### 需求来源
- 用户明确反馈：当前周趋势判断覆盖面很小，结果反复集中在 `tool-use`、`memory`、`ai-skills`、`agent-runtime` 等少数方向。
- 用户认为当前趋势判断过度依赖“几个高分项目”，导致每个核心趋势只有两三个关联项目作为证据，无法代表整个 AI Agent 行业的发展方向。
- 用户希望系统判断的是“当前整个 AI Agent 行业的发展趋势”，而不是 GitHub 热榜项目的局部聚类。
- 用户提出趋势判断应覆盖前沿大厂、研究所、顶会、知名开发者和工作室、技术社区、极客讨论、金融机构资金流、政策审批和支持、相关新闻或宣传倾斜、政策研究机构与高水平研究者关注方向。
- 用户希望尽量借助已有开源工具和外部信息搜寻 Agent，例如正在接入的 AgentReach，而不是完全自研爬虫。

### 业务背景
- 当前 AgentRadar 已具备可解释趋势雷达、daily/weekly 产物、项目库和观察视图，核心优势是证据链、评分拆解和可复核。
- 当前项目搜寻体系和外部补证信号层已经开始扩展覆盖范围，但 weekly 趋势判断仍主要从项目级信号出发，天然容易把“项目热度”误当成“行业趋势”。
- 行业趋势往往先表现为研究议题升温、头部厂商发布、开发者社区讨论、资本流入、监管或政策支持、顶会 workshop 密集出现，再逐渐落到项目和产品。
- 如果系统继续只把 repo、star、少量标签和高分项目作为主证据，weekly 会持续偏窄，难以及时发现 Agent 真实落地方向。

### 用户动机
- 用户希望 weekly 能回答“Agent 行业真正正在往哪里走”，而不是“哪些 GitHub 项目本周分数高”。
- 用户希望看到趋势背后的行业证据，例如谁在研究、谁在投钱、谁在发布、谁在讨论、政策是否支持、顶会和研究机构是否形成共识。
- 用户希望趋势判断既能发现前沿方向，也能解释该方向为何可能成为落地点，而不是只给出抽象标签。
- 用户希望系统能低成本、省时省力地对接成熟信息搜寻工具和其他 Agent，形成可持续扩展的信息网络。

## 2. Goals

### 产品目标
- 将 weekly 趋势判断的基准从“高分项目聚合”升级为“AI Agent 行业多源证据综合判断”。
- 建立行业级趋势证据模型，使 repo、论文、会议、产品发布、社区讨论、资本流向、政策信号和机构研究都能作为可审计证据参与趋势判断。
- 支持与 AgentReach 及类似信息搜寻工具 / Agent 对接，形成低成本、多渠道、可替换的信息搜寻能力。
- 支持多 Agent 分工完成行业情报搜寻、证据归一、趋势聚类、反证审计和 weekly 综合判断。
- 保持现有可解释性和可降级能力，避免系统变成不可复核的黑盒行业评论。

### 用户价值
- 用户能看到更完整的 Agent 行业趋势图谱，而不是少数通用 infra 方向的重复出现。
- 用户能判断某个趋势是否真的具备行业前沿性、资金与组织投入、研究共识、政策空间和落地可能。
- 用户能追溯每条趋势的多源证据，知道结论来自项目热度、研究动向、社区讨论、资本流动还是政策/机构信号。
- 用户能更早发现“还没有在 GitHub 爆发，但已经被大厂、研究者、开发者社区或资本市场注意到”的方向。

## 3. Users & Scenarios

### 用户角色
- 行业趋势研究用户：希望判断 AI Agent 生态的真实发展方向和未来落地点。
- 产品 / 投资 / 战略分析用户：希望理解哪些方向正在获得组织、资本和政策资源。
- 技术扫描型用户：希望追踪大厂、研究所、顶会、知名开发者和技术社区正在推动什么。
- AgentRadar 维护者：希望通过可对接的信息搜寻 Agent 扩展数据来源，而不是维护大量脆弱爬虫。
- 周趋势消费用户：希望 weekly 不只是项目周报，而是可信的行业趋势摘要。

### 使用场景

#### 场景 1：用户阅读 weekly 判断本周 Agent 行业方向
- 触发：用户打开 weekly，想知道本周 Agent 行业真正形成了哪些趋势。
- 目标：用户看到跨来源证据支撑的趋势，而不是几个高分项目组成的窄标签。

#### 场景 2：某个方向 GitHub 项目不多，但研究和大厂信号正在增强
- 触发：顶会论文、研究机构报告、头部厂商发布或知名开发者讨论集中指向同一方向。
- 目标：系统能将其识别为行业观察趋势，而不是因为缺少高分 repo 而完全忽略。

#### 场景 3：某个方向项目很多，但缺乏行业外部确认
- 触发：GitHub 上出现多个相似项目，但没有研究、产品、社区、资本或政策层面的独立证据。
- 目标：系统能将其降级为项目热度或局部社区波动，而不是直接称为行业趋势。

#### 场景 4：用户想核对趋势为何成立
- 触发：用户看到一条 weekly 核心趋势，想知道它的证据结构。
- 目标：用户能看到该趋势在大厂/研究/社区/资本/政策/项目等维度的证据分布和缺口。

#### 场景 5：信息搜寻工具或某个 Agent 不可用
- 触发：AgentReach 或某个外部工具限流、失败、结果为空。
- 目标：系统能标注该证据轴缺失并降级输出，而不是伪造完整行业判断。

### 触发条件
- weekly 趋势生成开始时。
- daily 发现某方向出现异常上升，需要进入周级行业观察池时。
- 外部信息搜寻 Agent 发现大厂发布、论文、政策、融资或社区讨论集中出现时。
- 用户或维护者新增一个行业观察方向、机构名单、会议名单或信息源集合时。

### 关键用户路径
1. 系统从项目源、研究源、社区源、产品发布源、资本源、政策源和机构研究源收集证据。
2. 不同信息搜寻 Agent 将证据标准化为可审计行业信号。
3. 系统按方向聚合证据，形成趋势候选、反证和证据缺口。
4. weekly 趋势判断 Agent 综合多源证据，区分核心趋势、观察趋势、局部项目热度和证据不足方向。
5. 用户在 weekly 中看到趋势结论、证据矩阵、反证说明、下周观察点和来源可追溯信息。

## 4. Requirement Definition

### 需求 1：weekly 趋势判断必须从项目级热度扩展为行业级多源判断
- What：系统必须把 weekly 趋势判断对象从“高分 GitHub 项目聚合”扩展为“行业方向假设”，并允许多类非 repo 证据参与判断。
- Why：AI Agent 行业趋势不一定先表现为 GitHub 高分项目，可能先出现在研究、产品、政策、资本或社区讨论中。
- Who：行业趋势研究用户、周趋势消费用户。
- When：生成 weekly 核心趋势、观察趋势和趋势审计时。
- Expected outcome：用户看到的 weekly 趋势不再反复局限于少数项目标签，而能反映更完整的行业前沿。

### 需求 2：系统必须建立行业趋势证据轴
- What：每条趋势候选必须按证据轴表达支撑情况，V1 必须完整覆盖项目/开源、研究/论文、顶会/学术活动、大厂/产品发布、知名开发者/工作室、技术社区/极客讨论、资本/金融、政策/监管、政策研究/智库与媒体宣传信号，不得在设计或实现阶段收缩为最小集合。
- Why：用户明确要求综合判断“谁在研究、谁在讨论、谁在投钱、政策是否支持、媒体与机构是否倾斜”。
- Who：趋势研究用户、产品/投资/战略分析用户。
- When：趋势候选进入 weekly 判断或审计时。
- Expected outcome：用户能看到每条趋势在完整行业证据轴上哪些维度强、哪些维度弱、哪些维度缺失，而不是只看到项目列表或被裁剪过的证据子集。

### 需求 3：系统必须支持非 repo 行业信号进入趋势判断
- What：系统必须允许论文、会议议程、产品公告、博客、社区帖子、融资事件、财报/公告、政策文件、智库报告、新闻报道等对象以正式证据身份进入行业趋势判断。
- Why：当前 `repo_url` 中心模型会排斥大量真正能反映行业方向的证据。
- Who：所有 weekly 用户。
- When：外部信息搜寻 Agent 提供非 GitHub 证据时。
- Expected outcome：非 repo 证据不再被强行附着到某个项目上，也不会因无法映射 repo 而丢失。

### 需求 4：趋势成立标准必须从“几个高分项目”改为“跨来源独立证据”
- What：核心趋势不得仅因为存在两三个高分项目而成立；必须至少具备跨来源独立证据，或明确标注其仍属于项目热度/观察趋势。
- Why：少量项目可能代表局部波动，不足以说明行业正在转向。
- Who：weekly 用户、研究与决策型用户。
- When：系统判断核心趋势、观察趋势和降级趋势时。
- Expected outcome：用户能区分“行业趋势”“项目热度”“早期观察”“证据不足”四种语义。

### 需求 5：系统必须覆盖前沿主体和权威主体的动向
- What：系统必须正式跟踪前沿大厂、研究所、顶会、知名开发者、知名工作室、技术社区、政策研究机构和高水平研究者的公开信号。
- Why：这些主体对 Agent 行业方向具有更高前瞻性和信号权重。
- Who：行业趋势研究用户、技术扫描型用户。
- When：daily 搜寻、weekly 汇总和趋势审计时。
- Expected outcome：weekly 能说明某趋势是否被头部主体推动或关注，而不是只看普通项目热度。

### 需求 6：系统必须引入资本与政策维度，但不能把其等同于技术成熟度
- What：系统必须记录资金流向、融资事件、财报、SEC 披露、基金报告、并购、上市公司公告、产业报告、政策审批、政策支持、监管动向、官方宣传或媒体倾斜等信号，并将其作为趋势判断证据轴之一。
- Why：用户明确认为资本、人力物力支持、政策审批和宣传倾斜能反映 Agent 落地点。
- Who：产品 / 投资 / 战略分析用户、行业趋势研究用户。
- When：趋势方向涉及产业落地、组织投入或监管空间判断时。
- Expected outcome：用户能看到资本/政策是否支持某方向，但不会把“融资多”或“政策关注”直接误读为技术已经成熟；高获取成本或受限数据优先通过现成第三方工具或开放数据源尝试覆盖。

### 需求 7：系统必须支持对接 AgentReach 及类似信息搜寻工具 / Agent
- What：系统必须把外部信息搜寻能力定义为可对接的 Agent / 工具层，优先复用 AgentReach、RSS 聚合、网页抓取、学术 API、新闻 API、金融数据工具、政策数据库等现成能力。
- Why：用户明确要求不要全部自研爬虫，而是低成本、省时省力地接入已有开源工具和信息搜寻 Agent。
- Who：AgentRadar 维护者、趋势研究用户。
- When：扩展新的信息源、证据轴或行业观察方向时。
- Expected outcome：新增来源不需要重写整个 weekly 判断链路，系统能消费外部 Agent 产出的标准化证据。

### 需求 8：系统必须支持多 Agent 分工完成行业趋势判断
- What：系统必须允许多个专责 Agent 分别负责行业证据搜寻、证据标准化、趋势聚类、证据审计和综合判断；完整分工应覆盖研究前沿、顶会/学术活动、大厂/产品发布、知名开发者/工作室、中文社区、海外社区、项目/开源生态、资本金融、政策监管、政策研究/智库、新闻/宣传信号、证据去重归一、反证审计和 weekly 趋势综合。
- Why：行业趋势判断跨度大，单一 Agent 难以稳定覆盖全部渠道和判断维度。
- Who：AgentRadar 维护者、weekly 用户。
- When：weekly 趋势判断需要整合多个领域证据时。
- Expected outcome：趋势判断过程可以分工、审计和降级；用户能感知最终结论不是单一来源或单一模型臆断。

### 需求 9：系统必须保留证据反链和反证审计
- What：每条趋势必须保留正向证据、反向证据、缺失证据和来源类别；当某证据轴为空或冲突时，weekly 必须表达。
- Why：行业级趋势判断更容易受到叙事、宣传和单源偏见影响，必须可复核。
- Who：研究与决策型用户、维护者。
- When：任何趋势被列为核心趋势或观察趋势时。
- Expected outcome：用户能核对趋势为何成立，也能看到哪些证据不足以支持更强结论。

### 需求 10：weekly 输出必须显式表达趋势等级和证据覆盖
- What：weekly 必须区分核心行业趋势、观察中行业趋势、项目热度簇、证据不足但值得跟踪方向，并展示各自证据覆盖摘要。
- Why：用户需要的是行业判断，不是把所有热闹都写成趋势。
- Who：所有 weekly 用户。
- When：生成 weekly 可读产物和结构化产物时。
- Expected outcome：用户能快速判断哪些方向已经具备行业级趋势资格，哪些只是早期线索。

## 5. Interpretation Options

### 关键请求 A：“当前周趋势覆盖面很小”
- 解释 A1：增加更多预设主题标签，让现有项目聚类覆盖更多方向。
- 解释 A2：改变趋势判断证据边界，引入行业级多源信号。
- 推荐冻结：采用 `A2`
- 原因：问题根因不是标签数量不够，而是输入和判断标准过度 repo-centric。

### 关键请求 B：“趋势判断不应该只看几个高分项目”
- 解释 B1：降低高分项目阈值，允许更多项目进入趋势候选。
- 解释 B2：将趋势成立标准改为跨来源独立证据，并保留项目热度作为其中一个证据轴。
- 推荐冻结：采用 `B2`
- 原因：降低阈值会扩大噪声，不能解决行业视野狭窄问题。

### 关键请求 C：“判断整个 AI Agent 行业的发展趋势”
- 解释 C1：覆盖所有泛 AI 新闻和泛科技事件。
- 解释 C2：围绕 AI Agent / automation / intelligent software 的行业前沿，覆盖研究、产品、社区、资本、政策和落地信号。
- 推荐冻结：采用 `C2`
- 原因：产品仍应保持 AgentRadar 边界，不能泛化成全行业新闻聚合器。

### 关键请求 D：“关注大厂、研究所、顶会、开发者、社区、资本、政策”
- 解释 D1：把这些内容作为 weekly 文案背景补充，不影响趋势判断。
- 解释 D2：把这些内容作为正式证据轴参与趋势成立、降级和审计。
- 推荐冻结：采用 `D2`
- 原因：用户要的是趋势判断标准扩展，而不是阅读材料堆叠。

### 关键请求 E：“尽量借助已有开源工具”
- 解释 E1：每个来源都在 AgentRadar 内自研采集器。
- 解释 E2：优先接入 AgentReach、RSS/网页抓取、学术/新闻/金融/政策 API 等现成工具或外部 Agent，AgentRadar 负责消费、归一和判断。
- 推荐冻结：采用 `E2`
- 原因：用户明确要求低成本、省时省力，并且行业信息源变化快，工具层必须可替换。

### 关键请求 F：“是否用多 Agent 完成任务”
- 解释 F1：继续使用一个 weekly Agent，提示词里要求它综合所有内容。
- 解释 F2：使用多 Agent 分工搜寻和审计，再由趋势综合 Agent 输出 weekly 判断。
- 推荐冻结：采用 `F2`
- 原因：多源行业趋势判断天然跨领域，分工能提高覆盖、降低单点失败，并让证据缺口更可见。

## 6. Constraints

### 权限与裁决边界
- 行业级证据可以改变趋势候选、趋势等级和审计结论，但不得伪造来源或不可追溯证据。
- 外部 Agent 的输出不能直接成为最终结论，必须经过归一、去重、来源标注和证据审计。
- 单一来源、单一平台或单一主体的高热不能独立证明行业趋势成立。
- 资本、政策和宣传信号只能作为行业支持度证据，不能单独证明技术能力成熟。

### 数据与事实边界
- repo、paper、policy、funding、community thread、product release 等对象必须允许拥有不同字段，不得强行统一成 GitHub 项目。
- 趋势证据必须保留来源类别、时间、主体、链接或可追溯引用。
- 无法核验或来源不明的信息只能进入低可信观察，不得进入核心趋势证据。
- 对政策倾斜、宣传倾斜、资本流向等高解释风险信号，必须表达为“迹象”而非确定事实。
- 中文社区和海外社区必须区分来源类别与语言标签；趋势权重不因中文或海外身份天然加权，只取决于机构、团队、个人或社区本身的权威程度与证据评分。

### 业务规则约束
- weekly 必须优先回答“行业方向是否形成”，而不是“哪些项目分数最高”。
- 项目级高分仍是重要证据轴，但不再是唯一核心证据。
- V1 必须完整覆盖需求定义中的全部行业证据轴，不允许设计阶段以“先做最小集合”为理由省略顶会、开发者/工作室、智库、媒体宣传、资本或政策等轴。
- 趋势判断必须支持正证、反证和缺口三类信息。
- 趋势输出不得只展示最强证据，也必须暴露证据不足或冲突之处。
- 多 Agent 分工必须服务于证据覆盖和审计，而不是制造更多不可解释结论。
- 行业趋势与项目趋势必须分开表达：行业趋势是 weekly 主叙事，项目趋势作为证据和落地样本承载；开源项目趋势通常具有滞后性，不应压过更早出现的行业级信号。

### 工具与来源约束
- V1 应优先复用成熟工具或开放数据源，例如 AgentReach、RSSHub、Crawl4AI / Firecrawl、GDELT、OpenAlex、arXiv、OpenReview、Semantic Scholar、Hugging Face Hub、GitHub API、OpenBB、SEC EDGAR、OECD.AI、Federal Register 等。
- 具体工具可以在设计阶段替换，但产品需求必须保留“可对接外部信息搜寻 Agent / 工具”的能力边界。
- 资本金融信号应尽量覆盖融资新闻、财报、SEC 披露、基金报告、并购和上市公司公告；其中获取成本高、授权受限或稳定性不足的来源，优先通过第三方工具或者网站获取，如果是在无法获取可以标记获取失败，不得为追求完整性引入不可持续采集成本。
- 某个工具不可用时，系统必须能标注该证据轴缺失并降级输出。

### 兼容性约束
- 现有 daily、weekly、项目库和外部补证信号层必须继续可用。
- 行业级趋势判断不能破坏现有项目级 evidence refs 和可审计产物。
- 当行业级证据不足时，weekly 必须回退到当前项目级趋势判断，但要明确标注“行业证据不足”。

## 7. Acceptance Criteria

### 验收 1：weekly 不再只由高分 GitHub 项目决定趋势
- 可观察结果：weekly 趋势卡包含项目以外的证据类型，例如论文、会议、产品发布、社区讨论、政策或资本信号。
- 成功条件：至少部分趋势能展示跨来源证据覆盖，并能说明项目证据在其中的角色。
- 失败条件：核心趋势仍只由两三个高分项目和固定标签决定。

### 验收 2：趋势证据轴可见
- 可观察结果：每条核心趋势都有完整证据轴摘要，能看出项目/开源、研究/论文、顶会/学术活动、大厂/产品发布、开发者/工作室、技术社区、资本/金融、政策/监管、智库/政策研究、新闻/宣传等维度是否存在证据。
- 成功条件：用户能判断一条趋势是“研究强”“社区强”“产品强”“资本强”“政策强”“媒体/宣传强”还是“多维共振”，并能看到缺失轴。
- 失败条件：用户只能看到趋势名称和 supporting projects，无法判断行业证据结构。

### 验收 3：系统能识别非 repo 行业信号
- 可观察结果：weekly 或行业观察池中出现无法映射到 GitHub repo 的论文、政策、会议、融资、产品发布或社区主题信号。
- 成功条件：这些信号能作为方向级证据被审计和消费，而不是被丢弃。
- 失败条件：非 repo 证据必须强行绑定项目，否则无法进入判断。

### 验收 4：趋势等级区分清晰
- 可观察结果：weekly 明确区分核心行业趋势、观察中行业趋势、项目热度簇和证据不足方向。
- 成功条件：用户能理解为什么某方向被升级、降级或只列为观察。
- 失败条件：所有热闹方向都被写成“趋势”，或所有方向都只按项目数量排序。

### 验收 5：多 Agent / 外部搜寻 Agent 对接语义成立
- 可观察结果：系统能消费来自不同信息搜寻 Agent 或工具的标准化证据，并保留来源类别。
- 成功条件：能表达研究前沿、顶会/学术活动、大厂/产品发布、开发者/工作室、中文社区、海外社区、项目/开源生态、资本金融、政策监管、智库/政策研究、新闻/宣传、证据审计和趋势综合等专责 Agent 或等价模块的输入状态和贡献。
- 失败条件：外部 Agent 的输出只能作为旁路备注，不能进入正式趋势判断。

### 验收 6：反证与缺口可见
- 可观察结果：每条核心趋势至少能表达证据缺口；存在冲突时能表达反证。
- 成功条件：用户能看到“为什么这条趋势成立”以及“它还缺什么证据”。
- 失败条件：weekly 只输出正向叙事，不暴露证据不足、来源偏置或冲突。

### 验收 7：工具失效时可降级
- 可观察结果：某类外部工具或 Agent 失败时，weekly 仍能产出，并标注对应证据轴缺失。
- 成功条件：主产物稳定，用户知道本周哪些行业证据未参与判断。
- 失败条件：工具失败导致 weekly 中断，或系统把缺失证据伪装成没有趋势。

### 验收 8：行业趋势边界没有泛化失控
- 可观察结果：系统仍围绕 AI Agent / automation / intelligent software 判断趋势。
- 成功条件：泛 AI 新闻、普通 SaaS、纯硬件或无 agent 关系事件不会因为热度进入核心趋势。
- 失败条件：weekly 退化为泛 AI 新闻综述。

## 8. Risks & Gaps

### 风险
- 如果只扩展来源而不改变趋势模型，系统会变成“更多材料 + 同样狭窄判断”。
- 如果把资本、政策或宣传信号权重过高，系统可能追随叙事泡沫。
- 如果外部 Agent 输出缺少标准化和审计，趋势判断会变成不可复核的黑盒。
- 如果证据轴过多但没有等级区分，用户会难以理解什么证据真正推动了结论。
- 如果过度追求“整个行业”，产品可能从 AgentRadar 漂移成泛 AI 情报平台。
- 如果多 Agent 之间没有清晰职责，可能出现重复搜寻、互相矛盾、结论堆叠的问题。

### 风险应对设计
- 对“更多材料 + 同样狭窄判断”：趋势模型必须先生成行业主张，再按完整证据轴寻找支撑与反证；项目标签聚类不能直接等同于行业趋势。
- 对资本、政策或宣传泡沫：资本、政策和宣传信号只能提升“行业关注度 / 组织投入迹象”，不能单独把方向升级为核心行业趋势；至少需要研究、产品、社区、开源或落地证据中的一个维度形成交叉确认。
- 对外部 Agent 黑盒：所有外部 Agent 只允许产出标准化证据，不允许直接产出最终趋势；证据必须包含来源、时间、主体、证据轴、语言、链接或可追溯引用、摘要、置信度和可核验性。
- 对证据轴过多导致用户难懂：weekly 只需要显式突出三类证据轴：主导证据轴、辅助证据轴、缺失 / 反证轴；完整证据矩阵可下钻查看，但主叙事必须说明真正推动结论的是哪几个轴。
- 对泛 AI 情报平台漂移：所有趋势候选必须先通过 `Agent relevance gate`，确认其与 autonomous action、tool use、workflow execution、agentic coding、computer use、multi-agent、memory、eval/governance、vertical agent 或 intelligent software automation 相关；否则只能作为背景材料，不能进入核心趋势。
- 对多 Agent 结论堆叠：专责 Agent 只负责搜寻和证据整理，证据归一 Agent 负责实体对齐和去重，反证审计 Agent 负责降级与风险提示，趋势综合 Agent 才能输出 weekly 趋势等级。

### 趋势成立阈值冻结
- 核心行业趋势：至少 3 个证据轴有独立证据，其中至少 1 个证据来自 `core` 或 `proven` 权威主体，且不存在强反证。
- 观察中行业趋势：至少 2 个证据轴有独立证据，或 1 个高权威信号叠加持续社区讨论。
- 项目热度簇：项目 / 开源轴强，但研究、产品、资本、政策、社区等行业轴不足。
- 证据不足方向：存在零散材料，但来源单一、不可核验、缺少 Agent 相关性，或只能说明泛 AI 热点。
- 降级规则：若趋势主要由资本、政策、新闻或宣传信号驱动，而缺少研究、产品、社区、开源或落地证据，默认不得进入核心行业趋势。

### 最低冻结设计要求

以下内容不再作为“缺口”留空。设计阶段可以细化数值、字段和实现方式，但不得低于本节冻结的最低要求。

#### 证据轴评分最低要求
- 每个证据轴必须至少输出 `0-100` 的轴评分，并拆成 `authority_score`、`freshness_score`、`independence_score`、`primary_source_score`、`continuity_score`、`agent_relevance_score` 六个子分。
- `authority_score` 衡量主体权威程度，必须基于 `core / proven / watch / ordinary` 实体层级。
- `freshness_score` 衡量信号是否足够新，过期信号只能作为背景，不得推动趋势升级。
- `independence_score` 衡量独立来源数量，同一新闻转载链、同一公司通稿、同一作者多平台转发不得重复计数。
- `primary_source_score` 衡量距离一手来源的距离，官方发布、论文、监管文件、财报和原始代码高于媒体转述。
- `continuity_score` 衡量持续天数、跨周复现或连续事件，而不是单日爆发。
- `agent_relevance_score` 衡量与 Agent / automation / intelligent software 的相关性；低于相关性门槛的材料只能作为泛 AI 背景。
- 每个趋势必须输出 `leading_axes`、`supporting_axes`、`missing_axes`、`counter_axes`，避免把多轴证据压成单一总分。

#### 权重函数最低要求
- 趋势总判断不得采用简单材料数量相加，必须采用“证据轴覆盖 + 主体权威 + 独立性 + 新鲜度 + Agent 相关性”的组合。
- 项目 / 开源轴最多只能作为一个证据轴，不得因项目数量多而吞没研究、产品、社区、资本和政策轴。
- 资本、政策、新闻和宣传轴不得单独把方向升级为核心行业趋势，只能在与研究、产品、社区、开源或落地证据交叉确认后提升趋势置信度。
- `core / proven` 来源可以推动趋势升级；`watch` 来源只能增强观察热度；`excluded` 来源不得参与评分。
- 中文来源和海外来源不按语言区域加权；权重只取决于主体权威、证据质量、独立性、持续性和一手程度。
- 设计阶段如果引入更复杂权重函数，必须保留上述门槛和降级规则，不得把它们改写为单一黑盒分数。

#### 冲突合并最低要求
- 所有趋势候选必须经过实体对齐、同源去重、转载链去重和重复主体去重。
- 同一主体多渠道发布只能算作一个主体信号，但可以增强该主体的持续性记录。
- 若不同证据轴结论冲突，系统必须输出冲突说明，而不是只保留正向证据。
- 若高权威反证出现，例如论文复现失败、项目停止维护、监管否定、公司撤回发布或融资信息无法核验，趋势必须降级或进入反证审计。
- 若多个 Agent 产出相互矛盾，反证审计 Agent 的降级结论优先于趋势综合 Agent 的升级结论。
- 合并后的趋势必须能追溯到原始证据项、来源类别和参与合并的 Agent。

#### Seed Registry 最低要求
- V1 Seed Registry 已在本文冻结，设计阶段必须以本文名单为初始 registry，不得留空、缩减为少数热门公司，或只实现 GitHub / 学术 / 社区中的一部分。
- 每个 registry entry 必须记录 `entity_id`、`display_name`、`entity_type`、`authority_tier`、`region`、`language`、`source_urls`、`evidence_axes`、`maintenance_agent_id`、`approval_agent_id`、`last_agent_reviewed_at`、`review_status` 和 `human_exception_required`。
- Registry 默认由 Agent 自动巡检、提议、审批和维护；人工只处理 `human_exception_required = true` 的争议项、付费授权项、法律风险项或高影响删除项。
- 新增来源必须给出加入理由；删除来源必须给出删除理由和替代来源。
- V1 可以因为工具成本或授权限制暂不自动采集某些来源，但必须在 registry 中保留其状态，例如 `auto`、`agent_review`、`optional_paid`、`human_exception`、`unavailable`。

#### 资本 / 政策 / 宣传可信度分层最低要求
- `high_confidence`：监管披露、SEC 文件、公司官方公告、财报、政府文件、标准组织文件、顶级会议官方材料、论文原文。
- `medium_confidence`：Reuters、Bloomberg、The Information、Dealroom、Sifted、专业数据库、投资机构正式报告、可追溯一手来源的媒体报道。
- `low_confidence`：普通科技媒体、泛行业媒体、二手博客、社媒总结、未给出来源链的市场传闻。
- `excluded`：营销软文、无法追溯来源、明显 SEO 内容、搬运号、纯观点文章、未经确认的融资或并购传闻。
- 政策和宣传信号必须表达为“监管关注、政策空间、产业投入迹象、叙事扩散或风险关注”，不得写成确定审批、确定支持或确定落地，除非来源本身明确。

#### 外部工具准入最低要求
- 每个外部工具必须记录 `tool_name`、`covered_axes`、`access_mode`、`cost_tier`、`rate_limit`、`license_risk`、`freshness_sla`、`failure_mode`、`fallback_mode`。
- 优先使用成熟开源工具、官方 API 和稳定第三方工具，例如 AgentReach、RSSHub、OpenAlex、Semantic Scholar、arXiv、OpenReview、Papers with Code、PaperQA / PaperQA2、OpenScholar、GPT Researcher、Crawl4AI / Firecrawl、Jina Reader、GitHub API、Hugging Face Hub API、OpenBB、SEC EDGAR、Federal Register、GDELT。
- 高成本、授权复杂或稳定性不足的工具不得成为 V1 自动化链路硬依赖，只能作为 `optional_paid`、`agent_review`、`human_exception` 或后续扩展；默认先由 Agent 判断是否存在免费替代源、公开 API 或可接受的延迟补证方式。
- 工具失效时必须标注对应证据轴缺失，不得把缺失误写成该方向没有趋势。

#### 中文 / 海外社区口径最低要求
- 中文社区和海外社区必须分开标注来源类别和语言，但不按语言区域天然加权。
- 中文核心社区只能包含 GitHub 中文开发者讨论、模型 / 开源生态社区、高质量 V2EX AI / 编程讨论、可验证作者的个人技术博客或公众号等高质量来源。
- 知乎、掘金、CSDN、小红书、泛 Bilibili 技术内容、泛微信公众号精选源默认不进入核心证据池，只能作为弱背景噪声、低优先级 Agent 反向检索线索或争议项排查入口。
- 机器之心、量子位、智东西、InfoQ 中文等媒体只能作为新闻 / 宣传或二级观察源；只有包含可追溯原始来源、采访对象或一手发布信息时，才可转为辅助证据。
- 海外社区同样必须筛选高质量子社区和明确身份主体，不得把 Reddit、X / Twitter、Discord、YouTube 等平台整体视为高质量来源。

### V1 Seed Registry

以下名单是 V1 初始维护名单，用于确保行业证据搜寻不会在设计阶段落空。名单不是永久全集，但设计阶段必须以此为最低覆盖基线；新增或删除需要说明理由。

#### Source Quality Gate
- 质量优先于数量：所有来源必须先进入 `core / proven / watch / excluded` 分层，再参与趋势判断；未经分层的来源不得推动趋势升级。
- `core`：一手或近一手来源，高权威主体，长期稳定，信号新鲜，可追溯，可自动化获取；可参与核心行业趋势判定。
- `proven`：质量稳定、可验证、经常引用一手材料的来源；可参与核心趋势判定，但不能单独主导结论。
- `watch`：有一定观察价值，但可能滞后、转述、混杂营销或质量不稳定；只能作为辅助证据或检索线索。
- `excluded`：低质量转载、SEO 内容、泛问答、营销号、低新鲜度媒体、无法追溯来源或高噪声平台；默认不得进入核心证据池。
- 每条来源必须记录 `authority_tier`、`source_type`、`language`、`access_mode`、`cost_tier`、`freshness_expectation` 和 `primary_source_distance`。
- 趋势升级只允许由 `core / proven` 来源推动；`watch` 来源可以增加观察热度，但不能把方向升级为核心行业趋势。
- 工具优先原则：如果某一类来源已有成熟开源工具、官方 API 或稳定第三方工具，V1 应优先接入工具输出，AgentRadar 负责归一、审计和趋势判断，不重复造爬虫。

#### 大厂 / 产品与平台主体
- 国际大厂与实验室：OpenAI、Anthropic、Google / Google DeepMind / Gemini、Microsoft / GitHub、Meta / FAIR、Amazon / AWS、Apple、NVIDIA、xAI、IBM、Salesforce、ServiceNow、Adobe、Databricks、Snowflake。
- 模型与 Agent 平台公司：Mistral AI、Cohere、Perplexity、Anysphere / Cursor、Cognition、Replit、Sourcegraph、Vercel、Hugging Face。
- 中国与亚洲主体：DeepSeek、Alibaba / Qwen、ByteDance / Seed、Tencent、Baidu、Huawei、Moonshot AI、Zhipu AI、MiniMax、01.AI、StepFun、ModelBest / OpenBMB、Shanghai AI Laboratory。
- Agent / 开发者工具生态主体：LangChain、LlamaIndex、Microsoft AutoGen、CrewAI、OpenHands、Browser Use、Aider、Continue、Mem0、Composio、Pydantic AI、Mastra、Langfuse、Ragas、DSPy。
- 质量规则：大厂 / 产品信号优先取官方博客、release notes、API 文档、开发者大会、论文、招聘 JD、客户案例、财报或官方 GitHub / Hugging Face 组织；新闻转述只能作为辅助证据。
- 推荐工具：RSSHub、官方 RSS / changelog、Crawl4AI / Firecrawl、GitHub API、Hugging Face Hub API、Jina Reader、AgentReach。

#### 研究所 / 大学 / 实验室
- 国际研究机构：Allen Institute for AI、Stanford HAI、Stanford CRFM、UC Berkeley BAIR、MIT CSAIL、Carnegie Mellon University、Princeton NLP、University of Washington NLP、NYU Center for Data Science、Mila、Vector Institute、ETH AI Center、Oxford、Cambridge。
- 大厂研究组织：OpenAI Research、Google DeepMind、Meta FAIR、Microsoft Research、NVIDIA Research、Apple Machine Learning Research、Amazon Science、Salesforce AI Research。
- 中国及亚洲研究机构：Tsinghua University / THUDM、Peking University、Shanghai AI Laboratory、Chinese Academy of Sciences、HKU、HKUST、NUS、NTU、KAIST、RIKEN AIP。
- 质量规则：研究机构信号优先取论文、实验室官方页面、公开项目、数据集、benchmark、课程 / seminar 页面和研究组成员发布；媒体报道只作为二级观察源。
- 推荐工具：OpenAlex、Semantic Scholar API、arXiv API、OpenReview API、PaperQA / PaperQA2、OpenScholar、Papers with Code、institution RSS / sitemap、AgentReach。

#### 顶会 / 学术活动 / Benchmark 场域
- AI / ML 顶会：NeurIPS、ICML、ICLR、AAAI、IJCAI、COLM。
- NLP / Agent 语言系统：ACL、EMNLP、NAACL、EACL、CoNLL。
- 数据、Web 与系统：KDD、The Web Conference、SIGIR、VLDB、SIGMOD、OSDI、SOSP、USENIX ATC。
- 人机交互与工具使用：CHI、UIST、CSCW、IUI。
- 多模态、视觉和具身智能：CVPR、ICCV、ECCV、RSS、CoRL、ICRA、IROS。
- V1 必须特别跟踪这些会议中的 agent、tool use、computer use、workflow automation、coding agent、multi-agent、memory、eval、alignment、safety、governance、robotics agent、web agent、GUI agent 相关 workshop、tutorial、challenge 和 benchmark。
- 质量规则：顶会信号优先取 accepted papers、oral / spotlight、workshop、challenge、benchmark leaderboard、official schedule、OpenReview discussion、官方 proceedings；社媒总结和媒体榜单只能作为检索线索。
- Auto research 规则：学术与 benchmark 方向必须优先接入成熟 auto research / literature synthesis 工具，不从零写论文爬虫或摘要器。V1 推荐以 OpenAlex / Semantic Scholar / arXiv / OpenReview / Papers with Code 做检索与元数据底座，以 PaperQA / PaperQA2 或 OpenScholar 做引用可追溯的文献综合，以 GPT Researcher 或 AgentReach 作为网页补充研究，不允许让通用搜索结果直接替代学术源。

#### 知名开发者 / 工作室 / 开源维护者
- 个人与意见领袖种子：Simon Willison、Andrej Karpathy、Swyx、Harrison Chase、Jerry Liu、Paul Gauthier、Yohei Nakajima、Jason Liu、Addy Osmani、Thorsten Ball、Chip Huyen、Lilian Weng、Eugene Yan、Sebastian Raschka。
- Builder / 工作室 / 开源团队种子：LangChain、LlamaIndex、Aider、OpenHands、Browser Use、CrewAI、Mem0、Composio、Continue、Pydantic AI、Mastra、DSPy、Langfuse、Ragas、Model Context Protocol 社区、Hugging Face Agents / Smolagents 社区。
- 维护规则：个人名单必须允许按 `core / proven / watch / ordinary` 分层维护，且不得因为单次爆红自动进入高权威层级。
- 质量规则：开发者信号必须来自明确身份主体的 GitHub、个人博客、X / Twitter、Substack、conference talk、podcast transcript、官方 repo discussion 或 release；搬运号、二创剪辑和无来源摘要默认排除。
- 推荐工具：GitHub API、RSSHub、AgentReach、X / Twitter connector、Crawl4AI / Firecrawl、Jina Reader。

#### 中文社区 / 海外社区
- 社区质量规则：V1 不追求社区数量完整，而追求高质量、前沿性和可追溯性；低质量转载站、SEO 内容站、营销号聚合、泛问答平台和低新鲜度科技媒体不得进入核心证据池。
- 海外核心社区种子：Hacker News、Reddit 中的高质量 AI / ML / Local LLM / programming 子社区、X / Twitter 高权威开发者与研究者网络、GitHub Discussions、Hugging Face community、Papers with Code、Lobsters、LessWrong / Alignment Forum、AI Engineer community、Latent Space community、OpenReview discussion、LangChain / LlamaIndex / MCP / Hugging Face / EleutherAI / LAION 等公开 Discord 或论坛。
- 海外内容型观察源：高质量 Substack / 技术博客、YouTube 技术频道、podcast / transcript 可作为观察证据，但必须绑定明确作者、机构或社区来源；不得仅按播放量或订阅数提升权重。
- 中文核心社区种子：GitHub 中文开发者讨论、Hugging Face / ModelScope / OpenXLab / OpenMMLab 等模型与开源生态社区、V2EX 中高质量 AI / 编程讨论、少量可验证作者的个人技术博客或公众号。
- 中文观察源：腾讯研究院 AI 速递、InfoQ 中文、AI 科技评论、机器之心、量子位、智东西等只能作为新闻/宣传、机构观察或二级观察源，不得作为核心社区讨论证据；其中腾讯研究院 AI 速递因具备机构研究属性，可作为产业 / 政策 / 大厂动态的辅助证据，若包含可追溯原始来源、官方链接或一手发布信息，可升级为 `proven` 证据。
- 中文排除或低权重源：知乎、掘金、CSDN、小红书、泛 Bilibili 技术内容、泛微信公众号精选源默认不进入 V1 核心证据池；如需使用，只能作为弱背景噪声、低优先级 Agent 反向检索线索或争议项排查入口，不能参与趋势升级。
- 语言规则：中文与海外来源必须标注语言和来源类别，但权重只由主体权威程度、证据质量、独立性和持续性决定；中文来源不会因为覆盖稀缺而被补偿性加权，海外来源也不会因为语言区域天然更高权重。
- 推荐工具：AgentReach、RSSHub、Hacker News Algolia API、Reddit API、GitHub Discussions API、Hugging Face Hub API、Crawl4AI / Firecrawl、Jina Reader。

#### 政策监管机构 / 政策研究 / 智库
- 政策监管机构：OECD.AI、EU AI Office、European Commission、NIST、U.S. AI Safety Institute、UK AI Safety Institute、Federal Register、White House OSTP、FTC、SEC、China CAC、MIIT、MOST、NDRC、ISO / IEC JTC 1 SC 42。
- 政策研究与智库：CSET、Stanford AI Index、Stanford HAI、Brookings、RAND、OECD AI Policy Observatory、Center for AI Safety、Ada Lovelace Institute、Alan Turing Institute、Institute for AI Policy and Strategy、GovAI。
- 解释规则：政策和智库信号默认表达为监管关注、政策空间、产业投入或风险关注，不得在来源未明确时写成确定审批或确定支持。
- 质量规则：政策信号优先取官方政策库、政府公告、监管文件、标准组织文件、正式报告和可下载原文；新闻解读、智库评论和媒体二次报道只能作为辅助解释。
- 推荐工具：OECD.AI、Federal Register API、SEC EDGAR、gov / eu official APIs、RSSHub、Crawl4AI / Firecrawl、Jina Reader。

#### 金融 / 资本 / 产业数据来源
- 开放与低成本金融数据：SEC EDGAR、OpenBB、FRED、公司 investor relations、上市公司 10-K / 10-Q / 8-K、年度报告、财报电话会 transcript、并购公告、公开招股书。
- 融资与并购核心 / proven 源：SEC EDGAR、公司 investor relations、Reuters、Bloomberg、The Information、Sifted、Dealroom、Crunchbase、PitchBook、CB Insights。
- 融资与并购 watch 源：TechCrunch、VentureBeat、Forbes、CNBC、36氪、钛媒体、晚点 LatePost 等只能作为观察源或线索源；只有包含一手公告、投资方确认、公司官方声明或监管披露时，才能升级为辅助证据。
- 产业研究与市场报告源：Gartner、Forrester、IDC、McKinsey、BCG、Bain、a16z、Sequoia、Lightspeed、Index Ventures、ARK Invest、ARK Big Ideas、Stanford AI Index。
- 质量规则：金融 / 资本信号必须优先依赖公开披露、公司公告、监管文件、可信金融媒体或专业数据库；普通科技媒体融资报道不得单独推动趋势升级。
- 成本规则：Crunchbase、PitchBook、CB Insights、Bloomberg、Gartner、Forrester 等高成本或授权受限来源可以作为 Agent 异步补证、可选付费工具或人工例外项，不应成为 V1 自动化链路的硬依赖。
- 推荐工具：OpenBB、SEC EDGAR API、FRED API、company investor relations RSS / pages、GDELT、RSSHub、Crawl4AI / Firecrawl、AgentReach。

### 隐含假设
- 用户接受“行业趋势”比“项目热度”更慢、更复杂，也会出现证据不足的结论。
- 用户愿意阅读趋势证据矩阵，而不只看简短项目榜单。
- 系统未来可以维护核心实体名单和来源目录。
- 外部信息搜寻 Agent 能产出足够结构化、可追溯的结果。

## 9. Frozen Decisions

以下问题已根据用户反馈完成冻结，设计阶段不得重新收缩口径；如果实现成本或来源限制导致无法满足，必须显式回到需求阶段更新边界。

1. V1 的行业证据轴是否全部上线，还是先冻结最小集合？
   - 冻结：需求中提到的行业证据轴必须全部上线，包括项目/开源、研究/论文、顶会/学术活动、大厂/产品发布、知名开发者/工作室、技术社区/极客讨论、资本/金融、政策/监管、政策研究/智库与媒体宣传信号。
   - 原因：如果只冻结最小集合，设计和实现阶段容易继续偷懒，weekly 仍会退回少量项目和少数通用方向。

2. V1 是否需要区分中文社区和海外社区？
   - 冻结：需要区分中文社区和海外社区，但先以来源类别和语言标注表达，不引入复杂语言区域权重。
   - 权重口径：权重只取决于机构、团队、个人或社区本身的权威程度与证据评分，不因为中文或海外来源天然加权。

3. 资本流向是否只看公开融资新闻，还是也看财报、SEC 披露、基金报告和并购？
   - 冻结：融资新闻、财报、SEC 披露、基金报告、并购、上市公司公告等都应纳入资本金融证据范围。
   - 成本口径：应尽量借助现成第三方工具、开放 API 或已有数据服务获取；获取成本高、授权复杂或维护成本过高的来源可以不接入 V1 自动化链路，但必须标注为未覆盖、Agent 异步补证、可选付费工具或人工例外范围。

4. 政策倾斜如何避免过度解读？
   - 冻结：只表达为政策/监管信号，不直接写成确定支持或确定审批，除非来源本身明确。
   - 解释口径：政策、监管、宣传和官方媒体倾斜属于行业迹象，不等同于技术成熟度、商业成熟度或确定落地。

5. 多 Agent 的最小分工如何冻结？
   - 冻结：不采用“最小分工”表述，V1 需求直接冻结完整多 Agent 形态。
   - 完整形态应包含以下专责 Agent 或等价模块：
     - 研究前沿 Agent：跟踪 arXiv、OpenAlex、Semantic Scholar、研究机构、重要论文和作者。
     - 顶会与学术活动 Agent：跟踪 NeurIPS、ICLR、ICML、ACL、EMNLP、AAAI、COLM 等顶会、workshop、tutorial、challenge 和 accepted paper 主题。
     - 大厂与产品发布 Agent：跟踪 OpenAI、Anthropic、Google/DeepMind、Microsoft、Meta、AWS、Apple、xAI、Mistral、Cohere、DeepSeek、Qwen、ByteDance、Tencent 等主体的产品、API、SDK、平台和案例发布。
     - 知名开发者与工作室 Agent：跟踪核心开发者、独立工作室、开源 maintainer、技术意见领袖和高质量 builder 社群。
     - 中文社区 Agent：跟踪中文技术社区、中文社媒、中文开发者讨论和中文媒体/官方发布。
     - 海外社区 Agent：跟踪 Hacker News、Reddit、X/Twitter、GitHub discussion、Discord/论坛、海外技术博客等讨论。
     - 项目/开源生态 Agent：跟踪 GitHub、Hugging Face、包生态、benchmark、demo、issue/PR 与 star/fork/download 等开源采纳信号。
     - 资本金融 Agent：跟踪融资新闻、财报、SEC 披露、基金报告、并购、上市公司公告和第三方金融数据。
     - 政策监管 Agent：跟踪政策文件、监管公告、审批、政府项目、公共采购和官方机构动态。
     - 政策研究与智库 Agent：跟踪 OECD.AI、CSET、Stanford AI Index、行业研究机构、咨询机构和高水平政策研究者。
     - 新闻与宣传信号 Agent：跟踪全球新闻、官方媒体、行业媒体、宣传倾斜和叙事扩散。
     - 证据归一 Agent：负责实体对齐、去重、来源类别标注、语言标注和证据轴归档。
     - 反证审计 Agent：负责发现单源泡沫、反向证据、证据缺口、来源偏置和过度解读风险。
     - 趋势综合 Agent：负责把各专责 Agent 的证据汇总为核心行业趋势、观察趋势、项目热度簇和证据不足方向。

6. 行业趋势与项目趋势是否需要两个分开的 weekly 区域？
   - 冻结：需要分开表达。行业趋势是 weekly 主叙事，项目趋势作为证据和落地样本承载。
   - 解释口径：开源项目趋势往往具有滞后性，不能让项目热度继续压过更早出现、更能反映行业前沿的研究、产品、资本、政策和社区信号。

## 10. Requirement Freeze Status

`READY`

满足原因：
- 用户问题清晰：当前 weekly 过度依赖少量项目和固定方向，不能代表 AI Agent 行业趋势。
- 用户价值清晰：需要更完整、更前沿、更接近落地点的行业趋势判断。
- 需求边界清晰：系统仍围绕 AI Agent / automation / intelligent software，不泛化为全 AI 新闻平台。
- 证据边界清晰：项目只是一个证据轴，研究、产品、社区、资本、政策、机构与开发者信号都应参与。
- 协作边界清晰：优先对接 AgentReach 和类似信息搜寻工具 / Agent，允许多 Agent 分工完成搜寻、审计和综合判断。
- 验收清晰：是否摆脱高分项目单一判断、是否展示证据轴、是否支持非 repo 信号、是否可降级、是否有反证与缺口，都可被观察。

可直接进入下一阶段设计：
- 设计行业级证据对象和趋势证据矩阵。
- 设计外部信息搜寻 Agent 的标准化输入契约。
- 设计 weekly 中行业趋势、项目热度簇、观察趋势和证据不足方向的输出结构。
- 设计多 Agent 分工、证据审计和降级语义。
