import { useState, useCallback, useRef } from "react";

interface CameraHook {
  stream: MediaStream | null;
  isLoading: boolean;
  error: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
}

export function useCamera(): CameraHook {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      return; // Camera already started
    }

    setIsLoading(true);
    setError(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use rear camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
    } catch (err) {
      console.error('Failed to access camera:', err);
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Camera access denied. Please allow camera permissions and reload.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera found. Please connect a camera device.');
        } else if (err.name === 'NotSupportedError') {
          setError('Camera not supported by this browser.');
        } else {
          setError('Failed to access camera. Please try again.');
        }
      } else {
        setError('Failed to access camera. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  return {
    stream,
    isLoading,
    error,
    startCamera,
    stopCamera,
  };
}
