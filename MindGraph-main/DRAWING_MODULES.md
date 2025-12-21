# MindGraph 绘图相关模块详细文档

> 提取自代码审查文档  
> 版本: 4.29.2  
> 日期: 2025年12月18日

---

## 目录

1. [模块概览](#1-模块概览)
2. [后端代理模块 (agents/)](#2-后端代理模块-agents)
   - [核心基类](#21-核心基类-agentscore)
   - [思维导图代理](#22-思维导图代理-agentsthinking_maps)
   - [概念图代理](#23-概念图代理-agentsconcept_maps)
   - [思维导图代理](#24-思维导图代理-agentsmind_maps)
   - [思维工具代理](#25-思维工具代理-agentsthinking_tools)
   - [节点调色板生成器](#26-节点调色板生成器-agentsthinking_modesnode_palette)
3. [主代理模块 (agents/main_agent.py)](#3-主代理模块-agentsmain_agentpy)
4. [前端渲染模块 (static/js/renderers/)](#4-前端渲染模块-staticjsrenderers)
5. [浏览器服务 (services/browser.py)](#5-浏览器服务-servicesbrowserpy)
6. [提示词模块 (prompts/)](#6-提示词模块-prompts)
7. [数据流程图](#7-数据流程图)

---

## 1. 模块概览

MindGraph 的绘图功能由以下核心模块协同完成：

```
绘图相关模块
├── agents/                          # 后端 AI 代理 - 生成图表 JSON 规格
│   ├── core/                        # 基础抽象类
│   ├── main_agent.py                # 主代理入口
│   ├── thinking_maps/               # 思维导图代理 (8种)
│   ├── concept_maps/                # 概念图代理
│   ├── mind_maps/                   # 思维导图代理
│   ├── thinking_tools/              # 思维工具代理 (9种)
│   └── thinking_modes/node_palette/ # 节点调色板生成器
├── static/js/renderers/             # 前端 D3.js 渲染器
├── services/browser.py              # Playwright 浏览器服务 (PNG导出)
└── prompts/                         # LLM 提示词模板
```

### 支持的图表类型

| 类别 | 类型 | 说明 |
|------|------|------|
| **思维导图** | circle_map | 圆圈图 - 定义/头脑风暴 |
| | bubble_map | 气泡图 - 属性描述 |
| | double_bubble_map | 双气泡图 - 比较对比 |
| | tree_map | 树形图 - 分类层次 |
| | flow_map | 流程图 - 顺序步骤 |
| | multi_flow_map | 多流程图 - 因果分析 |
| | brace_map | 括号图 - 整体-部分 |
| | bridge_map | 桥形图 - 类比关系 |
| **概念图** | concept_map | 概念图 - 关系网络 |
| **思维导图** | mindmap / mind_map | 思维导图 - 放射性结构 |
| **思维工具** | factor_analysis | 因素分析 |
| | three_position_analysis | 三方位分析 |
| | perspective_analysis | 视角分析 |
| | goal_analysis | 目标分析 |
| | possibility_analysis | 可能性分析 |
| | result_analysis | 结果分析 |
| | five_w_one_h | 5W1H 分析 |
| | whwm_analysis | WHWM 分析 |
| | four_quadrant | 四象限分析 |

---

## 2. 后端代理模块 (agents/)

### 2.1 核心基类 (agents/core/)

#### base_agent.py - 代理抽象基类

| 方法名 | 类型 | 功能描述 |
|--------|------|----------|
| `__init__(self, model='qwen')` | 构造 | 初始化代理，设置默认模型 |
| `generate_graph(self, user_prompt, language)` | 抽象 | 生成图表规格 (子类必须实现) |
| `validate_output(self, output)` | 方法 | 验证输出格式，返回 (bool, str) |
| `set_language(self, language)` | 方法 | 设置语言 |
| `get_language(self)` | 方法 | 获取当前语言 |

#### agent_utils.py - 代理工具函数

| 函数名 | 功能描述 |
|--------|----------|
| `extract_json_from_response(response_content, allow_partial)` | 从 LLM 响应中提取 JSON |
| `_extract_partial_json(text)` | 提取部分/截断的 JSON |
| `_repair_json_structure(text, error_pos)` | 修复损坏的 JSON 结构 |
| `_remove_js_comments_safely(text)` | 安全移除 JS 注释 |
| `_clean_json_string(text)` | 清理 JSON 字符串 |
| `parse_topic_extraction_result(result, language)` | 解析主题提取结果 |
| `extract_topics_from_prompt(user_prompt)` | 从提示词提取主题 |
| `parse_characteristics_result(result, topic1, topic2)` | 解析特征提取结果 |
| `generate_characteristics_fallback(topic1, topic2)` | 特征提取回退方案 |
| `detect_language(text)` | 检测文本语言 |
| `validate_agent_output(output, expected_type)` | 验证代理输出 |
| `extract_topics_with_agent(user_prompt, language)` | 使用代理提取主题 |
| `generate_characteristics_with_agent(topic1, topic2, language)` | 使用代理生成特征 |

---

### 2.2 思维导图代理 (agents/thinking_maps/)

#### circle_map_agent.py - 圆圈图代理

| 方法名 | 功能描述 |
|--------|----------|
| `__init__(self, model='qwen')` | 初始化圆圈图代理 |
| `generate_graph(self, prompt, language, user_id, organization_id, ...)` | 生成圆圈图规格 |
| `_generate_circle_map_spec(self, prompt, language, ...)` | 调用 LLM 生成规格 |
| `_enhance_spec(self, spec)` | 增强规格 (添加布局、尺寸、元数据) |
| `validate_output(self, spec)` | 验证圆圈图规格 |
| `enhance_spec(self, spec)` | 公开的规格增强方法 |

**输出规格**:
```json
{
  "topic": "中心主题",
  "context": ["上下文1", "上下文2", ...],
  "_layout": { "type": "circle_map", ... },
  "_recommended_dimensions": { "width": 900, "height": 700 },
  "_metadata": { "generated_by": "CircleMapAgent" }
}
```

---

#### bubble_map_agent.py - 气泡图代理

| 方法名 | 功能描述 |
|--------|----------|
| `__init__(self, model='qwen')` | 初始化气泡图代理 |
| `generate_graph(self, prompt, language, ...)` | 生成气泡图规格 |
| `_generate_bubble_map_spec(self, prompt, language, ...)` | 调用 LLM 生成规格 |
| `_enhance_spec(self, spec)` | 增强规格 |
| `validate_output(self, spec)` | 验证气泡图规格 |
| `enhance_spec(self, spec)` | 公开的规格增强方法 |

---

#### flow_map_agent.py - 流程图代理

| 方法名 | 功能描述 |
|--------|----------|
| `__init__(self, model='qwen')` | 初始化流程图代理 |
| `generate_graph(self, prompt, language, ...)` | 生成流程图规格 |
| `_generate_flow_map_spec(self, prompt, language, ...)` | 调用 LLM 生成规格 |
| `validate_output(self, spec)` | 验证流程图规格 |
| `enhance_spec(self, spec)` | 增强规格 (去重、规范化、计算尺寸) |

**常量**:
- `MAX_STEPS = 15` - 最大步骤数
- `MAX_SUBSTEPS_PER_STEP = 8` - 每步最大子步骤数

---

#### tree_map_agent.py - 树形图代理

| 方法名 | 功能描述 |
|--------|----------|
| `__init__(self, model='qwen')` | 初始化树形图代理 |
| `generate_graph(self, prompt, language, dimension_preference, fixed_dimension, ...)` | 生成树形图规格 |
| `_generate_tree_map_spec(self, prompt, language, dimension_preference, fixed_dimension, ...)` | 调用 LLM 生成规格 |
| `validate_output(self, spec)` | 验证树形图规格 |
| `enhance_spec(self, spec)` | 增强规格 (ID 生成、去重、尺寸计算) |

**常量**:
- `MAX_BRANCHES = 10` - 最大分支数
- `MAX_LEAVES_PER_BRANCH = 10` - 每分支最大叶子数

---

#### double_bubble_map_agent.py - 双气泡图代理

| 方法名 | 功能描述 |
|--------|----------|
| `__init__(self, model='qwen')` | 初始化双气泡图代理 |
| `generate_graph(self, prompt, language, ...)` | 生成双气泡图规格 |
| `_generate_double_bubble_map_spec(...)` | 调用 LLM 生成规格 |
| `validate_output(self, spec)` | 验证规格 |
| `enhance_spec(self, spec)` | 增强规格 |

---

#### brace_map_agent.py - 括号图代理

| 方法名 | 功能描述 |
|--------|----------|
| `__init__(self, model='qwen')` | 初始化括号图代理 |
| `generate_graph(self, prompt, language, ...)` | 生成括号图规格 |
| `_generate_brace_map_spec(...)` | 调用 LLM 生成规格 |
| `validate_output(self, spec)` | 验证规格 |
| `enhance_spec(self, spec)` | 增强规格 |

---

#### bridge_map_agent.py - 桥形图代理

| 方法名 | 功能描述 |
|--------|----------|
| `__init__(self, model='qwen')` | 初始化桥形图代理 |
| `generate_graph(self, prompt, language, ...)` | 生成桥形图规格 |
| `_generate_bridge_map_spec(...)` | 调用 LLM 生成规格 |
| `validate_output(self, spec)` | 验证规格 |
| `enhance_spec(self, spec)` | 增强规格 |

---

#### multi_flow_map_agent.py - 多流程图代理

| 方法名 | 功能描述 |
|--------|----------|
| `__init__(self, model='qwen')` | 初始化多流程图代理 |
| `generate_graph(self, prompt, language, ...)` | 生成多流程图规格 |
| `_generate_multi_flow_map_spec(...)` | 调用 LLM 生成规格 |
| `validate_output(self, spec)` | 验证规格 |
| `enhance_spec(self, spec)` | 增强规格 |

---

### 2.3 概念图代理 (agents/concept_maps/)

#### concept_map_agent.py - 概念图代理

| 方法名 | 功能描述 |
|--------|----------|
| `enhance_spec(self, spec)` | 增强概念图规格 |
| `generate_graph(self, user_prompt, language)` | 生成概念图 |
| `generate_simplified_two_stage(self, user_prompt, llm_client, language)` | 两阶段简化生成 |
| `generate_three_stage(self, user_prompt, llm_client, language)` | 三阶段生成 |
| `_extract_simple_topic(self, user_prompt)` | 提取简单主题 |
| `_get_prompt(self, prompt_key, **kwargs)` | 获取提示词 |
| `_get_llm_response(self, llm_client, prompt)` | 获取 LLM 响应 |
| `_parse_json_response(self, response)` | 解析 JSON 响应 |
| `_clean_text(self, text, max_len)` | 清理文本 |
| `_generate_layout_radial(self, topic, concepts, relationships)` | 生成径向布局 |
| `_compute_recommended_dimensions_from_layout(...)` | 计算推荐尺寸 |

---

### 2.4 思维导图代理 (agents/mind_maps/)

#### mind_map_agent.py - 思维导图代理

**核心方法**:

| 方法名 | 功能描述 |
|--------|----------|
| `__init__(self, model='qwen')` | 初始化思维导图代理 |
| `_clear_caches(self)` | 清除缓存 |
| `_get_node_text(self, node, default)` | 获取节点文本 |
| `generate_graph(self, prompt, language, ...)` | 生成思维导图规格 |
| `_generate_mind_map_spec(self, prompt, language, ...)` | 调用 LLM 生成规格 |
| `validate_output(self, spec)` | 验证规格 |
| `validate_layout_geometry(self, layout_data)` | 验证布局几何 |
| `enhance_spec(self, spec)` | 增强规格 |

**布局计算方法**:

| 方法名 | 功能描述 |
|--------|----------|
| `_generate_mind_map_layout(self, topic, children)` | 生成思维导图布局 |
| `_simple_balanced_layout(self, children, ...)` | 简单平衡布局 |
| `_stack_children_vertically(self, branches, column_x, side, num_branches)` | 垂直堆叠子节点 |
| `_balance_side_heights(self, left_positions, right_positions)` | 平衡两侧高度 |
| `_position_branches_at_mathematical_centers(...)` | 数学中心定位分支 |
| `_translate_sides_to_origin(...)` | 平移到原点 |
| `_two_stage_smart_positioning(...)` | 两阶段智能定位 |
| `_stage1_natural_layout(...)` | 第一阶段自然布局 |
| `_assign_children_to_sides_coherently(...)` | 一致性分配子节点到两侧 |
| `_position_children_with_even_spacing(...)` | 均匀间距定位子节点 |
| `_position_branches_at_centers(...)` | 中心定位分支 |

**验证方法**:

| 方法名 | 功能描述 |
|--------|----------|
| `_validate_all_principles(self, positions, children)` | 验证所有原则 |
| `_validate_branch_center_alignment(...)` | 验证分支中心对齐 |
| `_validate_middle_branch_horizontal_alignment(...)` | 验证中间分支水平对齐 |
| `_validate_no_overlaps(self, positions)` | 验证无重叠 |
| `_nodes_overlap(self, pos1, pos2)` | 检测节点重叠 |

**补偿和调整方法**:

| 方法名 | 功能描述 |
|--------|----------|
| `_identify_middle_branches_systematically(self, num_branches)` | 系统识别中间分支 |
| `_stage2_phantom_compensation(...)` | 第二阶段幻影补偿 |
| `_add_phantom_compensation(...)` | 添加幻影补偿 |
| `_calculate_phantom_compensation(...)` | 计算幻影补偿 |
| `_position_balanced_children(...)` | 定位平衡子节点 |
| `_calculate_center_out_branches(...)` | 计算中心向外分支 |
| `_apply_middle_branch_horizontal_alignment(...)` | 应用中间分支水平对齐 |
| `_identify_middle_branches(self, num_branches)` | 识别中间分支 |
| `_adjust_children_positions(...)` | 调整子节点位置 |
| `_fix_intra_branch_overlaps(self, children)` | 修复分支内重叠 |

**连接和尺寸方法**:

| 方法名 | 功能描述 |
|--------|----------|
| `_generate_connections(self, topic, children, positions)` | 生成连接线 |
| `_compute_recommended_dimensions(self, positions, topic, children)` | 计算推荐尺寸 |
| `_get_adaptive_font_size(self, text, node_type)` | 获取自适应字体大小 |
| `_get_adaptive_node_height(self, text, node_type)` | 获取自适应节点高度 |
| `_calculate_text_width(self, text, font_size)` | 计算文本宽度 |
| `_get_capped_node_width(self, text, node_type)` | 获取限制的节点宽度 |
| `_get_adaptive_padding(self, text)` | 获取自适应内边距 |
| `_analyze_branch_content(self, children)` | 分析分支内容 |
| `_calculate_optimal_spacing(self, children, child_heights)` | 计算最优间距 |
| `_get_adaptive_spacing(self, num_children)` | 获取自适应间距 |
| `_calculate_clockwise_branch_y(...)` | 计算顺时针分支 Y 坐标 |

**错误处理方法**:

| 方法名 | 功能描述 |
|--------|----------|
| `_generate_empty_layout(self, topic)` | 生成空布局 |
| `_generate_error_layout(self, topic, error_msg)` | 生成错误布局 |
| `_prevent_overlaps(self, positions)` | 防止重叠 |
| `_get_max_branches(self)` | 获取最大分支数 |

---

### 2.5 思维工具代理 (agents/thinking_tools/)

所有思维工具代理都继承自 `MindMapAgent`，复用其布局逻辑。

| 代理类 | 图表类型 | 方法 |
|--------|----------|------|
| `FactorAnalysisAgent` | 因素分析 | `__init__()`, `get_prompt(language)` |
| `ThreePositionAnalysisAgent` | 三方位分析 | `__init__()`, `get_prompt(language)` |
| `PerspectiveAnalysisAgent` | 视角分析 | `__init__()`, `get_prompt(language)` |
| `GoalAnalysisAgent` | 目标分析 | `__init__()`, `get_prompt(language)` |
| `PossibilityAnalysisAgent` | 可能性分析 | `__init__()`, `get_prompt(language)` |
| `ResultAnalysisAgent` | 结果分析 | `__init__()`, `get_prompt(language)` |
| `FiveWOneHAgent` | 5W1H 分析 | `__init__()`, `get_prompt(language)` |
| `WHWMAnalysisAgent` | WHWM 分析 | `__init__()`, `get_prompt(language)` |
| `FourQuadrantAgent` | 四象限分析 | `__init__()`, `get_prompt(language)` |

---

### 2.6 节点调色板生成器 (agents/thinking_modes/node_palette/)

#### base_palette_generator.py - 基础调色板生成器

| 方法名 | 功能描述 |
|--------|----------|
| `__init__(self)` | 初始化生成器 |
| `generate_batch(self, session_id, center_topic, educational_context, nodes_per_llm, ...)` | 批量生成节点 (5 LLM 并发) |
| `_build_prompt(self, center_topic, context_desc, language, count, batch_num)` | 构建提示词 |
| `_get_system_message(self, educational_context)` | 获取系统消息 |
| `_get_temperature_for_batch(self, batch_num)` | 获取批次温度 |
| `_deduplicate_node(self, new_text, session_id)` | 去重节点 |
| `_normalize_text(self, text)` | 规范化文本 |
| `end_session(self, session_id, reason)` | 结束会话 |

#### 专用调色板生成器

| 生成器类 | 图表类型 | 特殊方法 |
|----------|----------|----------|
| `CircleMapPaletteGenerator` | 圆圈图 | `_build_prompt()`, `_get_system_message()` |
| `BubbleMapPaletteGenerator` | 气泡图 | `_build_prompt()`, `_get_system_message()` |
| `DoubleBubblePaletteGenerator` | 双气泡图 | `_build_prompt()`, `_parse_topics()`, `_build_similarities_prompt()`, `_build_differences_prompt()` |
| `MultiFlowPaletteGenerator` | 多流程图 | `_build_prompt()`, `_build_causes_prompt()`, `_build_effects_prompt()` |
| `TreeMapPaletteGenerator` | 树形图 | `_build_prompt()`, `_build_dimension_prompt()`, `_build_category_prompt()`, `_build_children_prompt()` |
| `FlowMapPaletteGenerator` | 流程图 | `_build_prompt()`, `_build_dimensions_prompt()`, `_build_steps_prompt()`, `_build_substeps_prompt()` |
| `BraceMapPaletteGenerator` | 括号图 | `_build_prompt()`, `_build_dimensions_prompt()`, `_build_parts_prompt()`, `_build_subparts_prompt()` |
| `BridgeMapPaletteGenerator` | 桥形图 | `_build_prompt()` |
| `MindMapPaletteGenerator` | 思维导图 | `_build_prompt()`, `_build_branches_prompt()`, `_build_children_prompt()` |

**工厂函数**:

| 函数名 | 返回类型 |
|--------|----------|
| `get_circle_map_palette_generator()` | `CircleMapPaletteGenerator` |
| `get_bubble_map_palette_generator()` | `BubbleMapPaletteGenerator` |
| `get_double_bubble_palette_generator()` | `DoubleBubblePaletteGenerator` |
| `get_multi_flow_palette_generator()` | `MultiFlowPaletteGenerator` |
| `get_tree_map_palette_generator()` | `TreeMapPaletteGenerator` |
| `get_flow_map_palette_generator()` | `FlowMapPaletteGenerator` |
| `get_brace_map_palette_generator()` | `BraceMapPaletteGenerator` |
| `get_bridge_map_palette_generator()` | `BridgeMapPaletteGenerator` |
| `get_mindmap_palette_generator()` | `MindMapPaletteGenerator` |

---

## 3. 主代理模块 (agents/main_agent.py)

**功能**: 图表生成的核心入口，负责类型检测和代理调度

### 核心函数

| 函数名 | 功能描述 |
|--------|----------|
| `create_error_response(error_message, error_code)` | 创建标准化错误响应 |
| `validate_inputs(user_prompt, language)` | 验证输入参数 |
| `extract_central_topic_llm(prompt)` | LLM 提取中心主题 |
| `extract_double_bubble_topics_llm(prompt)` | LLM 提取双气泡主题 |
| `extract_topics_and_styles_from_prompt_qwen(prompt)` | 提取主题和样式 |

### JSON 处理函数

| 函数名 | 功能描述 |
|--------|----------|
| `_salvage_json_string(text)` | 从混乱 LLM 输出中抢救 JSON |
| `_salvage_truncated_json(text)` | 修复截断的 JSON |
| `_parse_strict_json(text)` | 严格 JSON 解析 |
| `extract_yaml_from_code_block(text)` | 从代码块提取 YAML |

### 图表生成函数

| 函数名 | 功能描述 |
|--------|----------|
| `generate_graph_spec(graph_type, prompt, llm, language)` | 使用 LLM 生成图表规格 |
| `_detect_diagram_type_from_prompt(prompt, llm)` | LLM 检测图表类型 |
| `_invoke_llm_prompt(llm, template, variables)` | 调用 LLM 提示模板 |

### 概念图生成函数

| 函数名 | 功能描述 |
|--------|----------|
| `generate_concept_map_two_stage(...)` | 两阶段概念图生成 |
| `generate_concept_map_unified(...)` | 统一概念图生成 |
| `generate_concept_map_enhanced_30(...)` | 增强 30 节点概念图 |
| `generate_concept_map_robust(...)` | 健壮概念图生成 |

### 学习单处理函数

| 函数名 | 功能描述 |
|--------|----------|
| `_detect_learning_sheet_from_prompt(prompt)` | 检测学习单请求 |
| `_clean_prompt_for_learning_sheet(prompt)` | 清理学习单提示词 |

### 主工作流函数

| 函数名 | 功能描述 |
|--------|----------|
| `_generate_spec_with_agent(diagram_type, prompt, language, model_id)` | 调度到专用代理 |
| `agent_graph_workflow_with_styles(prompt, style, language, model_id)` | **主工作流入口** |

### 类

| 类名 | 功能描述 |
|------|----------|
| `LLMTimingStats` | 线程安全的 LLM 调用统计 |
| `QwenLLM` | 向后兼容的同步 LLM 包装器 |
| `MainAgent` | 提供 BaseAgent 接口的包装类 |

---

## 4. 前端渲染模块 (static/js/renderers/)

### 4.1 渲染调度器 (renderer-dispatcher.js)

| 函数名 | 功能描述 |
|--------|----------|
| `renderGraph(type, spec, theme, dimensions)` | 主渲染调度函数 |
| `showRendererError(type, message)` | 显示渲染错误 |

### 4.2 共享工具 (shared-utilities.js)

**测量工具**:

| 函数名 | 功能描述 |
|--------|----------|
| `getMeasurementContainer()` | 获取测量容器 |
| `getTextRadius(text, fontSize, padding)` | 计算文本半径 |
| `cleanupMeasurementContainer()` | 清理测量容器 |

**水印工具**:

| 函数名 | 功能描述 |
|--------|----------|
| `getWatermarkText(theme)` | 获取水印文本 (学校名称) |
| `addWatermark(svg, theme)` | 添加水印到 SVG |

**颜色和样式**:

| 函数名 | 功能描述 |
|--------|----------|
| `getColorScale(theme, itemCount)` | 获取颜色比例尺 |
| `getThemeDefaults(theme)` | 获取主题默认值 |

**SVG 工具**:

| 函数名 | 功能描述 |
|--------|----------|
| `createSVG(containerId, dimensions)` | 创建 SVG 元素 |
| `centerContent(svg, contentGroup, dimensions)` | 居中内容 |

**文本处理**:

| 函数名 | 功能描述 |
|--------|----------|
| `wrapText(text, width)` | 文本换行 |
| `renderMultiLineText(svg, lines, x, startY, lineHeight, attrs)` | 渲染多行文本 |
| `splitAndWrapText(text, fontSize, maxWidth, measureFn)` | 分割并换行文本 |
| `splitTextLines(text)` | 按换行符分割文本 |
| `extractTextFromSVG(textElement)` | 从 SVG 提取文本 |

**学习单工具**:

| 函数名 | 功能描述 |
|--------|----------|
| `knockoutTextForLearningSheet(svg, hiddenPercentage)` | 隐藏随机文本 (学习单模式) |

### 4.3 专用渲染器

| 渲染器文件 | 主函数 | 图表类型 |
|------------|--------|----------|
| `bubble-map-renderer.js` | `renderBubbleMap()` | 气泡图 |
| | `renderCircleMap()` | 圆圈图 |
| | `renderDoubleBubbleMap()` | 双气泡图 |
| | `recalculateTightViewBox()` | 重新计算视图框 |
| `tree-renderer.js` | `renderTreeMap()` | 树形图 |
| | `recalculateTightViewBox()` | 重新计算视图框 |
| `flow-renderer.js` | `renderFlowchart()` | 流程图 |
| | `renderFlowMap()` | 流程图 (别名) |
| | `renderBridgeMap()` | 桥形图 |
| | `renderMultiFlowMap()` | 多流程图 |
| `brace-renderer.js` | `renderBraceMap()` | 括号图 |
| | `recalculateTightViewBoxBrace()` | 重新计算视图框 |
| `mind-map-renderer.js` | `renderMindMap()` | 思维导图 |
| | `createMeasureLineWidth()` | 创建行宽测量器 |
| | `getCircleEdgePoint()` | 获取圆边缘点 |
| | `getRectangleEdgePoint()` | 获取矩形边缘点 |
| | `renderMindMapWithLayout()` | 使用布局渲染 |
| | `isAdditionalAspectNode()` | 检测附加方面节点 |
| | `isAdditionalAspectConnection()` | 检测附加方面连接 |
| `concept-map-renderer.js` | `renderConceptMap()` | 概念图 |
| | `renderConceptMapWithForceLayout()` | 力导向布局渲染 |

### 4.4 思维工具渲染器

| 渲染器文件 | 主函数 | 图表类型 |
|------------|--------|----------|
| `factor-analysis-renderer.js` | `renderFactorAnalysis()` | 因素分析 |
| `three-position-analysis-renderer.js` | `renderThreePositionAnalysis()` | 三方位分析 |
| `perspective-analysis-renderer.js` | `renderPerspectiveAnalysis()` | 视角分析 |
| `goal-analysis-renderer.js` | `renderGoalAnalysis()` | 目标分析 |
| `possibility-analysis-renderer.js` | `renderPossibilityAnalysis()` | 可能性分析 |
| `result-analysis-renderer.js` | `renderResultAnalysis()` | 结果分析 |
| `five-w-one-h-renderer.js` | `renderFiveWOneH()` | 5W1H 分析 |
| `whwm-analysis-renderer.js` | `renderWHWMAnalysis()` | WHWM 分析 |
| `four-quadrant-renderer.js` | `renderFourQuadrant()` | 四象限分析 |

---

## 5. 浏览器服务 (services/browser.py)

**功能**: Playwright 浏览器管理，用于 PNG 导出

### 工具函数

| 函数名 | 功能描述 |
|--------|----------|
| `_get_chromium_version(executable_path)` | 获取 Chromium 版本号 |
| `_compare_versions(version1, version2)` | 比较版本号 |
| `_get_playwright_chromium_executable()` | 获取 Playwright 管理的 Chromium 路径 |
| `_get_local_chromium_executable()` | 获取本地 Chromium 路径 |
| `_get_best_chromium_executable()` | 选择最佳 Chromium (优先较新版本) |

### BrowserContextManager 类

| 方法名 | 功能描述 |
|--------|----------|
| `__init__(self)` | 初始化上下文管理器 |
| `__aenter__(self)` | 异步进入：创建新浏览器实例 |
| `__aexit__(self, exc_type, exc_val, exc_tb)` | 异步退出：清理浏览器资源 |

**浏览器配置**:
- Headless 模式
- 3x 设备像素比 (Retina 质量)
- 视口: 1200x800
- 安全参数: `--no-sandbox`, `--disable-dev-shm-usage`

---

## 6. 提示词模块 (prompts/)

### 6.1 模块结构

| 文件/目录 | 功能 |
|-----------|------|
| `__init__.py` | 统一注册中心 |
| `thinking_maps.py` | 思维导图提示词 |
| `concept_maps.py` | 概念图提示词 |
| `mind_maps.py` | 思维导图提示词 |
| `thinking_tools.py` | 思维工具提示词 |
| `main_agent.py` | 主代理提示词 |
| `voice_agent.py` | 语音代理提示词 |
| `tab_mode/` | Tab 模式提示词 |

### 6.2 核心函数

| 函数名 | 功能描述 |
|--------|----------|
| `get_prompt(diagram_type, language, prompt_type)` | 获取指定类型和语言的提示词 |
| `get_available_diagram_types()` | 获取所有支持的图表类型 |
| `get_prompt_metadata(diagram_type)` | 获取图表类型的提示词元数据 |

### 6.3 提示词命名规范

```
{diagram_type}_{prompt_type}_{language}

示例:
- circle_map_generation_zh
- bubble_map_agent_generation_en
- concept_map_extraction_zh
```

---

## 7. 数据流程图

### 7.1 图表生成流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户输入 (Prompt)                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    POST /generate_graph                          │
│                      (routers/api.py)                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              agent_graph_workflow_with_styles()                  │
│                   (agents/main_agent.py)                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
     ┌──────────────────────┐    ┌──────────────────────┐
     │ 类型检测 (Qwen-Turbo) │    │ 学习单检测            │
     │ _detect_diagram_type │    │ _detect_learning_sheet│
     └──────────────────────┘    └──────────────────────┘
                    │                       │
                    └───────────┬───────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  _generate_spec_with_agent()                     │
│                      代理调度分发                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│ 思维导图代理   │      │ 概念图代理     │      │ 思维工具代理   │
│ CircleMapAgent│      │ConceptMapAgent│      │FactorAnalysis │
│ BubbleMapAgent│      │               │      │ FiveWOneH     │
│ FlowMapAgent  │      │               │      │ FourQuadrant  │
│ TreeMapAgent  │      │               │      │ ...           │
│ ...           │      │               │      │               │
└───────────────┘      └───────────────┘      └───────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     LLM 服务调用                                  │
│                  (services/llm_service.py)                       │
│       Qwen-Plus / DeepSeek / Kimi / Hunyuan / Doubao            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     JSON 规格解析与验证                           │
│              extract_json_from_response()                        │
│              validate_output()                                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     规格增强                                      │
│              enhance_spec()                                      │
│         添加布局、尺寸、元数据                                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     返回 JSON 规格                                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     前端 D3.js 渲染                               │
│              renderer-dispatcher.js                              │
│              → 专用渲染器                                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SVG 图表展示                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 PNG 导出流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        JSON 规格                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    POST /export_png                              │
│                      (routers/api.py)                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                 BrowserContextManager                            │
│                   (services/browser.py)                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    创建新浏览器实例                               │
│                 Playwright + Chromium                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    加载渲染模板 HTML                              │
│                    注入 JSON 数据                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    D3.js 渲染                                    │
│                    等待渲染完成                                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    截图 (3x 分辨率)                               │
│                    Retina 质量                                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    返回 PNG Base64                               │
└─────────────────────────────────────────────────────────────────┘
```

---

*文档生成时间: 2025年12月18日*

