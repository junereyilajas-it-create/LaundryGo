import React, { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { 
  Truck, Navigation, CheckCircle, MapPin, ExternalLink, 
  Maximize2, Minimize2, Crosshair, ChevronUp, ChevronDown, 
  Phone, AlertCircle, RefreshCw, Layers, Clock
} from 'lucide-react';
import MultiMapComponent, { type MapMarkerData } from '../../components/map/MultiMapComponent';

interface Task {
  id: number;
  type: 'pickup' | 'delivery';
  order_number: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
}

export default function DriverMap() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Navigation & Location State
  const [driverLocation, setDriverLocation] = useState<{lat: number, lng: number} | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [routeInfo, setRouteInfo] = useState<{distance: string, duration: string} | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Responsive UI & Mobile Sheet Controls
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isBottomSheetCollapsed, setIsBottomSheetCollapsed] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'all' | 'pickup' | 'delivery'>('all');

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const [pRes, dRes] = await Promise.all([
        api.get('/logistics/pickups').catch(() => ({ data: [] })),
        api.get('/logistics/deliveries').catch(() => ({ data: [] }))
      ]);
      
      const pickups = (pRes.data || [])
        .filter((p: any) => p.status === 'assigned' || p.status === 'on_the_way')
        .map((p: any) => ({ ...p, type: 'pickup' }));
        
      const deliveries = (dRes.data || [])
        .filter((d: any) => d.status === 'assigned' || d.status === 'out_for_delivery')
        .map((d: any) => ({ ...d, type: 'delivery' }));
        
      setTasks([...pickups, ...deliveries]);
    } catch (error) {
      console.error('Error fetching driver tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Invalidate map layout when toggle happens
  const toggleMapExpand = () => {
    setIsMapExpanded(prev => !prev);
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 150);
  };

  const handleUpdateStatus = async (id: number, type: string, currentStatus: string) => {
    try {
      let newStatus = '';
      if (type === 'pickup') {
        newStatus = currentStatus === 'assigned' ? 'on_the_way' : 'picked_up';
      } else {
        newStatus = currentStatus === 'assigned' ? 'out_for_delivery' : 'delivered';
      }
      
      await api.put(`/logistics/${type}s/${id}/status`, { status: newStatus });
      fetchTasks();
      
      // Clear route if we completed it
      if (newStatus === 'picked_up' || newStatus === 'delivered') {
        if (selectedTask?.id === id && selectedTask?.type === type) {
          setSelectedTask(null);
          setRouteCoordinates([]);
          setRouteInfo(null);
        }
      }
    } catch (error) {
      alert('Failed to update task status');
    }
  };

  const calculateRoute = async (task: Task, driverLat: number, driverLng: number) => {
    if (!task.latitude || !task.longitude) {
      setLocationError(`Location coordinates are missing for Order #${task.order_number}.`);
      return;
    }

    setIsCalculatingRoute(true);
    setLocationError(null);
    setRouteInfo(null);
    setSelectedTask(task);

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${driverLng},${driverLat};${task.longitude},${task.latitude}?overview=full&geometries=geojson`
      );
      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No driving route found to this destination.');
      }

      const route = data.routes[0];
      const coords = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
      
      setRouteCoordinates(coords);
      setRouteInfo({
        distance: (route.distance / 1000).toFixed(1) + ' km',
        duration: Math.ceil(route.duration / 60) + ' min'
      });

      // Auto-collapse bottom sheet on mobile to give map maximum room
      if (window.innerWidth < 1024) {
        setIsBottomSheetCollapsed(true);
      }

      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 200);

    } catch (error: any) {
      console.error('Routing calculation error:', error);
      setLocationError(error.message || 'Unable to calculate live route between your location and the destination.');
      setRouteCoordinates([]);
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  const handleGetDirections = (task: Task) => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    if (driverLocation) {
      calculateRoute(task, driverLocation.lat, driverLocation.lng);
      return;
    }

    setIsCalculatingRoute(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setDriverLocation({ lat: latitude, lng: longitude });
        calculateRoute(task, latitude, longitude);
      },
      (error) => {
        setIsCalculatingRoute(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('GPS permission was denied. Please allow device location access to enable turn-by-turn routing.');
        } else {
          setLocationError('Could not determine current GPS position. Please ensure GPS/Location is enabled.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const locateDriver = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setDriverLocation(coords);
        if (selectedTask) {
          calculateRoute(selectedTask, coords.lat, coords.lng);
        }
      },
      (err) => {
        setLocationError('Unable to refresh current location.');
      }
    );
  };

  // Build markers
  const markers: MapMarkerData[] = [];
  
  if (driverLocation) {
    markers.push({
      id: 'driver-current',
      lat: driverLocation.lat,
      lng: driverLocation.lng,
      title: 'Driver Location (You)',
      subtitle: 'Current GPS position',
      color: 'green'
    });
  }

  const filteredTasks = tasks.filter(t => {
    if (taskFilter === 'pickup') return t.type === 'pickup';
    if (taskFilter === 'delivery') return t.type === 'delivery';
    return true;
  });

  tasks
    .filter(t => t.latitude && t.longitude)
    .forEach(t => {
      const isSelected = selectedTask?.id === t.id && selectedTask?.type === t.type;
      markers.push({
        id: `${t.type}-${t.id}`,
        lat: Number(t.latitude),
        lng: Number(t.longitude),
        title: `${t.type === 'pickup' ? '📦 Pickup' : '🚚 Delivery'}: ${t.order_number}`,
        subtitle: `${t.customer_name} • ${t.address}`,
        color: isSelected ? 'red' : (t.type === 'pickup' ? 'orange' : 'blue'),
        onClick: () => handleGetDirections(t),
        popupContent: (
          <div className="p-2 min-w-[190px] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                t.type === 'pickup' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {t.type}
              </span>
              <span className="font-mono text-xs font-bold">{t.order_number}</span>
            </div>
            <p className="text-xs font-bold text-gray-900">{t.customer_name}</p>
            <p className="text-[11px] text-gray-500 line-clamp-2">{t.address}</p>
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                handleGetDirections(t); 
              }}
              className="text-white bg-blue-600 hover:bg-blue-700 w-full py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 shadow-sm mt-1"
            >
              <Navigation className="w-3.5 h-3.5" /> Start Navigation
            </button>
          </div>
        )
      });
    });

  return (
    <div className={`space-y-4 flex flex-col transition-all duration-200 ${
      isMapExpanded 
        ? 'fixed inset-0 z-50 bg-white dark:bg-gray-950 p-2 sm:p-4 h-screen' 
        : 'h-[calc(100vh-100px)] min-h-[500px]'
    }`}>
      
      {/* Top Header / Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0 px-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Navigation className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
            Driver Navigation Map
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tasks.length} active assignments • Tap any stop or button to navigate
          </p>
        </div>

        {/* Task Filter Pills */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <button
            onClick={() => setTaskFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              taskFilter === 'all'
                ? 'bg-white dark:bg-gray-900 text-blue-600 shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            All ({tasks.length})
          </button>
          <button
            onClick={() => setTaskFilter('pickup')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              taskFilter === 'pickup'
                ? 'bg-white dark:bg-gray-900 text-orange-600 shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Pickups ({tasks.filter(t => t.type === 'pickup').length})
          </button>
          <button
            onClick={() => setTaskFilter('delivery')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              taskFilter === 'delivery'
                ? 'bg-white dark:bg-gray-900 text-blue-600 shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Deliveries ({tasks.filter(t => t.type === 'delivery').length})
          </button>
        </div>
      </div>

      {/* Location/Routing Error Banner */}
      {locationError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{locationError}</span>
          </div>
          <button 
            onClick={() => setLocationError(null)} 
            className="text-xs font-bold hover:underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Responsive Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0 relative">
        
        {/* MAP CONTAINER (Dominates screen on mobile & responsive viewports) */}
        <div className={`${
          isMapExpanded ? 'col-span-full' : 'lg:col-span-2'
        } bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 h-full relative overflow-hidden shadow-md flex flex-col min-h-[340px]`}>
          
          {/* Quick Floating Controls (Expand Fullscreen, Recenter Location, Refresh) */}
          <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2">
            <button
              onClick={toggleMapExpand}
              className="p-2.5 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md hover:bg-white dark:hover:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 transition-all flex items-center gap-1.5 text-xs font-bold"
              title={isMapExpanded ? 'Exit Full Screen' : 'Expand Full Screen'}
            >
              {isMapExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isMapExpanded ? 'Collapse' : 'Full Screen'}</span>
            </button>

            <button
              onClick={locateDriver}
              className="p-2.5 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md hover:bg-white dark:hover:bg-gray-900 text-blue-600 dark:text-blue-400 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 transition-all flex items-center gap-1 text-xs font-bold"
              title="Locate Current Position"
            >
              <Crosshair className="w-4 h-4" />
              <span className="hidden sm:inline">My GPS</span>
            </button>
          </div>

          {/* Active Navigation HUD Box (Floating on Top Right) */}
          {selectedTask && (
            <div className="absolute top-3 right-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-3.5 rounded-2xl shadow-xl border border-blue-200 dark:border-blue-900/60 z-[1000] max-w-[280px] sm:max-w-[320px] animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  selectedTask.type === 'pickup' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  Navigating {selectedTask.type}
                </span>
                <button
                  onClick={() => {
                    setSelectedTask(null);
                    setRouteCoordinates([]);
                    setRouteInfo(null);
                  }}
                  className="text-[11px] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium"
                >
                  Exit
                </button>
              </div>

              <div className="mt-2 space-y-1">
                <h4 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate">
                  {selectedTask.customer_name}
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                  {selectedTask.address}
                </p>
              </div>

              {/* Distance and ETA pill */}
              {routeInfo ? (
                <div className="grid grid-cols-2 gap-2 my-2.5 p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-center border border-blue-100 dark:border-blue-900/40">
                  <div>
                    <span className="text-[10px] text-gray-500 block">Distance</span>
                    <span className="text-xs font-black text-gray-900 dark:text-gray-100">{routeInfo.distance}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">Est. Time</span>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{routeInfo.duration}</span>
                  </div>
                </div>
              ) : isCalculatingRoute ? (
                <div className="my-2.5 py-2 text-center text-xs text-blue-600 flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Calculating route...</span>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <a 
                  href={`https://maps.google.com/?q=${selectedTask.latitude},${selectedTask.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="py-1.5 px-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Google Maps
                </a>
                <button
                  onClick={() => handleUpdateStatus(selectedTask.id, selectedTask.type, selectedTask.status)}
                  className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors shadow-sm"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{selectedTask.status === 'assigned' ? 'Start' : 'Complete'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Leaflet Map Renderer */}
          <div className="flex-1 w-full h-full min-h-[300px]">
            <MultiMapComponent 
              markers={markers} 
              height="100%" 
              showSearch={false} 
              routeCoordinates={routeCoordinates}
              onSearchSelect={(lat, lng) => setDriverLocation({lat, lng})}
            />
          </div>

          {/* Mobile Bottom Sheet Toggle bar */}
          <div className="lg:hidden shrink-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-2 flex items-center justify-between z-[1000] shadow-md">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                {filteredTasks.length} Assigned Stops
              </span>
            </div>
            <button
              onClick={() => setIsBottomSheetCollapsed(prev => !prev)}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30"
            >
              <span>{isBottomSheetCollapsed ? 'Show Task List' : 'Hide Task List'}</span>
              {isBottomSheetCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* TASK QUEUE PANEL (Collapsible on mobile, permanent column on desktop) */}
        {(!isMapExpanded || window.innerWidth >= 1024) && (
          <div className={`${
            isBottomSheetCollapsed ? 'hidden lg:flex' : 'flex'
          } flex-col h-full min-h-0 space-y-3 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm`}>
            
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h2 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100">
                  Assigned Stops
                </h2>
              </div>
              <button 
                onClick={fetchTasks}
                disabled={loading}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                title="Refresh stops"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-gray-500">
                Loading assignments...
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                No active {taskFilter !== 'all' ? taskFilter : ''} stops assigned.
              </div>
            ) : (
              <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                {filteredTasks.map(task => {
                  const isSelected = selectedTask?.id === task.id && selectedTask?.type === task.type;
                  const hasCoordinates = task.latitude && task.longitude;

                  return (
                    <div 
                      key={`${task.type}-${task.id}`} 
                      className={`rounded-xl border p-3 shadow-xs relative transition-all ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 ring-1 ring-blue-500' 
                          : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            task.type === 'pickup' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          }`}>
                            {task.type}
                          </span>
                          <span className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100">
                            {task.order_number}
                          </span>
                        </div>

                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          task.status.includes('on_the_way') || task.status.includes('out_for_delivery')
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                            : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {task.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs">
                        <p className="font-bold text-gray-900 dark:text-gray-100">{task.customer_name}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-start gap-1">
                          <MapPin className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{task.address}</span>
                        </p>
                        {task.customer_phone && (
                          <p className="text-[11px] text-gray-500 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <a href={`tel:${task.customer_phone}`} className="hover:underline text-blue-600 dark:text-blue-400 font-medium">
                              {task.customer_phone}
                            </a>
                          </p>
                        )}
                        {!hasCoordinates && (
                          <p className="text-[10px] text-red-500 font-semibold mt-1">
                            ⚠️ Customer coordinates unavailable
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                        <button 
                          onClick={() => handleGetDirections(task)}
                          disabled={isCalculatingRoute || !hasCoordinates}
                          className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-xs"
                        >
                          <Navigation className="w-3.5 h-3.5" /> 
                          {isCalculatingRoute && isSelected ? 'Routing...' : 'Navigate'}
                        </button>

                        <button 
                          onClick={() => handleUpdateStatus(task.id, task.type, task.status)}
                          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-xs"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> 
                          {task.status === 'assigned' ? 'Start Trip' : 'Mark Done'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
