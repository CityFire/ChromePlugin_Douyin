// 修改滚动到底部的函数
async function scrollToBottom() {
    return new Promise((resolve) => {
        let lastHeight = 0;
        let scrollAttempts = 0;
        const maxAttempts = 30; // 最大尝试次数
        const checkInterval = 1000; // 检查间隔时间（毫秒）
        let noChangeCount = 0;
        const maxNoChange = 3; // 连续3次高度不变就停止
        
        const scrollInterval = setInterval(() => {
            // 获取当前内容高度
            const currentHeight = document.documentElement.scrollHeight;
            scrollAttempts++;
            
            // 计算进度
            const progress = Math.min((scrollAttempts / maxAttempts) * 100, 100);
            chrome.runtime.sendMessage({
                type: 'scrollProgress',
                progress: progress.toFixed(1)
            });
            
            // 如果高度没有变化或达到最大尝试次数，停止滚动
            if (currentHeight === lastHeight) {
                noChangeCount++;
            } else {
                noChangeCount = 0;
            }
            
            if (noChangeCount >= maxNoChange || scrollAttempts >= maxAttempts) {
                clearInterval(scrollInterval);
                resolve();
                return;
            }
            
            // 更新上次高度
            lastHeight = currentHeight;
            
            // 执行滚动
            window.scrollTo({
                top: currentHeight,
                behavior: 'auto'
            });
            
            // 添加随机滚动距离，模拟人工滚动
            setTimeout(() => {
                window.scrollTo({
                    top: currentHeight - Math.floor(Math.random() * 100),
                    behavior: 'auto'
                });
            }, 200);
            
        }, 400); // 减少滚动间隔时间
    });
}

// 修改视频链接提取函数，添加点赞数筛选
function extractVideoLinks(minLikes = 0) {
    const links = new Set(); // 使用Set避免重复链接
    const videoElements = document.querySelectorAll('a.uz1VJwFY');
    
    videoElements.forEach(element => {
        const href = element.href;
        // 获取点赞数
        const likeText = element.querySelector('.BgCg_ebQ')?.textContent || '0';
        // 转换点赞数文本为数字（处理"万"单位）
        const likeCount = parseLikeCount(likeText);
        
        if (href && href.includes('douyin.com') && likeCount >= minLikes) {
            links.add({
                url: href,
                title: element.querySelector('.EtttsrEw')?.textContent?.trim() || '无标题',
                likes: likeText
            });
        }
    });
    
    return Array.from(links);
}

// 添加点赞数解析函数
function parseLikeCount(likeText) {
    if (!likeText) return 0;
    
    // 处理带"万"的数字
    if (likeText.includes('万')) {
        return parseFloat(likeText.replace('万', '')) * 10000;
    }
    
    return parseInt(likeText.replace(/[^0-9]/g, '')) || 0;
}

// 修改消息监听器
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractLinks') {
        (async () => {
            try {
                chrome.runtime.sendMessage({type: 'scrollStatus', status: '开始滚动页面...'});
                
                await scrollToBottom();
                
                chrome.runtime.sendMessage({type: 'scrollStatus', status: '滚动完成，正在提取链接...'});
                
                setTimeout(() => {
                    const links = extractVideoLinks(request.minLikes || 0);
                    sendResponse({
                        links: links,
                        totalFound: links.length
                    });
                }, 1000);
                
            } catch (error) {
                console.error('滚动过程出错:', error);
                sendResponse({error: '获取视频链接失败'});
            }
        })();
        return true;
    }
}); 