'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  type: 'training-video' | 'voice-audio' | 'background';
  accept: string;
  maxSizeMb: number;
  onUploadComplete: (data: { key: string; publicUrl: string }) => void;
  onError?: (error: string) => void;
  guidelines?: Record<string, string>;
  className?: string;
}

export function FileUpload({
  type,
  accept,
  maxSizeMb,
  onUploadComplete,
  onError,
  guidelines,
  className,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);
      setFileName(file.name);

      // Client-side size check
      const fileSizeMb = file.size / (1024 * 1024);
      if (fileSizeMb > maxSizeMb) {
        const errMsg = `File too large. Max ${maxSizeMb}MB, got ${fileSizeMb.toFixed(1)}MB`;
        setError(errMsg);
        onError?.(errMsg);
        return;
      }

      setUploading(true);
      setProgress(10);

      try {
        // Step 1: Get presigned URL
        const presignRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            filename: file.name,
            contentType: file.type,
            fileSizeMb,
          }),
        });

        const presignData = await presignRes.json();
        if (!presignData.success) {
          throw new Error(presignData.error || 'Failed to get upload URL');
        }

        setProgress(30);

        // Step 2: Upload directly to R2
        const { uploadUrl, key, publicUrl } = presignData.data;

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });

        if (!uploadRes.ok) {
          throw new Error('Upload failed');
        }

        setProgress(100);
        onUploadComplete({ key, publicUrl });
      } catch (err: any) {
        const errMsg = err.message || 'Upload failed';
        setError(errMsg);
        onError?.(errMsg);
      } finally {
        setUploading(false);
      }
    },
    [type, maxSizeMb, onUploadComplete, onError]
  );

  return (
    <div className={cn('space-y-3', className)}>
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
          uploading
            ? 'border-brand-500/50 bg-brand-500/5'
            : error
            ? 'border-red-500/50 bg-red-500/5'
            : fileName
            ? 'border-green-500/50 bg-green-500/5'
            : 'border-dark-400/50 hover:border-brand-500/30 hover:bg-dark-700/50'
        )}
      >
        <input
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
          id={`upload-${type}`}
        />
        <label htmlFor={`upload-${type}`} className="cursor-pointer">
          {uploading ? (
            <div className="space-y-3">
              <div className="text-3xl animate-pulse">⬆️</div>
              <p className="text-sm text-brand-400">Uploading {fileName}...</p>
              <div className="progress-bar max-w-xs mx-auto">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-dark-200">{progress}%</p>
            </div>
          ) : fileName && !error ? (
            <div className="space-y-2">
              <div className="text-3xl">✅</div>
              <p className="text-sm text-green-400">{fileName}</p>
              <p className="text-xs text-dark-200">Click to replace</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-3xl">
                {type === 'training-video' ? '🎥' : type === 'voice-audio' ? '🎙️' : '🖼️'}
              </div>
              <p className="text-sm text-slate-300">
                Click to upload or drag & drop
              </p>
              <p className="text-xs text-dark-200">
                Max {maxSizeMb}MB • {accept.replace(/\./g, '').toUpperCase()}
              </p>
            </div>
          )}
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-400 flex items-center gap-1">
          <span>⚠️</span> {error}
        </p>
      )}

      {guidelines && Object.keys(guidelines).length > 0 && (
        <details className="text-xs">
          <summary className="text-dark-100 cursor-pointer hover:text-slate-300">
            Upload guidelines
          </summary>
          <ul className="mt-2 space-y-1 text-dark-200 pl-4">
            {Object.entries(guidelines).map(([key, value]) => (
              <li key={key} className="flex gap-2">
                <span className="text-brand-400 font-medium capitalize">{key}:</span>
                <span>{value}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
