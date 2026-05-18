'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UsePollingOptions {
  url: string;
  interval?: number; // ms
  enabled?: boolean;
  maxAttempts?: number;
  stopWhen?: (data: any) => boolean;
  onUpdate?: (data: any) => void;
}

export function usePolling({
  url,
  interval = 5000,
  enabled = true,
  maxAttempts = 60,
  stopWhen,
  onUpdate,
}: UsePollingOptions) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [stopped, setStopped] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const poll = useCallback(async () => {
    if (stopped) return;
    
    try {
      setLoading(true);
      const res = await fetch(url);
      const json = await res.json();

      if (json.success) {
        setData(json.data);
        onUpdate?.(json.data);

        // Check stop condition
        if (stopWhen?.(json.data)) {
          setStopped(true);
          return;
        }
      } else {
        setError(json.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setAttempts((prev) => prev + 1);
    }
  }, [url, stopped, stopWhen, onUpdate]);

  useEffect(() => {
    if (!enabled || stopped || attempts >= maxAttempts) return;

    // Initial poll
    poll();

    // Set up interval
    timerRef.current = setInterval(poll, interval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [enabled, stopped, poll, interval, attempts, maxAttempts]);

  const reset = useCallback(() => {
    setStopped(false);
    setAttempts(0);
    setError(null);
  }, []);

  return { data, loading, error, attempts, stopped, reset };
}
