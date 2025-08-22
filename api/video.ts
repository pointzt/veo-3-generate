export const config = {
	runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
	if (req.method !== 'GET') {
		return new Response('Method Not Allowed', { status: 405 });
	}
	const url = new URL(req.url);
	const uri = url.searchParams.get('uri');
	const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
	if (!uri) return new Response('Missing uri', { status: 400 });
	try {
		const upstreamRes = await fetch(uri, {
			headers: apiKey ? { 'x-goog-api-key': apiKey } : undefined,
			signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(120000) : undefined,
		});
		return new Response(upstreamRes.body, {
			status: upstreamRes.status,
			headers: {
				'content-type': upstreamRes.headers.get('content-type') || 'application/octet-stream',
			},
		});
	} catch (err) {
		return new Response('Proxy error', { status: 502 });
	}
}