// 处理API请求
async function fetchVideoData(videoId) {
    try {
        // 使用新的API
        const apiUrl = 'https://api.douyin.wtf/video';
        console.log('尝试获取视频数据, videoId:', videoId);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify({
                url: `https://www.douyin.com/video/${videoId}`,
                hd: 1
            })
        });

        const data = await response.json();
        console.log('API返回数据:', data);

        // 如果有直接的视频地址
        if (data.nwm_video_url) {
            return {
                video_data: {
                    nwm_video_url: data.nwm_video_url,
                    desc: data.desc || '抖音视频'
                }
            };
        }

        // 尝试第二个API
        const secondUrl = `https://api.douyin.wtf/video_data?video_id=${videoId}`;
        console.log('尝试第二个API:', secondUrl);
        
        const secondResponse = await fetch(secondUrl);
        const secondData = await secondResponse.json();
        console.log('第二个API返回数据:', secondData);

        if (secondData.video_data?.play_addr?.url_list?.[0]) {
            const videoUrl = secondData.video_data.play_addr.url_list[0]
                .replace('playwm', 'play')
                .replace('watermark=1', 'watermark=0');

            return {
                video_data: {
                    nwm_video_url: videoUrl,
                    desc: secondData.video_data.desc || '抖音视频'
                }
            };
        }

        // 尝试第三个API
        const thirdUrl = `https://api.douyin.wtf/download?video_id=${videoId}`;
        console.log('尝试第三个API:', thirdUrl);
        
        const thirdResponse = await fetch(thirdUrl);
        const thirdData = await thirdResponse.json();
        console.log('第三个API返回数据:', thirdData);

        if (thirdData.video_data?.nwm_video_url) {
            return {
                video_data: {
                    nwm_video_url: thirdData.video_data.nwm_video_url,
                    desc: thirdData.video_data.desc || '抖音视频'
                }
            };
        }

        throw new Error('未找到视频地址');

    } catch (error) {
        console.error('API错误:', error);

        // 最后尝试直接从抖音获取
        try {
            const douyinUrl = `https://www.douyin.com/video/${videoId}`;
            const response = await fetch(douyinUrl);
            const html = await response.text();
            
            // 尝试从页面源码中提取视频地址
            const renderDataMatch = html.match(/<script id="RENDER_DATA" type="application\/json">([^<]+)<\/script>/);
            if (renderDataMatch) {
                const renderData = JSON.parse(decodeURIComponent(renderDataMatch[1]));
                
                for (const key in renderData) {
                    const item = renderData[key];
                    if (item?.aweme?.detail) {
                        const videoInfo = item.aweme.detail;
                        const videoUrl = videoInfo.video?.playAddr?.url_list?.[0];
                        
                        if (videoUrl) {
                            return {
                                video_data: {
                                    nwm_video_url: videoUrl.replace('playwm', 'play'),
                                    desc: videoInfo.desc || '抖音视频'
                                }
                            };
                        }
                    }
                }
            }
            
            throw new Error('无法从页面提取视频地址');
        } catch (finalError) {
            console.error('最终尝试失败:', finalError);
            throw new Error('无法获取视频，请稍后重试');
        }
    }
}

// 监听消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchVideoData') {
        fetchVideoData(request.videoId)
            .then(data => {
                console.log('成功获取视频数据:', data);
                sendResponse({ success: true, data });
            })
            .catch(error => {
                console.error('获取视频数据失败:', error);
                sendResponse({ 
                    success: false, 
                    error: error.message
                });
            });
        return true;
    }
    
    if (request.action === 'checkTab') {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            const isDouyinTab = tabs[0]?.url?.includes('douyin.com') || false;
            sendResponse({isDouyinTab});
        });
        return true;
    }
}); 