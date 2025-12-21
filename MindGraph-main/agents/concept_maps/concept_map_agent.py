"""
Concept Map Agent

Enhances concept map specifications by:
- Normalizing and deduplicating concepts
- Ensuring relationships reference existing concepts and deduplicating unordered pairs
- Cleaning labels
- Generating layout hints (rings, clusters, angle hints)
- Computing evenly-spread node positions with a lightweight force routine
- Providing recommended dimensions sized to fit all content
"""

from typing import Dict, List, Set, Any, Tuple, Optional
import logging
from ..core.base_agent import BaseAgent

logger = logging.getLogger(__name__)

# Import configuration
try:
    from concept_map_config import *
except ImportError:
    # Default values if config file not found
    NODE_SPACING = 1.2
    CANVAS_PADDING = 80
    MIN_NODE_DISTANCE = 120
    INNER_RADIUS = 0.25
    MIN_RADIUS = 0.45
    MAX_RADIUS = 0.95
    GAP_FACTOR = 0.9
    TARGET_RADIUS = 0.75
    REPULSION_FORCE = 0.025
    SPRING_FORCE = 0.03
    STEP_SIZE = 0.15
    ITERATIONS = 200


class ConceptMapAgent(BaseAgent):
    """Agent to enhance and sanitize concept map specifications."""
    
    def __init__(self, model='qwen'):
        super().__init__(model=model)
        self.diagram_type = "concept_map"

    MAX_CONCEPTS: int = 30
    MAX_LABEL_LEN: int = 60
    
    def validate_output(self, spec: Dict) -> Tuple[bool, str]:
        """Validate a concept map specification."""
        try:
            if not isinstance(spec, dict):
                return False, "Spec must be a dictionary"
            
            topic = spec.get("topic")
            concepts = spec.get("concepts")
            relationships = spec.get("relationships", [])
            
            if not topic or not isinstance(topic, str):
                return False, "Missing or invalid topic"
            if not concepts or not isinstance(concepts, list):
                return False, "Missing or invalid concepts list"
            if not isinstance(relationships, list):
                return False, "Relationships must be a list"
            
            # Check that relationships reference valid concepts
            all_concepts = [topic] + concepts
            for rel in relationships:
                if not isinstance(rel, dict):
                    return False, "Relationship must be a dictionary"
                if 'from' not in rel or 'to' not in rel:
                    return False, "Relationship must have 'from' and 'to' fields"
                if rel['from'] not in all_concepts or rel['to'] not in all_concepts:
                    return False, f"Relationship references invalid concept: {rel.get('from')} -> {rel.get('to')}"
            
            return True, ""
        except Exception as e:
            return False, f"Validation error: {str(e)}"

    async def enhance_spec(self, spec: Dict) -> Dict:
        try:
            if not isinstance(spec, dict):
                return {"success": False, "error": "Spec must be a dictionary"}

            topic = spec.get("topic")
            concepts = spec.get("concepts") or []
            relationships = spec.get("relationships") or []

            if not isinstance(topic, str) or not topic.strip():
                return {"success": False, "error": "Invalid or missing 'topic'"}
            if not isinstance(concepts, list) or not isinstance(relationships, list):
                return {"success": False, "error": "'concepts' and 'relationships' must be lists"}

            normalized_topic = self._clean_text(topic, self.MAX_LABEL_LEN)

            def canonical(label: str) -> str:
                # Canonical form for matching: lowercase + remove all whitespace
                if not isinstance(label, str):
                    return ""
                import re
                s = label.lower()
                s = re.sub(r"\s+", "", s)
                return s

            # Normalize and dedupe concepts
            normalized_concepts: List[str] = []
            seen: Set[str] = set()
            canon_to_display: Dict[str, str] = {}
            for c in concepts:
                if not isinstance(c, str):
                    continue
                cleaned = self._clean_text(c, self.MAX_LABEL_LEN)
                canon = canonical(cleaned)
                if cleaned and canon not in seen and cleaned != normalized_topic:
                    normalized_concepts.append(cleaned)
                    seen.add(canon)
                    canon_to_display[canon] = cleaned
                if len(normalized_concepts) >= self.MAX_CONCEPTS:
                    break

            concept_set: Set[str] = set(normalized_concepts)

            # Sanitize relationships and enforce single edge between unordered pair
            sanitized_relationships: List[Dict[str, str]] = []
            missing_concepts: Set[str] = set()
            pair_seen_unordered: Set[Tuple[str, str]] = set()
            for rel in relationships:
                if not isinstance(rel, dict):
                    continue
                frm_raw = self._clean_text(rel.get("from", ""), self.MAX_LABEL_LEN)
                to_raw = self._clean_text(rel.get("to", ""), self.MAX_LABEL_LEN)
                label = self._clean_text(rel.get("label", ""), self.MAX_LABEL_LEN)
                if not frm_raw or not to_raw or not label:
                    continue
                # Canonical matching to align with concept set
                frm_c = canonical(frm_raw)
                to_c = canonical(to_raw)
                topic_c = canonical(normalized_topic)
                if frm_c == to_c:
                    continue
                # Map canonical back to display
                frm = canon_to_display.get(frm_c, frm_raw)
                to = canon_to_display.get(to_c, to_raw)
                key = tuple(sorted((frm_c, to_c)))
                if key in pair_seen_unordered:
                    continue
                pair_seen_unordered.add(key)

                if frm_c not in seen and frm_c != topic_c:
                    missing_concepts.add(frm_c)  # Store canonical form
                if to_c not in seen and to_c != topic_c:
                    missing_concepts.add(to_c)  # Store canonical form

                sanitized_relationships.append({"from": frm, "to": to, "label": label})

            # Add missing endpoints as concepts if capacity allows
            for mc_canon in list(missing_concepts):
                if len(normalized_concepts) < self.MAX_CONCEPTS and mc_canon not in seen:
                    # Find the original display text for this canonical form
                    mc_display = None
                    for rel in relationships:
                        if isinstance(rel, dict):
                            frm_raw = self._clean_text(rel.get("from", ""), self.MAX_LABEL_LEN)
                            to_raw = self._clean_text(rel.get("to", ""), self.MAX_LABEL_LEN)
                            if canonical(frm_raw) == mc_canon:
                                mc_display = frm_raw
                                break
                            elif canonical(to_raw) == mc_canon:
                                mc_display = to_raw
                                break
                    
                    if mc_display:
                        normalized_concepts.append(mc_display)
                        seen.add(mc_canon)
                        canon_to_display[mc_canon] = mc_display

            # Final filter: drop any relationship whose endpoints are not in concepts or topic
            concept_or_topic = set(normalized_concepts)
            concept_or_topic.add(normalized_topic)
            sanitized_relationships = [
                r for r in sanitized_relationships
                if r["from"] in concept_or_topic and r["to"] in concept_or_topic
            ]

            # Use Sugiyama hierarchical layout (applied in frontend)
            # Generate layer information for nodes to help frontend Sugiyama layout
            layout = self._generate_sugiyama_layers(normalized_topic, normalized_concepts, sanitized_relationships)

            # Compute recommended dimensions for hierarchical layout
            recommended = self._compute_recommended_dimensions_for_sugiyama(
                topic=normalized_topic,
                concepts=normalized_concepts,
                relationships=sanitized_relationships,
            )

            enhanced_spec: Dict = {
                "topic": normalized_topic,
                "concepts": normalized_concepts,
                "relationships": sanitized_relationships,
                "_layout": layout,
                "_recommended_dimensions": recommended,
                "_layout_algorithm": "sugiyama",  # Mark that we're using Sugiyama layout
                "_config": {
                    "nodeSpacing": 4.0,
                    "canvasPadding": 140,
                    "minNodeDistance": 320
                }
            }
            
            # Preserve important metadata from original spec
            if spec.get('_method'):
                enhanced_spec['_method'] = spec['_method']
            if spec.get('_concept_count'):
                enhanced_spec['_concept_count'] = spec['_concept_count']

            if isinstance(spec.get("_style"), dict):
                enhanced_spec["_style"] = spec["_style"]

            return {"success": True, "spec": enhanced_spec}
        except Exception as exc:
            return {"success": False, "error": f"ConceptMapAgent failed: {exc}"}

    async def generate_graph(
        self, 
        user_prompt: str, 
        language: str = "en",
        # Token tracking parameters
        user_id: Optional[int] = None,
        organization_id: Optional[int] = None,
        request_type: str = 'diagram_generation',
        endpoint_path: Optional[str] = None,
        **kwargs  # Accept additional kwargs for compatibility
    ) -> Dict[str, Any]:
        """
        Generate a concept map graph specification from user prompt.
        
        This method now follows the same pattern as other diagram agents (bubble_map, tree_map, etc.):
        - Uses llm_service.chat directly (async)
        - Gets prompt from centralized prompt system
        - Extracts JSON from response
        - Returns standard format: {'success': True, 'spec': ..., 'diagram_type': ...}
        
        Args:
            user_prompt: User's input prompt
            language: Language for processing ('zh' or 'en')
            user_id: User ID for token tracking
            organization_id: Organization ID for token tracking
            request_type: Request type for token tracking
            endpoint_path: Endpoint path for token tracking
            **kwargs: Additional parameters for compatibility
            
        Returns:
            dict: Standard format with success, spec, and diagram_type
        """
        try:
            logger.info(f"ConceptMapAgent: Starting concept map generation for prompt: {user_prompt[:100]}...")
            
            # Generate the concept map specification using LLM
            spec = await self._generate_concept_map_spec(
                user_prompt, 
                language,
                user_id=user_id,
                organization_id=organization_id,
                request_type=request_type,
                endpoint_path=endpoint_path
            )
            
            if not spec:
                return {
                    'success': False,
                    'error': 'Failed to generate concept map specification'
                }
            
            # Validate the generated spec
            is_valid, validation_msg = self.validate_output(spec)
            if not is_valid:
                logger.warning(f"ConceptMapAgent: Validation failed: {validation_msg}")
                return {
                    'success': False,
                    'error': f'Generated invalid specification: {validation_msg}'
                }
            
            # Enhance the spec with layout and dimensions
            enhanced_result = await self.enhance_spec(spec)
            if not enhanced_result.get('success'):
                error_msg = enhanced_result.get('error', 'Enhancement failed')
                logger.warning(f"ConceptMapAgent: Enhancement failed: {error_msg}")
                # Return original spec if enhancement fails (better than nothing)
                enhanced_spec = spec
            else:
                enhanced_spec = enhanced_result.get('spec', spec)
            
            logger.info(f"ConceptMapAgent: Concept map generation completed successfully")
            return {
                'success': True,
                'spec': enhanced_spec,
                'diagram_type': self.diagram_type if hasattr(self, 'diagram_type') else 'concept_map'
            }
            
        except Exception as e:
            logger.error(f"ConceptMapAgent: Concept map generation failed: {e}", exc_info=True)
            return {
                'success': False,
                'error': f'Generation failed: {str(e)}'
            }
    
    async def _generate_concept_map_spec(
        self, 
        prompt: str, 
        language: str,
        # Token tracking parameters
        user_id: Optional[int] = None,
        organization_id: Optional[int] = None,
        request_type: str = 'diagram_generation',
        endpoint_path: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Generate the concept map specification using LLM.
        
        完全移植自concept-map-new-master的通信方式：
        1. 使用concept-map的提示词构建方式（buildConceptPrompt）
        2. 直接使用提示词作为user_prompt，不使用system_message
        3. 解析JSON响应的方式与concept-map一致（从响应中提取JSON）
        4. 将nodes/links格式转换为MindGraph的topic/concepts/relationships格式
        """
        try:
            # 构建提示词（完全按照concept-map的方式）
            from prompts.concept_maps import CONCEPT_MAP_PROMPTS
            
            # 判断是keyword类型还是description类型
            # 简单判断：如果prompt很短（<50字符）且不包含标点，可能是keyword
            is_keyword = len(prompt) < 50 and not any(p in prompt for p in ['。', '.', '，', ',', '；', ';'])
            
            if is_keyword and language == 'zh':
                # 使用keyword类型的提示词
                prompt_template = CONCEPT_MAP_PROMPTS.get("concept_map_keyword_prompt_zh")
                if prompt_template:
                    full_prompt = prompt_template.format(keyword=prompt)
                else:
                    # Fallback to description prompt
                    prompt_template = CONCEPT_MAP_PROMPTS.get("concept_map_description_prompt_zh")
                    if prompt_template:
                        full_prompt = prompt_template.format(description=prompt)
                    else:
                        logger.error(f"ConceptMapAgent: No concept-map style prompt found")
                        return None
            else:
                # 使用description类型的提示词
                prompt_template = CONCEPT_MAP_PROMPTS.get("concept_map_description_prompt_zh")
                if prompt_template:
                    full_prompt = prompt_template.format(description=prompt)
                else:
                    logger.error(f"ConceptMapAgent: No concept-map style prompt found")
                    return None
            
            # 调用llm_service（完全按照concept-map的方式：直接使用提示词，不使用system_message）
            from services.llm_service import llm_service
            from config.settings import config
            
            response = await llm_service.chat(
                prompt=full_prompt,  # 直接使用完整提示词
                model=self.model,
                system_message=None,  # 不使用system_message，完全按照concept-map的方式
                max_tokens=4000,  # concept-map需要更多tokens
                temperature=0.3,  # 使用concept-map的temperature设置
                timeout=60.0,  # 60秒超时
                # Token tracking parameters
                user_id=user_id,
                organization_id=organization_id,
                request_type=request_type,
                endpoint_path=endpoint_path,
                diagram_type='concept_map'
            )
            
            # 解析响应（完全按照concept-map的方式）
            response_str = str(response)
            
            # 从响应中提取JSON（concept-map的方式：查找第一个{和最后一个}）
            start_idx = response_str.find('{')
            end_idx = response_str.rfind('}') + 1
            
            if start_idx == -1 or end_idx == 0:
                logger.error(f"ConceptMapAgent: No JSON found in response")
                logger.debug(f"Response preview: {response_str[:500]}")
                return None
            
            json_content = response_str[start_idx:end_idx]
            
            try:
                import json
                concept_map_data = json.loads(json_content)
            except json.JSONDecodeError as e:
                logger.error(f"ConceptMapAgent: Failed to parse JSON: {e}")
                logger.debug(f"JSON content: {json_content[:500]}")
                return None
            
            # 将concept-map的nodes/links格式转换为MindGraph的topic/concepts/relationships格式
            nodes = concept_map_data.get("nodes", [])
            links = concept_map_data.get("links", [])
            
            if not nodes:
                logger.error(f"ConceptMapAgent: No nodes found in response")
                return None
            
            # 找到L1层的节点作为topic
            topic_node = None
            for node in nodes:
                if node.get("layer") == 1 or node.get("type") == "main":
                    topic_node = node
                    break
            
            if not topic_node:
                # 如果没有找到L1节点，使用第一个节点
                topic_node = nodes[0]
            
            topic = topic_node.get("label", "")
            
            # 提取所有非topic节点作为concepts
            concepts = []
            node_id_to_label = {}  # 用于映射id到label
            
            for node in nodes:
                node_id = node.get("id", "")
                node_label = node.get("label", "")
                node_layer = node.get("layer", 0)
                node_type = node.get("type", "")
                
                # 记录id到label的映射
                node_id_to_label[node_id] = node_label
                
                # 如果不是topic节点，添加到concepts
                if node_label != topic:
                    concepts.append(node_label)
            
            # 转换links为relationships
            relationships = []
            for link in links:
                source_id = str(link.get("source", ""))
                target_id = str(link.get("target", ""))
                label = link.get("label", "")
                
                # 从id映射到label
                source_label = node_id_to_label.get(source_id, "")
                target_label = node_id_to_label.get(target_id, "")
                
                if source_label and target_label and label:
                    relationships.append({
                        "from": source_label,
                        "to": target_label,
                        "label": label
                    })
            
            # 构建MindGraph格式的spec
            spec = {
                "topic": topic,
                "concepts": concepts,
                "relationships": relationships
            }
            
            logger.info(f"ConceptMapAgent: Successfully converted concept-map format to MindGraph format")
            logger.debug(f"Topic: {topic}, Concepts: {len(concepts)}, Relationships: {len(relationships)}")
            
            return spec
            
        except Exception as e:
            logger.error(f"ConceptMapAgent: Error in spec generation: {e}", exc_info=True)
            return None
    
    async def generate_from_focus_question(
        self,
        focus_question: str,
        language: str = 'zh'
    ) -> Dict[str, Any]:
        """
        Generate concept map from focus question using the focus question workflow.
        
        Workflow:
        1. Extract focus question (if input is text, not already a question)
        2. Generate introduction text
        3. Extract triples from introduction
        4. Convert triples to concept map data
        5. Enhance and return
        
        Args:
            focus_question: Focus question or text to extract focus question from
            language: Language ('zh' or 'en')
            
        Returns:
            dict: Graph specification with styling and metadata
        """
        try:
            logger.info(f"[ConceptMapAgent] Generating from focus question: {focus_question}")
            
            # Import services
            from services.focus_question_service import focus_question_service
            from services.introduction_service import introduction_service
            from services.triple_extraction_service import triple_extraction_service
            
            # Step 1: Extract focus question (if needed)
            # Check if input is already a question or needs extraction
            # Simple heuristic: check for question markers
            is_question = any(q in focus_question for q in ['是什么', '怎么样', '有哪些', '如何', '怎样', '为什么', 
                                                           'what', 'how', 'why', 'which', '?', '？'])
            
            if not is_question:
                # Extract focus question from text
                logger.info(f"[ConceptMapAgent] Input is not a question, extracting focus question...")
                extract_result = await focus_question_service.extract_focus_question(
                    focus_question, language=language
                )
                if not extract_result.get('success'):
                    return {
                        'success': False,
                        'error': f"Failed to extract focus question: {extract_result.get('error')}",
                        'spec': None
                    }
                focus_question = extract_result['focus_question']
                logger.info(f"[ConceptMapAgent] Extracted focus question: {focus_question}")
            else:
                logger.info(f"[ConceptMapAgent] Using input directly as focus question: {focus_question}")
            
            # Step 2: Generate introduction text
            intro_result = await introduction_service.generate_introduction(
                focus_question, language=language, stream=False
            )
            if not intro_result.get('success'):
                return {
                    'success': False,
                    'error': f"Failed to generate introduction: {intro_result.get('error')}",
                    'spec': None
                }
            intro_text = intro_result['text']
            logger.info(f"[ConceptMapAgent] Generated introduction, length: {len(intro_text)}")
            
            # Step 3: Extract triples from introduction
            triple_result = await triple_extraction_service.extract_triples(
                intro_text, language=language, stream=False
            )
            if not triple_result.get('success'):
                return {
                    'success': False,
                    'error': f"Failed to extract triples: {triple_result.get('error')}",
                    'spec': None
                }
            triples = triple_result['triples']
            logger.info(f"[ConceptMapAgent] Extracted {len(triples)} triples")
            
            # Step 4: Convert triples to concept map data
            concept_map_data = triple_extraction_service.convert_triples_to_concept_map_data(
                triples, focus_question=focus_question
            )
            
            # Step 5: Enhance the specification
            enhanced_result = await self.enhance_spec(concept_map_data)
            
            if not enhanced_result.get('success'):
                logger.warning(f"[ConceptMapAgent] Enhancement failed: {enhanced_result.get('error')}")
                # Return original spec if enhancement fails
                return concept_map_data
            
            # Add metadata
            enhanced_spec = enhanced_result.get('spec', concept_map_data)
            enhanced_spec['_method'] = 'focus_question_workflow'
            enhanced_spec['_focus_question'] = focus_question
            enhanced_spec['_introduction'] = intro_text
            
            logger.info(f"[ConceptMapAgent] Successfully generated concept map from focus question")
            # Return in GenerateResponse format
            return {
                'success': True,
                'spec': enhanced_spec,
                'diagram_type': 'concept_map'
            }
            
        except Exception as e:
            logger.error(f"[ConceptMapAgent] Focus question generation error: {e}", exc_info=True)
            # Return in GenerateResponse format with error
            return {
                'success': False,
                'error': f"Focus question generation failed: {str(e)}",
                'spec': None
            }

    def generate_simplified_two_stage(self, user_prompt: str, llm_client, language: str = "en") -> Dict:
        """
        Generate concept map using simplified two-stage approach.
        
        Stage 1: Generate concepts
        Stage 2: Generate relationships
        
        This approach is much more reliable than the complex unified generation.
        """
        try:
            # Stage 1: Generate concepts using enhanced prompts
            stage1_prompt_key = f"concept_map_enhanced_stage1_{language}"
            stage1_prompt = self._get_prompt(stage1_prompt_key, user_prompt=user_prompt)
            
            # Fallback to original prompts if enhanced not found
            if not stage1_prompt:
                stage1_prompt_key = f"concept_map_stage1_concepts_{language}"
                stage1_prompt = self._get_prompt(stage1_prompt_key, user_prompt=user_prompt)
            
            if not stage1_prompt:
                return {"success": False, "error": f"Prompt not found: {stage1_prompt_key}"}
            
            # Get concepts from LLM
            concepts_response = self._get_llm_response(llm_client, stage1_prompt)
            if not concepts_response:
                return {"success": False, "error": "No response from LLM for concepts generation"}
            
            # Parse concepts response
            try:
                concepts_data = self._parse_json_response(concepts_response)
                if not concepts_data:
                    return {"success": False, "error": "Failed to parse concepts response"}
                
                topic = concepts_data.get("topic", "")
                concepts = concepts_data.get("concepts", [])
                
                if not topic or not concepts:
                    return {"success": False, "error": "Missing topic or concepts in response"}
                
            except Exception as e:
                return {"success": False, "error": f"Failed to parse concepts: {str(e)}"}
            
            # Stage 2: Generate relationships using enhanced prompts
            stage2_prompt_key = f"concept_map_enhanced_stage2_{language}"
            stage2_prompt = self._get_prompt(stage2_prompt_key, topic=topic, concepts=concepts)
            
            # Fallback to original prompts if enhanced not found
            if not stage2_prompt:
                stage2_prompt_key = f"concept_map_stage2_relationships_{language}"
                stage2_prompt = self._get_prompt(stage2_prompt_key, topic=topic, concepts=concepts)
            
            if not stage2_prompt:
                return {"success": False, "error": f"Prompt not found: {stage2_prompt_key}"}
            
            # Get relationships from LLM
            relationships_response = self._get_llm_response(llm_client, stage2_prompt)
            if not relationships_response:
                return {"success": False, "error": "No response from LLM for relationships generation"}
            
            # Parse relationships response
            try:
                relationships_data = self._parse_json_response(relationships_response)
                if not relationships_data:
                    return {"success": False, "error": "Failed to parse relationships response"}
                
                relationships = relationships_data.get("relationships", [])
                
                if not relationships:
                    return {"success": False, "error": "No relationships generated"}
                
            except Exception as e:
                return {"success": False, "error": f"Failed to parse relationships: {str(e)}"}
            
            # Combine and enhance
            combined_spec = {
                "topic": topic,
                "concepts": concepts,
                "relationships": relationships
            }
            
            # Enhance the specification
            enhanced_spec = self.enhance_spec(combined_spec)
            if not enhanced_spec.get("success", False):
                return enhanced_spec
            
            return enhanced_spec
            
        except Exception as e:
            return {"success": False, "error": f"Two-stage generation failed: {str(e)}"}
    
    def generate_three_stage(self, user_prompt: str, llm_client, language: str = "en") -> Dict:
        """
        Generate concept map using streamlined 2-stage approach.
        
        Uses existing topic extraction from main agent, then:
        Stage 1: Generate exactly 30 key concepts based on user prompt  
        Stage 2: Generate relationships between topic and all concepts
        
        This approach integrates with existing workflow: [existing topic extraction] → 30 concepts → relationships.
        """
        try:
            # Use the existing LLM calling pattern from agent.py
            from agent import _invoke_llm_prompt
            
            # Stage 1: Generate exactly 30 concepts based on user prompt
            concepts_prompt_key = f"concept_map_30_concepts_{language}"
            concepts_prompt = self._get_prompt(concepts_prompt_key, central_topic=user_prompt)
            
            if not concepts_prompt:
                return {"success": False, "error": f"30 concepts prompt not found: {concepts_prompt_key}"}
            
            # Get concepts using the existing LLM pattern
            concepts_response = _invoke_llm_prompt(concepts_prompt, {})
            if not concepts_response:
                return {"success": False, "error": "No response from LLM for concepts generation"}
            
            # Parse concepts response
            try:
                concepts_data = self._parse_json_response(concepts_response)
                if not concepts_data:
                    return {"success": False, "error": "Failed to parse concepts response"}
                
                concepts = concepts_data.get("concepts", [])
                if not concepts:
                    return {"success": False, "error": "No concepts generated"}
                
                # Validate we have exactly 30 concepts
                if len(concepts) != 30:
                    # Try to adjust to exactly 30
                    if len(concepts) > 30:
                        concepts = concepts[:30]  # Take first 30
                    else:
                        # Pad with generic concepts if less than 30
                        while len(concepts) < 30:
                            concepts.append(f"Related concept {len(concepts) + 1}")
                
            except Exception as e:
                return {"success": False, "error": f"Failed to parse concepts: {str(e)}"}
            
            # Extract topic from user prompt for relationships
            # Use a simple extraction method instead of full LLM call
            central_topic = self._extract_simple_topic(user_prompt)
            
            # Stage 2: Generate relationships
            relationships_prompt_key = f"concept_map_3_stage_relationships_{language}"
            relationships_prompt = self._get_prompt(relationships_prompt_key, 
                                                   central_topic=central_topic, 
                                                   concepts=concepts)
            
            if not relationships_prompt:
                return {"success": False, "error": f"3-stage relationships prompt not found: {relationships_prompt_key}"}
            
            # Get relationships using the existing LLM pattern
            relationships_response = _invoke_llm_prompt(relationships_prompt, {})
            if not relationships_response:
                return {"success": False, "error": "No response from LLM for relationships generation"}
            
            # Parse relationships response
            try:
                relationships_data = self._parse_json_response(relationships_response)
                if not relationships_data:
                    return {"success": False, "error": "Failed to parse relationships response"}
                
                relationships = relationships_data.get("relationships", [])
                
                if not relationships:
                    return {"success": False, "error": "No relationships generated"}
                
            except Exception as e:
                return {"success": False, "error": f"Failed to parse relationships: {str(e)}"}
            
            # Combine into concept map spec
            concept_map_spec = {
                "topic": central_topic,  # Use extracted central topic
                "concepts": concepts,    # Exactly 30 concepts
                "relationships": relationships,
                "_method": "three_stage",  # Mark for identification
                "_stage_info": {
                    "original_prompt": user_prompt,
                    "extracted_topic": central_topic,
                    "concept_count": len(concepts),
                    "relationship_count": len(relationships)
                }
            }
            
            # Enhance the spec using existing method
            enhanced_spec = self.enhance_spec(concept_map_spec)
            return enhanced_spec
            
        except Exception as e:
            return {"success": False, "error": f"Three-stage concept map generation failed: {str(e)}"}

    def _extract_simple_topic(self, user_prompt: str) -> str:
        """Extract a simple topic from user prompt using basic text processing."""
        import re
        
        # Clean and extract key phrases
        prompt = user_prompt.lower().strip()
        
        # Remove common phrases
        prompt = re.sub(r'\b(i want to|help me|create|generate|make|build|understand|learn about|about)\b', '', prompt)
        prompt = re.sub(r'\b(concept map|mind map|diagram|graph|visualization)\b', '', prompt)
        
        # Extract the main subject
        words = prompt.split()
        # Filter out common words and take meaningful terms
        meaningful_words = [w for w in words if len(w) > 2 and w not in 
                          {'the', 'and', 'for', 'with', 'how', 'what', 'why', 'when', 'where'}]
        
        if meaningful_words:
            # Take first 2-3 meaningful words as topic
            topic = ' '.join(meaningful_words[:3])
            return topic.title()
        else:
            # Fallback to first few words
            return ' '.join(user_prompt.split()[:3]).title()
    
    def _get_prompt(self, prompt_key: str, **kwargs) -> str:
        """Get prompt from the prompts module."""
        try:
            from prompts.concept_maps import CONCEPT_MAP_PROMPTS
            
            # Try to get the language-specific prompt first
            language = kwargs.get('language', 'en')
            if language == 'zh':
                # Try Chinese version first
                zh_key = prompt_key.replace('_en', '_zh')
                prompt_template = CONCEPT_MAP_PROMPTS.get(zh_key)
                if prompt_template:
                    return prompt_template.format(**kwargs)
            
            # Fallback to English version
            prompt_template = CONCEPT_MAP_PROMPTS.get(prompt_key)
            if prompt_template:
                return prompt_template.format(**kwargs)
            
            # If we still don't have a prompt, log the issue
            print(f"Warning: No prompt found for key '{prompt_key}' (language: {language})")
            print(f"Available keys: {list(CONCEPT_MAP_PROMPTS.keys())}")
            return None
        except ImportError as e:
            print(f"Error importing prompts module: {e}")
            return None
        except Exception as e:
            print(f"Unexpected error in _get_prompt: {e}")
            return None
    
    def _get_llm_response(self, llm_client, prompt: str) -> str:
        """Get response from LLM client, handling different client types."""
        try:
            # Check if it's a mock client with get_response method
            if hasattr(llm_client, 'get_response'):
                return llm_client.get_response(prompt)
            
            # Check if it's a LangChain LLM client with invoke method
            elif hasattr(llm_client, 'invoke'):
                # Use LangChain's invoke method
                from langchain_core.prompts import PromptTemplate
                pt = PromptTemplate(input_variables=[], template=prompt)
                result = llm_client.invoke(pt)
                return str(result) if result else ""
            
            # Check if it's an async client with chat_completion method
            elif hasattr(llm_client, 'chat_completion'):
                # For now, return a mock response since we can't easily run async here
                # In production, you'd want to properly handle the async call
                if "concepts" in prompt.lower():
                    return '{"topic": "Test Topic", "concepts": ["Concept 1", "Concept 2", "Concept 3"]}'
                elif "relationships" in prompt.lower():
                    return '{"relationships": [{"from": "Concept 1", "to": "Concept 2", "label": "relates to"}]}'
                else:
                    return '{"result": "mock response"}'
            
            # Fallback for other client types
            else:
                raise ValueError(f"Unsupported LLM client type: {type(llm_client)}")
                
        except Exception as e:
            raise ValueError(f"Failed to get LLM response: {str(e)}")
    
    def _parse_json_response(self, response: str) -> Dict:
        """Parse JSON response from LLM, handling common formatting issues.
        
        This method includes multiple fallback strategies:
        1. Direct JSON parsing
        2. Fix unterminated strings and balance braces
        3. Extract JSON from markdown blocks
        4. Find JSON-like content with regex
        5. Create fallback responses from partial content
        6. Generate generic fallback if all else fails
        """
        try:
            # Remove markdown code blocks if present
            cleaned = response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            
            cleaned = cleaned.strip()
            
            # Try to parse as JSON
            import json
            return json.loads(cleaned)
            
        except json.JSONDecodeError as e:
            # Log the original error for debugging
            import logging
            logging.warning(f"JSON parsing failed: {e}")
            logging.debug(f"Original response: {response[:500]}...")  # Log first 500 chars
            
            # Log the full response for debugging (truncated if too long)
            if len(response) > 1000:
                logging.debug(f"Full response (truncated): {response[:1000]}...")
            else:
                logging.debug(f"Full response: {response}")
            
            # Try to fix unterminated strings and other common issues
            try:
                import re
                
                # Fix unterminated strings by finding the last complete quote
                # Look for patterns like "text" where the quote might be missing
                cleaned = re.sub(r'"([^"]*?)(?=\s*[,}\]]|$)', r'"\1"', cleaned)
                
                # Fix unescaped quotes within strings
                # This is tricky, but we can try to balance quotes
                quote_count = cleaned.count('"')
                if quote_count % 2 == 1:  # Odd number of quotes
                    # Find the last quote and see if we can balance it
                    last_quote_pos = cleaned.rfind('"')
                    if last_quote_pos > 0:
                        # Check if this looks like an unterminated string
                        before_quote = cleaned[:last_quote_pos]
                        if before_quote.rstrip().endswith(':'):
                            # This looks like a key without a value, remove it
                            cleaned = cleaned[:last_quote_pos].rstrip().rstrip(':').rstrip()
                            cleaned += '}'
                
                # Additional fix for unterminated strings at the end
                # Look for patterns like "key": "value where the closing quote is missing
                cleaned = re.sub(r'"([^"]*?)(?=\s*[,}\]]|$)', r'"\1"', cleaned)
                
                # Try to balance braces if they're mismatched
                open_braces = cleaned.count('{')
                close_braces = cleaned.count('}')
                if open_braces > close_braces:
                    cleaned += '}' * (open_braces - close_braces)
                elif close_braces > open_braces:
                    # Remove extra closing braces from the end
                    cleaned = cleaned.rstrip('}')
                    # Add back the right number
                    cleaned += '}' * open_braces
                
                logging.info(f"Attempting to parse cleaned JSON after fixes")
                # Try to parse the cleaned JSON
                result = json.loads(cleaned)
                logging.info(f"Successfully parsed JSON after applying fixes")
                return result
                
            except json.JSONDecodeError as e2:
                logging.warning(f"Cleaned JSON parsing also failed: {e2}")
                pass
            
            # Try to find JSON-like content
            try:
                import re
                json_match = re.search(r'\{.*\}', cleaned, re.DOTALL)
                if json_match:
                    return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass
            
            # Try to fix common issues
            try:
                # Remove any leading/trailing whitespace and newlines
                cleaned = re.sub(r'^\s+|\s+$', '', cleaned, flags=re.MULTILINE)
                # Try to find the start and end of JSON
                start = cleaned.find('{')
                end = cleaned.rfind('}') + 1
                if start >= 0 and end > start:
                    json_content = cleaned[start:end]
                    return json.loads(json_content)
            except json.JSONDecodeError:
                pass
            
            # Try to extract whatever concepts we can find from the response
            topic_match = re.search(r'"topic"\s*:\s*"([^"]+)"', cleaned)
            topic = topic_match.group(1) if topic_match else "Unknown Topic"
            
            # Extract concepts using multiple patterns - take whatever we can find
            concepts = []
            
            # Pattern 1: Look for concepts array
            concepts_match = re.search(r'"concepts"\s*:\s*\[(.*?)\]', cleaned, re.DOTALL)
            if concepts_match:
                concepts_str = concepts_match.group(1)
                concepts = [c.strip().strip('"') for c in concepts_str.split(',') if c.strip()]
                logging.info(f"Extracted concepts using Pattern 1 (concepts array): {concepts}")
            
            # Pattern 2: Look for keys array (for two-stage approach)
            if not concepts:
                keys_match = re.search(r'"keys"\s*:\s*\[(.*?)\]', cleaned, re.DOTALL)
                if keys_match:
                    keys_str = keys_match.group(1)
                    # Extract names from key objects
                    key_names = re.findall(r'"name"\s*:\s*"([^"]+)"', keys_str)
                    concepts.extend(key_names)
                    logging.info(f"Extracted concepts using Pattern 2 (keys array): {concepts}")
            
            # Pattern 3: Look for individual concept-like strings in the response
            if not concepts:
                # Find all quoted strings that look like concept names
                concept_candidates = re.findall(r'"([^"]{2,20})"', cleaned)
                # Filter out common JSON keys and short strings
                json_keys = {'topic', 'concepts', 'keys', 'key_parts', 'relationships', 'from', 'to', 'label'}
                concepts = [c for c in concept_candidates if c not in json_keys and len(c) > 1]
                if concepts:
                    logging.info(f"Extracted concepts using Pattern 3 (quoted strings): {concepts}")
            
            # Pattern 4: Look for unquoted concept names in the response
            if not concepts:
                # Find Chinese characters that might be concept names
                chinese_concepts = re.findall(r'[\u4e00-\u9fff]{2,6}', cleaned)
                # Filter out common words and keep meaningful concepts
                common_words = {'概念', '主题', '包含', '相关', '应用', '原理', '特点', '方法', '工具', '技术'}
                concepts = [c for c in chinese_concepts if c not in common_words and len(c) >= 2]
                # Remove duplicates while preserving order
                seen = set()
                unique_concepts = []
                for c in concepts:
                    if c not in seen:
                        seen.add(c)
                        unique_concepts.append(c)
                concepts = unique_concepts[:6]  # Limit to 6 concepts
                if concepts:
                    logging.info(f"Extracted concepts using Pattern 4 (Chinese characters): {concepts}")
            
            # Return whatever we found, even if incomplete
            if concepts:
                logging.info(f"Extracted partial concepts from malformed JSON: {concepts}")
                return {"topic": topic, "concepts": concepts}
            else:
                # If we found absolutely nothing, just return the topic
                logging.warning(f"Could not extract any concepts from response, returning topic only: {topic}")
                return {"topic": topic, "concepts": []}

    def _clean_text(self, text: str, max_len: int) -> str:
        if not isinstance(text, str):
            return ""
        cleaned = " ".join(text.split())
        if len(cleaned) > max_len:
            cleaned = cleaned[: max_len - 1].rstrip() + "…"
        return cleaned

    def _generate_sugiyama_layers(self, topic: str, concepts: List[str], relationships: List[Dict[str, str]]) -> Dict:
        """
        Generate layer information for Sugiyama hierarchical layout.
        This method assigns layer numbers to nodes based on their relationships.
        The actual layout calculation is done in the frontend using applySugiyamaLayout.
        
        Args:
            topic: Central topic node
            concepts: List of concept nodes
            relationships: List of relationships between nodes
            
        Returns:
            Dict with layer assignments for each node
        """
        from collections import defaultdict, deque
        
        # Build graph structure
        graph = defaultdict(set)  # node -> set of connected nodes
        in_degree = defaultdict(int)  # node -> in-degree count
        
        # Initialize all nodes
        all_nodes = {topic} | set(concepts)
        for node in all_nodes:
            in_degree[node] = 0
        
        # Build directed graph from relationships
        for rel in relationships:
            from_node = rel.get("from")
            to_node = rel.get("to")
            if from_node and to_node and from_node in all_nodes and to_node in all_nodes:
                graph[from_node].add(to_node)
                in_degree[to_node] += 1
        
        # Assign layers using BFS from root nodes (nodes with in-degree 0)
        node_layers = {}
        root_nodes = [node for node in all_nodes if in_degree[node] == 0]
        
        # If no root nodes, make topic the root
        if not root_nodes:
            root_nodes = [topic]
        
        # BFS to assign layers
        visited = set()
        queue = deque([(node, 1) for node in root_nodes])  # (node, layer)
        
        while queue:
            current_node, layer = queue.popleft()
            if current_node in visited:
                continue
            visited.add(current_node)
            node_layers[current_node] = layer
            
            # Add children to queue with layer + 1
            for neighbor in graph[current_node]:
                if neighbor not in visited:
                    queue.append((neighbor, layer + 1))
        
        # Assign remaining isolated nodes to layer 1
        for node in all_nodes:
            if node not in node_layers:
                node_layers[node] = 1
        
        return {
            "algorithm": "sugiyama",
            "layers": node_layers,
            "topic": topic,
            "concepts": concepts,
            "relationships": relationships
        }
    
    def _compute_recommended_dimensions_for_sugiyama(
        self,
        topic: str,
        concepts: List[str],
        relationships: List[Dict[str, str]],
    ) -> Dict[str, int]:
        """
        Calculate recommended canvas dimensions for Sugiyama hierarchical layout.
        
        Args:
            topic: Central topic
            concepts: List of concepts
            relationships: List of relationships
            
        Returns:
            Dict with recommended width, height, and padding
        """
        # Estimate number of layers (max layer depth)
        from collections import defaultdict, deque
        
        graph = defaultdict(set)
        in_degree = defaultdict(int)
        all_nodes = {topic} | set(concepts)
        
        for node in all_nodes:
            in_degree[node] = 0
        
        for rel in relationships:
            from_node = rel.get("from")
            to_node = rel.get("to")
            if from_node and to_node and from_node in all_nodes and to_node in all_nodes:
                graph[from_node].add(to_node)
                in_degree[to_node] += 1
        
        # Calculate max depth
        root_nodes = [node for node in all_nodes if in_degree[node] == 0]
        if not root_nodes:
            root_nodes = [topic]
        
        max_depth = 1
        visited = set()
        queue = deque([(node, 1) for node in root_nodes])
        
        while queue:
            current_node, depth = queue.popleft()
            if current_node in visited:
                continue
            visited.add(current_node)
            max_depth = max(max_depth, depth)
            
            for neighbor in graph[current_node]:
                if neighbor not in visited:
                    queue.append((neighbor, depth + 1))
        
        # Estimate dimensions based on layer count and node count
        num_nodes = len(concepts) + 1  # +1 for topic
        num_layers = max(max_depth, 1)
        
        # Horizontal: enough space for nodes in widest layer
        # Estimate max nodes per layer
        avg_nodes_per_layer = max(1, num_nodes / num_layers)
        max_nodes_in_layer = min(num_nodes, int(avg_nodes_per_layer * 2))
        
        # Each node needs ~150px width (including spacing)
        estimated_width = max(800, max_nodes_in_layer * 150 + 300)  # +300 for margins
        
        # Vertical: enough space for layers
        # Each layer needs ~220px height (including spacing)
        estimated_height = max(600, num_layers * 220 + 200)  # +200 for margins
        
        # Apply reasonable bounds
        min_width = 800
        min_height = 600
        max_width = 2000
        max_height = 2000
        
        width = max(min_width, min(max_width, estimated_width))
        height = max(min_height, min(max_height, estimated_height))
        
        return {
            "baseWidth": width,
            "baseHeight": height,
            "width": width,
            "height": height,
            "padding": 100
        }

    # DEPRECATED: Radial layout method - replaced by Sugiyama layout
    # This method is kept for reference but should not be used
    def _generate_layout_radial(self, topic: str, concepts: List[str], relationships: List[Dict[str, str]]) -> Dict:
        """Generate radial/circular layout with concentric circles around central topic."""
        import math
        import random
        from collections import defaultdict, deque
        
        if not concepts:
            return {"algorithm": "radial", "positions": {topic: {"x": 0.0, "y": 0.0}}}
        
        # Central topic at origin
        positions = {topic: {"x": 0.0, "y": 0.0}}
        
        # Build relationship graph to determine distance from center
        graph = defaultdict(set)
        for rel in relationships:
            from_node = rel.get("from")
            to_node = rel.get("to")
            if from_node and to_node:
                graph[from_node].add(to_node)
                graph[to_node].add(from_node)
        
        # Intelligently assign concepts to concentric circles
        concept_layers = {}
        
        # First, try BFS from central topic for direct relationships
        visited = {topic}
        queue = deque([(topic, 0)])
        
        while queue:
            current_node, layer = queue.popleft()
            
            for neighbor in graph[current_node]:
                if neighbor not in visited and neighbor in concepts:
                    visited.add(neighbor)
                    concept_layers[neighbor] = layer + 1
                    queue.append((neighbor, layer + 1))
        
        # For better visual distribution, create multiple concentric circles
        unassigned = [c for c in concepts if c not in concept_layers]
        total_concepts = len(concepts)
        
        if total_concepts <= 10:
            # Small concept maps: 1-2 circles
            target_circles = 2
        elif total_concepts <= 20:
            # Medium concept maps: 2-3 circles  
            target_circles = 3
        else:
            # Large concept maps: 3-4 circles
            target_circles = 4
        
        # Distribute all concepts across target number of circles
        all_concepts = list(concepts)
        concepts_per_circle = total_concepts // target_circles
        
        # Clear and redistribute for better visual appearance
        concept_layers = {}
        
        for i, concept in enumerate(all_concepts):
            # Distribute evenly across circles, with inner circles having fewer nodes
            if i < concepts_per_circle * 0.7:  # Inner circle (smaller)
                layer = 1
            elif i < concepts_per_circle * 1.8:  # Middle circle
                layer = 2
            elif i < concepts_per_circle * 3.0:  # Outer circle
                layer = 3
            else:  # Outermost circle
                layer = min(4, target_circles)
            
            concept_layers[concept] = layer
        
        # Group concepts by layer
        layers = defaultdict(list)
        for concept, layer in concept_layers.items():
            layers[layer].append(concept)
        
        # Calculate adaptive radii for concentric circles with maximum spacing
        # Use the EXACT same coordinate system as the root concept map agent for compatibility
        max_layer = max(layers.keys()) if layers else 1
        base_radius = 1.8  # Start radius for first circle (even larger from 1.2)
        radius_increment = min(1.2, 3.5 / max_layer)  # Maximum spacing (even larger from 0.8 and 2.5)
        
        # Position concepts in each concentric circle
        for layer_num, layer_concepts in layers.items():
            n_concepts = len(layer_concepts)
            if n_concepts == 0:
                continue
            
            # Calculate radius for this layer
            radius = base_radius + (layer_num - 1) * radius_increment
            radius = min(radius, 5.0)  # Allow maximum expansion for ultimate spacing (increased from 3.5)
            
            # Distribute concepts evenly around the circle
            for i, concept in enumerate(layer_concepts):
                # Calculate angle for even distribution
                angle = (2 * math.pi * i) / n_concepts
                
                # Add slight randomization to avoid perfect alignment
                angle_offset = random.uniform(-0.1, 0.1) if n_concepts > 1 else 0
                final_angle = angle + angle_offset
                
                # Calculate position
                x = radius * math.cos(final_angle)
                y = radius * math.sin(final_angle)
                
                positions[concept] = {"x": x, "y": y}
        
        # Generate edge curvatures for radial connections
        edge_curvatures = {}
        for i, concept in enumerate(concepts):
            # Vary curvature to reduce overlapping edges
            edge_curvatures[concept] = [0.0, 8.0, -8.0, 16.0, -16.0][i % 5]
        
        # Generate the EXACT same layout structure as the root concept map agent
        # This ensures 100% compatibility with the existing D3.js renderer
        return {
            "algorithm": "radial",
            "positions": positions,
            "edgeCurvatures": edge_curvatures,
            "layers": dict(layers),  # For debugging/analysis
            "params": {
                "nodeSpacing": 1.0,
                "baseRadius": base_radius,
                "radiusIncrement": radius_increment,
                "maxLayers": max_layer,
                "canvasBounds": 0.95
            }
        }

    def _compute_recommended_dimensions_from_layout(
        self,
        layout: Dict,
        topic: str,
        concepts: List[str],
    ) -> Dict[str, int]:
        """Calculate canvas size based on actual SVG element dimensions like D3.js does.

        This simulates the D3.js drawBox() function to predict real space requirements.
        """
        positions = layout.get("positions") or {}
        if not positions:
            # Minimal fallback sizing for empty layouts
            return {"baseWidth": 800, "baseHeight": 600, "width": 800, "height": 600, "padding": 100}

        # Simulate D3.js text measurement and box sizing
        def estimate_text_box(text: str, is_topic: bool = False) -> tuple:
            """Estimate text box dimensions like D3.js drawBox() function."""
            font_size = 26 if is_topic else 22  # Even larger font sizes for maximum readability (was 22/18)
            max_text_width = 350 if is_topic else 300  # Even larger max width for bigger text (was 300/260)
            
            # Estimate character width (approximate for common fonts)
            char_width = font_size * 0.6  # Rough estimate for common fonts
            text_width = len(text) * char_width
            
            # Handle text wrapping
            if text_width > max_text_width:
                lines = max(1, int(text_width / max_text_width) + 1)
                actual_text_width = min(text_width, max_text_width)
            else:
                lines = 1
                actual_text_width = text_width
                
            # Add padding like D3.js drawBox()
            padding_x = 16
            padding_y = 10
            line_height = int(font_size * 1.2)
            
            box_w = int(actual_text_width + padding_x * 2)
            box_h = int(lines * line_height + padding_y * 2)
            
            return box_w, box_h
        
        # Calculate actual node dimensions
        topic_w, topic_h = estimate_text_box(topic, True)
        
        concept_boxes = []
        for concept in concepts:
            w, h = estimate_text_box(concept, False)
            concept_boxes.append((w, h))
        
        # Find the coordinate bounds
        xs = [positions[c]["x"] for c in positions if "x" in positions[c]]
        ys = [positions[c]["y"] for c in positions if "y" in positions[c]]
        if not xs or not ys:
            return {"baseWidth": 800, "baseHeight": 600, "width": 800, "height": 600, "padding": 100}

        xmin, xmax = min(xs), max(xs)
        ymin, ymax = min(ys), max(ys)
        
        # Calculate the scale factor D3.js uses: scaleX = (width - 2*padding) / 6
        # We need to reverse this: width = spanx * pixels_per_unit + 2*padding + node_sizes
        
        # Coordinate span in the normalized space
        coord_span_x = max(0.4, xmax - xmin)
        coord_span_y = max(0.4, ymax - ymin)
        
        # We want the diagram to be readable, so use a scale that accommodates larger text and more spacing
        # Increased scale to handle larger text and maximum node spacing
        target_scale = 180  # Optimized for larger text and maximum spacing (reduced from 200 to balance size)  
        
        # Calculate content area needed for positions
        content_area_x = coord_span_x * target_scale
        content_area_y = coord_span_y * target_scale
        
        # Add space for the largest nodes (half extends on each side)
        max_concept_w = max([w for w, h in concept_boxes], default=100)
        max_concept_h = max([h for w, h in concept_boxes], default=40)
        
        node_margin_x = max(topic_w, max_concept_w) // 2
        node_margin_y = max(topic_h, max_concept_h) // 2
        
        # Calculate total required space
        base_padding = 80  # Reasonable padding
        total_width = content_area_x + (2 * node_margin_x) + (2 * base_padding)
        total_height = content_area_y + (2 * node_margin_y) + (2 * base_padding)
        
        # Apply reasonable bounds
        num_concepts = len(concepts)
        min_width = max(600, 400 + num_concepts * 10)   # Increased for larger text and spacing
        min_height = max(500, 350 + num_concepts * 8)
        max_width = 1400   # Increased maximum to accommodate larger text and spacing (was 1200)
        max_height = 1200  # Increased maximum to accommodate larger text and spacing (was 1000)
        
        width_px = int(max(min_width, min(max_width, total_width)))
        height_px = int(max(min_height, min(max_height, total_height)))

        return {
            "baseWidth": width_px, 
            "baseHeight": height_px, 
            "width": width_px, 
            "height": height_px, 
            "padding": base_padding
        }


__all__ = ["ConceptMapAgent"]


