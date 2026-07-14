// State Management
let chats = [];
let activeChatId = null;
let attachedImages = []; // Array of { dataUri, mimeType, name }
let settings = {
  apiUrl: 'https://api.x.ai/v1',
  apiKey: '',
  model: 'gpt-4o',
  systemPrompt: 'Anda adalah AI asisten yang sangat cerdas, membantu, dan detail.',
  temperature: 0.7,
  maxTokens: 2048
};

// DOM Elements
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const historyList = document.getElementById('history-list');
const settingsToggleBtn = document.getElementById('settings-toggle-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsCancelBtn = document.getElementById('settings-cancel-btn');
const settingsSaveBtn = document.getElementById('settings-save-btn');
const clearChatBtn = document.getElementById('clear-chat-btn');
const activeChatTitle = document.getElementById('active-chat-title');
const activeModelDisplay = document.getElementById('active-model-display');
const messagesContainer = document.getElementById('messages-container');
const welcomeScreen = document.getElementById('welcome-screen');
const messagesList = document.getElementById('messages-list');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const attachBtn = document.getElementById('attach-btn');
const imageUploadInput = document.getElementById('image-upload-input');
const attachmentPreviewContainer = document.getElementById('attachment-preview-container');
const statusEndpointDisplay = document.getElementById('status-endpoint-display');
const tempValDisplay = document.getElementById('temp-val-display');

// Model selection elements
const settingsModelInput = document.getElementById('settings-model');
const settingsModelSelect = document.getElementById('settings-model-select');
const checkModelsBtn = document.getElementById('check-models-btn');

// Initialize Markdown marked renderer
const renderer = new marked.Renderer();
renderer.code = function(firstArg, secondArg) {
  let codeText = '';
  let language = '';
  
  if (firstArg && typeof firstArg === 'object') {
    codeText = firstArg.text || '';
    language = firstArg.lang || '';
  } else {
    codeText = firstArg || '';
    language = secondArg || '';
  }
  
  const validLang = language && hljs.getLanguage(language) ? language : 'plaintext';
  
  let highlighted = '';
  try {
    highlighted = hljs.highlight(codeText, { language: validLang }).value;
  } catch (e) {
    highlighted = hljs.highlightAuto(codeText).value;
  }
  
  const codeId = 'code-' + Math.random().toString(36).substring(2, 9);
  
  // Detect if codeText is an SVG code block
  const trimmedCode = codeText.trim();
  const isSvg = trimmedCode.startsWith('<svg') && trimmedCode.endsWith('</svg>');
  
  if (isSvg) {
    return `
      <div class="assistant-rendered-svg-container">
        ${codeText}
        <div class="code-header" style="width: 100%; border-top: 1px solid var(--glass-border); padding-top: 10px; margin-top: 12px; margin-bottom: 0;">
          <span>SVG Vector Graphics</span>
          <button type="button" onclick="copyToClipboard('${codeId}')" id="${codeId}-btn">
            <i data-lucide="copy" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Copy SVG Code
          </button>
        </div>
        <pre style="display: none;"><code id="${codeId}">${escapeHTML(codeText)}</code></pre>
      </div>
    `;
  }
  
  return `
    <div class="code-wrapper">
      <div class="code-header">
        <span>${validLang}</span>
        <button type="button" onclick="copyToClipboard('${codeId}')" id="${codeId}-btn">
          <i data-lucide="copy" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Copy
        </button>
      </div>
      <pre><code class="hljs ${validLang}" id="${codeId}">${highlighted}</code></pre>
    </div>
  `;
};
renderer.image = function(firstArg, secondArg, thirdArg) {
  let href = '';
  let title = '';
  let text = '';
  
  if (firstArg && typeof firstArg === 'object') {
    href = firstArg.href || '';
    title = firstArg.title || '';
    text = firstArg.text || '';
  } else {
    href = firstArg || '';
    title = secondArg || '';
    text = thirdArg || '';
  }
  
  return `
    <div class="assistant-image-container">
      <img src="${href}" alt="${text || 'Image'}" title="${title || ''}" onclick="window.open('${href}', '_blank')" class="assistant-rendered-image">
      ${text ? `<span class="image-caption">${text}</span>` : ''}
    </div>
  `;
};
marked.use({ renderer });

// Custom Parser to handle KaTeX Math along with Markdown
function renderMathAndMarkdown(text) {
  if (!text) return '';
  let processedText = text;
  
  // 1. Extract Display Math: $$ math $$
  const displayMath = [];
  processedText = processedText.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
    const id = `__DISPLAY_MATH_${displayMath.length}__`;
    try {
      const rendered = katex.renderToString(math, { displayMode: true, throwOnError: false });
      displayMath.push({ id, html: rendered });
    } catch (e) {
      displayMath.push({ id, html: `<span class="error-math">${math}</span>` });
    }
    return id;
  });

  // 2. Extract Inline Math: $ math $
  const inlineMath = [];
  processedText = processedText.replace(/\$([^\$\n]+?)\$/g, (match, math) => {
    const id = `__INLINE_MATH_${inlineMath.length}__`;
    try {
      const rendered = katex.renderToString(math, { displayMode: false, throwOnError: false });
      inlineMath.push({ id, html: rendered });
    } catch (e) {
      inlineMath.push({ id, html: `<span class="error-math">${math}</span>` });
    }
    return id;
  });

  // 3. Render Markdown
  let html = marked.parse(processedText);

  // 4. Restore Display Math
  displayMath.forEach(({ id, html: mathHtml }) => {
    html = html.replace(id, mathHtml);
  });

  // 5. Restore Inline Math
  inlineMath.forEach(({ id, html: mathHtml }) => {
    html = html.replace(id, mathHtml);
  });

  return html;
}

