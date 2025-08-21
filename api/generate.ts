export const runtime = 'edge';

interface GenerateRequestBody {
  prompt?: string;
  aspect_ratio?: '16:9' | '9:16' | string;
  apiKey?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method Not Allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Content-Type must be application/json' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body: GenerateRequestBody = await req.json();
    const { prompt, aspect_ratio } = body || {};

    const clientApiKey = body?.apiKey || req.headers.get('x-api-key') || '';
    const envApiKey = (typeof process !== 'undefined' && process.env && process.env.VEO3_API_KEY) || '';
    const apiKey = clientApiKey || envApiKey;

    if (!prompt || !prompt.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required field: prompt' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing API key. Provide in body.apiKey or x-api-key header, or set VEO3_API_KEY.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const upstreamResponse = await fetch('https://api.veo3.ai/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: String(prompt).trim(),
        aspect_ratio: aspect_ratio || '16:9',
      }),
    });

    const upstreamJson = await upstreamResponse.json().catch(() => ({}));

    if (!upstreamResponse.ok) {
      const message = upstreamJson?.error || `Upstream error ${upstreamResponse.status}`;
      return new Response(
        JSON.stringify({ success: false, error: message }),
        { status: upstreamResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(upstreamJson),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

