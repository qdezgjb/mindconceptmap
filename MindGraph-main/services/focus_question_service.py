"""
Focus Question Service
======================

Service for extracting focus questions from user input text.
Based on concept-map-new-master/llm/focus-question-service.js

@author MindGraph Team
"""

import logging
import re
from typing import Dict, Optional

from services.llm_service import llm_service

logger = logging.getLogger(__name__)


class FocusQuestionService:
    """
    Service for extracting focus questions from text.
    
    Focus question types:
    - 是什么: Definition, concept class
    - 怎么样: Characteristics, evaluation class
    - 有哪些: Classification, enumeration class
    - 如何/怎样: Method, process class
    - 为什么: Reason, purpose class
    """
    
    def __init__(self):
        self.llm_service = llm_service
        logger.info("[FocusQuestionService] Initialized")
    
    async def extract_focus_question(
        self,
        text: str,
        language: str = 'zh',
        model: str = 'qwen',
        max_retries: int = 2
    ) -> Dict[str, any]:
        """
        Extract focus question from user input text.
        
        Args:
            text: User input text
            language: Language ('zh' or 'en')
            model: LLM model to use (default: 'qwen')
            max_retries: Maximum retry attempts
            
        Returns:
            Dict with 'success', 'focus_question', 'message' keys
        """
        logger.info(f"[FocusQuestionService] Extracting focus question, text length: {len(text)}, model: {model}")
        
        if not text or len(text.strip()) == 0:
            return {
                'success': False,
                'error': 'Empty text',
                'message': '输入文本不能为空'
            }
        
        last_error = None
        
        for attempt in range(max_retries):
            try:
                # Build prompt
                prompt = self._build_focus_question_prompt(text, language)
                system_prompt = self._build_system_prompt(language)
                
                # Call LLM with user-selected model
                response = await self.llm_service.chat(
                    prompt=prompt,
                    model=model,
                    system_message=system_prompt,
                    temperature=0.3,
                    max_tokens=100
                )
                
                if not response:
                    last_error = 'No response from LLM'
                    continue
                
                # Clean and validate focus question
                focus_question = self._clean_focus_question(response.strip())
                
                if self._validate_focus_question(focus_question):
                    logger.info(f"[FocusQuestionService] Successfully extracted: {focus_question}")
                    return {
                        'success': True,
                        'focus_question': focus_question,
                        'message': '焦点问题提取成功'
                    }
                else:
                    logger.warn(f"[FocusQuestionService] Attempt {attempt + 1}: Invalid focus question quality")
                    last_error = 'Focus question quality does not meet requirements'
                    
            except Exception as e:
                logger.error(f"[FocusQuestionService] Attempt {attempt + 1} failed: {e}")
                last_error = str(e)
        
        # All retries failed
        return {
            'success': False,
            'error': last_error or 'Unknown error',
            'message': f'焦点问题提取失败，已重试{max_retries}次'
        }
    
    def _build_system_prompt(self, language: str) -> str:
        """Build system prompt for focus question extraction."""
        if language == 'zh':
            return (
                "你是一个专业的知识分析专家，擅长从文本中提取核心主题和焦点问题。"
                "请用中文回答，输出必须简洁明确，只返回一个焦点问题，不超过20个字。"
            )
        else:
            return (
                "You are a professional knowledge analysis expert, skilled at extracting "
                "core themes and focus questions from text. Please respond in English, "
                "output must be concise and clear, return only one focus question, no more than 20 words."
            )
    
    def _build_focus_question_prompt(self, text: str, language: str) -> str:
        """Build prompt for focus question extraction."""
        if language == 'zh':
            return f"""# 任务：从文本中提取焦点问题

## 📋 用户输入的文本内容：
{text}

## 🎯 你的任务：
请仔细阅读上述文本，分析其核心主题，并提取出一个**简洁明确的焦点问题**。

## ⚠️ 严格要求：
1. **格式要求**：
   - 只输出一个焦点问题，不要任何额外的解释或说明
   - 不要使用引号、书名号等包裹
   - 不要添加"焦点问题："等前缀
   - 直接输出问题本身

2. **长度要求**：
   - 焦点问题必须简洁，不超过20个字
   - 避免冗长的描述

3. **内容要求**：
   - 必须是疑问句或陈述句
   - 能够概括文本的核心主题
   - 适合作为概念图的中心问题
   - 使用中文表达

4. **类型选择**：
   根据文本内容，选择最合适的问题类型：
   - **是什么**：适合定义、概念、本质类文本
   - **怎么样**：适合描述特点、状态、评价类文本
   - **有哪些**：适合分类、列举、要素类文本
   - **如何/怎样**：适合方法、过程、步骤类文本
   - **为什么**：适合原因、动机、目的类文本

## ✅ 正确示例：
- 文本："人工智能是计算机科学的一个分支..."
  输出：人工智能是什么

- 文本："机器学习主要包括监督学习、无监督学习和强化学习..."
  输出：机器学习的主要类型

## ❌ 错误示例：
❌ "人工智能是什么"（带引号）
✅ 人工智能是什么

❌ 焦点问题：机器学习的应用（带前缀）
✅ 机器学习的应用

请根据上述要求，从给定的文本中提取焦点问题，直接输出问题本身，不要任何额外内容。"""
        else:
            return f"""# Task: Extract focus question from text

## User Input Text:
{text}

## Your Task:
Please carefully read the text above, analyze its core theme, and extract a **concise and clear focus question**.

## Requirements:
1. **Format**:
   - Output only one focus question, no additional explanations
   - Do not use quotes or other wrappers
   - Do not add prefixes like "Focus question:"
   - Output the question itself directly

2. **Length**:
   - Must be concise, no more than 20 words
   - Avoid lengthy descriptions

3. **Content**:
   - Must be a question or statement
   - Should summarize the core theme of the text
   - Suitable as a central question for a concept map
   - Use English expression

4. **Type Selection**:
   Choose the most appropriate question type based on text content:
   - **What is**: Suitable for definition, concept, essence
   - **How is**: Suitable for characteristics, state, evaluation
   - **What are**: Suitable for classification, enumeration, elements
   - **How/How to**: Suitable for methods, processes, steps
   - **Why**: Suitable for reasons, motivations, purposes

Please extract the focus question according to the requirements above, output the question itself directly, no additional content."""
    
    def _clean_focus_question(self, question: str) -> str:
        """Clean focus question (remove extra formatting)."""
        if not question:
            return ""
        
        cleaned = question.strip()
        
        # Remove prefixes
        prefixes = [
            '焦点问题：', '焦点问题:', '问题：', '问题:',
            '核心问题：', '核心问题:', '中心问题：', '中心问题:',
            '主题：', '主题:', '标题：', '标题:',
            'Focus question:', 'Focus question: ', 'Question:', 'Question: '
        ]
        for prefix in prefixes:
            if cleaned.startswith(prefix):
                cleaned = cleaned[len(prefix):].strip()
        
        # Remove quotes (Chinese and English)
        quotes = ['"', '"', '"', "'", "'", "「", "」", "『", "』"]
        for quote in quotes:
            if cleaned.startswith(quote):
                cleaned = cleaned[1:]
            if cleaned.endswith(quote):
                cleaned = cleaned[:-1]
        
        cleaned = cleaned.strip()
        
        # Limit length (if over 30 chars, try to truncate at break points)
        if len(cleaned) > 30:
            logger.warn(f"[FocusQuestionService] Focus question too long, truncating: {cleaned}")
            cleaned = cleaned[:20]
            
            # Try to find nearest break point
            break_points = ['。', '，', '、', '；', ' ']
            last_break = -1
            for bp in break_points:
                idx = cleaned.rfind(bp)
                if idx > last_break:
                    last_break = idx
            if last_break > 10:
                cleaned = cleaned[:last_break]
        
        return cleaned
    
    def _validate_focus_question(self, question: str) -> bool:
        """Validate focus question quality."""
        if not question or len(question) == 0:
            return False
        
        # Length check (2-30 characters)
        if len(question) < 2 or len(question) > 30:
            logger.warn(f"[FocusQuestionService] Invalid length: {len(question)}")
            return False
        
        # Should not contain invalid patterns
        invalid_patterns = [
            re.compile(r'^焦点问题', re.IGNORECASE),
            re.compile(r'^核心问题', re.IGNORECASE),
            re.compile(r'^问题：', re.IGNORECASE),
            re.compile(r'["「『]'),  # Should not have quotes
            re.compile(r'\n'),       # Should not have newlines
            re.compile(r'^【.*】')   # Should not have special markers
        ]
        
        for pattern in invalid_patterns:
            if pattern.search(question):
                logger.warn(f"[FocusQuestionService] Invalid format: {question}")
                return False
        
        return True


# Global instance
focus_question_service = FocusQuestionService()