// Global copy function (referenced in code header template)
window.copyToClipboard = function(codeId) {
  const codeElement = document.getElementById(codeId);
  if (!codeElement) return;

  const textToCopy = codeElement.innerText;
  navigator.clipboard.writeText(textToCopy).then(() => {
    const copyButton = document.getElementById(`${codeId}-btn`);
    if (copyButton) {
      copyButton.innerHTML = `<i data-lucide="check" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;color:var(--color-success);"></i>Copied!`;
      lucide.createIcons();
      setTimeout(() => {
        copyButton.innerHTML = `<i data-lucide="copy" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Copy`;
        lucide.createIcons();
      }, 2000);
    }
  }).catch(err => {
    console.error('Gagal menyalin teks: ', err);
  });
};

// Initialize Application
function init() {
  loadSettings();
  loadChats();
  setupEventListeners();
  updateStatusDisplays();
  lucide.createIcons();
}

// // Load Settings from LocalStorage
function loadSettings() {
  const storedSettings = localStorage.getItem('bebaavision_settings');
  if (storedSettings) {
    try {
      settings = { ...settings, ...JSON.parse(storedSettings) };
    } catch (e) {
      console.error('Error loading settings', e);
    }
  }
}

// Save Settings to LocalStorage
function saveSettings(newSettings) {
  settings = { ...settings, ...newSettings };
  localStorage.setItem('bebaavision_settings', JSON.stringify(settings));
  updateStatusDisplays();
}

// Load Chats from LocalStorage
function loadChats() {
  const storedChats = localStorage.getItem('bebaavision_chats');
  const storedActiveChatId = localStorage.getItem('bebaavision_active_chat_id');
  
  if (storedChats) {
    try {
      chats = JSON.parse(storedChats);
    } catch (e) {
      console.error('Error loading chats', e);
    }
  }
  
  if (storedActiveChatId) {
    activeChatId = storedActiveChatId;
  }
  
  // Ensure we have at least one chat if empty
  if (chats.length === 0) {
    createNewChat();
  } else {
    renderHistory();
    switchChat(activeChatId || chats[0].id);
  }
}

// Save Chats to LocalStorage
function saveChats() {
  localStorage.setItem('bebaavision_chats', JSON.stringify(chats));
  localStorage.setItem('bebaavision_active_chat_id', activeChatId);
}

