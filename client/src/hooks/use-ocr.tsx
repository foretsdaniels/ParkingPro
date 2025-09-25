import { useState, useCallback } from "react";

// Declare Tesseract as a global variable since we're loading it via CDN
declare global {
  const Tesseract: any;
}

interface OCRHook {
  processImage: (imageData: string) => Promise<string | null>;
  isProcessing: boolean;
  ocrResult: string | null;
  confidence: number;
}

export function useOCR(): OCRHook {
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);

  const processImage = useCallback(async (imageData: string): Promise<string | null> => {
    if (typeof Tesseract === 'undefined') {
      console.error('Tesseract.js not loaded');
      return null;
    }

    setIsProcessing(true);
    setOcrResult(null);
    setConfidence(0);

    try {
      // Convert base64 to blob for Tesseract
      const response = await fetch(imageData);
      const blob = await response.blob();

      const result = await Tesseract.recognize(blob, 'eng', {
        logger: (m: any) => {
          // Optionally log progress
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      const text = result.data.text.trim().toUpperCase();
      const conf = result.data.confidence || 0;
      
      // Basic license plate pattern matching
      // Look for patterns like ABC-1234, ABC1234, etc.
      const platePatterns = [
        /([A-Z]{2,3}[-\s]?\d{3,4})/g,
        /(\d{1,2}[A-Z]{1,2}[-\s]?\d{3,4})/g,
        /([A-Z]{1,2}\d{1,3}[-\s]?[A-Z]{1,2}\d{1,3})/g,
      ];

      let bestMatch = '';
      let bestScore = 0;

      for (const pattern of platePatterns) {
        const matches = text.match(pattern);
        if (matches) {
          for (const match of matches) {
            const cleanMatch = match.replace(/[\s-]/g, '');
            if (cleanMatch.length >= 5 && cleanMatch.length <= 8) {
              const score = conf * (cleanMatch.length / 6); // Prefer 6-character plates
              if (score > bestScore) {
                bestMatch = match.replace(/\s+/g, '').replace(/([A-Z]+)(\d+)/, '$1-$2');
                bestScore = score;
              }
            }
          }
        }
      }

      if (bestMatch && bestScore > 30) {
        setOcrResult(bestMatch);
        setConfidence(Math.min(bestScore, 100));
        return bestMatch;
      } else {
        // If no good pattern match, return the cleaned text if it looks plate-like
        const cleaned = text.replace(/[^A-Z0-9]/g, '');
        if (cleaned.length >= 5 && cleaned.length <= 8 && /[A-Z]/.test(cleaned) && /\d/.test(cleaned)) {
          const formatted = cleaned.replace(/([A-Z]+)(\d+)/, '$1-$2');
          setOcrResult(formatted);
          setConfidence(Math.max(conf - 20, 0)); // Lower confidence for unmatched patterns
          return formatted;
        }
      }

      setOcrResult(null);
      setConfidence(0);
      return null;

    } catch (error) {
      console.error('OCR processing failed:', error);
      setOcrResult(null);
      setConfidence(0);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return {
    processImage,
    isProcessing,
    ocrResult,
    confidence,
  };
}
