"""
Introduction Text Service
=========================

Service for generating introduction text for focus questions.
Based on concept-map-new-master/llm/introduction-service.js

@author MindGraph Team
"""

import logging
from typing import Dict, Optional, AsyncGenerator

from services.llm_service import llm_service

logger = logging.getLogger(__name__)


class IntroductionService:
    """
    Service for generating introduction text for focus questions.
    
    Output format requirements:
    - First sentence must contain four analysis angles
    - 2-3 paragraphs, about 300 words
    - Format: "对于[主题]，可以从【角度1】、【角度2】、【角度3】、【角度4】四个方面进行分析。"
    """
    
    def __init__(self):
        self.llm_service = llm_service
        logger.info("[IntroductionService] Initialized")
    
    async def generate_introduction(
        self,
        keyword: str,
        language: str = 'zh',
        stream: bool = False
    ) -> Dict[str, any]:
        """
        Generate introduction text for a focus question.
        
        Args:
            keyword: Focus question keyword
            language: Language ('zh' or 'en')
            stream: Whether to stream the response
            
        Returns:
            Dict with 'success', 'text', 'message' keys
        """
        logger.info(f"[IntroductionService] Generating introduction for keyword: {keyword}")
        
        if not keyword or len(keyword.strip()) == 0:
            return {
                'success': False,
                'error': 'Empty keyword',
                'message': '关键词不能为空'
            }
        
        try:
            # Build prompt
            prompt = self._build_intro_prompt(keyword, language)
            system_prompt = self._build_system_prompt(keyword, language)
            
            if stream:
                # Stream response
                full_text = ""
                async for chunk in self.llm_service.chat_stream(
                    prompt=prompt,
                    model='qwen-plus',  # Use plus for better generation quality
                    system_message=system_prompt,
                    temperature=0.7,
                    max_tokens=800
                ):
                    if chunk:
                        full_text += chunk
                
                logger.info(f"[IntroductionService] Generated introduction, length: {len(full_text)}")
                return {
                    'success': True,
                    'text': full_text,
                    'message': '介绍文本生成完成'
                }
            else:
                # Non-stream response
                response = await self.llm_service.chat(
                    prompt=prompt,
                    model='qwen-plus',
                    system_message=system_prompt,
                    temperature=0.7,
                    max_tokens=800
                )
                
                if not response:
                    return {
                        'success': False,
                        'error': 'No response from LLM',
                        'message': '介绍文本生成失败'
                    }
                
                logger.info(f"[IntroductionService] Generated introduction, length: {len(response)}")
                return {
                    'success': True,
                    'text': response,
                    'message': '介绍文本生成完成'
                }
                
        except Exception as e:
            logger.error(f"[IntroductionService] Generation failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'message': '介绍文本生成失败'
            }
    
    async def generate_introduction_stream(
        self,
        keyword: str,
        language: str = 'zh'
    ) -> AsyncGenerator[str, None]:
        """
        Stream introduction text generation.
        
        Args:
            keyword: Focus question keyword
            language: Language ('zh' or 'en')
            
        Yields:
            Text chunks as they are generated
        """
        logger.info(f"[IntroductionService] Streaming introduction for keyword: {keyword}")
        
        if not keyword or len(keyword.strip()) == 0:
            yield ""
            return
        
        try:
            # Build prompt
            prompt = self._build_intro_prompt(keyword, language)
            system_prompt = self._build_system_prompt(keyword, language)
            
            async for chunk in self.llm_service.chat_stream(
                prompt=prompt,
                model='qwen-plus',
                system_message=system_prompt,
                temperature=0.7,
                max_tokens=800
            ):
                if chunk:
                    yield chunk
                    
        except Exception as e:
            logger.error(f"[IntroductionService] Stream generation failed: {e}")
            yield ""
    
    def _build_system_prompt(self, keyword: str, language: str) -> str:
        """Build system prompt for introduction generation."""
        if language == 'zh':
            return (
                "你是一个知识分析专家，擅长从多角度分析和介绍各种概念和知识。"
                "请用中文回答，内容分2-3段，字数控制在300字左右。"
                "【最重要】第一句话必须严格按照格式："
                f"'对于{keyword}，可以从【角度1】、【角度2】、【角度3】、【角度4】四个方面进行分析。'"
                "其中角度要具体明确，如政治角度、经济角度、文化角度、社会角度、历史背景、现实意义等。"
            )
        else:
            return (
                "You are a knowledge analysis expert, skilled at analyzing and introducing "
                "various concepts and knowledge from multiple perspectives. "
                "Please respond in English, content should be 2-3 paragraphs, about 300 words. "
                f"【Most Important】The first sentence must strictly follow the format: "
                f"'For {keyword}, it can be analyzed from four aspects: [Angle 1], [Angle 2], [Angle 3], [Angle 4].' "
                "Where angles should be specific and clear, such as political perspective, "
                "economic perspective, cultural perspective, social perspective, historical background, practical significance, etc."
            )
    
    def _build_intro_prompt(self, keyword: str, language: str) -> str:
        """Build prompt for introduction generation."""
        if language == 'zh':
            return f"""请用2-3段话介绍"{keyword}"，要求：

## 🔴🔴🔴 最重要：第一句话格式（必须严格遵守）
**第一句话必须严格按照以下格式输出：**
"对于{keyword}，可以从【角度1】、【角度2】、【角度3】、【角度4】四个方面进行分析。"

**角度选择要求：**
- 根据"{keyword}"的内容特点，选择最合适的四个分析维度/方面/角度
- 角度名称要简洁明确（2-6个字），例如：政治角度、经济角度、文化角度、社会角度、历史背景、现实意义等
- 四个角度应该能够全面、系统地覆盖该主题的主要方面
- 角度之间应该相互独立，不要重复

## 内容结构要求：
1. **第一段（开头）**：
   - 第一句必须是"对于{keyword}，可以从【角度1】、【角度2】、【角度3】、【角度4】四个方面进行分析。"
   - 然后简要概述该主题的定义或核心概念

2. **第二段（展开）**：
   - 分别从四个角度展开说明
   - 每个角度1-2句话，解释该角度下的主要内容

3. **第三段（总结）**：
   - 综合分析，说明该主题的意义或影响

## 示例格式：
"对于辛亥革命的背景，可以从【政治角度】、【经济角度】、【思想角度】、【社会角度】四个方面进行分析。辛亥革命是中国近代史上具有重大意义的资产阶级民主革命..."

## 注意事项：
- 字数控制在300字左右
- 客观、准确、易懂
- 直接输出内容，不要有标题或其他格式标记

请直接输出介绍文本："""
        else:
            return f"""Please introduce "{keyword}" in 2-3 paragraphs, requirements:

## 🔴🔴🔴 Most Important: First Sentence Format (Must Strictly Follow)
**The first sentence must strictly follow this format:**
"For {keyword}, it can be analyzed from four aspects: [Angle 1], [Angle 2], [Angle 3], [Angle 4]."

**Angle Selection Requirements:**
- Based on the content characteristics of "{keyword}", choose the most appropriate four analysis dimensions/aspects/angles
- Angle names should be concise and clear (2-6 words), e.g., political perspective, economic perspective, cultural perspective, social perspective, historical background, practical significance, etc.
- The four angles should comprehensively and systematically cover the main aspects of the topic
- Angles should be independent of each other, no repetition

## Content Structure Requirements:
1. **First Paragraph (Introduction)**:
   - First sentence must be "For {keyword}, it can be analyzed from four aspects: [Angle 1], [Angle 2], [Angle 3], [Angle 4]."
   - Then briefly outline the definition or core concept of the topic

2. **Second Paragraph (Development)**:
   - Explain from the four angles respectively
   - 1-2 sentences per angle, explaining the main content under that angle

3. **Third Paragraph (Summary)**:
   - Comprehensive analysis, explaining the significance or impact of the topic

## Notes:
- About 300 words
- Objective, accurate, easy to understand
- Output content directly, no titles or other format markers

Please output the introduction text directly:"""


# Global instance
introduction_service = IntroductionService()


