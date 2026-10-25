import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Search, Navigation } from 'lucide-react';

// Fix for default marker icon in leaflet with webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapComponentProps {
  initialCenter?: [number, number];
  initialPosition?: [number, number] | null;
  onLocationSelect?: (lat: number, lng: number, address?: string) => void;
  readOnly?: boolean;
  height?: string;
  onNotice?: (msg: string) => void;
}

function LocationMarker({ position, onSelect, readOnly }: { position: L.LatLng | null, onSelect: any, readOnly: boolean }) {
  useMapEvents({
    click(e) {
      if (!readOnly) {
        onSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  return position === null ? null : (
    <Marker position={position}>
      <Popup>
        <div className="text-xs">
          <strong>Selected Location</strong>
          <br />
          {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
        </div>
      </Popup>
    </Marker>
  );
}

function ChangeView({ center }: { center: L.LatLngExpression }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

function ResizeMap() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

export default function MapComponent({ 
  initialCenter = [8.8105, 124.7925], 
  initialPosition = null, 
  onLocationSelect, 
  readOnly = false,
  height = '350px',
  onNotice
}: MapComponentProps) {
  // Only set initial marker if explicitly provided
  const [pos, setPos] = useState<L.LatLng | null>(
    initialPosition ? new L.LatLng(initialPosition[0], initialPosition[1]) : null
  );
  const [mapCenter, setMapCenter] = useState<[number, number]>(
    initialPosition ? [initialPosition[0], initialPosition[1]] : initialCenter
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [inlineNotice, setInlineNotice] = useState<string | null>(null);

  useEffect(() => {
    if (initialPosition) {
      const latlng = new L.LatLng(initialPosition[0], initialPosition[1]);
      setPos(latlng);
      setMapCenter([initialPosition[0], initialPosition[1]]);
    } else {
      setPos(null);
    }
  }, [initialPosition]);

  const notify = (msg: string) => {
    setInlineNotice(msg);
    if (onNotice) onNotice(msg);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setInlineNotice(null);
    try {
      const queryWithContext = searchQuery.toLowerCase().includes('misamis') || searchQuery.toLowerCase().includes('lagonglong')
        ? searchQuery
        : `${searchQuery}, Lagonglong, Misamis Oriental`;

      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryWithContext)}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const newLat = parseFloat(lat);
        const newLng = parseFloat(lon);
        const newPos = new L.LatLng(newLat, newLng);
        setPos(newPos);
        setMapCenter([newLat, newLng]);
        if (onLocationSelect) {
          onLocationSelect(newLat, newLng, display_name);
        }
      } else {
        notify('Address not found. Please try a different street name or click directly on the map.');
      }
    } catch (error) {
      console.error('Error fetching location:', error);
      notify('Search service temporarily unavailable. Click directly on the map to place your pin.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleFindMyLocation = () => {
    if (!navigator.geolocation) {
      notify('Geolocation is not supported by your browser. Please click directly on the map.');
      return;
    }
    setIsLocating(true);
    setInlineNotice(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const newPos = new L.LatLng(latitude, longitude);
        setPos(newPos);
        setMapCenter([latitude, longitude]);

        // Attempt reverse geocoding
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          if (onLocationSelect) {
            onLocationSelect(latitude, longitude, data.display_name || 'My Current Location');
          }
        } catch (error) {
          if (onLocationSelect) onLocationSelect(latitude, longitude, 'My Current Location');
        }
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          notify('Location permission was denied. Click anywhere on the map to place your pin manually.');
        } else {
          notify('Current location could not be detected. Click anywhere on the map to place your pin.');
        }
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleMapClick = async (lat: number, lng: number) => {
    const newPos = new L.LatLng(lat, lng);
    setPos(newPos);
    setMapCenter([lat, lng]);

    // Reverse geocode to get human readable address
    let addressName = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      if (data && data.display_name) {
        addressName = data.display_name;
      }
    } catch (e) {
      // Fallback to coordinates
    }

    if (onLocationSelect) {
      onLocationSelect(lat, lng, addressName);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {!readOnly && (
        <form onSubmit={handleSearch} className="flex flex-wrap gap-2 mb-1">
          <input
            type="text"
            placeholder="Search address or landmark in Lagonglong..."
            className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-w-[160px]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            {isSearching ? 'Searching...' : 'Search'}
          </button>
          <button
            type="button"
            onClick={handleFindMyLocation}
            disabled={isLocating}
            className="px-3 py-1.5 text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center gap-1.5 transition-colors shrink-0"
          >
            <Navigation className="w-3.5 h-3.5 text-blue-600" />
            {isLocating ? 'Locating...' : 'Use My Current Location'}
          </button>
        </form>
      )}

      {inlineNotice && (
        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-[11px] text-blue-800 dark:text-blue-200 flex items-center gap-2">
          <span>{inlineNotice}</span>
        </div>
      )}

      <div style={{ height, width: '100%' }} className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
        <MapContainer 
          center={mapCenter} 
          zoom={14} 
          style={{ height: '100%', width: '100%', zIndex: 0 }} 
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ResizeMap />
          <ChangeView center={mapCenter} />
          <LocationMarker 
            position={pos} 
            onSelect={handleMapClick} 
            readOnly={readOnly} 
          />
        </MapContainer>
      </div>
    </div>
  );
}
