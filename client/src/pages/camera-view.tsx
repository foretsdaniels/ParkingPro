import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useCamera } from "@/hooks/use-camera";
import { useOCR } from "@/hooks/use-ocr";
import { useGeolocation } from "@/hooks/use-geolocation";
import CameraControls from "@/components/camera-controls";
import ScanOverlay from "@/components/scan-overlay";

export default function CameraView() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const { isOnline, connectionStatus } = useNetworkStatus();
  const { location: gpsLocation, locationStatus } = useGeolocation();
  const { stream, isLoading: cameraLoading, error: cameraError, startCamera, stopCamera } = useCamera();
  const { processImage, isProcessing, ocrResult, confidence } = useOCR();

  const [isFlashOn, setIsFlashOn] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showOCRResult, setShowOCRResult] = useState(false);

  // Initialize camera on mount
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // Set up video stream
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (isScanning || isProcessing) return;

    try {
      setIsScanning(true);

      // Capture frame from video
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      if (!context) throw new Error('Could not get canvas context');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);

      // Get image data
      const imageData = canvas.toDataURL('image/jpeg', 0.9);

      // Process with OCR
      const plateText = await processImage(imageData);

      if (plateText && confidence > 70) {
        // Show OCR result briefly
        setShowOCRResult(true);
        setTimeout(() => {
          setShowOCRResult(false);
          // Store capture data for confirmation view
          const captureData = {
            plateNumber: plateText,
            confidence: confidence,
            fullImage: imageData,
            plateImage: imageData, // In real implementation, would crop this
            location: gpsLocation,
            timestamp: new Date().toISOString(),
            parkingZone: "Front Lot - Section A" // Default zone
          };
          
          localStorage.setItem('currentCapture', JSON.stringify(captureData));
          setLocation('/confirmation');
        }, 2000);
      } else {
        toast({
          title: "No license plate detected",
          description: "Please position a license plate in the frame and try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Capture error:', error);
      toast({
        title: "Capture failed",
        description: "Please try again or check camera permissions.",
        variant: "destructive"
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleFlashToggle = () => {
    setIsFlashOn(!isFlashOn);
    // In real implementation, would control camera flash
  };

  const handleShowHistory = () => {
    setLocation('/history');
  };

  const handleOpenSettings = () => {
    setLocation('/settings');
  };

  return (
    <div className="min-h-screen relative bg-black camera-view" data-testid="camera-view">
      {/* Status Bar */}
      <div className="absolute top-0 left-0 right-0 z-50 flex justify-between items-center p-4 text-white">
        <div className="flex items-center space-x-2">
          <div 
            className={`w-2 h-2 rounded-full ${isOnline ? 'bg-success' : 'bg-destructive'}`}
            data-testid="connection-status"
          />
          <span className="text-sm font-medium">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <div className="flex items-center space-x-2" data-testid="gps-status">
          <i className="fas fa-location-dot text-sm"></i>
          <span className="text-sm">{locationStatus}</span>
        </div>
        <button 
          className="p-2 rounded-full bg-black bg-opacity-30"
          onClick={handleOpenSettings}
          data-testid="button-settings"
        >
          <i className="fas fa-cog text-white"></i>
        </button>
      </div>

      {/* Camera Feed */}
      <div className="relative w-full h-screen bg-gray-900">
        {cameraError ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-white p-6 max-w-md mx-auto">
              <i className="fas fa-camera-slash text-4xl mb-4 text-red-500"></i>
              <h3 className="text-lg font-medium mb-2">Camera Unavailable</h3>
              <p className="text-sm text-gray-300 mb-6">
                {cameraError}
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={startCamera}
                  disabled={cameraLoading}
                  className="w-full px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-50"
                  data-testid="button-retry-camera"
                >
                  {cameraLoading ? 'Trying...' : 'Try Again'}
                </button>
                
                <button 
                  onClick={() => setLocation('/dashboard')}
                  className="w-full px-6 py-3 bg-muted hover:bg-muted/90 text-foreground rounded-lg transition-colors"
                  data-testid="button-go-dashboard"
                >
                  Go to Dashboard
                </button>
              </div>
              
              {/* Production troubleshooting */}
              <div className="mt-6 p-4 bg-black/20 rounded-lg text-xs text-gray-400">
                <p className="font-medium mb-2">Troubleshooting:</p>
                <ul className="text-left space-y-1">
                  <li>• Allow camera permissions in browser settings</li>
                  <li>• Ensure app is using HTTPS (required for camera)</li>
                  <li>• Close other apps using the camera</li>
                  <li>• Try Chrome, Firefox, or Safari browser</li>
                  <li>• Refresh the page and try again</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              data-testid="camera-feed"
            />
            <canvas
              ref={canvasRef}
              className="hidden"
              data-testid="capture-canvas"
            />
          </>
        )}

        {/* Scan Overlay */}
        <ScanOverlay 
          isScanning={isScanning || isProcessing}
          showOCRResult={showOCRResult}
          ocrResult={ocrResult || undefined}
          confidence={confidence}
        />

        {/* Camera Controls */}
        <CameraControls
          onCapture={handleCapture}
          onShowHistory={handleShowHistory}
          onToggleFlash={handleFlashToggle}
          isFlashOn={isFlashOn}
          isCapturing={isScanning || isProcessing}
        />
      </div>
    </div>
  );
}

// Custom hook for network status
function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    connectionStatus: isOnline ? 'Online' : 'Offline'
  };
}
