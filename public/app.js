// State Management
let chats = [];
let activeChatId = null;
let attachedImages = []; // Array of { dataUri, mimeType, name }
let attachedDocs = []; // Array of { name, content, type }
let settings = {
  apiUrl: 'https://api.x.ai/v1',
  apiKey: '',
  model: 'gpt-4o',
  systemPrompt: 'Anda adalah AI asisten yang sangat cerdas, membantu, dan detail.',
  temperature: 0.7,
  maxTokens: 2048,
  directConn: false
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
const attachDocBtn = document.getElementById('attach-doc-btn');
const imageUploadInput = document.getElementById('image-upload-input');
const docUploadInput = document.getElementById('doc-upload-input');
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
  document.getElementById('settings-direct-conn').checked = !!settings.directConn;
  
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
  
  // Extract clean display text by removing the document context blocks
  let displayText = text;
  const docSplitIndex = text.indexOf('\n\n[Dokumen Terlampir:');
  if (docSplitIndex !== -1) {
    displayText = text.substring(0, docSplitIndex);
  }

  // Extract document names for rendering pills
  const docNames = [];
  const regex = /\[Dokumen Terlampir:\s*([^\]]+)\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    docNames.push(match[1]);
  }

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
  
  // Render Document Pills
  let docsHtml = '';
  if (docNames.length > 0) {
    docsHtml = `<div class="message-documents" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; margin-top: 4px;">`;
    docNames.forEach(name => {
      const isPdf = name.toLowerCase().endsWith('.pdf');
      docsHtml += `
        <div class="message-document-pill" style="display: flex; align-items: center; gap: 6px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; font-size: 11px; color: var(--text-primary);">
          <i data-lucide="${isPdf ? 'file-text' : 'file-code'}" style="width: 14px; height: 14px; color: var(--text-secondary);"></i>
          <span>${escapeHTML(name)}</span>
        </div>
      `;
    });
    docsHtml += `</div>`;
  }

  // Message Text HTML (using Markdown rendering for assistant, simple escaped or markdown for user)
  let bubbleContentHtml = '';
  if (role === 'assistant') {
    bubbleContentHtml = renderMathAndMarkdown(displayText);
  } else {
    // Escape HTML for user input, preserve newlines, or render markdown if simple
    bubbleContentHtml = `<p>${escapeHTML(displayText).replace(/\n/g, '<br>')}</p>`;
  }
  
  messageRow.innerHTML = `
    ${attachmentsHtml}
    ${docsHtml}
    <div class="message-bubble">
      ${bubbleContentHtml}
    </div>
    ${role === 'assistant' ? `
    <div class="message-actions" style="display: flex; gap: 8px; margin-top: 4px; margin-left: 12px; font-size: 11px;">
      <button type="button" class="btn-text btn-small" onclick="copyMessageText(this)" style="padding: 2px 6px; display: flex; align-items: center; gap: 4px; color: var(--text-secondary); background: transparent; border: none; cursor: pointer;">
        <i data-lucide="copy" style="width: 12px; height: 12px;"></i> Salin
      </button>
      <button type="button" class="btn-text btn-small" onclick="exportMessageWord(this)" style="padding: 2px 6px; display: flex; align-items: center; gap: 4px; color: var(--text-secondary); background: transparent; border: none; cursor: pointer;">
        <i data-lucide="file-text" style="width: 12px; height: 12px;"></i> Word
      </button>
    </div>` : ''}
    <div class="message-meta">
      <span>${role === 'user' ? 'Anda' : 'BebaaVision'}</span>
    </div>
  `;
  
  messagesList.appendChild(messageRow);
  if (role === 'assistant') {
    addTableExportButtons(messageRow);
  }
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

// Handle document upload and client-side extraction (PDF.js for pdfs, FileReader for others)
async function handleDocumentFiles(files) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (attachedDocs.some(doc => doc.name === file.name)) continue;
    
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (fileExtension === 'pdf') {
      try {
        const textContent = await extractTextFromPdf(file);
        attachedDocs.push({
          name: file.name,
          content: textContent,
          type: 'pdf'
        });
        renderAttachmentPreviews();
      } catch (err) {
        console.error('Error parsing PDF:', err);
        alert(`Gagal membaca file PDF "${file.name}": ${err.message}`);
      }
    } else {
      const reader = new FileReader();
      reader.onload = function(e) {
        attachedDocs.push({
          name: file.name,
          content: e.target.result,
          type: fileExtension
        });
        renderAttachmentPreviews();
      };
      reader.readAsText(file);
    }
  }
}

// Extract text content from PDF using PDF.js in the browser
async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = window['pdfjs-dist/build/pdf'];
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    text += strings.join(' ') + '\n';
  }
  return text;
}

