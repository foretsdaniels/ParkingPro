interface CameraControlsProps {
  onCapture: () => void;
  onShowHistory: () => void;
  onToggleFlash: () => void;
  isFlashOn: boolean;
  isCapturing: boolean;
}

export default function CameraControls({
  onCapture,
  onShowHistory,
  onToggleFlash,
  isFlashOn,
  isCapturing
}: CameraControlsProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 p-6" data-testid="camera-controls">
      <div className="flex items-center justify-between">
        
        {/* Gallery/History Button */}
        <button 
          className="w-12 h-12 rounded-full bg-black bg-opacity-50 flex items-center justify-center text-white hover:bg-opacity-70 transition-colors"
          onClick={onShowHistory}
          data-testid="button-show-history"
        >
          <i className="fas fa-images"></i>
        </button>

        {/* Main Capture Button */}
        <div className="relative">
          {!isCapturing ? (
            <button 
              className="w-20 h-20 rounded-full bg-white border-4 border-gray-300 shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
              onClick={onCapture}
              data-testid="button-capture"
            >
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                <i className="fas fa-camera text-white text-xl"></i>
              </div>
            </button>
          ) : (
            <div className="w-20 h-20 rounded-full border-4 border-primary border-t-transparent animate-spin bg-white shadow-lg" data-testid="capture-loading" />
          )}
        </div>

        {/* Flash/Light Toggle */}
        <button 
          className={`w-12 h-12 rounded-full bg-black bg-opacity-50 flex items-center justify-center text-white hover:bg-opacity-70 transition-colors ${
            isFlashOn ? 'text-warning' : ''
          }`}
          onClick={onToggleFlash}
          data-testid="button-flash"
        >
          <i className="fas fa-bolt"></i>
        </button>
      </div>
    </div>
  );
}
