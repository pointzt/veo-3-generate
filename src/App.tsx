import React, { useState } from 'react';
import { Play, Loader2, AlertCircle, Video } from 'lucide-react';

interface StartResponse {
  success: boolean;
  operationName?: string;
  error?: string;
}

interface ErrorDetails {
  url: string;
  status?: number;
  statusText?: string;
  contentType?: string;
  responseBody?: string;
  errorName?: string;
  errorMessage?: string;
  hint?: string;
  baseUrl?: string;
}

class AppError extends Error {
  details?: ErrorDetails;
  constructor(message: string, details?: ErrorDetails) {
    super(message);
    this.name = 'AppError';
    this.details = details;
  }
}

function getSafeApiBaseUrl(): string {
  const envBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const isBrowser = typeof window !== 'undefined';
  const isDev = import.meta.env.MODE === 'development';
  if (!envBase) return '/api';
  if (envBase.startsWith('/')) return envBase; // same-origin path
  if (envBase.startsWith('http')) {
    if (!isBrowser) return envBase;
    try {
      const envUrl = new URL(envBase);
      const curr = new URL(window.location.origin);
      const sameOrigin = envUrl.origin === curr.origin;
      const isLocalhost = /localhost|127\.0\.0\.1/.test(envUrl.hostname);
      if (!isDev && (isLocalhost || !sameOrigin)) {
        // In production, avoid pointing to localhost or cross-origin to prevent CORS/network errors
        return '/api';
      }
      return envBase;
    } catch {
      return '/api';
    }
  }
  return '/api';
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function App() {
  const [prompt, setPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [isLoading, setIsLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  const handleGenerate = async () => {
    // Validation
    if (!prompt.trim()) {
      alert('Please enter a video prompt');
      return;
    }

    setIsLoading(true);
    setError('');
    setVideoUrl('');
    setErrorDetails(null);
    setShowErrorDetails(false);

    // Build request URL ahead so we can include it in error details
    const baseUrl = getSafeApiBaseUrl();
    const startUrl = `${baseUrl}/generate`;

    try {
      // Start long-running operation
      const startRes = await fetch(startUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          aspect_ratio: aspectRatio,
        })
      });

      const startContentType = startRes.headers.get('content-type') || '';
      let startData: StartResponse | undefined;
      let startRaw = '';
      try {
        if (startContentType.includes('application/json')) {
          startData = await startRes.json();
        } else {
          startRaw = await startRes.text();
          startData = JSON.parse(startRaw);
        }
      } catch {
        if (!startRaw) startRaw = await startRes.text().catch(() => '');
      }

      if (!startRes.ok || !startData?.success || !startData.operationName) {
        const message = startData?.error || `Failed to start generation (${startRes.status})`;
        throw new AppError(message, {
          url: startUrl,
          status: startRes.status,
          statusText: startRes.statusText,
          contentType: startContentType,
          responseBody: startRaw || (startData ? JSON.stringify(startData) : ''),
          baseUrl,
        });
      }

      const operationName = startData.operationName;

      // Poll operation until done
      const pollUrl = `${baseUrl}/operation?name=${encodeURIComponent(operationName)}`;
      const maxAttempts = 60; // ~10 minutes at 10s interval
      const intervalMs = 10000;
      let videoUri: string | undefined;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const opRes = await fetch(pollUrl, { method: 'GET' });
        const opContentType = opRes.headers.get('content-type') || '';
        const opText = await opRes.text();
        let opJson: any = {};
        try { opJson = opText ? JSON.parse(opText) : {}; } catch {}

        if (!opRes.ok) {
          throw new AppError(`Operation polling failed (${opRes.status})`, {
            url: pollUrl,
            status: opRes.status,
            statusText: opRes.statusText,
            contentType: opContentType,
            responseBody: opText,
            baseUrl,
          });
        }

        if (opJson?.done) {
          videoUri = opJson?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
          if (!videoUri) {
            throw new AppError('Operation completed without video URI', {
              url: pollUrl,
              contentType: opContentType,
              responseBody: opText,
              baseUrl,
            });
          }
          break;
        }
        await sleep(intervalMs);
      }

      if (!videoUri) {
        throw new AppError('Timed out waiting for video generation to complete');
      }

      // Use proxy to stream video (handles auth)
      const videoProxyUrl = `${baseUrl}/video?uri=${encodeURIComponent(videoUri)}`;
      setVideoUrl(videoProxyUrl);
    } catch (err) {
      let errorMessage = 'An unexpected error occurred';
      const baseUrl = getSafeApiBaseUrl();
      if (err instanceof AppError) {
        errorMessage = err.message || errorMessage;
        if (err.details) setErrorDetails(err.details);
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        errorMessage = 'The request timed out. Please try again.';
      } else if (err instanceof TypeError) {
        // Browser fetch network/CORS errors are TypeError
        errorMessage = 'Network error or CORS blocked the request. If this persists, try a server-side proxy.';
        setErrorDetails((prev) => ({
          url: (prev?.url) || `${baseUrl}/generate`,
          errorName: 'TypeError',
          errorMessage: (err as TypeError).message,
          hint: 'On Vercel, ensure the API functions are deployed and GEMINI_API_KEY is set.',
          baseUrl,
        }));
      } else if (err instanceof Error) {
        errorMessage = err.message || errorMessage;
        setErrorDetails((prev) => (
          prev || {
            url: `${baseUrl}/generate`,
            errorName: err.name,
            errorMessage: err.message,
            baseUrl,
          }
        ));
      }
      setError(errorMessage);
      console.error('Video generation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Video className="w-8 h-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-slate-800">Veo 3 Video Generator</h1>
          </div>
          <p className="text-slate-600 text-lg">Transform your ideas into stunning videos with AI</p>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
          {/* Left Column - Controls */}
          <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
            <h2 className="text-2xl font-semibold text-slate-800 mb-6">Generate Video</h2>
            
            {/* Prompt Input */}
            <div className="space-y-2">
              <label htmlFor="prompt" className="block text-sm font-medium text-slate-700">
                Video Prompt
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your video prompt here..."
                className="w-full h-32 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none text-slate-800 placeholder-slate-400"
                disabled={isLoading}
              />
            </div>

            {/* API Key Input (optional) */}
            <div className="space-y-2">
              <label htmlFor="apiKey" className="block text-sm font-medium text-slate-700">
                Veo 3 API Key (optional)
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API Key (or set server key in Vercel)"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-slate-800 placeholder-slate-400"
                disabled={isLoading}
              />
            </div>

            {/* Aspect Ratio Toggle */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Aspect Ratio
              </label>
              <div className="flex bg-slate-100 rounded-xl p-1">
                <button
                  onClick={() => setAspectRatio('16:9')}
                  disabled={isLoading}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    aspectRatio === '16:9'
                      ? 'bg-white text-blue-600 shadow-md'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  16:9
                </button>
                <button
                  onClick={() => setAspectRatio('9:16')}
                  disabled={isLoading}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    aspectRatio === '9:16'
                      ? 'bg-white text-blue-600 shadow-md'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  9:16
                </button>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isLoading || !prompt.trim()}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-400 disabled:to-slate-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:hover:shadow-lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Video...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Generate Video
                </>
              )}
            </button>
          </div>

          {/* Right Column - Video Player */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-semibold text-slate-800 mb-6">Generated Video</h2>
            
            <div className="aspect-video bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
              {isLoading ? (
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">Generating your video...</p>
                  <p className="text-slate-400 text-sm mt-2">This may take a few moments</p>
                </div>
              ) : error ? (
                <div className="text-center max-w-md mx-auto p-6">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <p className="text-red-600 font-medium mb-2">Generation Failed</p>
                  <p className="text-slate-600 text-sm leading-relaxed">{error}</p>
                  {errorDetails && (
                    <div className="mt-4">
                      <button
                        onClick={() => setShowErrorDetails((s) => !s)}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        {showErrorDetails ? 'Hide technical details' : 'Show technical details'}
                      </button>
                      {showErrorDetails && (
                        <pre className="mt-2 text-left text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-auto max-h-64">
{JSON.stringify(errorDetails, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              ) : videoUrl ? (
                <video
                  controls
                  className="w-full h-full rounded-lg"
                  poster=""
                >
                  <source src={videoUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="text-center">
                  <Video className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">Your generated video will appear here</p>
                  <p className="text-slate-400 text-sm mt-2">Enter a prompt and click Generate to start</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;