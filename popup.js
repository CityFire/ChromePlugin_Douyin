let videoLinks = [];

// 添加消息监听器来更新状态
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'scrollStatus') {
        const resultDiv = document.getElementById('result');
        resultDiv.innerHTML = `<div>${message.status}</div>`;
    } else if (message.type === 'scrollProgress') {
        const progressDiv = document.getElementById('progress');
        const progressBar = progressDiv.querySelector('.progress-bar-inner');
        const progressText = progressDiv.querySelector('.progress-text');
        
        progressDiv.style.display = 'block';
        progressBar.style.width = `${message.progress}%`;
        progressText.textContent = `正在滚动页面: ${message.progress}%`;
    }
});

document.getElementById('extractLinks').addEventListener('click', async () => {
    const resultDiv = document.getElementById('result');
    const minLikesInput = document.getElementById('minLikes');
    const minLikes = parseInt(minLikesInput.value) || 0;
    
    // 禁用按钮，显示加载状态
    const extractBtn = document.getElementById('extractLinks');
    const exportBtn = document.getElementById('exportTxt');
    extractBtn.disabled = true;
    exportBtn.disabled = true;
    extractBtn.innerHTML = '<span class="loading"></span> 正在提取...';
    
    resultDiv.innerHTML = '<div>准备获取视频链接...</div>';
    resultDiv.className = '';
    
    try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'extractLinks',
            minLikes: minLikes
        });
        
        if (response.error) {
            resultDiv.innerHTML = `<div class="status-error">${response.error}</div>`;
            return;
        }
        
        videoLinks = response.links;
        
        resultDiv.innerHTML = `
            <div class="status-success">已获取 ${videoLinks.length} 个视频链接</div>
            <div style="margin-top: 5px; color: #666;">
                ${minLikes > 0 ? `筛选条件：点赞数 ≥ ${minLikes}<br>` : ''}
                点击下方按钮导出链接
            </div>
        `;
    } catch (error) {
        resultDiv.innerHTML = '<div class="status-error">获取视频链接失败，请重试</div>';
        console.error('Error:', error);
    } finally {
        // 恢复按钮状态
        extractBtn.disabled = false;
        exportBtn.disabled = false;
        extractBtn.textContent = '提取视频链接';
        document.getElementById('progress').style.display = 'none';
    }
});

document.getElementById('exportTxt').addEventListener('click', () => {
    if (videoLinks.length === 0) {
        alert('请先提取视频链接！');
        return;
    }
    
    const content = videoLinks.map((link, index) => 
        `序号：${index + 1}\n标题：${link.title}\n点赞：${link.likes}\n链接：${link.url}\n`
    ).join('\n');
    
    const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `抖音视频链接_${videoLinks.length}个.txt`;
    a.click();
    URL.revokeObjectURL(url);
}); 