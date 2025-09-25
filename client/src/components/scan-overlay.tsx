interface ScanOverlayProps {
  isScanning: boolean;
  showOCRResult: boolean;
  ocrResult?: string;
  confidence?: number;
}

export default function ScanOverlay({ 
  isScanning, 
  showOCRResult, 
  ocrResult, 
  confidence 
}: ScanOverlayProps) {
  return (
    <div className="absolute inset-0 camera-overlay flex flex-col items-center justify-center" data-testid="scan-overlay">
      {/* License plate scanning frame */}
      <div className="relative">
        <div className="w-80 h-24 scan-frame relative" data-testid="scan-frame">
          {/* Corner indicators */}
          <div className="absolute -top-2 -left-2 w-6 h-6 border-l-4 border-t-4 border-white"></div>
          <div className="absolute -top-2 -right-2 w-6 h-6 border-r-4 border-t-4 border-white"></div>
          <div className="absolute -bottom-2 -left-2 w-6 h-6 border-l-4 border-b-4 border-white"></div>
          <div className="absolute -bottom-2 -right-2 w-6 h-6 border-r-4 border-b-4 border-white"></div>
        </div>
        
        {/* Scanning indicator */}
        <div 
          className={`absolute inset-0 pulse-ring border-2 border-primary rounded-lg transition-opacity ${
            isScanning ? 'opacity-100' : 'opacity-0'
          }`}
          data-testid="scanning-indicator"
        />
      </div>

      {/* Instructions */}
      <div className="mt-8 text-center px-4">
        <h2 className="text-white text-xl font-medium mb-2">
          {isScanning ? 'Processing...' : 'Position License Plate in Frame'}
        </h2>
        <p className="text-gray-300 text-sm">
          {isScanning ? 'Analyzing license plate' : 'Hold steady for automatic detection'}
        </p>
      </div>

      {/* OCR Results Display */}
      {showOCRResult && ocrResult && (
        <div className="mt-6 bg-black bg-opacity-80 rounded-lg p-4 mx-4 fade-in" data-testid="ocr-result">
          <div className="text-center">
            <div className="text-success text-lg font-mono mb-2">{ocrResult}</div>
            {confidence && (
              <div className="text-gray-300 text-sm">
                Confidence: {Math.round(confidence)}%
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
