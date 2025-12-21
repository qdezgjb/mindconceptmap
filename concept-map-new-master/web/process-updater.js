// 概念图自动生成系统 - 流程状态更新模块

// 全局变量：当前步骤的计时器
let currentStepTimer = null;
let currentStepStartTime = null;

// 更新当前流程显示
function updateProcessStatus(step, status = 'active', finalDuration = null, mode = 'keyword') {
    if (!window.processText) return;
    
    // 根据模式选择不同的流程步骤
    let steps;
    if (mode === 'description') {
        // 文本分析模式：4步流程
        steps = [
            { id: 1, name: '焦点问题分析', desc: '正在分析文本，提取核心焦点问题...' },
            { id: 2, name: '概念图文本预处理', desc: '提取三元组、构建知识图谱...' },
            { id: 3, name: '概念图的生成', desc: '解析数据、计算布局、绘制节点和连线...' },
            { id: 4, name: '完成', desc: '概念图生成完成！' }
        ];
    } else {
        // 焦点问题模式：4步流程
        steps = [
            { id: 1, name: '概念图文本内容生成', desc: '正在请求DeepSeek AI生成介绍文本...' },
            { id: 2, name: '概念图文本预处理', desc: '提取三元组、构建知识图谱...' },
            { id: 3, name: '概念图的生成', desc: '解析数据、计算布局、绘制节点和连线...' },
            { id: 4, name: '完成', desc: '概念图生成完成！' }
        ];
    }
    
    // 初始化步骤用时存储
    if (!window.stepDurations) {
        window.stepDurations = {};
    }
    
    // 如果是进入active状态，开始计时
    if (status === 'active') {
        // 停止之前的计时器
        if (currentStepTimer) {
            clearInterval(currentStepTimer);
        }
        
        // 记录当前步骤开始时间
        currentStepStartTime = performance.now();
        window.stepDurations[step] = '0.00s';
        
        // 启动实时更新计时器
        currentStepTimer = setInterval(() => {
            if (currentStepStartTime) {
                const elapsed = ((performance.now() - currentStepStartTime) / 1000).toFixed(2);
                window.stepDurations[step] = elapsed + 's';
                // 重新渲染
                renderProcessSteps(steps, step, status);
            }
        }, 100); // 每100ms更新一次
        
    } else if (status === 'completed' && finalDuration !== null) {
        // 完成时，停止计时器，保存最终用时
        if (currentStepTimer) {
            clearInterval(currentStepTimer);
            currentStepTimer = null;
        }
        window.stepDurations[step] = finalDuration;
        currentStepStartTime = null;
    }
    
    // 渲染流程步骤
    renderProcessSteps(steps, step, status);
}

// 渲染流程步骤（分离渲染逻辑）
function renderProcessSteps(steps, currentStep, currentStatus) {
    if (!window.processText) return;
    
    let html = '<div class="process-steps">';
    
    steps.forEach(s => {
        let stepClass = 'process-step';
        if (s.id < currentStep) {
            stepClass += ' completed';
        } else if (s.id === currentStep) {
            if (currentStatus === 'active') {
                stepClass += ' active';
            } else if (currentStatus === 'error') {
                stepClass += ' error';
            } else if (currentStatus === 'completed') {
                stepClass += ' completed';
            }
        } else {
            stepClass += ' pending';
        }
        
        html += `<div class="${stepClass}">`;
        html += `<div class="step-number">${s.id}</div>`;
        html += `<div class="step-info">`;
        html += `<div class="step-name">${s.name}`;
        
        // 显示用时（包括正在计时的步骤）
        if (window.stepDurations && window.stepDurations[s.id]) {
            const duration = window.stepDurations[s.id];
            html += `<span class="step-duration">${duration}</span>`;
        }
        
        html += `</div>`;
        html += `<div class="step-desc">${s.desc}</div>`;
        html += `</div>`;
        html += `</div>`;
    });
    
    html += '</div>';
    
    window.processText.innerHTML = html;
}

// 清除流程显示
function clearProcessStatus() {
    // 停止计时器
    if (currentStepTimer) {
        clearInterval(currentStepTimer);
        currentStepTimer = null;
    }
    currentStepStartTime = null;
    
    if (!window.processText) return;
    window.processText.innerHTML = '';
}