// Update settings-related displays in UI
function updateStatusDisplays() {
  activeModelDisplay.textContent = settings.model;
  
  let hostname = 'BebaaVision API';
  try {
    const endpoint = new URL(settings.apiUrl);
    hostname = endpoint.hostname === 'api.x.ai' ? 'x.ai API' : endpoint.hostname;
  } catch (e) {
    hostname = settings.apiUrl || 'Unknown';
  }
  statusEndpointDisplay.textContent = hostname;
  
  // Populate settings fields
  document.getElementById('settings-api-url').value = settings.apiUrl;
  document.getElementById('settings-api-key').value = settings.apiKey;
  
  // Sync text input
  settingsModelInput.value = settings.model;
  
  // Sync dropdown if populated
  if (availableModels.length > 0) {
    if (availableModels.includes(settings.model)) {
      settingsModelSelect.value = settings.model;
    } else {
      // Add custom option if not present
      let optionExists = Array.from(settingsModelSelect.options).some(opt => opt.value === settings.model);
      if (!optionExists) {
        const opt = document.createElement('option');
        opt.value = settings.model;
        opt.textContent = `${settings.model} (Custom)`;
        settingsModelSelect.appendChild(opt);
      }
      settingsModelSelect.value = settings.model;
    }
  }
  
  document.getElementById('settings-system-prompt').value = settings.systemPrompt;
  document.getElementById('settings-temperature').value = settings.temperature;
  tempValDisplay.textContent = settings.temperature;
  document.getElementById('settings-max-tokens').value = settings.maxTokens || '';
}

// Create new chat session
function createNewChat() {
  const newId = 'chat_' + Date.now();
  const newChat = {
    id: newId,
    title: 'Chat Baru',
    messages: [],
    model: settings.model,
    systemPrompt: settings.systemPrompt,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens
  };
  
  chats.unshift(newChat);
  activeChatId = newId;
  saveChats();
  renderHistory();
  switchChat(newId);
}

// Render Chat History list in Sidebar
function renderHistory() {
  historyList.innerHTML = '';
  chats.forEach(chat => {
    const item = document.createElement('div');
    item.className = `history-item ${chat.id === activeChatId ? 'active' : ''}`;
    
    // Add title click listener
    item.innerHTML = `
      <div class="history-item-details" onclick="switchChat('${chat.id}')">
        <i data-lucide="message-square"></i>
        <span class="history-item-title">${escapeHTML(chat.title)}</span>
      </div>
      <div class="history-item-actions">
        <button class="btn btn-icon btn-small btn-rename" onclick="renameChatPrompt('${chat.id}', event)" title="Rename Chat">
          <i data-lucide="edit-3"></i>
        </button>
        <button class="btn btn-icon btn-small btn-danger" onclick="deleteChat('${chat.id}', event)" title="Delete Chat">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `;
    
    historyList.appendChild(item);
  });
  lucide.createIcons();
}

// Switch Active Chat
function switchChat(chatId) {
  // Save active id
  activeChatId = chatId;
  localStorage.setItem('bebaavision_active_chat_id', chatId);
  
  // Highlight active
  document.querySelectorAll('.history-item').forEach(item => {
    item.classList.remove('active');
  });
  
  const activeChat = chats.find(c => c.id === chatId);
  if (!activeChat) return;
  
  // Find current history DOM item and make active
  renderHistory();
  
  // Set UI Details
  activeChatTitle.textContent = activeChat.title;
  activeModelDisplay.textContent = activeChat.model || settings.model;
  
  // Render Messages
  renderMessages();
}

// Rename Chat via simple Prompt
window.renameChatPrompt = function(chatId, event) {
  event.stopPropagation();
  const chat = chats.find(c => c.id === chatId);
  if (!chat) return;
  
  const newTitle = prompt('Masukkan nama baru untuk chat ini:', chat.title);
  if (newTitle && newTitle.trim()) {
    chat.title = newTitle.trim();
    saveChats();
    renderHistory();
    if (chatId === activeChatId) {
      activeChatTitle.textContent = chat.title;
    }
  }
};

// Delete Chat session
window.deleteChat = function(chatId, event) {
  event.stopPropagation();
  const index = chats.findIndex(c => c.id === chatId);
  if (index === -1) return;
  
  if (confirm('Apakah Anda yakin ingin menghapus percakapan ini?')) {
    chats.splice(index, 1);
    
    if (chats.length === 0) {
      createNewChat();
    } else {
      if (activeChatId === chatId) {
        activeChatId = chats[0].id;
      }
      saveChats();
      renderHistory();
      switchChat(activeChatId);
    }
  }
};