// Render attachment thumbnails above input
function renderAttachmentPreviews() {
  if (attachedImages.length === 0 && attachedDocs.length === 0) {
    attachmentPreviewContainer.style.display = 'none';
    attachmentPreviewContainer.innerHTML = '';
    return;
  }
  
  attachmentPreviewContainer.style.display = 'flex';
  attachmentPreviewContainer.innerHTML = '';
  
  // Render Images
  attachedImages.forEach((img, index) => {
    const preview = document.createElement('div');
    preview.className = 'attachment-preview';
    preview.innerHTML = `
      <img src="${img.dataUri}" alt="${escapeHTML(img.name)}">
      <button type="button" class="remove-attachment-btn" onclick="removeImageAttachment(${index})">×</button>
    `;
    attachmentPreviewContainer.appendChild(preview);
  });

  // Render Documents
  attachedDocs.forEach((doc, index) => {
    const preview = document.createElement('div');
    preview.className = 'attachment-preview doc-preview';
    preview.style.display = 'flex';
    preview.style.flexDirection = 'column';
    preview.style.alignItems = 'center';
    preview.style.justifyContent = 'center';
    preview.style.width = '64px';
    preview.style.height = '64px';
    preview.style.border = '1px solid var(--border-color)';
    preview.style.borderRadius = '8px';
    preview.style.position = 'relative';
    preview.style.backgroundColor = 'var(--bg-secondary)';
    preview.style.padding = '4px';
    
    const isPdf = doc.type === 'pdf';
    preview.innerHTML = `
      <i data-lucide="${isPdf ? 'file-text' : 'file-code'}" style="width: 24px; height: 24px; color: var(--text-secondary);"></i>
      <span style="font-size: 9px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 4px; color: var(--text-primary);">${escapeHTML(doc.name)}</span>
      <button type="button" class="remove-attachment-btn" onclick="removeDocAttachment(${index})" style="position: absolute; top: -6px; right: -6px;">×</button>
    `;
    attachmentPreviewContainer.appendChild(preview);
  });
  
  lucide.createIcons();
}

window.removeImageAttachment = function(index) {
  attachedImages.splice(index, 1);
  renderAttachmentPreviews();
};

window.removeDocAttachment = function(index) {
  attachedDocs.splice(index, 1);
  renderAttachmentPreviews();
};

