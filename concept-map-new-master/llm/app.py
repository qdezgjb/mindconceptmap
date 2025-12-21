#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
概念图自动生成系统 - DeepSeek API对话服务
"""

import os
import json
import requests
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from dotenv import load_dotenv
import logging
from openai import OpenAI

# 加载环境变量
load_dotenv()

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
        "expose_headers": ["Content-Type"],
        "supports_credentials": False
    }
})  # 允许跨域请求

# DeepSeek API配置
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')
DEEPSEEK_BASE_URL = os.getenv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com')
DEEPSEEK_MODEL = os.getenv('DEEPSEEK_MODEL', 'deepseek-chat')

# 阿里云百炼API配置
DASHSCOPE_API_KEY = os.getenv('DASHSCOPE_API_KEY', 'sk-c135ed36bdf047d68ad83aafc5ce2190')

#=============================================================================
# 阿里云百炼视觉API类
#=============================================================================

class AliyunVisionAPI:
    """阿里云百炼视觉API客户端"""
    
    def __init__(self, api_key=None):
        """初始化阿里云百炼API客户端
        
        Args:
            api_key: API密钥，如果不提供则从环境变量读取
        """
        self.api_key = api_key or os.getenv("DASHSCOPE_API_KEY")
        
        if not self.api_key:
            raise ValueError("阿里云百炼 API密钥未配置，请设置 DASHSCOPE_API_KEY 环境变量或传入 api_key 参数")
        
        # 创建OpenAI客户端（使用阿里云百炼的兼容接口）
        self.client = OpenAI(
            api_key=self.api_key,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
        )
        
        self.model = "qwen3-vl-plus"
        
        logger.info(f"阿里云百炼视觉API客户端初始化成功 (model: {self.model})")
    
    def analyze_concept_map(self, image_data, prompt=None):
        """分析概念图图片
        
        Args:
            image_data: 图片数据，可以是：
                - base64编码的字符串（带或不带data:image前缀）
                - 图片URL
            prompt: 分析提示词，如果不提供则使用默认提示词
            
        Returns:
            dict: 包含分析结果的字典
                {
                    "success": bool,
                    "analysis": str,  # 分析结果文本
                    "error": str      # 错误信息（如果失败）
                }
        """
        if prompt is None:
            prompt = """请根据滑铁卢大学卓越教学中心的概念图评价标准，对这张概念图进行专业评价分析。

请从以下6个维度进行评估（每项满分10分，总分60分）：

**1. 网络广度 (Breadth of net) - 10分**
评分标准：
- 优秀(8-10分)：包含重要概念，在多个层次上描述领域
- 良好(6-7分)：包含大多数重要概念，在有限层次上描述领域
- 较差(3-5分)：缺少重要概念，仅在一个层次上描述领域
- 不及格(0-2分)：包含最少概念，缺失许多重要概念

**2. 嵌入性和互联性 (Embeddedness and inter-connectedness) - 10分**
评分标准：
- 优秀(8-10分)：所有概念与多个其他概念相互链接
- 良好(6-7分)：大多数概念与其他概念相互链接
- 较差(3-5分)：少数概念与其他概念链接
- 不及格(0-2分)：很少概念与其他概念链接

**3. 描述性链接的使用 (Use of descriptive links) - 10分**
评分标准：
- 优秀(8-10分)：链接简洁准确地描述所有关系
- 良好(6-7分)：链接对大多数关系具有描述性和有效性
- 较差(3-5分)：一些链接不清晰、模糊或无效
- 不及格(0-2分)：链接模糊，显示不一致的关系

**4. 链接效率 (Efficient links) - 10分**
评分标准：
- 优秀(8-10分)：每种链接类型与其他链接明确区分，清晰描述关系，使用一致
- 良好(6-7分)：大多数链接相互区分，区分概念，呈现多种关系类型，使用相当一致
- 较差(3-5分)：多个链接同义，不能很好地区分概念，没有显示多样化的关系，使用不一致
- 不及格(0-2分)：大多数链接同义或模糊描述关系，与其他链接不区分