// Clear all messages in current chat
function clearCurrentChat() {
  const activeChat = chats.find(c => c.id === activeChatId);
  if (!activeChat) return;
  
  if (confirm('Kosongkan semua pesan di chat ini?')) {
    activeChat.messages = [];
    activeChat.title = 'Chat Baru';
    saveChats();
    renderHistory();
    switchChat(activeChatId);
  }
}

// Render Messages on Screen
function renderMessages() {
  const activeChat = chats.find(c => c.id === activeChatId);
  if (!activeChat || activeChat.messages.length === 0) {
    welcomeScreen.style.display = 'flex';
    messagesList.innerHTML = '';
    return;
  }
  
  welcomeScreen.style.display = 'none';
  messagesList.innerHTML = '';
  
  activeChat.messages.forEach(msg => {
    appendMessageDOM(msg.role, msg.content);
  });
  scrollToBottom();
}

// Helper to escape HTML characters
function escapeHTML(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper to extract plain text and images from a message content (which can be a string or array)
function parseMessageContent(content) {
  let text = '';
  let images = [];
  
  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    content.forEach(item => {
      if (item.type === 'text') {
        text = item.text;
      } else if (item.type === 'image_url') {
        images.push(item.image_url.url);
      }
    });
  }
  return { text, images };
}

// Append message element to DOM
function appendMessageDOM(role, content) {
  const { text, images } = parseMessageContent(content);
  
  const messageRow = document.createElement('div');
  messageRow.className = `message-row ${role} message-animated`;
  
  // Attachments HTML
  let attachmentsHtml = '';
  if (images.length > 0) {
    attachmentsHtml = `<div class="message-attachments">`;
    images.forEach(imgUrl => {
      attachmentsHtml += `<img src="${imgUrl}" alt="Attachment" onclick="window.open('${imgUrl}', '_blank')">`;
    });
    attachmentsHtml += `</div>`;
  }
  
  // Message Text HTML (using Markdown rendering for assistant, simple escaped or markdown for user)
  let bubbleContentHtml = '';
  if (role === 'assistant') {
    bubbleContentHtml = renderMathAndMarkdown(text);
  } else {
    // Escape HTML for user input, preserve newlines, or render markdown if simple
    bubbleContentHtml = `<p>${escapeHTML(text).replace(/\n/g, '<br>')}</p>`;
  }
  
  messageRow.innerHTML = `
    ${attachmentsHtml}
    <div class="message-bubble">
      ${bubbleContentHtml}
    </div>
    <div class="message-meta">
      <span>${role === 'user' ? 'Anda' : 'BebaaVision'}</span>
    </div>
  `;
  
  messagesList.appendChild(messageRow);
  lucide.createIcons();
}

// Add typing indicator element
function appendTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'message-row assistant message-animated';
  indicator.id = 'typing-indicator-row';
  indicator.innerHTML = `
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
    <div class="message-meta">BebaaVision sedang mengetik...</div>
  `;
  messagesList.appendChild(indicator);
  scrollToBottom();
}

// Remove typing indicator
function removeTypingIndicator() {
  const indicator = document.getElementById('typing-indicator-row');
  if (indicator) {
    indicator.remove();
  }
}

// Auto-Scroll messages list to bottom
function scrollToBottom() {
  messagesContainer.scrollTo({
    top: messagesContainer.scrollHeight,
    behavior: 'smooth'
  });
}

// Handle image upload and base64 conversion
function handleFiles(files) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.type.startsWith('image/')) continue;
    
    const reader = new FileReader();
    reader.onload = function(e) {
      const dataUri = e.target.result;
      const mimeType = file.type;
      
      // Prevent duplicates
      if (attachedImages.some(img => img.name === file.name)) return;
      
      attachedImages.push({
        dataUri: dataUri,
        mimeType: mimeType,
        name: file.name
      });
      
      renderAttachmentPreviews();
    };
    reader.readAsDataURL(file);
  }
}

