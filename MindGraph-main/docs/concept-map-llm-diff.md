# 概念图 vs 其他图示：LLM 交互差异

本文档详细记录概念图（Concept Map）与其他图示类型在 LLM 交互流程上的差异。

---

## 1. 生成流程对比

### 1.1 其他图示（思维导图、气泡图等）

```
用户输入 → 图表类型检测 → 主题提取 → 单次 LLM 调用 → JSON 解析 → 渲染
```

**特点**：
- 单次 LLM 调用生成完整规格
- 使用通用的 `generate_graph` 方法
- max_tokens: 2000
- temperature: 0.3

### 1.2 概念图特有流程

```
用户输入 → 焦点问题提取/设置 → 多阶段 LLM 调用 → JSON 解析/合并 → Sugiyama 布局 → 渲染
```

**特点**：
- 支持多种生成策略（详见 2.2）
- 需要焦点问题（Focus Question）作为入口
- max_tokens: 4000
- temperature: 0.3
- 额外的后处理：聚合连接、关系去重

---

## 2. 概念图独有功能

### 2.1 焦点问题工作流

概念图需要先确定焦点问题，然后围绕焦点问题生成概念和关系。

**前端入口**：
- `handleConceptMapFocusQuestionGeneration()` - 焦点问题生成流程
- `window.focusQuestion` - 全局焦点问题存储

**后端服务**：
- `FocusQuestionService` - 焦点问题提取服务
- `IntroductionService` - 主题介绍生成服务

**Prompt 模板**：
- `FOCUS_QUESTION_EXTRACTION_ZH/EN` - 从文本提取焦点问题
- `INTRODUCTION_GENERATION_ZH/EN` - 生成主题介绍

### 2.2 多阶段生成策略

概念图支持多种生成方法，可通过 `method` 参数选择：

| 方法 | 说明 | 适用场景 |
|------|------|----------|
| `auto` | 自动选择最佳方法 | 默认 |
| `unified` | 单次生成所有内容 | 简单主题 |
| `two_stage` | 先生成关键概念，再生成子概念 | 中等复杂度 |
| `three_stage` | 主题提取 → 30概念 → 关系 | 复杂主题（推荐） |
| `network_first` | 先生成概念网络，再补充关系 | 强调概念覆盖 |

**相关函数**：
- `generate_concept_map_unified()` - 单次生成
- `generate_concept_map_two_stage()` - 两阶段生成
- `generate_concept_map_enhanced_30()` - 增强30概念生成
- `generate_concept_map_robust()` - 鲁棒生成（自动回退）

### 2.3 Sugiyama 层次布局

概念图使用 Sugiyama 算法进行层次布局，而其他图示使用各自的布局算法。

**前端实现**：
- `sugiyama-layout.js` - Sugiyama 布局算法
- `adjustViewBox()` - 自动调整视口

**布局特点**：
- 节点按层级分布
- 最小化连线交叉
- 父节点与子节点对齐优化

### 2.4 聚合连接处理

当多条连线从同一源节点出发且具有相同连接词时，自动聚合显示。

**相关函数**：
- `detectAggregatedLinks()` - 检测聚合连接
- `drawAggregatedLink()` - 绘制聚合连接

**规则**：
- 相同源节点 + 相同连接词 + 2条以上 → 聚合
- 聚合优先，普通连线不重复绘制

### 2.5 关系去重和规范化

概念图对关系进行严格的去重和规范化处理：

- 无向对去重：`A→B` 和 `B→A` 只保留一条
- 自环检测：禁止 `A→A`
- 标签规范化：统一大小写、去除多余空格

---

## 3. 参数差异对比

| 参数 | 概念图 | 其他图示 |
|------|--------|----------|
| max_tokens | 4000 | 2000 |
| temperature | 0.3 | 0.3 |
| timeout | 60s | 40s |
| system_message | None（嵌入prompt） | 独立设置 |
| 布局算法 | Sugiyama | 各自独立 |
| 焦点问题 | 必需 | 无 |
| 聚合连接 | 支持 | 无 |

---

## 4. Prompt 模板对比

### 4.1 其他图示 Prompt 结构

