import React, { useState } from 'react';
import { Play, Loader2, AlertCircle, Video } from 'lucide-react';

interface ApiResponse {
  success: boolean;
  videoUrl?: string;
  error?: string;
}

function App() {
  const [prompt, setPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [isLoading, setIsLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    // Validation
    if (!prompt.trim()) {
      alert('Please enter a video prompt');
      return;
    }
    
    if (!apiKey.trim()) {
      alert('Please enter your Veo 3 API key');
      return;
    }

    setIsLoading(true);
    setError('');
    setVideoUrl('');

    try {
      const response = await fetch('https://api.veo3.ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          aspect_ratio: aspectRatio
        })
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API request failed with status ${response.status}`);
      }

      if (data.success && data.videoUrl) {
        setVideoUrl(data.videoUrl);
      } else {
        throw new Error(data.error || 'Failed to generate video');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
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
        <div className="grid grid-cols-2 gap-8 max-w-7xl mx-auto">
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

            {/* API Key Input */}
            <div className="space-y-2">
              <label htmlFor="apiKey" className="block text-sm font-medium text-slate-700">
                Veo 3 API Key
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API Key"
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
              disabled={isLoading || !prompt.trim() || !apiKey.trim()}
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
            
            <div className={`${aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16]'} bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden`}>
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
                </div>
              ) : videoUrl ? (
                <video
                  controls
                  className="w-full h-full rounded-lg object-contain bg-black"
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