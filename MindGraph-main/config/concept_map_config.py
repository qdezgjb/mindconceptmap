"""
Concept Map Configuration
=========================

概念图独有的配置参数，与其他图示类型区分。
这些参数控制概念图的生成策略、布局算法和渲染行为。

Author: MindGraph Team
"""

# ============================================================================
# 生成策略配置
# ============================================================================

# 默认生成方法
# 可选值: 'auto', 'unified', 'two_stage', 'three_stage', 'network_first'
DEFAULT_GENERATION_METHOD = 'three_stage'

# 各方法说明:
# - auto: 自动选择最佳方法
# - unified: 单次生成所有内容（简单主题）
# - two_stage: 先生成关键概念，再生成子概念（中等复杂度）
# - three_stage: 主题提取 → 30概念 → 关系（复杂主题，推荐）
# - network_first: 先生成概念网络，再补充关系（强调概念覆盖）

# ============================================================================
# LLM 调用参数
# ============================================================================

# 概念图专用的 max_tokens（比其他图示更高）
CONCEPT_MAP_MAX_TOKENS = 4000

# 概念图专用的超时时间（秒）
CONCEPT_MAP_TIMEOUT = 60

# 温度参数（控制输出随机性）
CONCEPT_MAP_TEMPERATURE = 0.3

# 是否使用 system_message（概念图通常嵌入到 prompt 中）
USE_SYSTEM_MESSAGE = False

# ============================================================================
# 概念限制
# ============================================================================

# 最大概念数量
MAX_CONCEPTS = 30

# 最大标签长度（字符数）
MAX_LABEL_LEN = 60

# 关键概念数量范围
MIN_KEYS = 4
MAX_KEYS = 8

# 每个关键概念的子概念数量范围
MIN_PARTS_PER_KEY = 3
MAX_PARTS_PER_KEY = 7

# ============================================================================
# 布局参数 (Sugiyama 算法)
# ============================================================================

# 节点间距系数
NODE_SPACING = 1.2

# 画布边距（像素）
CANVAS_PADDING = 80

# 最小节点距离（像素）
MIN_NODE_DISTANCE = 120

# 层间距离（像素）
LAYER_SPACING = 150

# 同层节点间距（像素）
SAME_LAYER_SPACING = 100

# ============================================================================
# 力导向布局参数（备用）
# ============================================================================

# 内圈半径比例
INNER_RADIUS = 0.25

# 最小半径比例
MIN_RADIUS = 0.45

# 最大半径比例
MAX_RADIUS = 0.95

# 间隙系数
GAP_FACTOR = 0.9

# 目标半径比例
TARGET_RADIUS = 0.75

# 排斥力系数
REPULSION_FORCE = 0.025

# 弹簧力系数
SPRING_FORCE = 0.03

# 步长
STEP_SIZE = 0.15

# 迭代次数
ITERATIONS = 200

# ============================================================================
# 连接处理
# ============================================================================

# 启用聚合连接
ENABLE_AGGREGATION = True

# 聚合连接最小数量（相同源+相同标签）
MIN_AGGREGATION_COUNT = 2

# 启用关系去重
ENABLE_RELATIONSHIP_DEDUP = True

# 启用自环检测
ENABLE_SELF_LOOP_DETECTION = True

# ============================================================================
# 焦点问题配置
# ============================================================================

# 启用焦点问题工作流
ENABLE_FOCUS_QUESTION = True

# 焦点问题最大长度（字符）
FOCUS_QUESTION_MAX_LEN = 50

# 焦点问题框内边距（像素）
FOCUS_QUESTION_PADDING = 120

# 焦点问题框最小宽度（像素）
FOCUS_QUESTION_MIN_WIDTH = 320

# 焦点问题字符宽度估算系数
FOCUS_QUESTION_CHAR_WIDTH = 0.70

# ============================================================================
# 渲染配置
# ============================================================================

# 布局算法
# 可选值: 'sugiyama', 'force_directed', 'hierarchical'
LAYOUT_ALGORITHM = 'sugiyama'

# 连线断开间隙系数
LINK_GAP_FACTOR = 0.6

# 连线标签字体大小
LINK_LABEL_FONT_SIZE = 12

# 节点标签字体大小
NODE_LABEL_FONT_SIZE = 14

# 焦点问题字体大小
FOCUS_QUESTION_FONT_SIZE = 18

# ============================================================================
# 导出配置字典（供其他模块使用）
# ============================================================================

CONCEPT_MAP_CONFIG = {
    # 生成策略
    'generation_method': DEFAULT_GENERATION_METHOD,
    'max_tokens': CONCEPT_MAP_MAX_TOKENS,
    'timeout': CONCEPT_MAP_TIMEOUT,
    'temperature': CONCEPT_MAP_TEMPERATURE,
    'use_system_message': USE_SYSTEM_MESSAGE,
    
    # 概念限制
    'max_concepts': MAX_CONCEPTS,
    'max_label_len': MAX_LABEL_LEN,
    'min_keys': MIN_KEYS,
    'max_keys': MAX_KEYS,
    'min_parts_per_key': MIN_PARTS_PER_KEY,
    'max_parts_per_key': MAX_PARTS_PER_KEY,
    
    # 布局参数
    'node_spacing': NODE_SPACING,
    'canvas_padding': CANVAS_PADDING,
    'min_node_distance': MIN_NODE_DISTANCE,
    'layer_spacing': LAYER_SPACING,
    'same_layer_spacing': SAME_LAYER_SPACING,
    'layout_algorithm': LAYOUT_ALGORITHM,
    
    # 连接处理
    'enable_aggregation': ENABLE_AGGREGATION,
    'min_aggregation_count': MIN_AGGREGATION_COUNT,
    'enable_relationship_dedup': ENABLE_RELATIONSHIP_DEDUP,
    'enable_self_loop_detection': ENABLE_SELF_LOOP_DETECTION,
    
    # 焦点问题
    'enable_focus_question': ENABLE_FOCUS_QUESTION,
    'focus_question_max_len': FOCUS_QUESTION_MAX_LEN,
    'focus_question_padding': FOCUS_QUESTION_PADDING,
    'focus_question_min_width': FOCUS_QUESTION_MIN_WIDTH,
    'focus_question_char_width': FOCUS_QUESTION_CHAR_WIDTH,
    
    # 渲染
    'link_gap_factor': LINK_GAP_FACTOR,
    'link_label_font_size': LINK_LABEL_FONT_SIZE,
    'node_label_font_size': NODE_LABEL_FONT_SIZE,
    'focus_question_font_size': FOCUS_QUESTION_FONT_SIZE,
}


def get_config(key: str, default=None):
    """
    获取配置值
    
    Args:
        key: 配置键名
        default: 默认值
        
    Returns:
        配置值或默认值
    """
    return CONCEPT_MAP_CONFIG.get(key, default)


def update_config(updates: dict):
    """
    批量更新配置
    
    Args:
        updates: 要更新的配置字典
    """
    CONCEPT_MAP_CONFIG.update(updates)

