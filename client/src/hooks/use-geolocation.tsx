import { useState, useEffect } from "react";

interface GeolocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

interface GeolocationHook {
  location: GeolocationData | null;
  locationStatus: string;
  error: string | null;
  requestLocation: () => Promise<void>;
}

export function useGeolocation(): GeolocationHook {
  const [location, setLocation] = useState<GeolocationData | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>("Requesting...");
  const [error, setError] = useState<string | null>(null);

  const requestLocation = async (): Promise<void> => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      setLocationStatus("Not Available");
      return;
    }

    setLocationStatus("Requesting...");
    setError(null);

    return new Promise((resolve) => {
      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000, // Use cached location if less than 1 minute old
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData: GeolocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };
          
          setLocation(locationData);
          setLocationStatus("GPS Active");
          setError(null);
          resolve();
        },
        (err) => {
          console.error('Geolocation error:', err);
          
          switch (err.code) {
            case err.PERMISSION_DENIED:
              setError("GPS access denied");
              setLocationStatus("Permission Denied");
              break;
            case err.POSITION_UNAVAILABLE:
              setError("GPS unavailable");
              setLocationStatus("Unavailable");
              break;
            case err.TIMEOUT:
              setError("GPS timeout");
              setLocationStatus("Timeout");
              break;
            default:
              setError("GPS error");
              setLocationStatus("Error");
              break;
          }
          resolve();
        },
        options
      );
    });
  };

  // Auto-request location on mount
  useEffect(() => {
    requestLocation();
  }, []);

  // Watch position for updates
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 300000, // 5 minutes
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const locationData: GeolocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        
        setLocation(locationData);
        setLocationStatus("GPS Active");
        setError(null);
      },
      (err) => {
        // Don't update error state for watch errors unless there's no existing location
        if (!location) {
          switch (err.code) {
            case err.PERMISSION_DENIED:
              setError("GPS access denied");
              setLocationStatus("Permission Denied");
              break;
            case err.POSITION_UNAVAILABLE:
              setError("GPS unavailable");
              setLocationStatus("Unavailable");
              break;
            default:
              setError("GPS error");
              setLocationStatus("Error");
              break;
          }
        }
      },
      watchOptions
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [location]);

  return {
    location,
    locationStatus,
    error,
    requestLocation,
  };
}
