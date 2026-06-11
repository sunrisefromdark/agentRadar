# 服务规格索引

服务级规格描述每个边界的输入输出、状态语义、失败模式与运行约束。

## 当前文件

- `signal-ingestion.md`：`agents-radar`、Trendshift、GitHub 等信号入口契约
- `normalization.md`：`RawSignal` 归一化、去重和项目视图
- `scoring-engine.md`：评分组件、权重、解释与证据约束
- `llm-classification.md`：LLM 分类的允许边界与 fallback 语义
- `action-output.md`：daily / weekly / run-summary / knowledge-base 等输出契约
- `storage-incremental.md`：数据落盘、增量更新、dry-run 约束
- `cli-runtime.md`：CLI、终端 / Web workbench 入口、auth 辅助命令、logging / retry / 配置加载
