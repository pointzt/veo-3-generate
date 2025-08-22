export const config = {
	runtime: 'edge',
};

const UPSTREAM = process.env.UPSTREAM_BASE_URL || 'https://api.veo3.ai';

export default async function handler(req: Request): Promise<Response> {
	if (req.method !== 'POST') {
		return new Response(JSON.stringify({ success: false, error: 'Method Not Allowed' }), {
			status: 405,
			headers: { 'content-type': 'application/json' },
		});
	}

	try {
		const clientAuth = req.headers.get('authorization') || '';
		const serverKey = (process.env.VEO3_API_KEY || process.env.API_KEY || '').trim();
		const authHeader = clientAuth || (serverKey ? `Bearer ${serverKey}` : '');

		let bodyString = '';
		try {
			bodyString = await req.text();
		} catch {
			bodyString = '{}';
		}

		const upstreamRes = await fetch(`${UPSTREAM}/generate`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
				...(authHeader ? { Authorization: authHeader } : {}),
			},
			body: bodyString || '{}',
			signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(60000) : undefined,
		});

		const contentType = upstreamRes.headers.get('content-type') || '';
		const status = upstreamRes.status;
		if (contentType.includes('application/json')) {
			const text = await upstreamRes.text();
			return new Response(text, {
				status,
				headers: { 'content-type': 'application/json' },
			});
		} else {
			const text = await upstreamRes.text();
			return new Response(text, {
				status,
				headers: { 'content-type': contentType || 'text/plain' },
			});
		}
	} catch (err: any) {
		const message = typeof err?.message === 'string' ? err.message : 'Proxy error contacting upstream';
		return new Response(JSON.stringify({ success: false, error: message }), {
			status: 502,
			headers: { 'content-type': 'application/json' },
		});
	}
}