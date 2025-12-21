# MindGraph 系统代码审查文档

> 版本: 4.29.2  
> 审查日期: 2025年12月18日

---

## 目录

1. [系统概述](#1-系统概述)
2. [系统架构](#2-系统架构)
3. [模块详解](#3-模块详解)
   - [入口模块 (main.py)](#31-入口模块-mainpy)
   - [配置模块 (config/)](#32-配置模块-config)
   - [数据模型 (models/)](#33-数据模型-models)
   - [路由模块 (routers/)](#34-路由模块-routers)
   - [服务模块 (services/)](#35-服务模块-services)
   - [代理模块 (agents/)](#36-代理模块-agents)
   - [客户端模块 (clients/)](#37-客户端模块-clients)
   - [工具模块 (utils/)](#38-工具模块-utils)
   - [提示词模块 (prompts/)](#39-提示词模块-prompts)
   - [前端模块 (static/, templates/)](#310-前端模块-static-templates)
4. [数据流程](#4-数据流程)
5. [技术特点](#5-技术特点)

---

## 1. 系统概述

MindGraph 是一个基于 AI 的教育思维导图生成系统，专为 K12 教育场景设计。系统支持多种图表类型（10种思维导图 + 9种思维工具），通过集成多个大语言模型（Qwen、DeepSeek、Kimi、Hunyuan、Doubao）实现智能化的图表生成和教学辅助。

### 核心功能
- **10种思维导图类型**：圆圈图、气泡图、双气泡图、树形图、流程图、多流程图、括号图、桥形图、概念图、思维导图
- **9种思维工具**：因素分析、三方位分析、视角分析、目标分析、可能性分析、结果分析、5W1H分析、WHWM分析、四象限分析
- **AI 驱动**：智能图表生成、苏格拉底式引导教学（ThinkGuide）、节点调色板无限滚动
- **语音交互**：基于 Qwen Omni 的实时语音对话
- **多端支持**：Web 前端、DingTalk 集成
- **安全认证**：JWT Token、手机短信验证、IP 白名单（八一模式）

---

## 2. 系统架构

```
MindGraph/
├── main.py                    # 应用入口点
├── config/                    # 配置模块
│   ├── settings.py            # 集中式配置管理
│   └── database.py            # 数据库配置与管理
├── models/                    # 数据模型
│   ├── auth.py                # 认证相关数据库模型
│   ├── requests.py            # API 请求模型 (Pydantic)
│   ├── responses.py           # API 响应模型 (Pydantic)
│   ├── common.py              # 通用枚举与类型
│   ├── messages.py            # 双语消息系统
│   └── token_usage.py         # Token 使用记录模型
├── routers/                   # API 路由层
│   ├── api.py                 # 核心 API 端点
│   ├── pages.py               # 页面路由
│   ├── auth.py                # 认证 API
│   ├── thinking.py            # ThinkGuide API
│   ├── voice.py               # 语音 API
│   ├── admin_env.py           # 管理员环境 API
│   ├── admin_logs.py          # 日志管理 API
│   ├── cache.py               # 缓存管理 API
│   ├── tab_mode.py            # Tab 模式 API
│   └── update_notification.py # 更新通知 API
├── services/                  # 业务服务层
│   ├── llm_service.py         # LLM 统一服务
│   ├── error_handler.py       # 错误处理与重试
│   ├── rate_limiter.py        # 速率限制
│   ├── token_tracker.py       # Token 使用追踪
│   ├── browser.py             # 浏览器管理 (PNG 导出)
│   ├── voice_agent.py         # 语音代理服务
│   ├── backup_scheduler.py    # 数据库备份调度
│   ├── captcha_storage.py     # 验证码存储
│   ├── sms_middleware.py      # 短信中间件
│   └── ...                    # 其他服务
├── agents/                    # AI 代理层
│   ├── main_agent.py          # 主代理 (图表生成入口)
│   ├── core/                  # 核心代理基类
│   │   └── base_agent.py      # 抽象基类
│   ├── thinking_maps/         # 思维导图代理
│   ├── mind_maps/             # 思维导图代理
│   ├── concept_maps/          # 概念图代理
│   ├── thinking_tools/        # 思维工具代理
│   └── thinking_modes/        # ThinkGuide 模式代理
├── clients/                   # LLM 客户端
│   ├── llm.py                 # 多 LLM 客户端
│   ├── omni_client.py         # Qwen Omni WebSocket 客户端
│   └── dify.py                # Dify API 客户端
├── utils/                     # 工具函数
│   ├── auth.py                # 认证工具
│   ├── invitations.py         # 邀请码工具
│   ├── db_migration.py        # 数据库迁移
│   └── env_utils.py           # 环境变量工具
├── prompts/                   # LLM 提示词库
│   ├── __init__.py            # 提示词注册中心
│   ├── thinking_maps/         # 思维导图提示词
│   ├── concept_maps/          # 概念图提示词
│   ├── mind_maps/             # 思维导图提示词
│   ├── thinking_tools/        # 思维工具提示词
│   ├── voice_agent/           # 语音代理提示词
│   └── tab_mode/              # Tab 模式提示词
├── static/                    # 前端静态资源
│   ├── js/                    # JavaScript 文件
│   │   ├── renderers/         # D3.js 图表渲染器
│   │   ├── core/              # 核心 JS 模块
│   │   └── ...                # 其他 JS 文件
│   ├── css/                   # 样式表
│   └── fonts/                 # 字体文件
├── templates/                 # HTML 模板
│   ├── index.html             # 登陆页
│   ├── editor.html            # 编辑器页面
│   ├── auth.html              # 认证页面
│   └── ...                    # 其他页面
└── data/                      # 数据目录
    ├── mindgraph.db           # SQLite 数据库
    ├── backups/               # 数据库备份
    └── temp_images/           # 临时图片
```

---

## 3. 模块详解

### 3.1 入口模块 (main.py)

**文件**: `main.py`  
**功能**: 应用入口点，负责初始化整个 FastAPI 应用

#### 核心函数

| 函数名 | 功能描述 |
|--------|----------|
| `_handle_shutdown_signal(sig, frame)` | 优雅处理 SIGINT/SIGTERM 信号，确保资源正确释放 |
| `_check_port_available(port)` | 检查指定端口是否可用 |
| `_find_process_on_port(port)` | 查找占用指定端口的进程 |
| `_cleanup_stale_process(port)` | 清理僵尸进程（仅限 Windows 8000 端口） |
| `lifespan(app)` | 异步上下文管理器，管理应用生命周期（启动/关闭） |
| `add_security_headers(request, call_next)` | HTTP 中间件：添加安全头（CSP, X-Frame-Options 等） |
| `add_cache_control_headers(request, call_next)` | HTTP 中间件：管理静态文件和页面缓存 |
| `log_requests(request, call_next)` | HTTP 中间件：请求日志记录和慢请求监控 |
| `http_exception_handler(request, exc)` | 全局 HTTP 异常处理器 |
| `general_exception_handler(request, exc)` | 全局通用异常处理器 |
| `health_check()` | 健康检查端点 `/health` |
| `get_status()` | 状态查询端点 `/status` |

#### 关键类

| 类名 | 功能描述 |
|------|----------|
| `TimestampedRotatingFileHandler` | 自定义日志处理器，支持 72 小时日志轮转 |
| `UnifiedFormatter` | 统一日志格式器，支持 ANSI 颜色和来源缩写 |
| `CancelledErrorFilter` | 日志过滤器，过滤预期的 asyncio.CancelledError |

#### 启动流程

1. 加载环境变量 (`.env`)
2. 配置日志系统
3. 检查端口可用性
4. 初始化数据库
5. 初始化 LLM 服务
6. 启动后台调度器：
   - 临时图片清理 (`start_temp_image_cleaner`)
   - 验证码清理 (`start_captcha_cleanup_scheduler`)
   - WAL 检查点 (`start_wal_checkpoint_scheduler`)
   - 数据库备份 (`start_backup_scheduler`)
7. 配置中间件 (CORS, GZip, 安全头, 缓存控制, 请求日志)
8. 注册路由器

---

### 3.2 配置模块 (config/)

#### 3.2.1 settings.py

**功能**: 集中式配置管理，统一管理所有应用配置

##### Config 类属性

| 属性分类 | 属性名 | 说明 |
|----------|--------|------|
| **LLM 配置** | `QWEN_API_KEY` | 通义千问 API 密钥 |
| | `QWEN_MODEL_ID` | 生成模型 ID (qwen-plus) |
| | `QWEN_TURBO_MODEL_ID` | 分类模型 ID (qwen-turbo) |
| | `DEEPSEEK_MODEL_ID` | DeepSeek 模型 ID |
| | `KIMI_MODEL_ID` | Kimi (Moonshot) 模型 ID |
| | `HUNYUAN_*` | 腾讯混元配置 |
| | `DOUBAO_*` | 字节豆包配置 |
| **服务器配置** | `SERVER_HOST` | 服务器监听地址 |
| | `SERVER_PORT` | 服务器监听端口 |
| | `DEBUG` | 调试模式开关 |
| | `LOG_LEVEL` | 日志级别 |
| **功能开关** | `FEATURE_LEARNING_MODE` | 学习模式功能开关 |
| | `FEATURE_THINKGUIDE` | ThinkGuide 功能开关 |
| | `FEATURE_MINDMATE` | MindMate 功能开关 |
| | `FEATURE_VOICE_AGENT` | 语音代理功能开关 |
| | `FEATURE_DRAG_AND_DROP` | 拖放功能开关 |
| | `FEATURE_TAB_MODE` | Tab 模式功能开关 |
| **D3.js 配置** | `D3_*` | D3.js 可视化相关配置 |
| **Qwen Omni** | `QWEN_OMNI_*` | 语音对话相关配置 |

##### 主要方法

| 方法名 | 功能 |
|--------|------|
| `validate_qwen_config()` | 验证 Qwen 配置完整性 |
| `get_qwen_headers()` | 获取 Qwen API 请求头 |
| `get_qwen_data(prompt, model_id, temperature)` | 构造 Qwen API 请求体 |
| `get_llm_data(prompt, model_id, temperature)` | 构造通用 LLM API 请求体 |
| `prepare_llm_messages(prompt)` | 准备 LLM 消息格式 |
| `get_d3_dimensions()` | 获取 D3.js 维度配置 |
| `print_config_summary()` | 打印配置摘要 |

---

#### 3.2.2 database.py

**功能**: SQLAlchemy 数据库配置和管理

##### 核心函数

| 函数名 | 功能 |
|--------|------|
| `check_database_location_conflict()` | 关键安全检查：防止新旧数据库位置冲突导致数据混乱 |
| `migrate_old_database_if_needed()` | 自动迁移旧版数据库文件到 `data/` 目录 |
| `init_db()` | 数据库初始化：创建表、运行迁移、初始化数据 |
| `get_db()` | FastAPI 依赖注入：提供数据库会话 |
| `checkpoint_wal()` | 手动 WAL 检查点：合并 WAL 到主数据库 |
| `start_wal_checkpoint_scheduler()` | 启动定期 WAL 检查点调度器 |
| `check_disk_space(required_mb)` | 检查磁盘空间是否充足 |
| `check_integrity()` | SQLite 完整性检查 |
| `close_db()` | 关闭数据库连接 |

##### 数据库配置

- **数据库类型**: SQLite
- **WAL 模式**: 启用 (提高并发性能)
- **连接池**: 
  - `pool_pre_ping=True` (连接健康检查)
  - `pool_recycle=3600` (1小时连接回收)
- **数据库路径**: `data/mindgraph.db`

---

### 3.3 数据模型 (models/)

#### 3.3.1 auth.py - 数据库实体模型

| 模型名 | 说明 | 主要字段 |
|--------|------|----------|
| `Organization` | 组织/学校 | `id`, `code`, `name`, `invitation_code`, `expires_at`, `is_active` |
| `User` | 用户 (K12 教师) | `id`, `phone`, `password_hash`, `name`, `organization_id`, `failed_login_attempts`, `locked_until` |
| `APIKey` | API 密钥 | `id`, `key`, `name`, `quota_limit`, `usage_count`, `is_active`, `expires_at` |
| `UpdateNotification` | 更新通知 | `id`, `enabled`, `version`, `title`, `message`, `start_date`, `end_date` |
| `UpdateNotificationDismissed` | 通知关闭记录 | `id`, `user_id`, `version`, `dismissed_at` |
| `Captcha` | 验证码 | `id`, `code`, `expires_at` |
| `SMSVerification` | 短信验证码 | `id`, `phone`, `code`, `purpose`, `is_used`, `expires_at` |

#### 3.3.2 requests.py - API 请求模型 (Pydantic)

| 模型名 | 用途 |
|--------|------|
| `GenerateRequest` | 图表生成请求 |
| `ExportPNGRequest` | PNG 导出请求 |
| `AIAssistantRequest` | AI 助手请求 |
| `RegisterRequest` | 用户注册请求 |
| `LoginRequest` | 用户登录请求 |
| `SendSMSCodeRequest` | 发送短信验证码请求 |
| `ThinkingModeRequest` | ThinkGuide 模式请求 |
| `NodePaletteStartRequest` | 节点调色板启动请求 |
| `FeedbackRequest` | 用户反馈请求 |

#### 3.3.3 messages.py - 双语消息系统

**功能**: 提供中英文双语错误消息和提示信息

| 函数名 | 功能 |
|--------|------|
| `Messages.error(key, lang, *args)` | 获取本地化错误消息 |
| `Messages.success(key, lang, *args)` | 获取本地化成功消息 |
| `get_request_language(x_language, accept_language)` | 从请求头检测用户语言 |

---

### 3.4 路由模块 (routers/)

#### 3.4.1 api.py - 核心 API 端点

| 端点 | 方法 | 功能 |
|------|------|------|
| `/generate_graph` | POST | 生成图表规格 (JSON) |
| `/export_png` | POST | 导出图表为 PNG |
| `/generate_png` | POST | 一步生成 PNG (兼容旧版) |
| `/generate_dingtalk` | POST | DingTalk 集成 - 生成 PNG |
| `/ai_assistant/stream` | POST | AI 助手 SSE 流式响应 |
| `/recalculate_mindmap_layout` | POST | 重新计算思维导图布局 |
| `/llm/metrics` | GET | LLM 性能指标 |
| `/llm/health` | GET | LLM 服务健康检查 |
| `/generate_multi_parallel` | POST | 多 LLM 并行生成 |
| `/generate_multi_progressive` | POST | 多 LLM 渐进式流生成 |
| `/feedback` | POST | 提交用户反馈 |
| `/temp_images/{filename}` | GET | 临时图片服务 |

##### 核心函数

| 函数名 | 功能 |
|--------|------|
| `ai_assistant_stream(request)` | 调用 Dify API 进行 SSE 流式对话 |
| `generate_graph(request)` | 调用代理生成图表规格 |
| `export_png(request)` | 使用 Playwright 渲染并截图 |
| `stream_parallel_results(prompt, ...)` | 多 LLM 并行生成的 SSE 流 |

---

#### 3.4.2 pages.py - 页面路由

| 端点 | 功能 |
|------|------|
| `/` | 首页，根据 AUTH_MODE 重定向 |
| `/editor` | 主编辑器页面 (核心功能页面) |
| `/auth` | 认证页面 (标准模式登录/注册) |
| `/demo` | Demo/八一模式密钥页面 |
| `/loginByXz` | 八一模式加密 Token 认证端点 |
| `/debug` | 调试页面 (仅调试模式或管理员) |
| `/favicon.ico` | 网站图标 |

---

#### 3.4.3 auth.py - 认证 API

| 端点 | 方法 | 功能 |
|------|------|------|
| `/mode` | GET | 获取当前认证模式 |
| `/organizations` | GET | 获取组织列表 |
| `/register` | POST | 用户注册 |
| `/login` | POST | 用户登录 (密码+验证码) |
| `/demo/verify` | POST | Demo 密钥验证 |
| `/logout` | POST | 用户登出 |
| `/me` | GET | 获取当前用户信息 |
| `/sms/send` | POST | 发送短信验证码 |
| `/sms/login` | POST | 短信验证码登录 |
| `/captcha` | GET | 生成图形验证码 |
| `/captcha/verify` | POST | 验证图形验证码 |

##### 安全特性

- **验证码保护**: 图形验证码防机器人
- **速率限制**: 每 15 分钟最多 10 次登录尝试
- **账户锁定**: 10 次失败后锁定 5 分钟
- **密码哈希**: bcrypt 加密存储
- **JWT Token**: HTTP-only Cookie 存储

---

#### 3.4.4 thinking.py - ThinkGuide API

| 端点 | 方法 | 功能 |
|------|------|------|
| `/thinking_mode/stream` | POST | ThinkGuide 苏格拉底式引导 SSE 流 |
| `/thinking_mode/node_learning/{session_id}/{node_id}` | GET | 获取节点学习材料 |
| `/thinking_mode/node_palette/start` | POST | 启动节点调色板 (5 LLM 并发) |
| `/thinking_mode/node_palette/next_batch` | POST | 获取下一批节点 (无限滚动) |
| `/thinking_mode/node_palette/select_node` | POST | 记录节点选择事件 |
| `/thinking_mode/node_palette/finish` | POST | 完成节点选择 |
| `/thinking_mode/node_palette/cancel` | POST | 取消节点选择 |
| `/thinking_mode/node_palette/cleanup` | POST | 清理会话 |

##### 节点调色板生成器

每种图表类型都有专用的调色板生成器：

| 生成器 | 图表类型 |
|--------|----------|
| `CircleMapPaletteGenerator` | 圆圈图 |
| `BubbleMapPaletteGenerator` | 气泡图 |
| `DoubleBubblePaletteGenerator` | 双气泡图 |
| `MultiFlowPaletteGenerator` | 多流程图 |
| `TreeMapPaletteGenerator` | 树形图 |
| `FlowMapPaletteGenerator` | 流程图 |
| `BraceMapPaletteGenerator` | 括号图 |
| `BridgeMapPaletteGenerator` | 桥形图 |
| `MindmapPaletteGenerator` | 思维导图 |

---

#### 3.4.5 voice.py - 语音 API

| 端点 | 方法 | 功能 |
|------|------|------|
| `/voice/websocket` | WebSocket | 实时语音对话 WebSocket 连接 |

##### 核心函数

| 函数名 | 功能 |
|--------|------|
| `get_diagram_prefix_map()` | 获取各图表类型的节点 ID 前缀 |
| `is_paragraph_text(text)` | 检测是否为段落文本 (vs 命令) |
| `process_paragraph_with_qwen_plus(...)` | 使用 Qwen Plus 处理段落，提取意图和内容 |
| `safe_websocket_send(websocket, data)` | 安全的 WebSocket 发送 |

##### 语音会话管理

- 使用内存存储 `voice_sessions` 跟踪会话状态
- `active_websockets` 跟踪活动 WebSocket 连接
- 支持多种图表类型的语音命令解析

---

### 3.5 服务模块 (services/)

#### 3.5.1 llm_service.py - LLM 统一服务

**功能**: 所有 LLM 操作的统一入口，管理多个 LLM 客户端

##### LLMService 类方法

| 方法名 | 功能 |
|--------|------|
| `initialize()` | 初始化服务：加载客户端、提示词、速率限制器 |
| `cleanup()` | 清理资源 |
| `chat(prompt, model, temperature, max_tokens, timeout)` | 单次对话完成 |
| `chat_stream(prompt, model, ...)` | 流式对话完成 |
| `generate_multi(prompt, models, ...)` | 多 LLM 并行调用，等待全部完成 |
| `generate_progressive(prompt, models, ...)` | 多 LLM 并行调用，逐个返回结果 |
| `stream_progressive(prompt, models, ...)` | 多 LLM 并发流式输出 |
| `generate_race(prompt, models, ...)` | 多 LLM 竞速，返回最快响应 |
| `compare_responses(prompt, models, ...)` | 多 LLM 响应比较 |
| `get_available_models()` | 获取可用模型列表 |
| `health_check()` | 健康检查 |
| `get_fastest_model()` | 获取响应最快的模型 |

##### 支持的模型

| 模型别名 | 提供商 | 说明 |
|----------|--------|------|
| `qwen` | Dashscope | 通义千问 Plus |
| `qwen-turbo` | Dashscope | 通义千问 Turbo (分类) |
| `qwen-plus` | Dashscope | 通义千问 Plus (生成) |
| `deepseek` | Dashscope | DeepSeek V3.1 |
| `kimi` | Dashscope | Moonshot Kimi |
| `hunyuan` | Tencent | 腾讯混元 |
| `doubao` | Volcengine | 字节豆包 |

---

#### 3.5.2 error_handler.py - 错误处理

##### 异常类型

| 异常类 | 说明 | 是否重试 |
|--------|------|----------|
| `LLMServiceError` | 基础 LLM 服务错误 | 是 |
| `LLMTimeoutError` | 超时错误 | 是 |
| `LLMValidationError` | 响应验证失败 | 是 |
| `LLMRateLimitError` | 速率限制 | 是 (加长延迟) |
| `LLMContentFilterError` | 内容过滤 | **否** |
| `LLMInvalidParameterError` | 参数错误 | **否** |
| `LLMQuotaExhaustedError` | 配额耗尽 | **否** |
| `LLMModelNotFoundError` | 模型不存在 | **否** |
| `LLMAccessDeniedError` | 访问拒绝 | **否** |

##### ErrorHandler 类方法

| 方法名 | 功能 |
|--------|------|
| `with_retry(func, max_retries, base_delay, max_delay)` | 指数退避重试 |
| `with_timeout(func, timeout)` | 超时包装 |
| `validate_response(response, validator)` | 响应验证 |

---

#### 3.5.3 rate_limiter.py - 速率限制

##### DashscopeRateLimiter 类

**功能**: 防止超出 Dashscope 平台的 QPM 和并发限制

| 方法名 | 功能 |
|--------|------|
| `acquire()` | 获取请求许可 (阻塞直到允许) |
| `release()` | 释放请求许可 |
| `get_stats()` | 获取统计信息 |

**配置参数**:
- `qpm_limit`: 每分钟最大请求数 (默认 200)
- `concurrent_limit`: 最大并发请求数 (默认 50)

---

#### 3.5.4 token_tracker.py - Token 使用追踪

**功能**: 追踪 LLM Token 使用量和成本

##### TokenTracker 类

| 方法名 | 功能 |
|--------|------|
| `track_usage(model_alias, input_tokens, output_tokens, ...)` | 记录 Token 使用 (非阻塞) |
| `flush()` | 手动刷新待写入记录 |
| `generate_session_id()` | 生成会话 ID |

**性能优化**:
- 异步队列批量写入
- 非阻塞操作 (不影响 LLM 响应速度)
- 自动批处理 (每 10 条或每 5 秒)
- 队列满时优雅降级

##### 成本计算 (每百万 Token, 人民币)

| 模型 | 输入成本 | 输出成本 |
|------|----------|----------|
| Qwen/Qwen-Plus | ¥0.4 | ¥1.2 |
| Qwen-Turbo | ¥0.3 | ¥0.6 |
| DeepSeek | ¥0.4 | ¥2.0 |
| Kimi | ¥2.0 | ¥6.0 |
| Hunyuan | ¥0.45 | ¥0.5 |

---

#### 3.5.5 browser.py - 浏览器管理

**功能**: Playwright 浏览器管理，用于 PNG 导出

##### BrowserContextManager 类

**特性**:
- 每请求创建新浏览器实例 (隔离性)
- 自动资源清理
- 支持本地 Chromium 和 Playwright 管理的 Chromium
- 自动选择更新版本的浏览器

##### 辅助函数

| 函数名 | 功能 |
|--------|------|
| `_get_chromium_version(executable_path)` | 获取 Chromium 版本 |
| `_compare_versions(v1, v2)` | 版本号比较 |
| `_get_local_chromium_executable()` | 获取本地 Chromium 路径 |
| `_get_playwright_chromium_executable()` | 获取 Playwright Chromium 路径 |
| `_get_best_chromium_executable()` | 选择最佳 Chromium |

---

#### 3.5.6 其他服务模块

| 服务文件 | 功能 |
|----------|------|
| `backup_scheduler.py` | 数据库定时备份调度 |
| `captcha_storage.py` | 验证码存储 (SQLite) |
| `sms_middleware.py` | 短信发送中间件 |
| `voice_agent.py` | 语音代理管理器 |
| `client_manager.py` | WebSocket 客户端管理 |
| `temp_image_cleaner.py` | 临时图片清理调度 |
| `database_recovery.py` | 数据库恢复向导 |
| `prompt_manager.py` | 提示词管理 |
| `performance_tracker.py` | 性能追踪 |
| `dashscope_error_parser.py` | Dashscope 错误解析 |
| `hunyuan_error_parser.py` | 混元错误解析 |
| `doubao_error_parser.py` | 豆包错误解析 |
| `websocket_llm_middleware.py` | WebSocket LLM 中间件 |
| `log_streamer.py` | 日志流服务 |
| `env_manager.py` | 环境变量管理 |
| `update_notifier.py` | 更新通知服务 |

---

### 3.6 代理模块 (agents/)

#### 3.6.1 main_agent.py - 主代理

**功能**: 图表生成的核心入口，负责类型检测和代理调度

##### 核心函数

| 函数名 | 功能 |
|--------|------|
| `agent_graph_workflow_with_styles(prompt, style, language, model_id)` | 主工作流：类型检测 → 提示清理 → 代理调用 |
| `_detect_diagram_type_from_prompt(prompt, llm)` | LLM 驱动的图表类型检测 |
| `_detect_learning_sheet_from_prompt(prompt)` | 学习单检测 |
| `_clean_prompt_for_learning_sheet(prompt)` | 学习单提示词清理 |
| `_generate_spec_with_agent(diagram_type, prompt, language, model_id)` | 调度到专用代理 |
| `extract_central_topic_llm(prompt)` | LLM 提取中心主题 |
| `extract_double_bubble_topics_llm(prompt)` | LLM 提取双气泡主题 |
| `_salvage_json_string(text)` | 从 LLM 输出中抢救 JSON |
| `_salvage_truncated_json(text)` | 修复截断的 JSON |
| `_parse_strict_json(text)` | 严格 JSON 解析 |

##### LLMTimingStats 类

**功能**: 线程安全的 LLM 调用统计追踪

---

#### 3.6.2 core/base_agent.py - 代理基类

##### BaseAgent 抽象类

```python
class BaseAgent(ABC):
    def __init__(self):
        self.language = 'en'
        self.diagram_type = None
    
    @abstractmethod
    async def generate_graph(self, prompt: str, **kwargs) -> dict:
        """生成图表规格 (子类必须实现)"""
        pass
    
    def validate_output(self, output: dict) -> bool:
        """验证输出格式"""
        pass
    
    def set_language(self, language: str):
        """设置语言"""
        pass
```

---

#### 3.6.3 thinking_maps/ - 思维导图代理

| 代理文件 | 图表类型 | 说明 |
|----------|----------|------|
| `bubble_map_agent.py` | 气泡图 | 描述单一主题的属性 |
| `bridge_map_agent.py` | 桥形图 | 类比关系 |
| `tree_map_agent.py` | 树形图 | 分类层次 |
| `circle_map_agent.py` | 圆圈图 | 定义/头脑风暴 |
| `double_bubble_map_agent.py` | 双气泡图 | 比较对比 |
| `flow_map_agent.py` | 流程图 | 顺序/步骤 |
| `brace_map_agent.py` | 括号图 | 整体-部分关系 |
| `multi_flow_map_agent.py` | 多流程图 | 因果分析 |

##### BubbleMapAgent 示例

```python
class BubbleMapAgent(BaseAgent):
    def __init__(self):
        super().__init__()
        self.diagram_type = 'bubble_map'
    
    async def generate_graph(self, prompt, **kwargs):
        # 1. 生成规格
        spec = await self._generate_bubble_map_spec(prompt, kwargs.get('language'))
        # 2. 验证输出
        if not self.validate_output(spec):
            raise ValueError("Invalid bubble map specification")
        # 3. 增强规格
        enhanced_spec = self._enhance_spec(spec)
        return enhanced_spec
    
    async def _generate_bubble_map_spec(self, prompt, language):
        # 调用 LLM 生成规格
        pass
    
    def _enhance_spec(self, spec):
        # 添加布局、尺寸、元数据
        pass
```

---

#### 3.6.4 thinking_tools/ - 思维工具代理

| 代理文件 | 工具类型 | 说明 |
|----------|----------|------|
| `factor_analysis_agent.py` | 因素分析 | 分析影响因素 |
| `three_position_analysis_agent.py` | 三方位分析 | 过去/现在/未来 |
| `perspective_analysis_agent.py` | 视角分析 | 多角度思考 |
| `goal_analysis_agent.py` | 目标分析 | 目标设定与分解 |
| `possibility_analysis_agent.py` | 可能性分析 | 可能的情景 |
| `result_analysis_agent.py` | 结果分析 | 预期结果 |
| `five_w_one_h_agent.py` | 5W1H 分析 | Who/What/When/Where/Why/How |
| `whwm_analysis_agent.py` | WHWM 分析 | 我们/希望/为什么/方法 |
| `four_quadrant_agent.py` | 四象限分析 | 四象限矩阵 |

**特点**: 思维工具代理通常继承自 `MindMapAgent`，复用思维导图的布局逻辑

```python
class FactorAnalysisAgent(MindMapAgent):
    def __init__(self):
        super().__init__()
        self.diagram_type = 'factor_analysis'
    
    def get_prompt(self, language='en'):
        prompt_key = f"factor_analysis_generation_{language}"
        return THINKING_TOOLS_PROMPTS.get(prompt_key)
```

---

#### 3.6.5 thinking_modes/ - ThinkGuide 模式代理

**功能**: 苏格拉底式引导教学的代理

| 组件 | 功能 |
|------|------|
| `factory.py` | 代理工厂，根据图表类型创建代理 |
| `circle_map_thinking.py` | 圆圈图引导代理 |
| `bubble_map_thinking.py` | 气泡图引导代理 |
| `node_palette/` | 节点调色板生成器 |

##### ThinkingAgentFactory

```python
class ThinkingAgentFactory:
    @staticmethod
    def get_agent(diagram_type: str) -> BaseThinkingAgent:
        """根据图表类型获取对应的引导代理"""
        pass
    
    @staticmethod
    def get_supported_types() -> list:
        """获取支持的图表类型列表"""
        pass
```

---

### 3.7 客户端模块 (clients/)

#### 3.7.1 llm.py - 多 LLM 客户端

##### QwenClient 类

**功能**: 通义千问 API 异步客户端

| 方法名 | 功能 |
|--------|------|
| `chat_completion(prompt, model_id, temperature)` | 同步对话完成 |
| `async_stream_chat_completion(prompt, model_id, ...)` | 异步流式对话 |

##### 其他客户端

| 类名 | 提供商 | 说明 |
|------|--------|------|
| `DeepSeekClient` | Dashscope | DeepSeek 模型客户端 |
| `KimiClient` | Dashscope | Kimi (Moonshot) 客户端 |
| `HunyuanClient` | Tencent | 腾讯混元客户端 (OpenAI 兼容) |
| `DoubaoClient` | Volcengine | 字节豆包客户端 (OpenAI 兼容) |

##### 工厂函数

```python
def get_llm_client(model_id: str) -> Union[QwenClient, DeepSeekClient, ...]:
    """根据模型 ID 获取对应的客户端实例"""
    if model_id == 'qwen':
        return QwenClient()
    elif model_id == 'deepseek':
        return DeepSeekClient()
    # ...
```

---

#### 3.7.2 omni_client.py - Qwen Omni WebSocket 客户端

**功能**: 实时语音对话的 WebSocket 客户端

##### OmniRealtimeClient 类

| 方法名 | 功能 |
|--------|------|
| `connect()` | 建立 WebSocket 连接 |
| `disconnect()` | 断开连接 |
| `send_audio(audio_data)` | 发送音频数据 |
| `send_text(text)` | 发送文本消息 |
| `update_session(config)` | 更新会话配置 |

##### OmniClient 类

**功能**: `OmniRealtimeClient` 的包装器，提供向后兼容接口

| 方法名 | 功能 |
|--------|------|
| `start_conversation(config)` | 开始对话 |
| `send_audio(audio_data)` | 发送音频 |
| `update_instructions(instructions)` | 更新指令 |
| `create_greeting(text)` | 创建欢迎语 |
| `cancel_response()` | 取消当前响应 |
| `append_image(image_data)` | 添加图像 |

---

#### 3.7.3 dify.py - Dify API 客户端

**功能**: Dify 平台 SSE 流式对话客户端

##### AsyncDifyClient 类

| 方法名 | 功能 |
|--------|------|
| `stream_chat(prompt, conversation_id, ...)` | SSE 流式对话 |

---

### 3.8 工具模块 (utils/)

#### 3.8.1 auth.py - 认证工具

##### 密码处理

| 函数名 | 功能 |
|--------|------|
| `hash_password(password)` | bcrypt 密码哈希 |
| `verify_password(password, hash)` | 验证密码 |

##### JWT Token

| 函数名 | 功能 |
|--------|------|
| `create_access_token(user)` | 创建 JWT Token |
| `decode_access_token(token)` | 解码验证 Token |
| `get_current_user(request)` | FastAPI 依赖：获取当前用户 |

##### 速率限制

| 函数名 | 功能 |
|--------|------|
| `check_rate_limit(key, attempts_dict, max_attempts)` | 检查速率限制 |
| `record_failed_attempt(key, attempts_dict)` | 记录失败尝试 |
| `clear_attempts(key, attempts_dict)` | 清除尝试记录 |

##### 账户安全

| 函数名 | 功能 |
|--------|------|
| `check_account_lockout(user)` | 检查账户是否锁定 |
| `increment_failed_attempts(user, db)` | 增加失败次数 |
| `reset_failed_attempts(user, db)` | 重置失败次数 |

##### 八一模式

| 函数名 | 功能 |
|--------|------|
| `decrypt_bayi_token(encrypted_token)` | AES 解密八一 Token |
| `validate_bayi_token_body(token_body)` | 验证 Token 内容 |

##### 工具函数

| 函数名 | 功能 |
|--------|------|
| `get_client_ip(request)` | 获取客户端真实 IP (支持反向代理) |
| `is_https(request)` | 检测是否 HTTPS 连接 |
| `is_admin(user)` | 检查是否管理员 |

---

#### 3.8.2 invitations.py - 邀请码工具

| 函数名 | 功能 |
|--------|------|
| `normalize_or_generate()` | 规范化或生成邀请码 |
| `INVITE_PATTERN` | 邀请码正则 (AAAA-XXXXX) |

---

### 3.9 提示词模块 (prompts/)

**功能**: 集中管理所有 LLM 提示词模板

#### 结构

```
prompts/
├── __init__.py            # 统一注册中心
├── thinking_maps/         # 思维导图提示词
│   ├── bubble_map.py
│   ├── bridge_map.py
│   └── ...
├── concept_maps/          # 概念图提示词
├── mind_maps/             # 思维导图提示词
├── thinking_tools/        # 思维工具提示词
├── voice_agent/           # 语音代理提示词
├── tab_mode/              # Tab 模式提示词
└── main_agent/            # 主代理提示词
```

#### 提示词注册中心

```python
# prompts/__init__.py
PROMPT_REGISTRY = {
    **THINKING_MAP_PROMPTS,
    **CONCEPT_MAP_PROMPTS,
    **MIND_MAP_PROMPTS,
    **MAIN_AGENT_PROMPTS,
    **THINKING_TOOLS_PROMPTS,
    **VOICE_AGENT_PROMPTS,
    **TAB_MODE_PROMPTS,
}

def get_prompt(diagram_type: str, language: str = 'en', prompt_type: str = 'generation') -> str:
    """获取指定类型和语言的提示词"""
    key = f"{diagram_type}_{prompt_type}_{language}"
    return PROMPT_REGISTRY.get(key, "")

def get_available_diagram_types() -> list:
    """获取所有支持的图表类型"""
    pass
```

---

### 3.10 前端模块 (static/, templates/)

#### 3.10.1 渲染器 (static/js/renderers/)

| 渲染器文件 | 图表类型 |
|------------|----------|
| `bubble-map-renderer.js` | 气泡图 |
| `concept-map-renderer.js` | 概念图 |
| `mind-map-renderer.js` | 思维导图 |
| `tree-renderer.js` | 树形图 |
| `flow-renderer.js` | 流程图 |
| `brace-renderer.js` | 括号图 |
| `factor-analysis-renderer.js` | 因素分析 |
| `five-w-one-h-renderer.js` | 5W1H 分析 |
| `four-quadrant-renderer.js` | 四象限分析 |
| `goal-analysis-renderer.js` | 目标分析 |
| `perspective-analysis-renderer.js` | 视角分析 |
| `possibility-analysis-renderer.js` | 可能性分析 |
| `result-analysis-renderer.js` | 结果分析 |
| `three-position-analysis-renderer.js` | 三方位分析 |
| `whwm-analysis-renderer.js` | WHWM 分析 |
| `renderer-dispatcher.js` | 渲染器调度器 |
| `shared-utilities.js` | 共享工具函数 |

#### 3.10.2 核心 JavaScript

| 文件 | 功能 |
|------|------|
| `static/js/core/` | 核心模块 |
| `static/js/diagram-selector.js` | 图表选择器 |
| `static/js/node-palette.js` | 节点调色板 UI |
| `static/js/thinkguide.js` | ThinkGuide UI |
| `static/js/voice-agent.js` | 语音代理 UI |

#### 3.10.3 HTML 模板

| 模板文件 | 页面 |
|----------|------|
| `templates/index.html` | 登陆页/首页 |
| `templates/editor.html` | 主编辑器 (核心功能页) |
| `templates/auth.html` | 认证页面 |
| `templates/demo.html` | Demo 密钥页面 |
| `templates/debug.html` | 调试页面 |

---

## 4. 数据流程

### 4.1 图表生成流程

```
用户输入 (Prompt)
       ↓
[POST /generate_graph]
       ↓
main_agent.agent_graph_workflow_with_styles()
       ↓
_detect_diagram_type_from_prompt() ← LLM (Qwen-Turbo)
       ↓
_generate_spec_with_agent(diagram_type)
       ↓
[专用代理] (e.g., BubbleMapAgent)
       ↓
LLM 调用 (Qwen-Plus/DeepSeek/Kimi/Hunyuan)
       ↓
JSON 规格解析与验证
       ↓
规格增强 (布局、尺寸、元数据)
       ↓
返回 JSON 规格
       ↓
前端 D3.js 渲染器
       ↓
SVG 图表展示
```

### 4.2 PNG 导出流程

```
JSON 规格
       ↓
[POST /export_png]
       ↓
BrowserContextManager (Playwright)
       ↓
创建新浏览器实例
       ↓
加载渲染模板 HTML
       ↓
注入 JSON 数据
       ↓
D3.js 渲染
       ↓
等待渲染完成
       ↓
截图 (3x 分辨率)
       ↓
返回 PNG Base64
```

### 4.3 ThinkGuide 流程

```
用户开始 ThinkGuide
       ↓
[POST /thinking_mode/stream]
       ↓
ThinkingAgentFactory.get_agent(diagram_type)
       ↓
SSE 流式响应
       ↓
苏格拉底式提问 ← LLM
       ↓
用户回答
       ↓
引导反馈 ← LLM
       ↓
节点建议
       ↓
循环直到完成
```

### 4.4 语音对话流程

```
用户开始语音输入
       ↓
[WebSocket /voice/websocket]
       ↓
OmniClient (Qwen Omni)
       ↓
实时语音识别
       ↓
意图分类 ← LLM (Qwen-Turbo)
       ↓
执行操作 (添加节点/修改/删除)
       ↓
语音反馈 ← Qwen Omni TTS
```

---

## 5. 技术特点

### 5.1 高并发设计

- **异步编程**: 全栈使用 `async/await`，支持 4000+ 并发连接
- **SSE 流式响应**: 实时返回 LLM 生成结果
- **WebSocket**: 实时语音对话
- **批量写入**: Token 追踪使用异步队列批量入库

### 5.2 多 LLM 支持

- **工厂模式**: 统一客户端接口
- **并行调用**: 多 LLM 竞速/渐进式返回
- **熔断机制**: 自动跳过故障模型
- **统一错误处理**: 标准化错误类型

### 5.3 安全特性

- **JWT Token**: HTTP-only Cookie
- **bcrypt 密码哈希**: 12 轮
- **验证码保护**: 图形验证码 + 短信验证码
- **速率限制**: QPM + 登录尝试限制
- **账户锁定**: 防暴力破解
- **CSP 安全头**: 防 XSS
- **IP 白名单**: 八一模式

### 5.4 可观测性

- **结构化日志**: 统一格式、来源标识
- **性能追踪**: LLM 调用耗时统计
- **Token 使用追踪**: 按用户/组织统计
- **健康检查**: `/health`, `/llm/health`

### 5.5 数据完整性

- **SQLite WAL 模式**: 提高并发写入性能
- **定期检查点**: 防止 WAL 文件过大
- **完整性检查**: 启动时检测数据库损坏
- **自动备份**: 每小时备份
- **恢复向导**: 数据库损坏时的恢复工具

---

## 附录 A: 环境变量配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `QWEN_API_KEY` | 通义千问 API 密钥 | - |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | - |
| `KIMI_API_KEY` | Kimi API 密钥 | - |
| `HUNYUAN_SECRET_ID` | 混元密钥 ID | - |
| `HUNYUAN_SECRET_KEY` | 混元密钥 | - |
| `DOUBAO_API_KEY` | 豆包 API 密钥 | - |
| `SERVER_HOST` | 服务器地址 | `127.0.0.1` |
| `SERVER_PORT` | 服务器端口 | `8000` |
| `DEBUG` | 调试模式 | `false` |
| `AUTH_MODE` | 认证模式 | `standard` |
| `JWT_SECRET_KEY` | JWT 密钥 | - |
| `DEMO_PASSKEY` | Demo 模式密钥 | `888888` |
| `ADMIN_PHONES` | 管理员手机号列表 | - |

---

## 附录 B: API 端点汇总

### 核心 API

| 端点 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/generate_graph` | POST | 是 | 生成图表 |
| `/export_png` | POST | 是 | 导出 PNG |
| `/ai_assistant/stream` | POST | 是 | AI 助手流 |

### 认证 API

| 端点 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/auth/login` | POST | 否 | 登录 |
| `/auth/register` | POST | 否 | 注册 |
| `/auth/logout` | POST | 是 | 登出 |
| `/auth/me` | GET | 是 | 当前用户 |

### ThinkGuide API

| 端点 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/thinking_mode/stream` | POST | 是 | 引导流 |
| `/thinking_mode/node_palette/start` | POST | 是 | 启动调色板 |

---

*文档生成时间: 2025年12月18日*