// Render attachment thumbnails above input
function renderAttachmentPreviews() {
  if (attachedImages.length === 0) {
    attachmentPreviewContainer.style.display = 'none';
    attachmentPreviewContainer.innerHTML = '';
    return;
  }
  
  attachmentPreviewContainer.style.display = 'flex';
  attachmentPreviewContainer.innerHTML = '';
  
  attachedImages.forEach((img, index) => {
    const preview = document.createElement('div');
    preview.className = 'attachment-preview';
    preview.innerHTML = `
      <img src="${img.dataUri}" alt="${escapeHTML(img.name)}">
      <button type="button" class="remove-attachment-btn" onclick="removeAttachment(${index})">×</button>
    `;
    attachmentPreviewContainer.appendChild(preview);
  });
}

// Remove attached image from preview list
window.removeAttachment = function(index) {
  attachedImages.splice(index, 1);
  renderAttachmentPreviews();
};

// Send message trigger
async function handleSendMessage(e) {
  if (e) e.preventDefault();
  
  const activeChat = chats.find(c => c.id === activeChatId);
  if (!activeChat) return;
  
  const textInput = chatInput.value.trim();
  
  // Validate that there is content to send
  if (!textInput && attachedImages.length === 0) return;
  
  // Validation: API Key must be set
  if (!settings.apiKey) {
    alert('Harap isi API Key Anda di menu Pengaturan sebelum mengirim pesan.');
    settingsModal.style.display = 'flex';
    return;
  }
  
  // Build message structure
  let messageContent;
  if (attachedImages.length > 0) {
    // Multimodal payload
    messageContent = [];
    messageContent.push({ type: 'text', text: textInput || 'Jelaskan gambar ini' });
    attachedImages.forEach(img => {
      messageContent.push({
        type: 'image_url',
        image_url: {
          url: img.dataUri
        }
      });
    });
  } else {
    // Plain text
    messageContent = textInput;
  }
  
  const userMessage = {
    role: 'user',
    content: messageContent,
    timestamp: new Date().toLocaleTimeString()
  };
  
  // Update chat title if it's the first message
  if (activeChat.messages.length === 0) {
    const titleText = textInput || 'Analisis Gambar';
    activeChat.title = titleText.length > 30 ? titleText.substring(0, 30) + '...' : titleText;
  }
  
  // Save user message to active chat
  activeChat.messages.push(userMessage);
  saveChats();
  
  // Refresh views
  welcomeScreen.style.display = 'none';
  appendMessageDOM('user', messageContent);
  renderHistory();
  scrollToBottom();
  
  // Reset input field and attachment previews
  chatInput.value = '';
  chatInput.style.height = 'auto';
  attachedImages = [];
  renderAttachmentPreviews();
  
  // Add temporary assistant typing bubble
  appendTypingIndicator();
  
  // Setup SSE stream to proxy endpoint
  try {
    // Build payloads
    const apiMessages = [];
    
    // Add system prompt if configured
    if (settings.systemPrompt) {
      apiMessages.push({
        role: 'system',
        content: settings.systemPrompt
      });
    }
    
    // Add history messages
    activeChat.messages.forEach(msg => {
      // Structure content
      apiMessages.push({
        role: msg.role,
        content: msg.content
      });
    });
    
    const payload = {
      model: settings.model,
      messages: apiMessages,
      stream: true,
      temperature: parseFloat(settings.temperature)
    };
    
    if (settings.maxTokens) {
      payload.max_tokens = parseInt(settings.maxTokens);
    }
    
    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: settings.apiUrl + '/chat/completions',
        key: settings.apiKey,
        body: payload
      })
    });
    
    removeTypingIndicator();
    
    if (!response.ok) {
      const errorData = await response.json();
      let errorMsg = `HTTP ${response.status}`;
      if (errorData.details) {
        try {
          const parsedDetails = JSON.parse(errorData.details);
          errorMsg = parsedDetails.error?.message || errorData.details;
        } catch (e) {
          errorMsg = errorData.details;
        }
      } else if (errorData.error) {
        errorMsg = typeof errorData.error === 'object' ? (errorData.error.message || JSON.stringify(errorData.error)) : errorData.error;
      }
      throw new Error(errorMsg);
    }
    
    // Create assistant message bubble
    const assistantMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString()
    };
    
    // Append blank bubble to DOM first
    const messageRow = document.createElement('div');
    messageRow.className = 'message-row assistant message-animated';
    messageRow.innerHTML = `
      <div class="message-bubble"></div>
      <div class="message-meta"><span>BebaaVision</span></div>
    `;
    messagesList.appendChild(messageRow);
    const bubbleElement = messageRow.querySelector('.message-bubble');
    scrollToBottom();
    
    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullResponseText = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Save incomplete line to buffer
      
      for (const line of lines) {
        const cleanLine = line.trim();
        if (!cleanLine) continue;
        if (cleanLine === 'data: [DONE]') continue;
        
        if (cleanLine.startsWith('data: ')) {
          const jsonStr = cleanLine.slice(6);
          try {
            const data = JSON.parse(jsonStr);
            const content = data.choices?.[0]?.delta?.content || '';
            if (content) {
              fullResponseText += content;
              assistantMessage.content = fullResponseText;
              bubbleElement.innerHTML = renderMathAndMarkdown(fullResponseText);
              scrollToBottom();
            }
          } catch (e) {
            // Ignore incomplete chunks errors
            console.warn('Failed parsing JSON chunk', e, jsonStr);
          }
        }
      }
    }
    
    // Re-run highlighting & syntax replacements just in case
    bubbleElement.innerHTML = renderMathAndMarkdown(fullResponseText);
    lucide.createIcons();
    scrollToBottom();
    
    // Add completed assistant message to chat list and save
    activeChat.messages.push(assistantMessage);
    saveChats();
    
  } catch (error) {
    removeTypingIndicator();
    console.error('Send Error:', error);
    
    // Show error message bubble
    const errorMsg = {
      role: 'assistant',
      content: `⚠️ **Gagal mengirim pesan.**\n\nDetail Kesalahan: \`${error.message}\`\n\nSilakan periksa API Key, Base URL, dan koneksi internet Anda di menu Pengaturan.`,
      timestamp: new Date().toLocaleTimeString()
    };
    appendMessageDOM('assistant', errorMsg.content);
    activeChat.messages.push(errorMsg);
    saveChats();
  }
}

