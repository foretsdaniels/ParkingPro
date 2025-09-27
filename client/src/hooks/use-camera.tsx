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
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported by this browser or requires HTTPS.');
      }

      // First try with specific constraints
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Use rear camera on mobile
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (specificErr) {
        console.warn('Specific camera constraints failed, trying fallback:', specificErr);
        // Fallback to basic video constraints
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
    } catch (err) {
      console.error('Failed to access camera:', err);
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Camera access denied. Please allow camera permissions in your browser and reload the page.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera found. Please connect a camera device or try a different browser.');
        } else if (err.name === 'NotSupportedError') {
          setError('Camera not supported by this browser. Try Chrome, Firefox, or Safari.');
        } else if (err.name === 'NotReadableError') {
          setError('Camera is being used by another app. Please close other camera apps and try again.');
        } else if (err.message.includes('HTTPS')) {
          setError('Camera requires HTTPS. Please use a secure connection or published app.');
        } else {
          setError(`Camera error: ${err.message}. Please try refreshing the page.`);
        }
      } else {
        setError('Failed to access camera. Please try again or use a different browser.');
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