// Send message trigger
async function handleSendMessage(e) {
  if (e) e.preventDefault();
  
  const activeChat = chats.find(c => c.id === activeChatId);
  if (!activeChat) return;
  
  let textInput = chatInput.value.trim();
  
  // Validate that there is content to send
  if (!textInput && attachedImages.length === 0 && attachedDocs.length === 0) return;
  
  // Validation: API Key must be set
  if (!settings.apiKey) {
    alert('Harap isi API Key Anda di menu Pengaturan sebelum mengirim pesan.');
    settingsModal.style.display = 'flex';
    return;
  }
  
  // Build document context if any
  if (attachedDocs.length > 0) {
    let docContext = '';
    attachedDocs.forEach(doc => {
      docContext += `\n\n[Dokumen Terlampir: ${doc.name}]\n----------------------------------\n${doc.content}\n----------------------------------`;
    });
    textInput = (textInput || 'Analisis dokumen terlampir.') + docContext;
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
  attachedDocs = [];
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
    
    let targetUrl = settings.apiUrl;
    const isGemini = settings.apiUrl.includes('generativelanguage.googleapis.com');
    const isAnthropic = settings.apiUrl.includes('api.anthropic.com');
    if (!isGemini && !isAnthropic) {
      const endsWithCompletions = settings.apiUrl.includes('/chat/completions') || 
                                  settings.apiUrl.includes('/chat/completions/');
      if (!endsWithCompletions) {
        targetUrl = settings.apiUrl.endsWith('/') ? settings.apiUrl + 'chat/completions' : settings.apiUrl + '/chat/completions';
      }
    }

    let response;
    const isLocalUrl = settings.apiUrl.includes('localhost') || settings.apiUrl.includes('127.0.0.1');

    if (settings.directConn || isLocalUrl) {
      let finalHeaders = {
        'Content-Type': 'application/json'
      };
      let finalBody = JSON.stringify(payload);

      if (isGemini) {
        let model = payload.model || 'gemini-1.5-flash';
        if (!model.startsWith('models/')) {
          model = `models/${model}`;
        }
        targetUrl = `https://generativelanguage.googleapis.com/v1beta/${model}:streamGenerateContent?key=${settings.apiKey}&alt=sse`;
        finalBody = JSON.stringify(convertOpenAiToGemini(payload));
      } else if (isAnthropic) {
        targetUrl = 'https://api.anthropic.com/v1/messages';
        finalHeaders = {
          'Content-Type': 'application/json',
          'x-api-key': settings.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        };
        const systemMessage = (payload.messages || []).find(m => m.role === 'system');
        const otherMessages = (payload.messages || []).filter(m => m.role !== 'system');
        const anthropicBody = {
          model: payload.model || 'claude-3-5-sonnet-20241022',
          messages: otherMessages,
          max_tokens: payload.max_tokens || 2048,
          stream: true
        };
        if (systemMessage) {
          anthropicBody.system = systemMessage.content;
        }
        finalBody = JSON.stringify(anthropicBody);
      } else {
        if (settings.apiKey) {
          finalHeaders['Authorization'] = `Bearer ${settings.apiKey}`;
        }
      }

      response = await fetch(targetUrl, {
        method: 'POST',
        headers: finalHeaders,
        body: finalBody
      });
    } else {
      response = await fetch('/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: targetUrl,
          key: settings.apiKey,
          body: payload
        })
      });
    }
    
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
            let content = '';
            if (data.choices?.[0]?.delta?.content !== undefined) {
              content = data.choices[0].delta.content || '';
            } else if (data.candidates?.[0]?.content?.parts?.[0]?.text !== undefined) {
              content = data.candidates[0].content.parts[0].text || '';
            } else if (data.delta?.text !== undefined) {
              content = data.delta.text || '';
            }
            
            if (data.candidates?.[0]?.finishReason && data.candidates[0].finishReason !== 'STOP') {
              const reason = data.candidates[0].finishReason;
              if (reason === 'SAFETY') {
                content += `\n\n*(Dihentikan oleh AI: Konten diblokir oleh Filter Keamanan/Safety Filter)*`;
              } else {
                content += `\n\n*(Dihentikan oleh AI: ${reason})*`;
              }
            }
            
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
    
    // Check if response is empty after stream finished
    if (!fullResponseText.trim()) {
      fullResponseText = `*⚠️ Tidak ada respon dari AI. Ini biasanya terjadi jika request disaring atau diblokir oleh Filter Keamanan (Safety/Moderation Filter) dari provider API Anda.*`;
      assistantMessage.content = fullResponseText;
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
    let errorDetails = `⚠️ **Gagal mengirim pesan.**\n\nDetail Kesalahan: \`${error.message}\`\n\nSilakan periksa API Key, Base URL, dan koneksi internet Anda di menu Pengaturan.`;
    if (error.message.includes('504') || error.message.includes('502') || error.message.toLowerCase().includes('timeout') || error.message.toLowerCase().includes('failed')) {
      errorDetails += `\n\n💡 **Tips:** Terjadi batas waktu koneksi (timeout/fetch failed). Jika Anda menggunakan OpenRouter, Gemini, atau local 9Router, harap aktifkan/centang opsi **Bypass Proxy (Koneksi Langsung)** di menu Settings agar koneksi menjadi instan dan stabil.`;
    }
    const errorMsg = {
      role: 'assistant',
      content: errorDetails,
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
    let response;
    const isLocalUrl = endpointUrl.includes('localhost') || endpointUrl.includes('127.0.0.1');

    if (settings.directConn || isLocalUrl) {
      response = await fetch(endpointUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
    } else {
      response = await fetch(`/api/models?url=${encodeURIComponent(endpointUrl)}&key=${encodeURIComponent(apiKey)}`);
    }
    
    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errorText = await response.text();
        try {
          const errorData = JSON.parse(errorText);
          errorMsg = errorData.error?.message || errorData.details || errorData.error || errorText;
        } catch (e) {
          errorMsg = errorText || errorMsg;
        }
      } catch (e) {
        // Fallback
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
    const directConn = document.getElementById('settings-direct-conn').checked;
    
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
      directConn,
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

  // Document Upload Trigger Buttons
  attachDocBtn.addEventListener('click', () => {
    docUploadInput.click();
  });
  
  docUploadInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleDocumentFiles(e.target.files);
    }
  });
  
  // Drag & Drop Handlers
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const images = [];
      const docs = [];
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
          images.push(files[i]);
        } else {
          docs.push(files[i]);
        }
      }
      if (images.length > 0) handleFiles(images);
      if (docs.length > 0) handleDocumentFiles(docs);
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