**5. 布局 (Layout) - 10分**
评分标准：
- 优秀(8-10分)：地图包含在单页中，有多个清晰的层次结构，布局合理，提供足够数量的相关示例和链接
- 良好(6-7分)：地图包含在单页中，有几个清晰的层次结构，布局相当合理，提供足够数量的相关示例和链接
- 较差(3-5分)：地图未包含在单页中，层次结构不清晰，布局不佳，提供一些相关示例和链接
- 不及格(0-2分)：地图未包含在单页中，难以阅读，没有层次组织

**6. 随时间的发展 (Development over time) - 10分**
评分标准（如果适用）：
- 优秀(8-10分)：最终地图显示出从基础地图开始的显著认知进步和对领域理解深度的显著提升
- 良好(6-7分)：最终地图显示出从基础地图开始的一些认知进步和对领域理解深度的适度提升
- 较差(3-5分)：最终地图显示出从基础地图开始的最小认知进步和对领域理解深度的轻微提升
- 不及格(0-2分)：最终地图显示出从基础地图开始没有显著认知进步，对领域理解深度没有提升
注：如果这是单次评价而非过程性评价，此维度可评估概念图本身的深度和完整性。

**请按以下格式输出评价结果：**

【总体评价】
（用1-2句话概括概念图的整体质量）

【各维度评分】
1. 网络广度：X/10分
   - 优点：...
   - 不足：...

2. 嵌入性和互联性：X/10分
   - 优点：...
   - 不足：...

3. 描述性链接的使用：X/10分
   - 优点：...
   - 不足：...

4. 链接效率：X/10分
   - 优点：...
   - 不足：...

5. 布局：X/10分
   - 优点：...
   - 不足：...

6. 随时间的发展：X/10分
   - 优点：...
   - 不足：...

【总分】X/60分

【整体优点】
（列出2-3个主要亮点）

【主要问题】
（列出2-3个需要改进的方面）

【改进建议】
（针对每个问题给出具体的改进建议）

请用中文回答，语言要专业且易懂。"""
        
        try:
            logger.info("开始调用阿里云百炼视觉API分析概念图...")
            logger.info(f"使用提示词长度: {len(prompt)} 字符")
            
            # 处理图片数据
            if image_data.startswith('http://') or image_data.startswith('https://'):
                # 图片URL
                image_url = image_data
                logger.info(f"使用图片URL: {image_url[:100]}...")
            else:
                # base64编码的图片
                # 如果已经有data:image前缀，直接使用；否则添加前缀
                if not image_data.startswith('data:image'):
                    # 检测图片格式（默认为PNG）
                    if image_data.startswith('/9j/'):
                        image_url = f"data:image/jpeg;base64,{image_data}"
                    else:
                        image_url = f"data:image/png;base64,{image_data}"
                else:
                    image_url = image_data
                
                logger.info(f"使用base64编码图片，数据长度: {len(image_data)} 字符")
            
            # 调用API
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_url
                                },
                            },
                            {
                                "type": "text",
                                "text": prompt
                            },
                        ],
                    },
                ],
                temperature=0.7,
                top_p=0.9
            )
            
            # 提取分析结果
            analysis = completion.choices[0].message.content
            
            logger.info(f"概念图分析完成，结果长度: {len(analysis)} 字符")
            
            return {
                "success": True,
                "analysis": analysis
            }
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"概念图分析失败: {error_msg}", exc_info=True)
            
            # 处理特定的API错误，提供更友好的错误信息
            if "inappropriate content" in error_msg.lower():
                friendly_error = "图片内容可能包含不当内容，被API安全检测拦截。请尝试：\n1. 检查图片内容是否包含敏感信息\n2. 尝试使用其他图片\n3. 如果图片内容正常，可能是API误判，请稍后重试"
            elif "APIError" in str(type(e)):
                friendly_error = f"API调用失败: {error_msg}\n请检查API密钥配置和网络连接"
            else:
                friendly_error = f"分析失败: {error_msg}"
            
            return {
                "success": False,
                "error": friendly_error
            }
    
    def analyze_concept_map_simple(self, image_data, question=None):
        """简单的概念图分析（用于快速回答用户问题）
        
        Args:
            image_data: 图片数据
            question: 用户问题，如果不提供则使用默认问题
            
        Returns:
            dict: 包含分析结果的字典
        """
        if question is None:
            question = "请简要描述这张概念图的主要内容和结构。"
        
        return self.analyze_concept_map(image_data, prompt=question)
    
    def analyze_concept_map_stream(self, image_data, prompt=None):
        """流式分析概念图图片
        
        Args:
            image_data: 图片数据，可以是：
                - base64编码的字符串（带或不带data:image前缀）
                - 图片URL
            prompt: 分析提示词，如果不提供则使用默认提示词
            
        Yields:
            dict: 流式输出的数据块
        """
        if prompt is None:
            prompt = """请根据滑铁卢大学卓越教学中心的概念图评价标准，对这张概念图进行专业评价分析。

