import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Map as MapIcon, Truck, Search, MapPin, List, Map } from 'lucide-react';
import MultiMapComponent, { type MapMarkerData } from '../../components/map/MultiMapComponent';

interface LogisticsItem {
  id: number;
  order_id: number;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  driver_id: number | null;
  status: string;
  notes: string;
  created_at: string;
  pickup_date?: string;
  pickup_time?: string;
  delivery_date?: string;
  delivery_time?: string;
}

interface Driver {
  id: number;
  name: string;
}

export default function WorkerTracking() {
  const [pickups, setPickups] = useState<LogisticsItem[]>([]);
  const [deliveries, setDeliveries] = useState<LogisticsItem[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pickups' | 'deliveries'>('pickups');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pRes, dRes, drRes] = await Promise.all([
        api.get('/logistics/pickups'),
        api.get('/logistics/deliveries'),
        api.get('/users?role=driver')
      ]);
      setPickups(pRes.data);
      setDeliveries(dRes.data);
      setDrivers(drRes.data);
    } catch (error) {
      console.error('Error fetching logistics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStatusUpdate = async (id: number, type: 'pickups' | 'deliveries', status: string, driver_id?: string) => {
    try {
      const payload: any = { status };
      if (driver_id) payload.driver_id = driver_id === 'unassigned' ? null : parseInt(driver_id);
      
      await api.put(`/logistics/${type}/${id}/status`, payload);
      fetchData();
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

  const data = activeTab === 'pickups' ? pickups : deliveries;
  const filteredData = data.filter(item => 
    item.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const mapMarkers: MapMarkerData[] = filteredData
    .filter(item => item.latitude && item.longitude)
    .map(item => ({
      id: `${activeTab}-${item.id}`,
      lat: Number(item.latitude),
      lng: Number(item.longitude),
      title: `${activeTab === 'pickups' ? 'Pickup' : 'Delivery'}: ${item.order_number}`,
      subtitle: item.customer_name,
      color: activeTab === 'pickups' ? 'orange' : 'blue',
      popupContent: (
        <div className="p-1 min-w-[150px]">
          <h4 className="font-bold text-sm mb-1">{activeTab === 'pickups' ? 'Pickup' : 'Delivery'} - {item.order_number}</h4>
          <p className="text-sm font-medium">{item.customer_name}</p>
          <p className="text-xs text-gray-500 mb-2">{item.customer_phone}</p>
          <p className="text-xs">{item.address}</p>
          <p className="text-xs font-bold mt-2 text-blue-600 capitalize">Status: {item.status.replace(/_/g, ' ')}</p>
        </div>
      )
    }));

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <MapIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            Logistics & Tracking
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage pickups and deliveries visually</p>
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <button 
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}
          >
            <List className="h-4 w-4" /> List
          </button>
          <button 
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'map' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}
          >
            <Map className="h-4 w-4" /> Map
          </button>
        </div>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-800 shrink-0">
        <button
          className={`px-6 py-3 font-medium text-sm transition-colors relative ${activeTab === 'pickups' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
          onClick={() => setActiveTab('pickups')}
        >
          Pickups
          {activeTab === 'pickups' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />}
        </button>
        <button
          className={`px-6 py-3 font-medium text-sm transition-colors relative ${activeTab === 'deliveries' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
          onClick={() => setActiveTab('deliveries')}
        >
          Deliveries
          {activeTab === 'deliveries' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />}
        </button>
      </div>

      <div className="relative shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by Order # or Customer..."
          className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {viewMode === 'map' ? (
        <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden min-h-[500px] z-0">
          <MultiMapComponent markers={mapMarkers} height="100%" showSearch={true} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="col-span-full p-8 text-center text-gray-500">Loading {activeTab}...</div>
          ) : filteredData.length === 0 ? (
            <div className="col-span-full p-8 text-center text-gray-500">No {activeTab} found.</div>
          ) : (
            filteredData.map(item => (
              <div key={item.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{activeTab.slice(0,-1)}</span>
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{item.order_number}</h3>
                  </div>
                  <Truck className="h-5 w-5 text-gray-400" />
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.customer_name}</p>
                  <p className="text-sm text-gray-500">{item.customer_phone}</p>
                </div>

                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{item.address || 'No address provided'}</p>
                    {!item.latitude && <p className="text-[10px] text-red-500 font-medium mt-1">⚠️ No GIS Coordinates</p>}
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Driver Assignment</label>
                    <select 
                      className="w-full p-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 outline-none"
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
                    <label className="text-xs text-gray-500 block mb-1">Status</label>
                    <select 
                      className="w-full p-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 outline-none"
                      value={item.status}
                      onChange={(e) => handleStatusUpdate(item.id, activeTab, e.target.value)}
                    >
                      {getStatusOptions(activeTab).map(s => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
