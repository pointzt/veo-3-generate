import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

const UPSTREAM = process.env.UPSTREAM_BASE_URL || 'https://api.veo3.ai';

async function readRawBody(req: VercelRequest): Promise<string> {
	return await new Promise((resolve, reject) => {
		let data = '';
		req.on('data', (chunk) => {
			data += chunk;
		});
		req.on('end', () => resolve(data));
		req.on('error', reject);
	});
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		res.setHeader('Allow', 'POST');
		return res.status(405).json({ success: false, error: 'Method Not Allowed' });
	}
	try {
		const auth = req.headers['authorization'];
		let bodyString: string;
		if (req.body && typeof req.body === 'object') {
			try {
				bodyString = JSON.stringify(req.body);
			} catch {
				bodyString = await readRawBody(req);
			}
		} else if (typeof req.body === 'string') {
			bodyString = req.body;
		} else {
			bodyString = await readRawBody(req);
		}

		const upstreamRes = await fetch(`${UPSTREAM}/generate`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(auth ? { Authorization: String(auth) } : {}),
			},
			body: bodyString || '{}',
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