请从以下6个维度进行评估（每项满分10分，总分60分）：

**1. 网络广度 (Breadth of net) - 10分**
评分标准：
- 优秀(8-10分)：包含重要概念，在多个层次上描述领域
- 良好(6-7分)：包含大多数重要概念，在有限层次上描述领域
- 较差(3-5分)：缺少重要概念，仅在一个层次上描述领域
- 不及格(0-2分)：包含最少概念，缺失许多重要概念

**2. 嵌入性和互联性 (Embeddedness and inter-connectedness) - 10分**
评分标准：
- 优秀(8-10分)：所有概念与多个其他概念相互链接
- 良好(6-7分)：大多数概念与其他概念相互链接
- 较差(3-5分)：少数概念与其他概念链接
- 不及格(0-2分)：很少概念与其他概念链接

**3. 描述性链接的使用 (Use of descriptive links) - 10分**
评分标准：
- 优秀(8-10分)：链接简洁准确地描述所有关系
- 良好(6-7分)：链接对大多数关系具有描述性和有效性
- 较差(3-5分)：一些链接不清晰、模糊或无效
- 不及格(0-2分)：链接模糊，显示不一致的关系

**4. 链接效率 (Efficient links) - 10分**
评分标准：
- 优秀(8-10分)：每种链接类型与其他链接明确区分，清晰描述关系，使用一致
- 良好(6-7分)：大多数链接相互区分，区分概念，呈现多种关系类型，使用相当一致
- 较差(3-5分)：多个链接同义，不能很好地区分概念，没有显示多样化的关系，使用不一致
- 不及格(0-2分)：大多数链接同义或模糊描述关系，与其他链接不区分

**5. 布局 (Layout) - 10分**
评分标准：
- 优秀(8-10分)：地图包含在单页中，有多个清晰的层次结构，布局合理，提供足够数量的相关示例和链接
- 良好(6-7分)：地图包含在单页中，有几个清晰的层次结构，布局相当合理，提供足够数量的相关示例和链接
- 较差(3-5分)：地图未包含在单页中，层次结构不清晰，布局不佳，提供一些相关示例和链接
- 不及格(0-2分)：地图未包含在单页中，难以阅读，没有层次组织

**6. 随时间的发展 (Development over time) - 10分**
评分标准（如果适用）：
- 优秀(8-10分)：最终地图显示出从基础地图开始的显著认知进步和对领域理解深度的显著提升
- 良好(6-7分)：最终地图显示出从基础地图开始的一些认知进步和对领域理解深度的适度提升
- 较差(3-5分)：最终地图显示出从基础地图开始的最小认知进步和对领域理解深度的轻微提升
- 不及格(0-2分)：最终地图显示出从基础地图开始没有显著认知进步，对领域理解深度没有提升
注：如果这是单次评价而非过程性评价，此维度可评估概念图本身的深度和完整性。

**请按以下格式输出评价结果：**

【总体评价】
（用1-2句话概括概念图的整体质量）

【各维度评分】
1. 网络广度：X/10分
   - 优点：...
   - 不足：...

2. 嵌入性和互联性：X/10分
   - 优点：...
   - 不足：...

3. 描述性链接的使用：X/10分
   - 优点：...
   - 不足：...

4. 链接效率：X/10分
   - 优点：...
   - 不足：...

5. 布局：X/10分
   - 优点：...
   - 不足：...

6. 随时间的发展：X/10分
   - 优点：...
   - 不足：...

【总分】X/60分

【整体优点】
（列出2-3个主要亮点）

【主要问题】
（列出2-3个需要改进的方面）

【改进建议】
（针对每个问题给出具体的改进建议）

