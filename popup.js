let videoLinks = [];
let currentMediaUrl = '';

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

// 标签切换功能
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // 更新标签按钮状态
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // 显示对应内容
        const tabId = btn.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = content.id === `${tabId}Tab` ? 'block' : 'none';
        });
    });
});

// 提取视频链接功能
document.getElementById('extractLinks').addEventListener('click', async () => {
    const resultDiv = document.getElementById('extractResult');
    const minLikesInput = document.getElementById('minLikes');
    const minLikes = parseInt(minLikesInput.value) || 0;
    
    // 禁用按钮，显示加载状态
    const extractBtn = document.getElementById('extractLinks');
    const exportBtn = document.getElementById('exportTxt');
    extractBtn.disabled = true;
    exportBtn.disabled = true;
    extractBtn.innerHTML = '<span class="loading"></span> 正在提取...';
    
    resultDiv.innerHTML = '<div class="status-info">准备获取视频链接...</div>';
    
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
            <div class="status-success">
                已获取 ${videoLinks.length} 个视频链接
                <div style="font-size: 12px; margin-top: 5px;">
                    ${minLikes > 0 ? `筛选条件：点赞数 ≥ ${minLikes}<br>` : ''}
                    点击"导出为文本"按钮保存链接
                </div>
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

// 导出功能
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

// 去水印功能
document.getElementById('removeWatermark').addEventListener('click', async () => {
    const mediaUrl = document.getElementById('mediaUrl').value.trim();
    const resultDiv = document.getElementById('watermarkResult'); // 修改为正确的结果div
    const previewDiv = document.getElementById('preview');
    const mediaContainer = previewDiv.querySelector('.media-container');
    const downloadBtn = document.getElementById('downloadBtn');

    console.log('=== 开始去水印处理 ===');
    console.log('输入的URL:', mediaUrl);

    // 检查输入
    if (!mediaUrl) {
        console.log('错误: 未输入链接');
        resultDiv.innerHTML = `
            <div class="status-error">
                请输入视频链接
                <div style="font-size: 12px; margin-top: 5px;">
                    支持的格式：<br>
                    1. 抖音视频链接（例如：https://www.douyin.com/video/7xxx）<br>
                    2. 视频ID（例如：7xxx）<br>
                    3. 分享文本
                </div>
            </div>
        `;
        return;
    }

    // 显示加载状态
    const button = document.getElementById('removeWatermark');
    try {
        console.log('更新UI状态为加载中...');
        resultDiv.innerHTML = '<div class="status-info">正在处理中...</div>';
        previewDiv.style.display = 'none';
        button.disabled = true;
        button.innerHTML = '<span class="loading"></span> 处理中...';

        // 提取视频ID
        console.log('开始提取视频ID...');
        const videoId = extractVideoId(mediaUrl);
        console.log('提取到的视频ID:', videoId);

        if (!videoId) {
            throw new Error('无法识别的链接格式，请确保链接正确');
        }

        // 尝试多个API端点
        const apiUrls = [
            `https://api.douyin.wtf/api?video_id=${videoId}&hd=1`,
            `https://api.douyin.wtf/download?video_id=${videoId}&hd=1`,
            `https://api.douyin.wtf/video?video_id=${videoId}&hd=1`
        ];

        console.log('开始尝试API请求...');
        let success = false;
        let error = null;

        for (const [index, apiUrl] of apiUrls.entries()) {
            try {
                console.log(`尝试第${index + 1}个API:`, apiUrl);
                resultDiv.innerHTML = `<div class="status-info">正在尝试第${index + 1}个API...</div>`;

                const response = await fetch(apiUrl);
                console.log('API响应状态:', response.status);

                if (!response.ok) {
                    throw new Error(`API请求失败: ${response.status}`);
                }

                const data = await response.json();
                console.log('API返回数据:', data);

                // 尝试获取无水印地址
                const videoUrl = data.nwm_video_url || 
                               data.video_data?.nwm_video_url || 
                               data.video_url;

                if (videoUrl) {
                    console.log('成功获取到无水印地址:', videoUrl);
                    
                    // 更新预览
                    console.log('创建视频预览元素...');
                    mediaContainer.innerHTML = '';
                    const video = document.createElement('video');
                    video.src = videoUrl;
                    video.controls = true;
                    video.style.maxWidth = '100%';
                    video.onerror = (e) => {
                        console.error('视频加载失败:', e);
                        throw new Error('视频加载失败，可能是链接已失效');
                    };
                    mediaContainer.appendChild(video);

                    // 更新下载按钮
                    console.log('更新下载按钮...');
                    downloadBtn.href = videoUrl;
                    downloadBtn.download = `抖音视频_无水印_${videoId}.mp4`;
                    
                    // 显示成功信息
                    previewDiv.style.display = 'block';
                    resultDiv.innerHTML = `
                        <div class="status-success">
                            处理成功！
                            <div style="font-size: 12px; margin-top: 5px;">
                                视频ID: ${videoId}<br>
                                API来源: ${index + 1}<br>
                                可以直接预览或点击下载
                            </div>
                        </div>
                    `;
                    success = true;
                    break;
                } else {
                    console.log('API返回数据中没有视频地址');
                }
            } catch (err) {
                console.error(`第${index + 1}个API调用失败:`, err);
                error = err;
            }
        }

        if (!success) {
            throw error || new Error('无法获取无水印视频，所有API都失败了');
        }

    } catch (error) {
        console.error('处理失败:', error);
        console.error('错误堆栈:', error.stack);
        resultDiv.innerHTML = `
            <div class="status-error">
                处理失败：${error.message}
                <div style="font-size: 12px; margin-top: 5px;">
                    可能的原因：<br>
                    1. 链接格式不正确<br>
                    2. 视频不存在或已删除<br>
                    3. 网络连接问题<br>
                    4. 服务器暂时不可用<br>
                    <br>
                    请检查链接是否正确，稍后重试
                </div>
            </div>
        `;
        previewDiv.style.display = 'none';
    } finally {
        // 恢复按钮状态
        console.log('恢复按钮状态...');
        button.disabled = false;
        button.textContent = '去除水印';
        console.log('=== 处理完成 ===');
    }
});

// 提取视频ID的函数
function extractVideoId(url) {
    // 处理分享文本，提取URL
    const urlMatch = url.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
        url = urlMatch[0];
    }

    // 移除@符号和多余的空格
    url = url.replace('@', '').trim();
    
    // 如果是纯数字，直接返回
    if (/^\d+$/.test(url)) {
        return url;
    }

    // 匹配视频ID
    const patterns = [
        /\/video\/(\d+)/,                // 标准网页链接
        /douyin\.com\/(\d+)/,           // 短链接
        /video\/(\d+)/                   // 其他可能的格式
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

// 添加链接输入框的粘贴事件处理
document.getElementById('mediaUrl').addEventListener('paste', (e) => {
    // 延迟处理以确保值已经粘贴
    setTimeout(() => {
        const input = e.target;
        // 尝试提取链接
        const text = input.value;
        const urlMatch = text.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
            input.value = urlMatch[0];
        }
    }, 0);
}); 