// Helper to convert OpenAI messages format to Gemini Native format
function convertOpenAiToGemini(body) {
  const systemMessages = (body.messages || []).filter(m => m.role === 'system');
  const otherMessages = (body.messages || []).filter(m => m.role !== 'system');

  const systemInstruction = systemMessages.length > 0 ? {
    parts: [{ text: systemMessages.map(m => m.content).join('\n') }]
  } : undefined;

  const contents = otherMessages.map(m => {
    let role = m.role === 'assistant' ? 'model' : 'user';
    let parts = [];
    if (typeof m.content === 'string') {
      parts = [{ text: m.content }];
    } else if (Array.isArray(m.content)) {
      parts = m.content.map(part => {
        if (part.type === 'text') {
          return { text: part.text };
        } else if (part.type === 'image_url') {
          const dataUrl = part.image_url.url;
          const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            return {
              inlineData: {
                mimeType: matches[1],
                data: matches[2]
              }
            };
          }
        }
        return null;
      }).filter(Boolean);
    }
    return { role, parts };
  });

  const geminiPayload = {
    contents,
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" }
    ]
  };

  if (systemInstruction) {
    geminiPayload.systemInstruction = systemInstruction;
  }

  const generationConfig = {};
  if (body.temperature !== undefined) {
    generationConfig.temperature = body.temperature;
  }
  if (body.max_tokens !== undefined) {
    generationConfig.maxOutputTokens = body.max_tokens;
  }
  if (Object.keys(generationConfig).length > 0) {
    geminiPayload.generationConfig = generationConfig;
  }

  return geminiPayload;
}

// Automatically scan and add float Excel/CSV export button to Markdown Tables
function addTableExportButtons(bubbleElement) {
  const tables = bubbleElement.querySelectorAll('table');
  tables.forEach((table, index) => {
    if (table.parentElement.classList.contains('table-wrapper')) return;
    
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    wrapper.style.position = 'relative';
    wrapper.style.margin = '12px 0';
    wrapper.style.border = '1px solid var(--border-color)';
    wrapper.style.borderRadius = '8px';
    wrapper.style.overflow = 'auto';
    wrapper.style.padding = '36px 12px 12px 12px';
    wrapper.style.backgroundColor = 'var(--bg-secondary)';
    
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
    
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary';
    btn.style.position = 'absolute';
    btn.style.top = '6px';
    btn.style.right = '6px';
    btn.style.fontSize = '10px';
    btn.style.padding = '4px 8px';
    btn.style.zIndex = '10';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.gap = '4px';
    btn.style.backgroundColor = 'var(--bg-primary)';
    btn.style.border = '1px solid var(--border-color)';
    btn.style.color = 'var(--text-primary)';
    btn.style.cursor = 'pointer';
    btn.style.borderRadius = '4px';
    btn.innerHTML = `<i data-lucide="download" style="width: 12px; height: 12px;"></i> Excel/CSV`;
    
    btn.onclick = () => {
      exportTableToCSV(table, `tabel_${index + 1}_${Date.now()}.csv`);
    };
    
    wrapper.appendChild(btn);
  });
}

// Extract table content to CSV format with Excel compatibility (UTF-8 BOM)
function exportTableToCSV(table, filename) {
  const rows = table.querySelectorAll('tr');
  let csvContent = '';
  
  rows.forEach(row => {
    const cols = row.querySelectorAll('th, td');
    const rowData = [];
    cols.forEach(col => {
      let text = col.innerText.trim();
      text = text.replace(/"/g, '""');
      rowData.push(`"${text}"`);
    });
    csvContent += rowData.join(',') + '\r\n';
  });
  
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Copy assistant bubble text content to clipboard
window.copyMessageText = function(btnElement) {
  const bubble = btnElement.closest('.message-row').querySelector('.message-bubble');
  const text = bubble.innerText;
  navigator.clipboard.writeText(text).then(() => {
    const originalHTML = btnElement.innerHTML;
    btnElement.innerHTML = `<i data-lucide="check" style="width: 12px; height: 12px;"></i> Tersalin`;
    lucide.createIcons();
    setTimeout(() => {
      btnElement.innerHTML = originalHTML;
      lucide.createIcons();
    }, 2000);
  });
};

// Export assistant bubble content to MS Word compatible document (.doc)
window.exportMessageWord = function(btnElement) {
  const bubble = btnElement.closest('.message-row').querySelector('.message-bubble');
  const htmlContent = bubble.innerHTML;
  
  const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head>
    <title>Export Doc</title>
    <style>
      body { font-family: 'Arial', sans-serif; font-size: 11pt; line-height: 1.5; color: #333333; }
      h1, h2, h3, h4 { color: #1a1a1a; margin-top: 12pt; margin-bottom: 6pt; }
      h1 { font-size: 18pt; }
      h2 { font-size: 14pt; }
      table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
      th, td { border: 1px solid #cccccc; padding: 6pt; text-align: left; }
      th { background-color: #f2f2f2; font-weight: bold; }
      pre { background-color: #f5f5f5; border: 1px solid #e5e5e5; padding: 8pt; font-family: 'Courier New', Courier, monospace; }
      code { font-family: 'Courier New', Courier, monospace; background-color: #f5f5f5; }
    </style>
  </head>
  <body>
    ${htmlContent}
  </body>
  </html>`;
  
  const blob = new Blob(['\ufeff' + header], { type: 'application/msword' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `dokumen_ai_${Date.now()}.doc`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