请用中文回答，语言要专业且易懂。"""
        
        try:
            logger.info("开始调用阿里云百炼视觉API流式分析概念图...")
            logger.info(f"使用提示词长度: {len(prompt)} 字符")
            
            # 处理图片数据
            if image_data.startswith('http://') or image_data.startswith('https://'):
                # 图片URL
                image_url = image_data
                logger.info(f"使用图片URL: {image_url[:100]}...")
            else:
                # base64编码的图片
                if not image_data.startswith('data:image'):
                    if image_data.startswith('/9j/'):
                        image_url = f"data:image/jpeg;base64,{image_data}"
                    else:
                        image_url = f"data:image/png;base64,{image_data}"
                else:
                    image_url = image_data
                
                logger.info(f"使用base64编码图片，数据长度: {len(image_data)} 字符")
            
            # 调用流式API
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_url
                                },
                            },
                            {
                                "type": "text",
                                "text": prompt
                            },
                        ],
                    },
                ],
                temperature=0.7,
                top_p=0.9,
                stream=True
            )
            
            # 流式输出
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    yield {"content": content, "done": False}
            
            # 流结束
            logger.info("概念图流式分析完成")
            yield {"done": True}
                
        except Exception as e:
            error_msg = str(e)
            logger.error(f"概念图流式分析失败: {error_msg}", exc_info=True)
            
            # 处理特定的API错误，提供更友好的错误信息
            if "inappropriate content" in error_msg.lower():
                friendly_error = "图片内容可能包含不当内容，被API安全检测拦截。请尝试：\n1. 检查图片内容是否包含敏感信息\n2. 尝试使用其他图片\n3. 如果图片内容正常，可能是API误判，请稍后重试"
            elif "APIError" in str(type(e)):
                friendly_error = f"API调用失败: {error_msg}\n请检查API密钥配置和网络连接"
            else:
                friendly_error = f"分析失败: {error_msg}"
            
            yield {"error": friendly_error, "done": True}

class DeepSeekAPI:
    """DeepSeek API客户端（使用OpenAI SDK）"""
    
    def __init__(self):
        self.api_key = DEEPSEEK_API_KEY
        self.base_url = DEEPSEEK_BASE_URL
        self.model = DEEPSEEK_MODEL
        
        if not self.api_key:
            raise ValueError("DeepSeek API密钥未配置")
        
        # 创建OpenAI客户端
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )
        
        logger.info(f"DeepSeek API客户端初始化成功 (model: {self.model}, base_url: {self.base_url})")
    
    def chat(self, message, max_tokens=None, temperature=0.3, max_retries=2, system_prompt=None, timeout=60):
        """与DeepSeek对话，支持重试机制
        
        优化参数：
        - max_tokens: None (不限制输出长度，让模型完整输出)
        - temperature: 0.3 (降低随机性，更快更集中)
        - max_retries: 2 (增加重试次数，提高成功率)
        - timeout: 60 (60秒超时，防止长时间等待)
        """
        # 如果没有指定system_prompt，使用默认的
        if system_prompt is None:
            system_prompt = "你是一个专业的知识提取助手。请严格按照要求的格式输出，不要添加任何额外的解释或说明。"
        
        for attempt in range(max_retries + 1):
            try:
                logger.info(f"尝试第 {attempt + 1} 次调用DeepSeek API...")
                logger.info(f"消息长度: {len(message)} 字符")
                
                # 构建API调用参数
                api_params = {
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": message}
                    ],
                    "temperature": temperature,
                    "stream": False,
                    "top_p": 0.9,
                    "timeout": timeout
                }
                
                # 只有当 max_tokens 不为 None 时才添加该参数
                if max_tokens is not None:
                    api_params["max_tokens"] = max_tokens
                    logger.info(f"使用 max_tokens 限制: {max_tokens}")
                else:
                    logger.info("不限制 max_tokens，让模型完整输出")
                
                response = self.client.chat.completions.create(**api_params)
                
                content = response.choices[0].message.content
                logger.info(f"DeepSeek API调用成功，返回内容长度: {len(content)} 字符")
                return {
                    "success": True,
                    "response": content
                }
                    
            except Exception as e:
                error_msg = str(e)
                logger.error(f"第 {attempt + 1} 次调用失败: {error_msg}")
                
                # 区分超时错误和其他错误
                if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
                    logger.error("API调用超时")
                    if attempt == max_retries:
                        return {
                            "success": False,
                            "error": f"API调用超时（{timeout}秒），请稍后重试或使用更简短的文本"
                        }
                else:
                    if attempt == max_retries:
                        return {
                            "success": False,
                            "error": f"API调用失败: {error_msg}"
                        }
                continue
    
    def chat_stream(self, message, max_tokens=None, temperature=0.7, system_prompt=None):
        """与DeepSeek对话（流式输出）
        
        参数：
        - max_tokens: None (不限制输出长度，让模型完整输出)
        - temperature: 0.7 (适中的随机性，生成更自然的文本)
        """
        # 如果没有指定system_prompt，使用默认的
        if system_prompt is None:
            system_prompt = "你是一个知识介绍专家，擅长用简洁清晰的语言介绍各种概念和知识。"
        
        try:
            logger.info("开始流式调用DeepSeek API...")
            
            # 构建API调用参数
            api_params = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message}
                ],
                "temperature": temperature,
                "stream": True,
                "top_p": 0.9
            }
            
            # 只有当 max_tokens 不为 None 时才添加该参数
            if max_tokens is not None:
                api_params["max_tokens"] = max_tokens
                logger.info(f"流式输出使用 max_tokens 限制: {max_tokens}")
            else:
                logger.info("流式输出不限制 max_tokens，让模型完整输出")
            
            stream = self.client.chat.completions.create(**api_params)
            
            # 流式输出
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    yield {"content": content, "done": False}
            
            # 流结束
            logger.info("流式输出完成")
            yield {"done": True}
                
        except Exception as e:
            logger.error(f"流式API调用异常: {str(e)}", exc_info=True)
            yield {"error": str(e), "done": True}

# 创建DeepSeek API实例
try:
    deepseek_api = DeepSeekAPI()
except ValueError as e:
    logger.error(f"DeepSeek API初始化失败: {e}")
    deepseek_api = None

# 创建阿里云百炼视觉API实例
try:
    aliyun_vision_api = AliyunVisionAPI(api_key=DASHSCOPE_API_KEY)
except Exception as e:
    logger.error(f"阿里云百炼视觉API初始化失败: {e}")
    aliyun_vision_api = None

@app.route('/api/chat', methods=['POST'])
def chat_with_deepseek():
    """与DeepSeek对话接口（非流式）"""
    from datetime import datetime
    request_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
    logger.info(f"📥 [/api/chat] 收到请求 - 时间: {request_time}")
    
    if not deepseek_api:
        return jsonify({
            "success": False,
            "error": "DeepSeek API未配置"
        }), 500
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "请求数据为空"
            }), 400
        
        message = data.get('message', '').strip()
        
        if not message:
            return jsonify({
                "success": False,
                "error": "消息内容为空"
            }), 400
        
        logger.info(f"收到对话请求: {message[:50]}...")
        
        # 记录开始时间
        import time
        start_time = time.time()
        
        # 调用DeepSeek API
        result = deepseek_api.chat(message)
        
        # 计算响应时间
        elapsed_time = time.time() - start_time
        logger.info(f"DeepSeek API响应时间: {elapsed_time:.2f}秒")
        
        if result["success"]:
            logger.info("对话成功")
            return jsonify(result)
        else:
            logger.error(f"对话失败: {result['error']}")
            return jsonify(result), 500
            
    except Exception as e:
        logger.error(f"处理请求时发生错误: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"服务器内部错误: {str(e)}"
        }), 500

@app.route('/api/chat/stream', methods=['POST', 'OPTIONS'])
def chat_with_deepseek_stream():
    """与DeepSeek对话接口（流式输出）"""
    from datetime import datetime
    request_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
    logger.info(f"📥 [/api/chat/stream] 收到请求 - 时间: {request_time}")
    
    # 处理OPTIONS预检请求
    if request.method == 'OPTIONS':
        response = app.make_response('')
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Accept'
        response.headers['Access-Control-Max-Age'] = '3600'
        return response
    
    if not deepseek_api:
        return jsonify({
            "success": False,
            "error": "DeepSeek API未配置"
        }), 500
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "请求数据为空"
            }), 400
        
        message = data.get('message', '').strip()
        
        if not message:
            return jsonify({
                "success": False,
                "error": "消息内容为空"
            }), 400
        
        logger.info(f"收到流式对话请求: {message[:50]}...")
        
        # 获取system_prompt参数（如果有）
        system_prompt = data.get('system_prompt', None)
        
        # 调用流式API
        def generate():
            try:
                chunk_count = 0
                for chunk in deepseek_api.chat_stream(message, system_prompt=system_prompt):
                    if chunk:
                        chunk_count += 1
                        chunk_str = json.dumps(chunk, ensure_ascii=False)
                        yield f"data: {chunk_str}\n\n"
                        
                logger.info(f"流式输出完成，共发送 {chunk_count} 个chunk")
                # 发送结束标记
                yield f"data: {json.dumps({'done': True}, ensure_ascii=False)}\n\n"
                        
            except Exception as e:
                logger.error(f"流式输出错误: {str(e)}", exc_info=True)
                yield f"data: {json.dumps({'error': str(e), 'done': True}, ensure_ascii=False)}\n\n"
        
        response = app.response_class(
            generate(),
            mimetype='text/event-stream'
        )
        response.headers['Cache-Control'] = 'no-cache'
        response.headers['X-Accel-Buffering'] = 'no'
        response.headers['Connection'] = 'close'  # 关键修复：响应完成后立即关闭连接
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response
            
    except Exception as e:
        logger.error(f"处理流式请求时发生错误: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"服务器内部错误: {str(e)}"
        }), 500

@app.route('/api/analyze-concept-map', methods=['POST', 'OPTIONS'])
def analyze_concept_map():
    """分析概念图接口（非流式）"""
    from datetime import datetime
    request_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
    logger.info(f"📥 [/api/analyze-concept-map] 收到请求 - 时间: {request_time}")
    
    # 处理OPTIONS预检请求
    if request.method == 'OPTIONS':
        response = app.make_response('')
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Accept'
        response.headers['Access-Control-Max-Age'] = '3600'
        return response
    
    if not aliyun_vision_api:
        return jsonify({
            "success": False,
            "error": "阿里云百炼视觉API未配置"
        }), 500
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "请求数据为空"
            }), 400
        
        image_data = data.get('image_data', '').strip()
        custom_prompt = data.get('prompt', None)
        
        if not image_data:
            return jsonify({
                "success": False,
                "error": "图片数据为空"
            }), 400
        
        logger.info(f"收到概念图分析请求，图片数据长度: {len(image_data)} 字符")
        
        # 记录开始时间
        import time
        start_time = time.time()
        
        # 调用阿里云百炼视觉API
        result = aliyun_vision_api.analyze_concept_map(image_data, prompt=custom_prompt)
        
        # 计算响应时间
        elapsed_time = time.time() - start_time
        logger.info(f"阿里云百炼API响应时间: {elapsed_time:.2f}秒")
        
        if result["success"]:
            logger.info("概念图分析成功")
            return jsonify(result)
        else:
            logger.error(f"概念图分析失败: {result.get('error', '未知错误')}")
            return jsonify(result), 500
            
    except Exception as e:
        logger.error(f"处理概念图分析请求时发生错误: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": f"服务器内部错误: {str(e)}"
        }), 500

@app.route('/api/analyze-concept-map/stream', methods=['POST', 'OPTIONS'])
def analyze_concept_map_stream():
    """分析概念图接口（流式输出）"""
    from datetime import datetime
    request_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
    logger.info(f"📥 [/api/analyze-concept-map/stream] 收到请求 - 时间: {request_time}")
    
    # 处理OPTIONS预检请求
    if request.method == 'OPTIONS':
        response = app.make_response('')
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Accept'
        response.headers['Access-Control-Max-Age'] = '3600'
        return response
    
    if not aliyun_vision_api:
        return jsonify({
            "success": False,
            "error": "阿里云百炼视觉API未配置"
        }), 500
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "请求数据为空"
            }), 400
        
        image_data = data.get('image_data', '').strip()
        custom_prompt = data.get('prompt', None)
        
        if not image_data:
            return jsonify({
                "success": False,
                "error": "图片数据为空"
            }), 400
        
        logger.info(f"收到概念图流式分析请求，图片数据长度: {len(image_data)} 字符")
        
        # 调用流式API
        def generate():
            try:
                chunk_count = 0
                for chunk in aliyun_vision_api.analyze_concept_map_stream(image_data, prompt=custom_prompt):
                    if chunk:
                        chunk_count += 1
                        chunk_str = json.dumps(chunk, ensure_ascii=False)
                        yield f"data: {chunk_str}\n\n"
                        
                logger.info(f"概念图流式分析完成，共发送 {chunk_count} 个chunk")
                # 发送结束标记
                yield f"data: {json.dumps({'done': True}, ensure_ascii=False)}\n\n"
                        
            except Exception as e:
                logger.error(f"流式分析错误: {str(e)}", exc_info=True)
                yield f"data: {json.dumps({'error': str(e), 'done': True}, ensure_ascii=False)}\n\n"
        
        response = app.response_class(
            generate(),
            mimetype='text/event-stream'
        )
        response.headers['Cache-Control'] = 'no-cache'
        response.headers['X-Accel-Buffering'] = 'no'
        response.headers['Connection'] = 'close'
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response
            
    except Exception as e:
        logger.error(f"处理流式分析请求时发生错误: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": f"服务器内部错误: {str(e)}"
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        "status": "healthy",
        "api_configured": deepseek_api is not None,
        "aliyun_vision_configured": aliyun_vision_api is not None,
        "timestamp": "2024-01-01T00:00:00Z"
    })

@app.route('/')
def index():
    """提供主页"""
    import os
    # 获取项目根目录
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    web_dir = os.path.join(parent_dir, 'web')
    index_path = os.path.join(web_dir, 'index.html')
    
    if os.path.exists(index_path):
        from flask import send_file
        return send_file(index_path)
    else:
        return "index.html not found", 404

@app.route('/web/<path:filename>')
def serve_web_static(filename):
    """提供web目录的静态文件"""
    import os
    from flask import send_from_directory
    
    # 获取web目录
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    web_dir = os.path.join(parent_dir, 'web')
    
    return send_from_directory(web_dir, filename)

@app.route('/algorithm/<path:filename>')
def serve_algorithm_static(filename):
    """提供algorithm目录的静态文件"""
    import os
    from flask import send_from_directory
    
    # 获取algorithm目录
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    algorithm_dir = os.path.join(parent_dir, 'algorithm')
    
    return send_from_directory(algorithm_dir, filename)

@app.route('/llm/<path:filename>')
def serve_llm_static(filename):
    """提供llm目录的静态文件"""
    import os
    from flask import send_from_directory
    
    # 获取llm目录
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    return send_from_directory(current_dir, filename)

@app.route('/agent/<path:filename>')
def serve_agent_static(filename):
    """提供agent目录的静态文件"""
    import os
    from flask import send_from_directory
    
    # 获取agent目录（llm目录的父目录下的agent目录）
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    agent_dir = os.path.join(parent_dir, 'agent')
    
    return send_from_directory(agent_dir, filename)

if __name__ == '__main__':
    # 优先使用环境变量中的端口，如果没有则使用5000
    port = int(os.getenv('FLASK_PORT', os.getenv('PORT', 5000)))
    debug = os.getenv('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"启动DeepSeek对话服务，端口: {port}")
    logger.info(f"DeepSeek API配置状态: {'已配置' if deepseek_api else '未配置'}")
    
    # 启动Flask服务
    import threading
    import time
    import webbrowser
    
    # 使用全局标志防止重复打开浏览器
    browser_opened = False
    
    def open_browser():
        """立即打开浏览器"""
        global browser_opened
        
        # 防止重复打开浏览器
        if browser_opened:
            return
        
        # 检查是否是Werkzeug重启的子进程
        if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
            # 这是reload后的子进程，不打开浏览器
            return
        
        try:
            # 直接打开HTTP服务地址，避免file://协议导致的CORS问题
            url = f"http://localhost:{port}"
            webbrowser.open(url)
            logger.info(f"已自动打开浏览器: {url}")
            
            # 标记浏览器已打开
            browser_opened = True
            
        except Exception as e:
            logger.error(f"自动打开浏览器失败: {e}")
    
    # 只在主进程中打开浏览器（只打开一次）
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        # 延迟1秒等待服务启动完成
        def delayed_open():
            time.sleep(1)
            open_browser()
        
        # 在新线程中启动浏览器
        browser_thread = threading.Thread(target=delayed_open, daemon=True)
        browser_thread.start()
        logger.info("服务启动中，立即自动打开浏览器...")
    else:
        logger.info("检测到Werkzeug重启，跳过浏览器打开（避免重复）")
    
    app.run(host='0.0.0.0', port=port, debug=debug) 