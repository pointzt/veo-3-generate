import type { VercelRequest, VercelResponse } from '@vercel/node';

const UPSTREAM = process.env.UPSTREAM_BASE_URL || 'https://api.veo3.ai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		res.setHeader('Allow', 'POST');
		return res.status(405).json({ success: false, error: 'Method Not Allowed' });
	}
	try {
		const auth = req.headers['authorization'];
		const upstreamRes = await fetch(`${UPSTREAM}/generate`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(auth ? { Authorization: String(auth) } : {}),
			},
			body: JSON.stringify(req.body ?? {}),
		});

		const contentType = upstreamRes.headers.get('content-type') || '';
		const status = upstreamRes.status;
		res.status(status);
		if (contentType.includes('application/json')) {
			const data = await upstreamRes.json();
			return res.json(data);
		} else {
			const text = await upstreamRes.text();
			return res.setHeader('Content-Type', contentType || 'text/plain').send(text);
		}
	} catch (err) {
		console.error('[api/generate] Proxy error', err);
		return res.status(502).json({ success: false, error: 'Proxy error contacting upstream' });
	}
}