```
系统消息: 图表类型定义和格式要求
用户消息: 用户输入的主题/描述

输出格式:
{
  "topic": "主题",
  "branches": [...],  // 或其他字段
  ...
}
```

### 4.2 概念图 Prompt 结构

**统一生成 (unified)**:
```
{
  "topic": "中心主题",
  "keys": [{"name": "关键概念", "label": "关系词"}],
  "key_parts": {"关键概念": [{"name": "子概念", "label": "关系词"}]},
  "relationships": [{"from": "源", "to": "目标", "label": "关系词"}]
}
```

**concept-map 风格 (移植)**:
```
{
  "nodes": [
    {"id": "1", "label": "概念", "type": "main/core/detail", "layer": 1, ...}
  ],
  "links": [
    {"source": "1", "target": "2", "label": "关系词", ...}
  ],
  "metadata": {...}
}
```

---

## 5. 配置参数

概念图独有的配置参数在 `config/concept_map_config.py` 中定义：

```python
# 布局参数
NODE_SPACING = 1.2
CANVAS_PADDING = 80
MIN_NODE_DISTANCE = 120

# 力导向布局参数
REPULSION_FORCE = 0.025
SPRING_FORCE = 0.03
STEP_SIZE = 0.15
ITERATIONS = 200

# 概念限制
MAX_CONCEPTS = 30
MAX_LABEL_LEN = 60

# LLM 参数
CONCEPT_MAP_MAX_TOKENS = 4000
CONCEPT_MAP_TIMEOUT = 60
```

---

## 6. 前端渲染差异

| 功能 | 概念图 | 其他图示 |
|------|--------|----------|
| 渲染器 | `concept-map-renderer.js` | 各自独立渲染器 |
| 布局 | Sugiyama 层次布局 | D3 力导向/自定义 |
| 连线样式 | 支持断开+连接词 | 直线/曲线 |
| 焦点问题框 | 特殊样式+自适应宽度 | 无 |
| 聚合连接 | 支持 | 无 |
| 同级连接 | 下弯曲线 | 无 |

---

## 7. 统一化建议

为了将概念图更好地整合到统一流程中，建议：

### 7.1 已统一的部分

- ✅ 使用 BaseAgent 基类
- ✅ 通过 `llm_service.chat` 调用 LLM
- ✅ 返回统一格式 `{success, spec, diagram_type}`
- ✅ 集成到 `_generate_spec_with_agent` 调度

### 7.2 保持独立的部分

- 🔧 焦点问题工作流（概念图核心特性）
- 🔧 多阶段生成策略（提升质量的关键）
- 🔧 Sugiyama 布局（层次结构必需）
- 🔧 聚合连接处理（优化显示效果）

### 7.3 建议的配置化方向

将概念图独有参数移入配置文件，便于调整：

```python
# config/diagram_specific.py
CONCEPT_MAP_CONFIG = {
    "generation_method": "three_stage",  # auto, unified, two_stage, three_stage
    "max_tokens": 4000,
    "timeout": 60,
    "max_concepts": 30,
    "enable_aggregation": True,
    "enable_focus_question": True,
    "layout_algorithm": "sugiyama"
}
```

---

## 8. 调用示例

### 8.1 其他图示调用

```python
# 思维导图
from agents.mind_maps.mind_map_agent import MindMapAgent
agent = MindMapAgent(model='qwen')
result = await agent.generate_graph(prompt, language='zh')
```

### 8.2 概念图调用

```python
# 方式1: 直接调用 Agent
from agents.concept_maps.concept_map_agent import ConceptMapAgent
agent = ConceptMapAgent(model='qwen')
result = await agent.generate_graph(prompt, language='zh')

# 方式2: 使用 robust 生成（推荐）
from agents.main_agent import generate_concept_map_robust
spec = generate_concept_map_robust(prompt, language='zh', method='three_stage')

# 方式3: 通过焦点问题生成（前端流程）
# 1. 先提取焦点问题
# 2. 调用 handleConceptMapFocusQuestionGeneration(focusQuestion, language)
```

---

*文档版本: 1.0 | 更新日期: 2025-01-21*
