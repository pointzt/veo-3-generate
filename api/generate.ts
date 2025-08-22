export const config = {
	runtime: 'edge',
};

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export default async function handler(req: Request): Promise<Response> {
	if (req.method !== 'POST') {
		return new Response(JSON.stringify({ success: false, error: 'Method Not Allowed' }), {
			status: 405,
			headers: { 'content-type': 'application/json' },
		});
	}

	const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
	if (!apiKey) {
		return new Response(JSON.stringify({ success: false, error: 'Server missing GEMINI_API_KEY' }), {
			status: 500,
			headers: { 'content-type': 'application/json' },
		});
	}

	try {
		const bodyText = await req.text();
		let bodyJson: any = {};
		try { bodyJson = bodyText ? JSON.parse(bodyText) : {}; } catch {}
		const prompt: string = (bodyJson?.prompt || '').toString();
		const aspectRatio: string | undefined = bodyJson?.aspect_ratio;
		if (!prompt) {
			return new Response(JSON.stringify({ success: false, error: 'Missing prompt' }), {
				status: 400,
				headers: { 'content-type': 'application/json' },
			});
		}

		const instances: any[] = [{ prompt }];
		// If the API supports aspect ratio, include it (harmless if ignored)
		if (aspectRatio) {
			instances[0].aspect_ratio = aspectRatio;
		}

		const upstreamRes = await fetch(`${BASE_URL}/models/veo-3.0-generate-preview:predictLongRunning`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-goog-api-key': apiKey,
			},
			body: JSON.stringify({ instances }),
			signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(60000) : undefined,
		});

		const text = await upstreamRes.text();
		const status = upstreamRes.status;
		const contentType = upstreamRes.headers.get('content-type') || '';
		if (!upstreamRes.ok) {
			return new Response(text || JSON.stringify({ success: false, error: 'Failed to start operation' }), {
				status,
				headers: { 'content-type': contentType || 'application/json' },
			});
		}
		let json: any = {};
		try { json = text ? JSON.parse(text) : {}; } catch {}
		const name = json?.name;
		if (!name) {
			return new Response(JSON.stringify({ success: false, error: 'Operation name not returned' }), {
				status: 502,
				headers: { 'content-type': 'application/json' },
			});
		}
		return new Response(JSON.stringify({ success: true, operationName: name }), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		});
	} catch (err: any) {
		const message = typeof err?.message === 'string' ? err.message : 'Proxy error contacting upstream';
		return new Response(JSON.stringify({ success: false, error: message }), {
			status: 502,
			headers: { 'content-type': 'application/json' },
		});
	}
}