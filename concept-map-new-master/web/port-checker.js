// 端口检测脚本 - 帮助前端获取正确的端口号

class PortChecker {
    constructor() {
        this.ports = [5000, 5001, 5002, 5003, 5004, 5005, 5006, 5007, 5008, 5009];
        this.currentPort = null;
    }
    
    // 检测端口是否可用
    async checkPort(port) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 增加到3秒超时
            
            console.log(`正在检测端口 ${port}...`);
            const response = await fetch(`http://localhost:${port}/api/health`, {
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            console.log(`端口 ${port} 响应状态: ${response.status}`);
            return response.ok;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log(`端口 ${port} 检测超时`);
            } else {
                console.log(`端口 ${port} 检测失败:`, error.message);
            }
            return false;
        }
    }
    
    // 查找可用的端口
    async findAvailablePort() {
        console.log('开始扫描端口...');
        
        // 优先检测当前浏览器端口
        const currentBrowserPort = window.location.port;
        if (currentBrowserPort && this.ports.includes(parseInt(currentBrowserPort))) {
            console.log(`优先检测浏览器当前端口: ${currentBrowserPort}`);
            if (await this.checkPort(parseInt(currentBrowserPort))) {
                this.currentPort = parseInt(currentBrowserPort);
                localStorage.setItem('flask_port', this.currentPort);
                console.log(`✅ 找到可用端口: ${this.currentPort}`);
                return this.currentPort;
            }
        }
        
        // 扫描端口列表
        for (const port of this.ports) {
            if (await this.checkPort(port)) {
                this.currentPort = port;
                // 保存到localStorage
                localStorage.setItem('flask_port', port);
                console.log(`✅ 找到可用端口: ${port}`);
                return port;
            }
        }
        
        console.log('❌ 未找到可用的端口');
        return null;
    }
    
    // 获取当前端口
    getCurrentPort() {
        return this.currentPort || localStorage.getItem('flask_port') || 5000;
    }
    
    // 构建API URL
    getApiUrl() {
        const port = this.getCurrentPort();
        return `http://localhost:${port}/api`;
    }
    
    // 监听端口变化
    startPortMonitoring() {
        // 每30秒检查一次端口状态
        setInterval(async () => {
            const currentPort = this.getCurrentPort();
            if (!(await this.checkPort(currentPort))) {
                console.log(`端口 ${currentPort} 不可用，尝试重新检测...`);
                await this.findAvailablePort();
                // 触发端口变化事件
                window.dispatchEvent(new CustomEvent('portChanged', {
                    detail: { port: this.getCurrentPort() }
                }));
            }
        }, 30000);
    }
    
    // 显示连接状态
    async showConnectionStatus() {
        const port = this.getCurrentPort();
        const isConnected = await this.checkPort(port);
        
        if (isConnected) {
            console.log(`✅ 已连接到后端服务 (端口: ${port})`);
            return true;
        } else {
            console.log(`❌ 无法连接到后端服务 (端口: ${port})`);
            return false;
        }
    }
}

// 创建全局实例
window.portChecker = new PortChecker();

// 页面加载完成后自动检测端口
document.addEventListener('DOMContentLoaded', async () => {
    console.log('开始检测后端服务端口...');
    
    try {
        const port = await window.portChecker.findAvailablePort();
        if (port) {
            console.log(`✅ 后端服务端口检测成功: ${port}`);
            await window.portChecker.showConnectionStatus();
            
            // 触发端口变化事件，通知其他脚本
            window.dispatchEvent(new CustomEvent('portChanged', {
                detail: { port: port }
            }));
        } else {
            console.log('❌ 未找到可用的后端服务端口');
            console.log('请确保已运行 start.bat 启动后端服务');
        }
    } catch (error) {
        console.error('端口检测过程中发生错误:', error);
    }
    
    window.portChecker.startPortMonitoring();
});

// 导出供其他脚本使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PortChecker;
} 