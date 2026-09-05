import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Search } from 'lucide-react';

// Fix for default marker icon in leaflet with webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapComponentProps {
  initialPosition?: [number, number];
  onLocationSelect?: (lat: number, lng: number, address?: string) => void;
  readOnly?: boolean;
}

function LocationMarker({ position, onSelect, readOnly }: { position: L.LatLng | null, onSelect: any, readOnly: boolean }) {
  const [currentPos, setCurrentPos] = useState<L.LatLng | null>(position);

  useEffect(() => {
    setCurrentPos(position);
  }, [position]);

  useMapEvents({
    click(e) {
      if (!readOnly) {
        setCurrentPos(e.latlng);
        onSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  return currentPos === null ? null : (
    <Marker position={currentPos}>
      <Popup>Selected Location</Popup>
    </Marker>
  );
}

function ChangeView({ center }: { center: L.LatLngExpression }) {
  const map = useMap();
  map.setView(center, 15);
  return null;
}

export default function MapComponent({ initialPosition = [14.5995, 120.9842], onLocationSelect, readOnly = false }: MapComponentProps) {
  const [pos, setPos] = useState<L.LatLng | null>(initialPosition ? new L.LatLng(initialPosition[0], initialPosition[1]) : null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (initialPosition) {
      setPos(new L.LatLng(initialPosition[0], initialPosition[1]));
    }
  }, [initialPosition]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const newPos = new L.LatLng(parseFloat(lat), parseFloat(lon));
        setPos(newPos);
        if (onLocationSelect) {
          onLocationSelect(parseFloat(lat), parseFloat(lon), display_name);
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

  return (
    <div className="flex flex-col gap-2">
      {!readOnly && (
        <form onSubmit={handleSearch} className="flex gap-2 mb-2">
          <input
            type="text"
            placeholder="Search address..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-secondary flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>
      )}
      <MapContainer center={pos || initialPosition} zoom={13} style={{ height: '400px', width: '100%', zIndex: 0 }} className="rounded-lg shadow-sm border border-gray-200">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pos && <ChangeView center={pos} />}
        <LocationMarker position={pos} onSelect={(lat: number, lng: number) => {
          setPos(new L.LatLng(lat, lng));
          if (onLocationSelect) onLocationSelect(lat, lng);
        }} readOnly={readOnly} />
      </MapContainer>
    </div>
  );
}
