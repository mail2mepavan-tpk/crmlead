import { useState } from 'react';
import { ImageIcon, UploadCloud, Sparkles, Loader2 } from 'lucide-react';

export default function ImageContentReader() {
  const [imageContent, setImageContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedImageDataUrl, setSelectedImageDataUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState('gpt-4o-mini');
  const [apiKey, setApiKey] = useState('jeVAtHJeMDiIfRahyhas7UKYWg3GDVl0lpiy11uu');
  const [apiEndpoint, setApiEndpoint] = useState('https://api.api-ninjas.com/v1/imagetotext');

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      setImageContent('');
      setPreviewUrl('');
      setSelectedImageDataUrl('');
      setFileName('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setPreviewUrl(result);
      setSelectedImageDataUrl(result);
      setFileName(file.name);
      setError('');
    };
    reader.onerror = () => {
      setError('Unable to read the selected image.');
      setImageContent('');
      setPreviewUrl('');
      setSelectedImageDataUrl('');
      setFileName('');
    };
    reader.readAsDataURL(file);
  };

  const handleReadImage = async () => {
    if (!selectedImageDataUrl) {
      setError('Please upload an image before reading it.');
      return;
    }

    if (!apiKey.trim()) {
      setError('Please enter an API key for the AI endpoint.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const fileName = selectedImageDataUrl.split(',')[0].split(';')[0].split(':')[1] || 'image.png';
      const mimeType = fileName.includes('jpeg') || fileName.includes('jpg') ? 'image/jpeg' : 'image/png';
      const base64Data = selectedImageDataUrl.split(',')[1];
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: mimeType });
      const formData = new FormData();
      formData.append('image', blob, fileName);

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || body.message || `Request failed (${response.status})`);
      }

      const data = await response.json();
      const text = Array.isArray(data)
        ? data.map((item) => item.text || item.content || '').join('\n')
        : data.text || data.content || 'No readable text found.';
      setImageContent(text || 'No readable text found.');
    } catch (err) {
      setError(err.message || 'Unable to analyze the image.');
      setImageContent('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-surface px-5 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-2 text-sm font-semibold text-brand">
            <ImageIcon className="size-4" />
            AI Image Reader
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-slate-900">Upload an image and convert it to text</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Select an image, send it to an OpenAI-compatible vision endpoint, and view the extracted text in the textarea below.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-sky-50 p-3 text-sky-700">
                <UploadCloud className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Upload Image</p>
                <p className="text-sm text-slate-600">Choose a JPG, PNG, or WebP image.</p>
              </div>
            </div>

            <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-sky-400 hover:bg-sky-50">
              <UploadCloud className="size-8 text-slate-400" />
              <span className="mt-3 text-sm font-semibold text-slate-700">Click to upload image</span>
              <span className="mt-1 text-sm text-slate-500">A preview will appear here after selection.</span>
              <input type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
            </label>

            <div className="mt-6 grid gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10"
                  placeholder="Enter your AI API key"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Endpoint</label>
                <input
                  type="text"
                  value={apiEndpoint}
                  onChange={(e) => setApiEndpoint(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10"
                  placeholder="https://api.openai.com/v1/chat/completions"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Model</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10"
                  placeholder="gpt-4o-mini"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleReadImage}
              disabled={loading}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {loading ? 'Reading image...' : 'Read with AI'}
            </button>

            {fileName && (
              <p className="mt-4 text-sm text-slate-600">
                Selected file: <span className="font-semibold text-slate-800">{fileName}</span>
              </p>
            )}

            {error && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {previewUrl && (
              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <img src={previewUrl} alt="Uploaded preview" className="max-h-72 w-full rounded-xl object-contain" />
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Extracted Text</p>
                <p className="mt-2 text-sm text-slate-600">The AI response will appear here as readable text.</p>
              </div>
            </div>
            <textarea
              className="mt-4 min-h-[360px] w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10"
              value={imageContent}
              readOnly
              placeholder="Upload an image and click 'Read with AI' to extract text..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
