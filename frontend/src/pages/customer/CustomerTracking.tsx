import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  MapPin, Truck, Navigation, Phone, Clock, 
  MessageSquare, RefreshCw, AlertCircle, CheckCircle2, Package 
} from 'lucide-react';
import api from '../../services/api';
import MultiMapComponent, { type MapMarkerData } from '../../components/map/MultiMapComponent';
import { Button } from '../../components/ui';
import OrderChatModal from '../../components/common/OrderChatModal';

interface TrackingItem {
  id: number;
  order_id: number;
  order_number: string;
  type: 'pickup' | 'delivery';
  status: string;
  address_line: string;
  latitude: number | null;
  longitude: number | null;
  driver_name?: string;
  driver_phone?: string;
  driver_lat?: number;
  driver_lng?: number;
  scheduled_date?: string;
  scheduled_time?: string;
}

export default function CustomerTracking() {
  const [items, setItems] = useState<TrackingItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<TrackingItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Live Routing State
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Chat Modal State
  const [chatOrder, setChatOrder] = useState<{ id: number; order_number: string } | null>(null);

  const fetchTrackingData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [pickupsRes, deliveriesRes, ordersRes] = await Promise.all([
        api.get('/logistics/pickups'),
        api.get('/logistics/deliveries'),
        api.get('/orders')
      ]);

      const pickupList: TrackingItem[] = pickupsRes.data.map((p: any) => ({
        ...p,
        type: 'pickup'
      }));

      const deliveryList: TrackingItem[] = deliveriesRes.data.map((d: any) => ({
        ...d,
        type: 'delivery'
      }));

      const combined = [...pickupList, ...deliveryList];
      setItems(combined);

      // Automatically select active "on_the_way" item if available, or first item
      if (!selectedItem && combined.length > 0) {
        const active = combined.find((i) => i.status === 'on_the_way' || i.status === 'out_for_delivery');
        setSelectedItem(active || combined[0]);
      } else if (selectedItem) {
        // Keep updated details of currently selected
        const updated = combined.find((i) => i.id === selectedItem.id && i.type === selectedItem.type);
        if (updated) setSelectedItem(updated);
      }

      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('Error fetching customer tracking:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackingData();
    // Live polling every 5 seconds for driver coordinates
    const interval = setInterval(() => fetchTrackingData(true), 5000);
    return () => clearInterval(interval);
  }, []);

  // Calculate live route from driver to destination when driver is "on_the_way"
  useEffect(() => {
    if (!selectedItem) {
      setRouteCoordinates([]);
      setRouteInfo(null);
      return;
    }

    const isOnTheWay = selectedItem.status === 'on_the_way' || selectedItem.status === 'out_for_delivery';
    const destLat = selectedItem.latitude || 8.7845; // Default Poblacion, Lagonglong
    const destLng = selectedItem.longitude || 124.7761;

    // Simulated driver position near Lagonglong if driver GPS is not live yet
    const driverLat = selectedItem.driver_lat || 8.7830;
    const driverLng = selectedItem.driver_lng || 124.7745;

    if (isOnTheWay) {
      // Calculate OSRM route
      fetch(`https://router.project-osrm.org/route/v1/driving/${driverLng},${driverLat};${destLng},${destLat}?overview=full&geometries=geojson`)
        .then((res) => res.json())
        .then((data) => {
          if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const coords = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
            setRouteCoordinates(coords);
            setRouteInfo({
              distance: (route.distance / 1000).toFixed(1) + ' km',
              duration: Math.max(1, Math.ceil(route.duration / 60)) + ' mins'
            });
          }
        })
        .catch(() => {
          setRouteCoordinates([]);
          setRouteInfo(null);
        });
    } else {
      setRouteCoordinates([]);
      setRouteInfo(null);
    }
  }, [selectedItem]);

  // Build Map Markers
  const markers: MapMarkerData[] = [];

  if (selectedItem) {
    const destLat = selectedItem.latitude || 8.7845;
    const destLng = selectedItem.longitude || 124.7761;

    // Destination Pin
    markers.push({
      id: 'destination',
      lat: destLat,
      lng: destLng,
      title: `${selectedItem.type === 'pickup' ? 'Pickup' : 'Delivery'} Destination`,
      subtitle: selectedItem.address_line,
      color: 'blue'
    });

    // Driver Pin ONLY when driver is actively "on_the_way" (fulfills security rule to protect driver privacy when not active)
    const isOnTheWay = selectedItem.status === 'on_the_way' || selectedItem.status === 'out_for_delivery';
    if (isOnTheWay) {
      markers.push({
        id: 'driver',
        lat: selectedItem.driver_lat || 8.7830,
        lng: selectedItem.driver_lng || 124.7745,
        title: `Driver: ${selectedItem.driver_name || 'En Route'}`,
        subtitle: 'Live Position',
        color: 'green'
      });
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'on_the_way':
      case 'out_for_delivery':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 animate-pulse border-blue-200';
      case 'arrived':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200';
      case 'picked_up':
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200';
      default:
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200';
    }
  };

  const isSelectedActive = selectedItem?.status === 'on_the_way' || selectedItem?.status === 'out_for_delivery';

  return (
    <div className="space-y-6 max-w-7xl mx-auto h-[calc(100vh-140px)] flex flex-col pb-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2.5">
            <Navigation className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            Live Driver Tracking
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Poblacion, Lagonglong • Live GPS map updates automatically
          </p>
        </div>

        {lastUpdated && (
          <span className="text-[11px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full font-mono">
            Synced: {lastUpdated}
          </span>
        )}
      </div>

      {/* Main Grid: Map & Task Switcher */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* Left Column: Interactive Leaflet Map */}
        <div className="lg:col-span-8 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm flex flex-col relative h-[380px] lg:h-full">
          
          {/* Live ETA Floating Banner when Driver is On The Way */}
          {isSelectedActive && routeInfo && (
            <div className="absolute top-4 left-4 right-4 z-20 max-w-sm mx-auto bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-blue-200 dark:border-blue-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                    Driver is On The Way
                  </span>
                  <p className="text-sm font-extrabold text-gray-900 dark:text-white">
                    Arriving in ~{routeInfo.duration}
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg">
                {routeInfo.distance}
              </span>
            </div>
          )}

          <div className="flex-1 w-full h-full relative">
            <MultiMapComponent
              markers={markers}
              routeCoordinates={routeCoordinates}
              initialCenter={[8.7845, 124.7761]} // Poblacion, Lagonglong default center
              zoom={15}
            />
          </div>
        </div>

        {/* Right Column: Selected Order Card & Task Switcher */}
        <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
          
          {/* Active Order Card */}
          {selectedItem ? (
            <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono font-bold text-base text-gray-900 dark:text-white block">
                    {selectedItem.order_number}
                  </span>
                  <span className="text-xs text-gray-500 capitalize">
                    {selectedItem.type} Task
                  </span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${getStatusBadge(selectedItem.status)}`}>
                  {selectedItem.status.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Status Explanation Banner */}
              <div className={`p-3.5 rounded-xl text-xs leading-relaxed ${
                isSelectedActive
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-900'
                  : 'bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-800'
              }`}>
                {isSelectedActive ? (
                  <p className="font-medium">
                    🚚 <strong>Driver en route:</strong> Your driver is traveling toward your address in Poblacion, Lagonglong. Live coordinates are plotted above.
                  </p>
                ) : selectedItem.status === 'arrived' ? (
                  <p className="font-medium text-purple-700 dark:text-purple-300">
                    📍 <strong>Driver arrived:</strong> Your driver has reached the location. Please be ready to meet them.
                  </p>
                ) : selectedItem.status === 'picked_up' || selectedItem.status === 'delivered' ? (
                  <p className="font-medium text-emerald-700 dark:text-emerald-300">
                    ✓ <strong>Completed:</strong> This task has been finished. Thank you for using LaundriGo!
                  </p>
                ) : (
                  <p className="font-medium">
                    ⏳ <strong>Waiting for driver dispatch:</strong> Real-time GPS location will activate once the driver marks "On the Way".
                  </p>
                )}
              </div>

              {/* Driver Details */}
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 space-y-2 text-xs">
                <span className="text-gray-400 font-semibold block uppercase tracking-wider text-[10px]">
                  Driver Assigned
                </span>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900 dark:text-white text-sm">
                    {selectedItem.driver_name || 'Driver Assignment in Progress'}
                  </span>
                  {selectedItem.driver_phone && (
                    <a
                      href={`tel:${selectedItem.driver_phone}`}
                      className="px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1 hover:underline"
                    >
                      <Phone className="w-3 h-3" /> Call
                    </a>
                  )}
                </div>
              </div>

              {/* Destination Address */}
              <div className="space-y-1 text-xs">
                <span className="text-gray-400 font-semibold block uppercase tracking-wider text-[10px]">
                  Target Address
                </span>
                <p className="font-medium text-gray-800 dark:text-gray-200 flex items-start gap-1.5">
                  <MapPin className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{selectedItem.address_line || 'Poblacion, Lagonglong'}</span>
                </p>
              </div>

              {/* Chat Button */}
              <Button
                variant="outline"
                onClick={() => setChatOrder({ id: selectedItem.order_id, order_number: selectedItem.order_number })}
                className="w-full gap-2 font-semibold text-xs py-2.5"
              >
                <MessageSquare className="w-4 h-4 text-blue-600" />
                Message Driver / Staff
              </Button>
            </div>
          ) : (
            <div className="p-8 text-center bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 text-gray-400">
              <Package className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-700" />
              <p className="text-xs">Select an order below to track logistics.</p>
            </div>
          )}

          {/* All Dispatches Switcher List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">
              Your Active Dispatches ({items.length})
            </h4>

            {items.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                onClick={() => setSelectedItem(item)}
                className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                  selectedItem?.id === item.id && selectedItem?.type === item.type
                    ? 'border-blue-600 bg-white dark:bg-gray-900 shadow-sm ring-2 ring-blue-500/20'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-xs text-gray-900 dark:text-white">
                    {item.order_number}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusBadge(item.status)}`}>
                    {item.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 capitalize">
                  {item.type} • {item.address_line || 'Poblacion, Lagonglong'}
                </p>
              </div>
            ))}
          </div>

        </div>

      </div>

      {/* Order Chat Modal */}
      {chatOrder && (
        <OrderChatModal
          orderId={chatOrder.id}
          orderNumber={chatOrder.order_number}
          onClose={() => setChatOrder(null)}
        />
      )}

    </div>
  );
}
