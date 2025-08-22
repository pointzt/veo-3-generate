export const config = {
	runtime: 'edge',
};

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export default async function handler(req: Request): Promise<Response> {
	if (req.method !== 'GET') {
		return new Response(JSON.stringify({ success: false, error: 'Method Not Allowed' }), {
			status: 405,
			headers: { 'content-type': 'application/json' },
		});
	}
	const url = new URL(req.url);
	const name = url.searchParams.get('name');
	const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
	if (!name) {
		return new Response(JSON.stringify({ success: false, error: 'Missing operation name' }), {
			status: 400,
			headers: { 'content-type': 'application/json' },
		});
	}
	if (!apiKey) {
		return new Response(JSON.stringify({ success: false, error: 'Server missing GEMINI_API_KEY' }), {
			status: 500,
			headers: { 'content-type': 'application/json' },
		});
	}
	try {
		const upstreamRes = await fetch(`${BASE_URL}/${encodeURIComponent(name)}`, {
			headers: { 'x-goog-api-key': apiKey },
			signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(30000) : undefined,
		});
		const text = await upstreamRes.text();
		const status = upstreamRes.status;
		const contentType = upstreamRes.headers.get('content-type') || 'application/json';
		return new Response(text, { status, headers: { 'content-type': contentType } });
	} catch (err: any) {
		const message = typeof err?.message === 'string' ? err.message : 'Proxy error contacting upstream';
		return new Response(JSON.stringify({ success: false, error: message }), {
			status: 502,
			headers: { 'content-type': 'application/json' },
		});
	}
}