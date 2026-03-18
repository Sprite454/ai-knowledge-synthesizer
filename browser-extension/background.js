// 监听插件安装或配置更新时创建右键菜单
const setupContextMenus = () => {
    chrome.storage.local.get(['aiSynthServerUrl'], (result) => {
      chrome.contextMenus.removeAll(() => {
        if (result.aiSynthServerUrl) {
          // 只在用户配置了服务器后开启功能菜单
          chrome.contextMenus.create({
            id: "synthesize_page",
            title: "🌟 AI 知识合成：解析当前整个网页",
            contexts: ["page"]
          });
          
          chrome.contextMenus.create({
            id: "synthesize_selection",
            title: "🌟 AI 知识合成：浓缩被选中的文字",
            contexts: ["selection"]
          });
  
          chrome.contextMenus.create({
            id: "synthesize_link",
            title: "🌟 AI 知识合成：抓取并解析此链接",
            contexts: ["link"]
          });
        }
      });
    });
  };
  
  chrome.runtime.onInstalled.addListener(setupContextMenus);
  
  // 监听发送事件
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === "CONFIG_UPDATED") {
          setupContextMenus();
          sendResponse({ success: true });
      } else if (request.type === "SEND_TO_SYNTHESIZER") {
          handleSendToCloud(request.data, sendResponse);
          return true; // 保持异步挂起以便能发回返回信号
      }
  });
  
  // 监听右键菜单点击
  chrome.contextMenus.onClicked.addListener((info, tab) => {
      let data = { title: tab ? tab.title : '未命名截页', sourceUrl: tab ? tab.url : '' };
      
      if (info.menuItemId === "synthesize_page") {
          data.type = 'url';
          data.content = tab.url; // 整页抓取使用 URL 触发后端无头浏览器
      } else if (info.menuItemId === "synthesize_selection") {
          data.type = 'text';
          data.content = info.selectionText; // 碎片高亮文字
      } else if (info.menuItemId === "synthesize_link") {
          data.type = 'url';
          data.content = info.linkUrl; // 单独的连接
      }
      
      // 显示一个小徽章提示正在处理 (V3 原生特性)
      if(tab && tab.id) chrome.action.setBadgeText({ text: "...", tabId: tab.id });
      
      handleSendToCloud(data, (res) => {
         if (tab && tab.id) {
             const badgeText = res.success ? "OK" : "Err";
             const badgeColor = res.success ? "#10b981" : "#ef4444";
             chrome.action.setBadgeText({ text: badgeText, tabId: tab.id });
             chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId: tab.id });
             setTimeout(() => { chrome.action.setBadgeText({ text: "", tabId: tab.id }); }, 4000);
         }
      });
  });
  
  // 封装好的通讯方法：将参数打给云端卡片生成 API
  async function handleSendToCloud(payload, sendResponse) {
      const config = await chrome.storage.local.get(['aiSynthServerUrl', 'aiSynthToken']);
      if (!config.aiSynthServerUrl) {
          sendResponse({ success: false, error: "请先点击插件图标配置您的 Render 服务器地址。" });
          return;
      }
  
      // 判断给后端的载荷：后端通常对 /api/v1/cards 接口接受 { type: 'text'|'url'|'image', content: '...', title: '...' }
      // 这里根据我们在 `src/types.ts` 和前端的行为封装请求体
      const bodyPayload = {
          title: payload.title || "从扩展插件提取",
          type: payload.type || (payload.isPage ? 'url' : 'text'),
          content: payload.content || payload.url,
          tags: ["✨浏览器快速剪藏"], // 自动打上专属扩展标签
          sourceUrl: payload.sourceUrl || payload.url
      };
  
      try {
          const res = await fetch(`${config.aiSynthServerUrl}/api/v1/cards`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${config.aiSynthToken}` // 使用 Token
              },
              body: JSON.stringify(bodyPayload)
          });
  
          if (res.ok) {
              const resData = await res.json();
              console.log("云端任务创建成功:", resData);
              sendResponse({ success: true, data: resData });
          } else {
              const err = await res.text();
              console.error("云端 API 拒绝请求:", err);
              sendResponse({ success: false, error: `服务器返回了 ${res.status}` });
          }
  
      } catch (e) {
          console.error("网络异常:", e);
          sendResponse({ success: false, error: e.message });
      }
  }
