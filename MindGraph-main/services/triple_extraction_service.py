"""
Triple Extraction Service
==========================

Service for extracting triples (concept-relation-concept) from introduction text.
Based on concept-map-new-master/llm/llm-manager.js

@author MindGraph Team
"""

import logging
import re
from typing import Dict, List, Optional, Tuple

from services.llm_service import llm_service

logger = logging.getLogger(__name__)


class TripleExtractionService:
    """
    Service for extracting triples from introduction text.
    
    Triple format: (concept1, relation, concept2, layer_relation)
    Layer relations: L1-L2, L2-L3, L3-L4, L4-L5, etc.
    """
    
    def __init__(self):
        self.llm_service = llm_service
        logger.info("[TripleExtractionService] Initialized")
    
    async def extract_triples(
        self,
        intro_text: str,
        language: str = 'zh',
        stream: bool = False
    ) -> Dict[str, any]:
        """
        Extract triples from introduction text.
        
        Args:
            intro_text: Introduction text
            language: Language ('zh' or 'en')
            stream: Whether to stream the response
            
        Returns:
            Dict with 'success', 'triples', 'message' keys
        """
        logger.info(f"[TripleExtractionService] Extracting triples, text length: {len(intro_text)}")
        
        if not intro_text or len(intro_text.strip()) == 0:
            return {
                'success': False,
                'error': 'Empty introduction text',
                'message': '介绍文本不能为空'
            }
        
        try:
            # Build prompt
            prompt = self._build_triple_prompt(intro_text, language)
            
            if stream:
                # Stream response
                full_response = ""
                async for chunk in self.llm_service.chat_stream(
                    prompt=prompt,
                    model='qwen-plus',
                    temperature=0.3,
                    max_tokens=2000
                ):
                    if chunk:
                        full_response += chunk
                
                # Parse triples from response
                triples = self._parse_triples_from_response(full_response)
            else:
                # Non-stream response
                response = await self.llm_service.chat(
                    prompt=prompt,
                    model='qwen-plus',
                    temperature=0.3,
                    max_tokens=2000
                )
                
                if not response:
                    return {
                        'success': False,
                        'error': 'No response from LLM',
                        'message': '三元组提取失败'
                    }
                
                # Parse triples from response
                triples = self._parse_triples_from_response(response)
            
            if len(triples) == 0:
                logger.warn("[TripleExtractionService] No triples extracted from response")
                return {
                    'success': False,
                    'error': 'No triples extracted',
                    'message': '未能从AI响应中解析到任何三元组',
                    'raw_response': full_response if stream else response
                }
            
            logger.info(f"[TripleExtractionService] Successfully extracted {len(triples)} triples")
            return {
                'success': True,
                'triples': triples,
                'message': f'成功从文本中提取 {len(triples)} 个三元组',
                'raw_response': full_response if stream else response
            }
            
        except Exception as e:
            logger.error(f"[TripleExtractionService] Extraction failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'message': '三元组提取失败'
            }
    
    def _build_triple_prompt(self, intro_text: str, language: str) -> str:
        """Build prompt for triple extraction."""
        if language == 'zh':
            return f"""# 重要任务：从文本中提取概念关系，构建分层知识图谱

## ⚠️ 核心规则（必须严格遵守）：
- **🔴🔴🔴 最重要：严格按文本提取，禁止自行生成新内容**
  - **所有概念和关系词必须完全来源于提供的文本**
  - **绝对禁止自行创造、补充或生成文本中不存在的概念、节点或关系**
  - **如果文本中没有足够的内容，只能提取文本中实际存在的部分，不能自行添加**
  - **所有三元组中的概念词必须能在文本中找到对应的表述或直接引用**
- **为每个概念添加层级标记（L1、L2、L3、L4、L5等，根据内容自然确定层数）**
- **只能从高层到低层提取三元组**（L1→L2、L2→L3、L3→L4、L4→L5等，单向流动，必须相邻层）
- **允许同层提取**（L2→L2、L3→L3、L4→L4等同层连接，使用圆弧连接）
- **严格禁止反向提取**（绝对不能从低层到高层，如L2→L1、L3→L2、L4→L3等）
- **严格禁止跨层提取**（绝对不能从L1直接连接到L3或L4，必须逐层连接）
- **总三元组数：20-28个（建议范围，如果文本内容不足，以实际可提取的数量为准）**
- **节点文字长度限制：每个节点的文字长度必须不超过12个字**

## 层级划分方法（可根据内容扩展）：
1. **L1（第一层）**：核心主题概念（通常1个节点）
2. **L2（第二层）**：主要分类或维度
3. **L3（第三层）**：具体分类或子维度
4. **L4（第四层）**：具体细节或实例
5. **L5、L6等（更深层）**：根据内容需要，可以继续细分

## 输出格式（严格遵守）：
每行一个三元组，格式为：(概念1, 关系词, 概念2, 层级关系)

层级关系标记（只允许从高到低的相邻层）：
- L1-L2: 第一层到第二层的关系（✅ 允许）
- L2-L3: 第二层到第三层的关系（✅ 允许）
- L3-L4: 第三层到第四层的关系（✅ 允许）
- L4-L5: 第四层到第五层的关系（✅ 允许，如果存在）
- ❌ 禁止反向连接（如L2-L1、L3-L2、L4-L3、L5-L4等，从低到高）
- ❌ 禁止跨层连接（如L1-L3、L1-L4、L2-L4、L2-L5等，必须逐层连接）
- ✅ 允许同层连接（如L2-L2、L3-L3、L4-L4等，使用圆弧连接）

## 关系词选择（⭐ 关键：必须准确反映两个节点之间的具体关系）：
**关系词要简洁（2-4字），不含助词（如"的"、"了"等），但能让"概念1 + 关系词 + 概念2"连读成通顺且语义准确的话**

推荐关系词类型：
- 包含/组成关系：包括、包含、涵盖、含有、构成、组成、分为
- 因果关系：导致、引发、造成、产生、引起、促使、推动、促进
- 时间/顺序关系：先于、后于、始于、终于、经过、经历
- 功能/用途关系：用于、应用于、服务于、实现、支持、提供
- 依赖/基础关系：需要、基于、依赖、借助、通过、依靠
- 属性/特征关系：具有、表现为、特征是、特点是
- 影响/作用关系：影响、作用于、改变、改善、提升
- 归属/分类关系：属于、归类为、划分为、分类为

## 文本内容：
{intro_text}

## 最终检查清单：
✓ **🔴🔴🔴 最重要：所有概念和关系词都严格来源于提供的文本，没有自行生成或创造任何新内容**
✓ 为每个概念明确标注层级（L1、L2、L3、L4），且同一个概念在整个三元组列表中必须始终使用相同的层级标记
✓ **只能从高层到低层提取**（L1→L2、L2→L3、L3→L4）
✓ **允许同层连接**（L2-L2、L3-L3、L4-L4等）
✓ 绝对禁止跨层提取（L1-L3、L1-L4、L2-L4等）
✓ **绝对禁止反向提取**（L2→L1、L3→L2、L4→L3等）
✓ **🔴🔴🔴 节点文字长度检查（关键）：每个节点的文字长度不超过12个字，已进行浓缩提取**
✓ 关系词准确，不使用"是"、"有"
✓ 层级关系标记正确（L1-L2、L2-L3、L3-L4等）
✓ **层级完整性：每一层都有至少1个节点**
✓ **⭐ 相邻层连接数量要求（最关键）：**
  - **L1→L2 之间必须有至少 4 个三元组**
  - **L2→L3 之间必须有至少 6 个三元组**
  - **L3→L4 之间必须有至少 6 个三元组**
✓ **🚫🚫🚫 绝对禁止孤立节点：每个节点都必须至少有一条连接线（作为源节点或目标节点）**

请开始输出三元组（记住：**严格按文本提取，禁止自行生成**，只能从高层到低层提取或同层提取，允许同层连接，绝对禁止反向和跨层提取）："""
        else:
            return f"""# Important Task: Extract concept relationships from text to build hierarchical knowledge graph

## ⚠️ Core Rules (Must Strictly Follow):
- **🔴🔴🔴 Most Important: Extract strictly from text, prohibit generating new content**
  - **All concepts and relation words must completely come from the provided text**
  - **Absolutely prohibit creating, supplementing, or generating concepts, nodes, or relations that don't exist in the text**
  - **If there isn't enough content in the text, only extract what actually exists, cannot add on your own**
- **Add layer markers for each concept (L1, L2, L3, L4, L5, etc., determine layers naturally based on content)**
- **Can only extract triples from high to low layers** (L1→L2, L2→L3, L3→L4, L4→L5, etc., unidirectional flow, must be adjacent layers)
- **Allow same-layer extraction** (L2→L2, L3→L3, L4→L4 same-layer connections, use arc connections)
- **Strictly prohibit reverse extraction** (absolutely cannot go from low to high, e.g., L2→L1, L3→L2, L4→L3, etc.)
- **Strictly prohibit cross-layer extraction** (absolutely cannot connect L1 directly to L3 or L4, must connect layer by layer)
- **Total triples: 20-28 (suggested range, if text content is insufficient, use actual extractable quantity)**
- **Node text length limit: Each node's text length must not exceed 12 characters**

## Output Format (Strictly Follow):
One triple per line, format: (concept1, relation_word, concept2, layer_relation)

Layer relation markers (only allow high to low adjacent layers):
- L1-L2: Relation from first layer to second layer (✅ allowed)
- L2-L3: Relation from second layer to third layer (✅ allowed)
- L3-L4: Relation from third layer to fourth layer (✅ allowed)
- L4-L5: Relation from fourth layer to fifth layer (✅ allowed, if exists)
- ❌ Prohibit reverse connections (e.g., L2-L1, L3-L2, L4-L3, L5-L4, etc., low to high)
- ❌ Prohibit cross-layer connections (e.g., L1-L3, L1-L4, L2-L4, L2-L5, etc., must connect layer by layer)
- ✅ Allow same-layer connections (e.g., L2-L2, L3-L3, L4-L4, etc., use arc connections)

## Text Content:
{intro_text}

Please start outputting triples (remember: **extract strictly from text, prohibit generating**, can only extract from high to low layers or same-layer, allow same-layer connections, absolutely prohibit reverse and cross-layer extraction):"""
    
    def _parse_triples_from_response(self, response: str) -> List[Tuple[str, str, str, str]]:
        """
        Parse triples from LLM response.
        
        Format: (概念1, 关系词, 概念2, 层级关系)
        Example: (辛亥革命, 旨在, 推翻清朝, L1-L2)
        
        Returns:
            List of tuples: [(concept1, relation, concept2, layer_relation), ...]
        """
        triples = []
        
        # Split by lines
        lines = response.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Try to match pattern: (concept1, relation, concept2, layer)
            # Pattern: (xxx, xxx, xxx, Lx-Lx)
            pattern = r'\(([^,]+),\s*([^,]+),\s*([^,]+),\s*(L\d+-L\d+)\)'
            match = re.search(pattern, line)
            
            if match:
                concept1 = match.group(1).strip()
                relation = match.group(2).strip()
                concept2 = match.group(3).strip()
                layer_relation = match.group(4).strip()
                
                # Validate
                if concept1 and concept2 and relation and layer_relation:
                    triples.append((concept1, relation, concept2, layer_relation))
            else:
                # Try alternative format without parentheses
                # Format: concept1, relation, concept2, layer
                parts = [p.strip() for p in line.split(',')]
                if len(parts) >= 4:
                    concept1 = parts[0]
                    relation = parts[1]
                    concept2 = parts[2]
                    layer_relation = parts[3]
                    
                    # Validate layer format
                    if re.match(r'L\d+-L\d+', layer_relation):
                        triples.append((concept1, relation, concept2, layer_relation))
        
        return triples
    
    def convert_triples_to_concept_map_data(
        self,
        triples: List[Tuple[str, str, str, str]],
        focus_question: Optional[str] = None
    ) -> Dict[str, any]:
        """
        Convert triples to concept map data format.
        
        Args:
            triples: List of (concept1, relation, concept2, layer_relation) tuples
            focus_question: Optional focus question (used as central topic)
            
        Returns:
            Concept map data dict with 'topic', 'concepts', 'relationships'
        """
        if not triples:
            return {
                'topic': focus_question or 'Unknown Topic',
                'concepts': [],
                'relationships': []
            }
        
        # Extract all unique concepts
        concepts_set = set()
        for concept1, _, concept2, _ in triples:
            concepts_set.add(concept1)
            concepts_set.add(concept2)
        
        concepts = list(concepts_set)
        
        # Determine central topic
        if focus_question:
            topic = focus_question
        else:
            # Try to find L1 concept
            l1_concepts = []
            for concept1, _, concept2, layer in triples:
                if layer.startswith('L1-'):
                    l1_concepts.append(concept1)
            topic = l1_concepts[0] if l1_concepts else concepts[0] if concepts else 'Unknown Topic'
        
        # Convert triples to relationships
        relationships = []
        for concept1, relation, concept2, layer in triples:
            relationships.append({
                'from': concept1,
                'to': concept2,
                'label': relation
            })
        
        return {
            'topic': topic,
            'concepts': concepts,
            'relationships': relationships
        }


# Global instance
triple_extraction_service = TripleExtractionService()


