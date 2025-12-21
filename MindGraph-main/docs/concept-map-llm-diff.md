# 概念图 vs 其他图示：LLM 交互差异

- **前端触发流程**：概念图自动补全走焦点问题专用流程（`static/js/managers/toolbar/llm-autocomplete-manager.js` 的 `handleConceptMapFocusQuestionGeneration`）；其他图示走通用 `handleAutoComplete`。
- **专用 Agent 与调用参数**：概念图使用 `ConceptMapAgent`（`agents/concept_maps/concept_map_agent.py`），无 system_message，`max_tokens=4000`、`temperature=0.3`、`diagram_type='concept_map'`，超时 60s；其他图示走 `agent_graph_workflow_with_styles` 按样式选择模型/参数。
- **Prompt 模板**：概念图用专用双阶段 JSON 约束（`prompts/concept_maps.py`：概念扩展 + 关系生成 + 唯一性约束）；其他图示用通用/样式化模板，由后端自动选择。
- **解析与容错**：概念图响应通过“首个 { 到最后一个 }”截取再 `json.loads` 的强制解析，失败直接空返回；其他图示使用 `agents/main_agent.py` 的多策略解析/校验（严格 JSON + fallback）。
- **后处理与数据转换**：概念图将返回的 `nodes/links` 转为 `topic/concepts/relationships`，并在前端应用聚合、同层曲线等特殊渲染；其他图示直接用通用结构进入统一渲染。

