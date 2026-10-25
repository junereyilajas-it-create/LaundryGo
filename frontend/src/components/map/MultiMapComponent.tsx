import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
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

// Custom Icons
const createIcon = (color: string) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export const MapIcons = {
  blue: createIcon('blue'),
  red: createIcon('red'),
  green: createIcon('green'),
  orange: createIcon('orange'),
  yellow: createIcon('yellow'),
  violet: createIcon('violet'),
  grey: createIcon('grey'),
  black: createIcon('black'),
};

export interface MapMarkerData {
  id: string | number;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  color?: keyof typeof MapIcons;
  onClick?: () => void;
  popupContent?: React.ReactNode;
}

interface MultiMapComponentProps {
  markers: MapMarkerData[];
  initialCenter?: [number, number];
  zoom?: number;
  height?: string;
  onSearchSelect?: (lat: number, lng: number, address: string) => void;
  showSearch?: boolean;
  routeCoordinates?: [number, number][];
}

function BoundsFitter({ markers, center, routeCoordinates }: { markers: MapMarkerData[], center: L.LatLngExpression, routeCoordinates?: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    let bounds = L.latLngBounds([]);
    let hasBounds = false;
    
    if (markers.length > 0) {
      markers.forEach(m => bounds.extend([m.lat, m.lng]));
      hasBounds = true;
    }
    if (routeCoordinates && routeCoordinates.length > 0) {
      routeCoordinates.forEach(coord => bounds.extend(coord));
      hasBounds = true;
    }
    
    if (hasBounds) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else {
      map.setView(center, 12);
    }
  }, [markers, routeCoordinates, map, center]);
  return null;
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);
    const timer1 = setTimeout(() => map.invalidateSize(), 200);
    const timer2 = setTimeout(() => map.invalidateSize(), 600);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [map]);
  return null;
}

export default function MultiMapComponent({ 
  markers, 
  initialCenter = [8.8105, 124.7925], 
  zoom = 13,
  height = '400px',
  onSearchSelect,
  showSearch = false,
  routeCoordinates
}: MultiMapComponentProps) {
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [mapCenter, setMapCenter] = useState<L.LatLngExpression>(initialCenter);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        setMapCenter([parseFloat(lat), parseFloat(lon)]);
        if (onSearchSelect) {
          onSearchSelect(parseFloat(lat), parseFloat(lon), display_name);
        }
      } else {
        alert('Location not found');
      }
    } catch (error) {
      console.error('Error fetching location:', error);
      alert('Error searching for location');
    } finally {
      setIsSearching(false);
    }
  };

  const handleFindMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setMapCenter([latitude, longitude]);
        if (onSearchSelect) {
          onSearchSelect(latitude, longitude, 'My Location');
        }
        setIsLocating(false);
      },
      () => {
        alert('Unable to retrieve your location');
        setIsLocating(false);
      }
    );
  };

  return (
    <div className="flex flex-col gap-2 w-full h-full">
      {showSearch && (
        <form onSubmit={handleSearch} className="flex flex-wrap gap-2 mb-2 p-2">
          <input
            type="text"
            placeholder="Search address..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-w-[200px]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            {isSearching ? 'Searching...' : 'Search'}
          </button>
          <button
            type="button"
            onClick={handleFindMyLocation}
            disabled={isLocating}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors"
          >
            <Navigation className="w-4 h-4" />
            {isLocating ? 'Locating...' : 'My Location'}
          </button>
        </form>
      )}
      <MapContainer 
        center={mapCenter} 
        zoom={zoom} 
        style={{ height, width: '100%', zIndex: 0 }} 
        className="rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex-1 min-h-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <BoundsFitter markers={markers} center={mapCenter} routeCoordinates={routeCoordinates} />
        <MapResizer />
        
        {routeCoordinates && routeCoordinates.length > 0 && (
          <Polyline positions={routeCoordinates} color="#3b82f6" weight={5} opacity={0.8} />
        )}

        {markers.map(marker => (
          <Marker 
            key={marker.id} 
            position={[marker.lat, marker.lng]}
            icon={marker.color ? MapIcons[marker.color] : MapIcons.blue}
            eventHandlers={{
              click: () => {
                if (marker.onClick) marker.onClick();
              }
            }}
          >
            <Popup>
              {marker.popupContent ? marker.popupContent : (
                <div className="text-sm">
                  <div className="font-bold">{marker.title}</div>
                  {marker.subtitle && <div className="text-gray-600">{marker.subtitle}</div>}
                </div>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
