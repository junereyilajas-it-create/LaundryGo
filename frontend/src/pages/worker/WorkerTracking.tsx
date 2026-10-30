import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { 
  Map as MapIcon, Truck, Search, MapPin, List, Map, 
  Phone, User, CheckCircle2, Clock, Navigation, AlertCircle,
  Eye, RefreshCw, ChevronRight, X
} from 'lucide-react';
import MultiMapComponent, { type MapMarkerData } from '../../components/map/MultiMapComponent';
import StatusBadge from '../../components/common/StatusBadge';
import { Button } from '../../components/ui';

interface LogisticsItem {
  id: number;
  order_id: number;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  address?: string;
  address_line?: string;
  latitude: number | null;
  longitude: number | null;
  driver_id: number | null;
  driver_name?: string;
  driver_phone?: string;
  driver_lat?: number | null;
  driver_lng?: number | null;
  driver_location_updated_at?: string | null;
  status: string;
  order_status?: string;
  notes?: string;
  created_at: string;
  pickup_date?: string;
  pickup_time?: string;
  delivery_date?: string;
  delivery_time?: string;
}

interface Driver {
  id: number;
  name: string;
  phone?: string;
}

export default function WorkerTracking() {
  const [pickups, setPickups] = useState<LogisticsItem[]>([]);
  const [deliveries, setDeliveries] = useState<LogisticsItem[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pickups' | 'deliveries'>('pickups');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<LogisticsItem | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [pRes, dRes, drRes] = await Promise.all([
        api.get('/logistics/pickups'),
        api.get('/logistics/deliveries'),
        api.get('/users?role=driver')
      ]);
      setPickups(pRes.data);
      setDeliveries(dRes.data);
      setDrivers(drRes.data);
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      // If an item is currently selected for tracking, refresh its state
      if (selectedItem) {
        const pool = activeTab === 'pickups' ? pRes.data : dRes.data;
        const fresh = pool.find((item: LogisticsItem) => item.id === selectedItem.id);
        if (fresh) setSelectedItem(fresh);
      }
    } catch (error) {
      console.error('Error fetching logistics:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Real-time polling every 6 seconds to update driver movements & status
    const interval = setInterval(() => fetchData(true), 6000);
    return () => clearInterval(interval);
  }, [activeTab, selectedItem?.id]);

  const handleStatusUpdate = async (id: number, type: 'pickups' | 'deliveries', status: string, driver_id?: string) => {
    try {
      const payload: any = { status };
      if (driver_id) payload.driver_id = driver_id === 'unassigned' ? null : parseInt(driver_id);
      
      await api.put(`/logistics/${type}/${id}/status`, payload);
      fetchData(true);
    } catch (error) {
      alert('Failed to update status');
    }
  };

  const getStatusOptions = (type: 'pickups' | 'deliveries') => {
    if (type === 'pickups') {
      return ['pending', 'accepted', 'assigned', 'on_the_way', 'picked_up', 'cancelled'];
    }
    return ['pending', 'assigned', 'out_for_delivery', 'delivered', 'cancelled'];
  };

  const resolveAddress = (item: LogisticsItem) => {
    if (item.address && item.address.trim() !== '') return item.address;
    if (item.address_line && item.address_line.trim() !== '') return item.address_line;
    if (item.latitude && item.longitude) {
      return activeTab === 'pickups' ? 'Pinned pickup location' : 'Pinned delivery location';
    }
    return 'Location unavailable (No coordinates or address)';
  };

  const hasCustomerCoords = (item: LogisticsItem) => {
    return item.latitude !== null && item.longitude !== null && !isNaN(Number(item.latitude)) && !isNaN(Number(item.longitude));
  };

  const hasDriverGps = (item: LogisticsItem) => {
    return item.driver_lat !== null && item.driver_lat !== undefined &&
           item.driver_lng !== null && item.driver_lng !== undefined &&
           !isNaN(Number(item.driver_lat)) && !isNaN(Number(item.driver_lng));
  };

  const handleTrackOnMap = (item: LogisticsItem) => {
    setSelectedItem(item);
    setViewMode('map');
  };

  const rawData = activeTab === 'pickups' ? pickups : deliveries;
  const filteredData = rawData.filter(item => {
    const matchesSearch = 
      item.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.driver_name && item.driver_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Build map markers
  const buildMapMarkers = (): MapMarkerData[] => {
    // If a specific order is selected, show its customer location AND driver live location
    if (selectedItem) {
      const markers: MapMarkerData[] = [];
      
      if (hasCustomerCoords(selectedItem)) {
        markers.push({
          id: `customer-${selectedItem.id}`,
          lat: Number(selectedItem.latitude),
          lng: Number(selectedItem.longitude),
          title: `Customer ${activeTab === 'pickups' ? 'Pickup' : 'Delivery'}: ${selectedItem.order_number}`,
          subtitle: resolveAddress(selectedItem),
          color: 'blue',
          popupContent: (
            <div className="p-2 min-w-[200px] space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 block">
                Customer Location
              </span>
              <h4 className="font-bold text-sm text-gray-900">{selectedItem.order_number}</h4>
              <p className="text-xs font-semibold text-gray-700">{selectedItem.customer_name}</p>
              <p className="text-xs text-gray-500">{selectedItem.customer_phone}</p>
              <p className="text-xs text-gray-600 pt-1 border-t border-gray-100">{resolveAddress(selectedItem)}</p>
              <div className="pt-1">
                <StatusBadge status={selectedItem.status} />
              </div>
            </div>
          )
        });
      }

      if (hasDriverGps(selectedItem)) {
        markers.push({
          id: `driver-${selectedItem.driver_id || selectedItem.id}`,
          lat: Number(selectedItem.driver_lat),
          lng: Number(selectedItem.driver_lng),
          title: `Driver: ${selectedItem.driver_name || 'Assigned Driver'}`,
          subtitle: `Live GPS Position • Updated ${selectedItem.driver_location_updated_at ? new Date(selectedItem.driver_location_updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}`,
          color: 'green',
          popupContent: (
            <div className="p-2 min-w-[180px] space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 block">
                Driver Live Location
              </span>
              <h4 className="font-bold text-sm text-gray-900">{selectedItem.driver_name || 'Driver'}</h4>
              {selectedItem.driver_phone && <p className="text-xs text-gray-500">{selectedItem.driver_phone}</p>}
              <p className="text-[11px] text-gray-600">En route for Order #{selectedItem.order_number}</p>
              {selectedItem.driver_location_updated_at && (
                <p className="text-[10px] text-gray-400">
                  Last update: {new Date(selectedItem.driver_location_updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          )
        });
      }

      return markers;
    }

    // Default: Show all filtered items with valid customer coordinates
    return filteredData
      .filter(item => hasCustomerCoords(item))
      .map(item => ({
        id: `${activeTab}-${item.id}`,
        lat: Number(item.latitude),
        lng: Number(item.longitude),
        title: `${activeTab === 'pickups' ? 'Pickup' : 'Delivery'}: ${item.order_number}`,
        subtitle: `${item.customer_name} • ${resolveAddress(item)}`,
        color: item.status === 'picked_up' || item.status === 'delivered' 
          ? 'green' 
          : item.status === 'on_the_way' || item.status === 'out_for_delivery'
          ? 'orange'
          : 'blue',
        popupContent: (
          <div className="p-2 min-w-[180px] space-y-1">
            <h4 className="font-bold text-sm text-gray-900">{activeTab === 'pickups' ? 'Pickup' : 'Delivery'} - {item.order_number}</h4>
            <p className="text-xs font-semibold text-gray-700">{item.customer_name}</p>
            <p className="text-xs text-gray-500">{item.customer_phone}</p>
            <p className="text-xs text-gray-600">{resolveAddress(item)}</p>
            <div className="pt-1.5 flex items-center justify-between">
              <StatusBadge status={item.status} />
              <button 
                onClick={() => setSelectedItem(item)}
                className="text-[11px] text-blue-600 font-bold hover:underline"
              >
                Track Live →
              </button>
            </div>
          </div>
        )
      }));
  };

  const mapMarkers = buildMapMarkers();

  return (
    <div className="space-y-6 h-full flex flex-col pb-12">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2.5">
            <MapIcon className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            Live Logistics & Order Tracking
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Real-time customer pickup locations, active driver GPS coordinates, and route monitoring
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-gray-400">
              <Clock className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              Synced {lastRefreshed}
            </span>
          )}

          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            <button 
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'list' 
                  ? 'bg-white dark:bg-gray-700 shadow-xs text-blue-600 dark:text-blue-400' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'map' 
                  ? 'bg-white dark:bg-gray-700 shadow-xs text-blue-600 dark:text-blue-400' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Map className="h-3.5 w-3.5" /> Map View
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 shrink-0">
        <button
          className={`px-6 py-3 font-bold text-xs sm:text-sm transition-colors relative flex items-center gap-2 ${
            activeTab === 'pickups' 
              ? 'text-blue-600 dark:text-blue-400' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
          onClick={() => { setActiveTab('pickups'); setSelectedItem(null); }}
        >
          <Truck className="w-4 h-4" />
          Customer Pickups ({pickups.length})
          {activeTab === 'pickups' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />}
        </button>
        <button
          className={`px-6 py-3 font-bold text-xs sm:text-sm transition-colors relative flex items-center gap-2 ${
            activeTab === 'deliveries' 
              ? 'text-blue-600 dark:text-blue-400' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
          onClick={() => { setActiveTab('deliveries'); setSelectedItem(null); }}
        >
          <Navigation className="w-4 h-4" />
          Customer Deliveries ({deliveries.length})
          {activeTab === 'deliveries' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />}
        </button>
      </div>

      {/* Search and Status Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={`Search ${activeTab} by Order #, Customer, or Driver...`}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 whitespace-nowrap">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-medium outline-none"
          >
            <option value="all">All Statuses</option>
            {getStatusOptions(activeTab).map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* VIEW MODES */}
      {viewMode === 'map' ? (
        <div className="flex-1 flex flex-col space-y-3 min-h-[550px]">
          {/* Active Order Focus Banner */}
          {selectedItem && (
            <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Navigation className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 dark:text-white font-mono">
                      Tracking #{selectedItem.order_number}
                    </span>
                    <StatusBadge status={selectedItem.status} />
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mt-0.5">
                    Customer: <strong className="text-gray-900 dark:text-white">{selectedItem.customer_name}</strong> • 
                    Driver: <strong className="text-gray-900 dark:text-white">{selectedItem.driver_name || 'Unassigned'}</strong>
                    {hasDriverGps(selectedItem) ? (
                      <span className="text-emerald-700 dark:text-emerald-300 font-bold ml-1.5">● Live GPS Active</span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-300 ml-1.5">○ Driver GPS Unavailable</span>
                    )}
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedItem(null)}
                className="text-xs h-auto py-1 px-2.5 whitespace-nowrap gap-1"
              >
                <X className="w-3.5 h-3.5" /> Show All Orders
              </Button>
            </div>
          )}

          <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden min-h-[500px] z-0 shadow-sm">
            <MultiMapComponent markers={mapMarkers} height="100%" showSearch={true} />
          </div>
        </div>
      ) : (
        /* List View */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="col-span-full py-20 flex flex-col justify-center items-center text-gray-400 space-y-2">
              <RefreshCw className="w-7 h-7 animate-spin text-blue-600" />
              <p className="text-xs">Loading logistics orders...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="col-span-full p-16 text-center text-gray-400 space-y-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
              <Truck className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-700" />
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">No {activeTab} match your criteria</h3>
              <p className="text-xs text-gray-500">Try adjusting your search query or status filter.</p>
            </div>
          ) : (
            filteredData.map(item => {
              const addressText = resolveAddress(item);
              const coordsAvailable = hasCustomerCoords(item);
              const driverHasGps = hasDriverGps(item);

              return (
                <div 
                  key={item.id} 
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5 hover:border-gray-300 dark:hover:border-gray-700 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header Row: Order # and Status Badge */}
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                          {activeTab === 'pickups' ? 'Pickup Request' : 'Delivery Request'}
                        </span>
                        <h3 className="font-extrabold text-base text-gray-900 dark:text-white font-mono">
                          {item.order_number}
                        </h3>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>

                    {/* Customer Row */}
                    <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800/80 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-blue-500" />
                          {item.customer_name}
                        </span>
                        {item.customer_phone && (
                          <a 
                            href={`tel:${item.customer_phone}`} 
                            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            {item.customer_phone}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Resolved Location Row */}
                    <div className="space-y-1">
                      <div className="flex items-start gap-2 text-xs">
                        <MapPin className={`h-4 w-4 shrink-0 mt-0.5 ${coordsAvailable ? 'text-blue-600' : 'text-amber-500'}`} />
                        <div className="flex-1">
                          <p className={`font-medium line-clamp-2 ${coordsAvailable ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 italic'}`}>
                            {addressText}
                          </p>
                          {coordsAvailable ? (
                            <span className="text-[10px] text-gray-400 font-mono block mt-0.5">
                              ({Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)})
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block mt-0.5">
                              ⚠️ Location coordinates unavailable
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Driver Status & Live GPS Badge */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 text-[11px] font-semibold">Assigned Driver:</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200">
                          {item.driver_name || 'Unassigned'}
                        </span>
                      </div>

                      {item.driver_name ? (
                        <div className="flex items-center gap-1.5 text-[11px]">
                          {driverHasGps ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              GPS Live ({Number(item.driver_lat).toFixed(4)}, {Number(item.driver_lng).toFixed(4)})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-[10px]">
                              ○ Driver GPS Unavailable
                            </span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions & Status Updates */}
                  <div className="space-y-2.5 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Driver</label>
                        <select 
                          className="w-full p-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 outline-none text-gray-900 dark:text-white"
                          value={item.driver_id || 'unassigned'}
                          onChange={(e) => handleStatusUpdate(item.id, activeTab, item.status, e.target.value)}
                        >
                          <option value="unassigned">Unassigned</option>
                          {drivers.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Status</label>
                        <select 
                          className="w-full p-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 outline-none text-gray-900 dark:text-white capitalize"
                          value={item.status}
                          onChange={(e) => handleStatusUpdate(item.id, activeTab, e.target.value)}
                        >
                          {getStatusOptions(activeTab).map(s => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* View on Map Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTrackOnMap(item)}
                      className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 h-auto font-bold border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      View on Map & Live Tracking
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
