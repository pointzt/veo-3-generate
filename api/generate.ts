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
		const auth = req.headers.get('authorization') || '';
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
				...(auth ? { Authorization: auth } : {}),
			},
			body: bodyString || '{}',
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
	} catch (err) {
		return new Response(JSON.stringify({ success: false, error: 'Proxy error contacting upstream' }), {
			status: 502,
			headers: { 'content-type': 'application/json' },
		});
	}
}