// Available models state
let availableModels = [];

// Fetch available models from proxy
async function fetchAvailableModels() {
  const apiUrl = document.getElementById('settings-api-url').value.trim();
  const apiKey = document.getElementById('settings-api-key').value.trim();
  
  if (!apiUrl || !apiKey) {
    alert('Harap isi Base URL dan API Key terlebih dahulu sebelum mengecek model!');
    return;
  }
  
  const icon = checkModelsBtn.querySelector('i');
  if (icon) icon.classList.add('spin-icon-hover');
  checkModelsBtn.disabled = true;
  checkModelsBtn.innerHTML = `<i data-lucide="refresh-cw" class="spin-icon-hover"></i> Memuat...`;
  lucide.createIcons();
  
  try {
    const endpointUrl = apiUrl + '/models';
    const response = await fetch(`/api/client-models?url=${encodeURIComponent(endpointUrl)}&key=${encodeURIComponent(apiKey)}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      let errorMsg = `HTTP ${response.status}`;
      if (errorData.details) {
        try {
          const parsedDetails = JSON.parse(errorData.details);
          errorMsg = parsedDetails.error?.message || errorData.details;
        } catch (e) {
          errorMsg = errorData.details;
        }
      }
      throw new Error(errorMsg);
    }
    
    const data = await response.json();
    if (data.data && Array.isArray(data.data)) {
      availableModels = data.data.map(m => m.id);
      populateModelsDropdown();
    } else {
      throw new Error('Format response list model tidak valid');
    }
  } catch (error) {
    console.error('Error fetching models:', error);
    alert(`Gagal mengambil daftar model:\n${error.message}`);
  } finally {
    checkModelsBtn.disabled = false;
    checkModelsBtn.innerHTML = `<i data-lucide="refresh-cw"></i> Cek Model`;
    lucide.createIcons();
  }
}

// Populate model dropdown
function populateModelsDropdown() {
  if (availableModels.length === 0) return;
  
  settingsModelSelect.innerHTML = '';
  
  // Sort models alphabetically
  availableModels.sort();
  
  availableModels.forEach(modelId => {
    const opt = document.createElement('option');
    opt.value = modelId;
    opt.textContent = modelId;
    settingsModelSelect.appendChild(opt);
  });
  
  // Show select, hide input
  settingsModelInput.style.display = 'none';
  settingsModelSelect.style.display = 'block';
  
  // Set current selected value
  if (availableModels.includes(settings.model)) {
    settingsModelSelect.value = settings.model;
  } else {
    // Add current model as custom option if it's not in the list
    const opt = document.createElement('option');
    opt.value = settings.model;
    opt.textContent = `${settings.model} (Custom)`;
    settingsModelSelect.appendChild(opt);
    settingsModelSelect.value = settings.model;
  }
}

// Setup all DOM events
function setupEventListeners() {
  // Sidebar Toggles
  sidebarToggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });
  
  newChatBtn.addEventListener('click', createNewChat);
  clearChatBtn.addEventListener('click', clearCurrentChat);
  
  // Settings Modal events
  settingsToggleBtn.addEventListener('click', () => {
    settingsModal.style.display = 'flex';
  });
  
  settingsCloseBtn.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });
  
  settingsCancelBtn.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });
  
  settingsSaveBtn.addEventListener('click', () => {
    const apiUrl = document.getElementById('settings-api-url').value.trim();
    const apiKey = document.getElementById('settings-api-key').value.trim();
    
    // Read model from dropdown if visible, else from text input
    const model = (settingsModelSelect.style.display !== 'none' && settingsModelSelect.value) 
      ? settingsModelSelect.value 
      : settingsModelInput.value.trim();
      
    const systemPrompt = document.getElementById('settings-system-prompt').value.trim();
    const temperature = document.getElementById('settings-temperature').value;
    const maxTokensVal = document.getElementById('settings-max-tokens').value.trim();
    
    if (!apiUrl) {
      alert('Base URL API tidak boleh kosong!');
      return;
    }
    
    saveSettings({
      apiUrl,
      apiKey,
      model: model || 'gpt-4o',
      systemPrompt,
      temperature,
      maxTokens: maxTokensVal ? parseInt(maxTokensVal) : null
    });
    
    // Update active chat's settings if empty/new
    const activeChat = chats.find(c => c.id === activeChatId);
    if (activeChat && activeChat.messages.length === 0) {
      activeChat.model = settings.model;
      activeChat.systemPrompt = settings.systemPrompt;
      activeChat.temperature = settings.temperature;
      activeChat.maxTokens = settings.maxTokens;
      saveChats();
    }
    
    settingsModal.style.display = 'none';
    updateStatusDisplays();
  });
  
  // Model Select Change sync to input
  settingsModelSelect.addEventListener('change', () => {
    settingsModelInput.value = settingsModelSelect.value;
  });
  
  // Check Models Button click
  checkModelsBtn.addEventListener('click', fetchAvailableModels);
  
  // Password Visibility Toggle
  document.getElementById('toggle-key-visibility').addEventListener('click', function() {
    const keyInput = document.getElementById('settings-api-key');
    const icon = this.querySelector('i');
    if (keyInput.type === 'password') {
      keyInput.type = 'text';
      icon.setAttribute('data-lucide', 'eye-off');
    } else {
      keyInput.type = 'password';
      icon.setAttribute('data-lucide', 'eye');
    }
    lucide.createIcons();
  });
  
  // Temperature Slider Event
  const tempSlider = document.getElementById('settings-temperature');
  tempSlider.addEventListener('input', () => {
    tempValDisplay.textContent = tempSlider.value;
  });
  
  // Textarea Auto-Growing
  chatInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight - 4) + 'px';
  });
  
  // Submit Form / Enter Key trigger
  chatForm.addEventListener('submit', handleSendMessage);
  
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });
  
  // Image Upload Trigger Buttons
  attachBtn.addEventListener('click', () => {
    imageUploadInput.click();
  });
  
  imageUploadInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  });
  
  // Drag & Drop Handlers
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });
  
  // Copy Paste Clipboard Image Handler
  chatInput.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        // Create custom name for paste
        const pasteFile = new File([file], `clipboard_${Date.now()}.png`, { type: file.type });
        handleFiles([pasteFile]);
      }
    }
  });
}

// Start the APP!
window.onload = init;
