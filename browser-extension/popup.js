document.addEventListener('DOMContentLoaded', () => {
    const serverUrlInput = document.getElementById('serverUrl');
    const userTokenInput = document.getElementById('userToken');
    const saveBtn = document.getElementById('saveBtn');
    const synthesizeBtn = document.getElementById('synthesizeBtn');
    const statusDiv = document.getElementById('status');
  
    // 加载已有配置
    chrome.storage.local.get(['aiSynthServerUrl', 'aiSynthToken'], (result) => {
      if (result.aiSynthServerUrl) serverUrlInput.value = result.aiSynthServerUrl;
      if (result.aiSynthToken) userTokenInput.value = result.aiSynthToken;
    });
  
    // 提示信息函数
    const showStatus = (msg, isError = false) => {
      statusDiv.textContent = msg;
      statusDiv.className = isError ? 'error' : 'success';
      setTimeout(() => { statusDiv.textContent = ''; }, 3000);
    };
  
    // 保存配置
    saveBtn.addEventListener('click', () => {
      const url = serverUrlInput.value.trim().replace(/\/$/, ""); // 移除结尾斜杠
      const token = userTokenInput.value.trim();
      if (!url) {
        showStatus('服务器地址不能为空！', true);
        return;
      }
      chrome.storage.local.set({ aiSynthServerUrl: url, aiSynthToken: token }, () => {
        showStatus('配置已保存成功！现在可一键抓取网页。');
        // 通知后台脚本重新挂载右键菜单
        chrome.runtime.sendMessage({ type: "CONFIG_UPDATED" });
      });
    });
  
    // 主动抓取当前页
    synthesizeBtn.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if(!currentTab) return;
        
        statusDiv.textContent = "🚀 正在向你的私有云端发送网页...";
        statusDiv.className = "";
        
        chrome.runtime.sendMessage({
          type: "SEND_TO_SYNTHESIZER",
          data: {
            title: currentTab.title,
            url: currentTab.url,
            isPage: true
          }
        }, (response) => {
            if (response && response.success) {
                showStatus('✅ 发送成功！云端已开始在后台解析。');
            } else {
                showStatus('❌ 发送失败：' + (response ? response.error : '未知错误'), true);
            }
        });
      });
    });
});
