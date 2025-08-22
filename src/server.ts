import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 5174;
const UPSTREAM = process.env.UPSTREAM_BASE_URL || 'https://api.veo3.ai';

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.post('/api/generate', async (req, res) => {
	try {
		const apiKey = req.headers['authorization'];
		const response = await fetch(`${UPSTREAM}/generate`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(apiKey ? { Authorization: String(apiKey) } : {}),
			},
			body: JSON.stringify(req.body),
		});

		const contentType = response.headers.get('content-type') || '';
		const status = response.status;
		res.status(status);
		if (contentType.includes('application/json')) {
			const data = await response.json();
			return res.json(data);
		} else {
			const text = await response.text();
			return res.type(contentType || 'text/plain').send(text);
		}
	} catch (err) {
		console.error('Proxy error', err);
		return res.status(502).json({ success: false, error: 'Proxy error contacting upstream' });
	}
});

app.listen(PORT, () => {
	console.log(`[proxy] Listening on http://localhost:${PORT}, forwarding to ${UPSTREAM}`);
});