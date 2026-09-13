const { requireAdmin } = require('../lib/auth');

const MAX_HTML = 500 * 1024;
const MAX_INSTRUCTION = 4000;
const MAX_OUTPUT_TOKENS = 65536;

function cleanModel(value) {
  return String(value || 'gemini-3.1-pro-preview')
    .trim()
    .replace(/^models\//, '') || 'gemini-3.1-pro-preview';
}

module.exports = async function(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }
  if (!requireAdmin(req, res)) return;

  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: 'GEMINI_API_KEY não configurada no Vercel.' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const html = String(body.html || '');
    const instruction = String(body.instruction || '').trim();

    if (!html.trim()) return res.status(400).json({ ok: false, error: 'HTML vazio.' });
    if (Buffer.byteLength(html, 'utf8') > MAX_HTML) {
      return res.status(413).json({ ok: false, error: 'HTML muito grande para a IA.' });
    }
    if (!instruction) return res.status(400).json({ ok: false, error: 'Informe o que a IA deve alterar.' });
    if (instruction.length > MAX_INSTRUCTION) {
      return res.status(400).json({ ok: false, error: 'Pedido da IA muito grande.' });
    }

    const model = cleanModel(process.env.GEMINI_EDITOR_MODEL);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    const prompt = `Você é o desenvolvedor sênior do site SQM Style Quality Model.

Faça SOMENTE as alterações pedidas pelo administrador no HTML abaixo.
Preserve as funcionalidades existentes, incluindo catálogo, produtos, imagens, login administrativo, checkout e chamadas /api.
Nunca remova autenticação ou segurança.
Nunca coloque API keys, senhas, tokens ou segredos no HTML.
Não invente APIs que não existem.
Mantenha o site funcional e responsivo.
Retorne SOMENTE o HTML completo final, sem Markdown, sem crases e sem explicações.

PEDIDO DO ADMINISTRADOR:
${instruction}

HTML ATUAL:
${html}`;

    const payload = {
      systemInstruction: {
        parts: [{
          text: 'Você é um desenvolvedor web sênior especializado em interfaces premium. Preserve funcionalidades e segurança. Retorne somente o HTML completo final.'
        }]
      },
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.2,
        thinkingConfig: { thinkingLevel: 'high' },
        maxOutputTokens: MAX_OUTPUT_TOKENS
      }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Gemini editor API error:', JSON.stringify(data));
      const apiMessage = data?.error?.message || data?.error?.status || `HTTP ${response.status}`;
      return res.status(502).json({
        ok: false,
        error: `Gemini: ${apiMessage}`,
        status: response.status,
        model
      });
    }

    const candidate = data?.candidates?.[0];
    let output = '';
    const parts = candidate?.content?.parts;
    if (Array.isArray(parts)) {
      output = parts
        .filter(part => typeof part?.text === 'string')
        .map(part => part.text)
        .join('');
    }

    output = String(output || '')
      .replace(/^\s*```(?:html)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    if (!output) {
      const finishReason = candidate?.finishReason || 'sem conteúdo';
      return res.status(502).json({
        ok: false,
        error: `Gemini não retornou HTML (${finishReason}).`,
        model
      });
    }

    if (Buffer.byteLength(output, 'utf8') > MAX_HTML) {
      return res.status(502).json({ ok: false, error: 'A resposta da Gemini ficou grande demais.', model });
    }

    return res.status(200).json({ ok: true, html: output, model });
  } catch (error) {
    console.error('SQM Gemini editor:', error);
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Erro interno ao usar a IA Gemini.'
    });
  }
};
