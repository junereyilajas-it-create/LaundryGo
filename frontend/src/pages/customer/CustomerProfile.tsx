import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  User, MapPin, Phone, Mail, Lock, Plus, Trash2, 
  CheckCircle2, X, AlertCircle, Navigation, Star, Edit3 
} from 'lucide-react';
import MapComponent from '../../components/map/MapComponent';

interface Address {
  id: number;
  address: string;
  latitude: number | null;
  longitude: number | null;
  is_default?: boolean;
}

export default function CustomerProfile() {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({ name: '', email: '', phone: '', password: '' });
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  // Pin Location Modal State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationAddressInput, setLocationAddressInput] = useState('');
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [existingPinForEdit, setExistingPinForEdit] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (user) {
      setProfileData({ 
        name: user.name || '', 
        email: user.email || '', 
        phone: user.phone || '', 
        password: '' 
      });
    }
    fetchAddresses();
  }, [user]);

  const fetchAddresses = async () => {
    try {
      const { data } = await api.get('/addresses');
      setAddresses(data || []);
    } catch (error) {
      console.error('Error fetching addresses:', error);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const payload: any = { name: profileData.name, phone: profileData.phone };
      if (profileData.password) payload.password = profileData.password;
      
      const res = await api.put('/users/profile/update', payload);
      setMessage({ type: 'success', text: 'Profile details saved successfully!' });
      setProfileData(prev => ({ ...prev, password: '' }));
      if (setUser && res.data?.user) {
        setUser((prev: any) => ({ ...prev, ...res.data.user }));
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update profile details' });
    } finally {
      setLoading(false);
    }
  };

  // Open modal for a fresh pin (no pre-selected marker)
  const handleOpenPinModal = (editAddr?: Address) => {
    setModalError(null);
    if (editAddr && editAddr.latitude && editAddr.longitude) {
      // Deliberately loading an existing location for editing
      const coords = { lat: Number(editAddr.latitude), lng: Number(editAddr.longitude) };
      setSelectedCoords(coords);
      setExistingPinForEdit([coords.lat, coords.lng]);
      setLocationAddressInput(editAddr.address || '');
    } else {
      // CRITICAL: Initially no selected marker when opened for new location
      setSelectedCoords(null);
      setExistingPinForEdit(null);
      setLocationAddressInput('');
    }
    setIsPinModalOpen(true);
  };

  const handleLocationSelectedOnMap = (lat: number, lng: number, address?: string) => {
    setSelectedCoords({ lat, lng });
    setModalError(null);
    if (address && !locationAddressInput) {
      setLocationAddressInput(address);
    }
  };

  const handleConfirmLocationSave = async () => {
    if (!selectedCoords) {
      setModalError('Please select a point on the map by clicking or using "Use My Current Location".');
      return;
    }

    if (!locationAddressInput.trim()) {
      setModalError('Please enter a descriptive address name or landmark.');
      return;
    }

    setIsSavingLocation(true);
    setModalError(null);

    try {
      // Persist to user's profile and address list via backend endpoint
      const payload = {
        address: locationAddressInput.trim(),
        latitude: selectedCoords.lat,
        longitude: selectedCoords.lng
      };

      const res = await api.put('/users/profile/location', payload);

      // Update AuthContext user with default location if available
      if (setUser) {
        setUser((prev: any) => ({
          ...prev,
          default_address: payload.address,
          latitude: payload.latitude,
          longitude: payload.longitude
        }));
      }

      await fetchAddresses();
      setIsPinModalOpen(false);
      setMessage({
        type: 'success',
        text: `Pickup location confirmed and saved as default: "${payload.address}"`
      });
    } catch (err: any) {
      console.error('Error saving confirmed location:', err);
      // Keep modal open so customer can retry
      setModalError(err?.response?.data?.message || 'Failed to save location. Please check your connection and retry.');
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleDeleteAddress = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this saved location?')) return;
    try {
      await api.delete(`/addresses/${id}`);
      fetchAddresses();
      setMessage({ type: 'success', text: 'Saved address removed.' });
    } catch (error) {
      alert('Failed to delete address');
    }
  };

  const handleSetDefaultAddress = async (addr: Address) => {
    if (!addr.latitude || !addr.longitude) return;
    try {
      await api.put('/users/profile/location', {
        address: addr.address,
        latitude: addr.latitude,
        longitude: addr.longitude
      });
      if (setUser) {
        setUser((prev: any) => ({
          ...prev,
          default_address: addr.address,
          latitude: addr.latitude,
          longitude: addr.longitude
        }));
      }
      setMessage({ type: 'success', text: `Set "${addr.address}" as default pickup location.` });
    } catch (e) {
      alert('Failed to set default location.');
    }
  };

  const hasDefaultLocation = Boolean(user?.default_address && user?.latitude && user?.longitude);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          My Profile & Locations
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Manage your account info and confirm your exact GPS pickup location for fast laundry service
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-sm flex items-center justify-between border ${
          message.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
            : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
          <button 
            onClick={() => setMessage(null)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        
        {/* Personal Details Form */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Personal Details
          </h2>

          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                Full Name
              </label>
              <input 
                required 
                type="text" 
                value={profileData.name} 
                onChange={(e) => setProfileData({...profileData, name: e.target.value})} 
                className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-colors" 
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                Email Address
              </label>
              <input 
                disabled 
                type="email" 
                value={profileData.email} 
                className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-100 dark:bg-gray-800/60 text-gray-500 cursor-not-allowed text-sm" 
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                Phone Number (for SMS & Driver Contact)
              </label>
              <input 
                type="text" 
                value={profileData.phone} 
                onChange={(e) => setProfileData({...profileData, phone: e.target.value})} 
                placeholder="09171234567"
                className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-colors" 
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                New Password (Optional)
              </label>
              <input 
                type="password" 
                value={profileData.password} 
                onChange={(e) => setProfileData({...profileData, password: e.target.value})} 
                placeholder="Leave blank to keep current" 
                className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-colors" 
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-xs font-bold disabled:opacity-50 shadow-md shadow-blue-500/20"
            >
              {loading ? 'Saving Changes...' : 'Save Profile Details'}
            </button>
          </form>
        </div>

        {/* Saved Pickup Locations Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-red-500" />
                Pickup Locations
              </h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Pin your exact house or shop location so drivers can easily locate you during pickups.
            </p>

            {/* Default Confirmed Location Highlight */}
            {hasDefaultLocation ? (
              <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                    <Star className="w-3.5 h-3.5 fill-blue-600 text-blue-600" />
                    Default Pickup Location
                  </span>
                  <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                    {Number(user?.latitude).toFixed(4)}, {Number(user?.longitude).toFixed(4)}
                  </span>
                </div>
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  {user?.default_address}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Automatically pre-filled when you request laundry service.
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>No confirmed default pickup location yet. Click the button below to pin your address on the map.</span>
              </div>
            )}

            {/* Action Button: Pin Location on Map */}
            <button 
              type="button" 
              onClick={() => handleOpenPinModal()}
              className="w-full py-3 px-4 border-2 border-dashed border-blue-400 dark:border-blue-600/70 hover:border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all font-bold text-xs flex items-center justify-center gap-2 shadow-xs"
            >
              <MapPin className="w-4 h-4" />
              <span>Pin Location on Map</span>
            </button>
          </div>

          {/* List of Other Saved Locations */}
          <div className="space-y-2.5 pt-3 border-t border-gray-100 dark:border-gray-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Saved Addresses ({addresses.length})
            </h3>
            
            {addresses.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-4">No additional addresses saved.</p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {addresses.map(addr => {
                  const isCurrentDefault = user?.default_address === addr.address;
                  return (
                    <div 
                      key={addr.id} 
                      className={`flex justify-between items-start p-3 border rounded-xl transition-all ${
                        isCurrentDefault 
                          ? 'border-blue-300 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/20'
                          : 'border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-gray-900 dark:text-gray-100 leading-snug">
                            {addr.address}
                          </p>
                          {isCurrentDefault && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold">
                              Default
                            </span>
                          )}
                        </div>
                        {addr.latitude && addr.longitude && (
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                            GPS: {parseFloat(addr.latitude.toString()).toFixed(4)}, {parseFloat(addr.longitude.toString()).toFixed(4)}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {!isCurrentDefault && addr.latitude && addr.longitude && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultAddress(addr)}
                            className="p-1.5 text-xs text-gray-500 hover:text-blue-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="Set as Default"
                          >
                            <Star className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenPinModal(addr)}
                          className="p-1.5 text-xs text-gray-500 hover:text-blue-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="Edit Pin on Map"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDeleteAddress(addr.id)} 
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PIN LOCATION ON MAP MODAL */}
      {isPinModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div 
            className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col space-y-4 max-h-[94vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-900/40 text-red-600 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                    Pin Your Pickup Location
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Tap or click anywhere on the map to drop a pin, or use your phone's GPS.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPinModalOpen(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Error Alert */}
            {modalError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Map Component (Respects no-default-marker rule) */}
            <div className="space-y-2">
              <MapComponent 
                initialPosition={existingPinForEdit}
                onLocationSelect={handleLocationSelectedOnMap}
                height="380px"
              />
            </div>

            {/* Selected Location Indicator Card */}
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-red-500" />
                  Confirmed Coordinates:
                </span>
                {selectedCoords ? (
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                    {selectedCoords.lat.toFixed(6)}, {selectedCoords.lng.toFixed(6)}
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                    ⚠️ No pin placed yet
                  </span>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                  Address Details / Landmark:
                </label>
                <input 
                  type="text"
                  placeholder="e.g. Poblacion, Zone 2, House #15 near Catholic Church..."
                  value={locationAddressInput}
                  onChange={(e) => setLocationAddressInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setIsPinModalOpen(false);
                  setSelectedCoords(null);
                  setLocationAddressInput('');
                }}
                disabled={isSavingLocation}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmLocationSave}
                disabled={!selectedCoords || isSavingLocation}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSavingLocation ? 'Saving Location...' : 'Confirm Location'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
