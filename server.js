const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support large image payloads
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/proxy', async (req, res) => {
  const { url, key, body } = req.body;

  if (!url || !key || !body) {
    return res.status(400).json({ error: 'Missing required parameters: url, key, or body' });
  }

  try {
    const isGemini = url.includes('generativelanguage.googleapis.com');
    let targetUrl = url;
    let finalHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    };
    let finalBody = JSON.stringify(body);

    if (isGemini) {
      let model = body.model || 'gemini-1.5-flash';
      if (!model.startsWith('models/')) {
        model = `models/${model}`;
      }
      const stream = !!body.stream;
      const method = stream ? 'streamGenerateContent' : 'generateContent';
      targetUrl = `https://generativelanguage.googleapis.com/v1beta/${model}:${method}?key=${key}`;
      if (stream) {
        targetUrl += '&alt=sse';
      }
      finalHeaders = {
        'Content-Type': 'application/json'
      };
      finalBody = JSON.stringify(convertOpenAiToGemini(body));
    }

    console.log(`[PROXY REQUEST] Target: ${targetUrl} | Model: ${body.model} | Stream: ${body.stream || false} | Gemini Native: ${isGemini}`);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: finalHeaders,
      body: finalBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PROXY API ERROR] Status: ${response.status} | Details:`, errorText);
      return res.status(response.status).json({
        error: `API responded with status ${response.status}`,
        details: errorText
      });
    }

    console.log(`[PROXY API SUCCESS] Status: ${response.status}`);

    // Set headers for SSE streaming if request body says stream: true
    if (body.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      if (isGemini) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          let lines = buffer.split('\n');
          buffer = lines.pop(); // Keep the remaining unfinished line

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.substring(5).trim();
              try {
                const parsed = JSON.parse(dataStr);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (text) {
                  const openAiChunk = {
                    choices: [
                      {
                        delta: {
                          content: text
                        }
                      }
                    ]
                  };
                  res.write(`data: ${JSON.stringify(openAiChunk)}\n\n`);
                }
              } catch (err) {
                // Not a JSON chunk or stream termination
              }
            }
          }
        }
        res.write('data: [DONE]\n\n');
      } else {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
      }
      res.end();
    } else {
      const json = await response.json();
      if (isGemini) {
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const openAiResponse = {
          choices: [
            {
              message: {
                role: 'assistant',
                content: text
              }
            }
          ]
        };
        res.json(openAiResponse);
      } else {
        res.json(json);
      }
    }
  } catch (error) {
    console.error('[PROXY INTERNAL ERROR] Exception:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

app.get('/api/models', async (req, res) => {
  const { url, key } = req.query;

  if (!url || !key) {
    return res.status(400).json({ error: 'Missing required query parameters: url or key' });
  }

  try {
    const isGemini = url.includes('generativelanguage.googleapis.com');
    let targetUrl = url;
    let headers = {
      'Authorization': `Bearer ${key}`
    };

    if (isGemini) {
      targetUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
      headers = {};
    }

    console.log(`[PROXY MODELS] Fetching models from: ${targetUrl} | Gemini Native: ${isGemini}`);
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PROXY API ERROR] Status: ${response.status} | Details:`, errorText);
      return res.status(response.status).json({
        error: `API responded with status ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();

    if (isGemini) {
      const openAiData = {
        data: (data.models || []).map(m => {
          const id = m.name.split('/').pop();
          return { id, name: m.displayName };
        })
      };
      res.json(openAiData);
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('[PROXY INTERNAL ERROR] Exception:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

module.exports = app;
