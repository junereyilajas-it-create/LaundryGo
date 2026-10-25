import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import MapComponent from '../../components/map/MapComponent';
import { Card, CardHeader, CardTitle, Input, Label, Button } from '../../components/ui';
import { PlusCircle, MapPin, Info, AlertTriangle, Layers, CheckCircle2 } from 'lucide-react';
import { calculateLaundryPricing, type PricingResult } from '../../lib/pricingCalculator';

interface Address {
  id: number;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

export default function RequestService() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    service_type: 'PICKUP',
    estimated_weight: '',
    preferred_date: '',
    preferred_time: 'Afternoon',
    special_instructions: '',
    payment_method: 'CASH',
  });
  
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('new');
  const [location, setLocation] = useState<{lat: number, lng: number, address: string} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState<any>(null);

  const [addressDetails, setAddressDetails] = useState({
    house_street: '',
    barangay: 'Poblacion',
    municipality: 'Lagonglong',
    province: 'Misamis Oriental',
    postal_code: '9006'
  });

  const pricing: PricingResult = calculateLaundryPricing(formData.estimated_weight);

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      const { data } = await api.get('/addresses');
      setSavedAddresses(data || []);
      if (data && data.length > 0) {
        setSelectedAddressId(data[0].id.toString());
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
    }
  };

  const isOutsideServiceArea = (barangay: string, municipality: string) => {
    return barangay.toLowerCase() !== 'poblacion' || municipality.toLowerCase() !== 'lagonglong';
  };

  const isCurrentlyOutside = selectedAddressId === 'new' 
    ? isOutsideServiceArea(addressDetails.barangay, addressDetails.municipality)
    : (() => {
        const addr = savedAddresses.find(a => a.id.toString() === selectedAddressId);
        if (!addr) return false;
        return !addr.address.toLowerCase().includes('poblacion') || !addr.address.toLowerCase().includes('lagonglong');
      })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let addressId = selectedAddressId === 'new' ? null : parseInt(selectedAddressId);
      let fullAddress = '';
      let lat: number | null = null;
      let lng: number | null = null;
      
      if (selectedAddressId === 'new') {
        if (!location) {
          alert('Please select and pin a location on the map.');
          setIsSubmitting(false);
          return;
        }
        
        fullAddress = `${addressDetails.house_street}, Brgy. ${addressDetails.barangay}, ${addressDetails.municipality}, ${addressDetails.province} ${addressDetails.postal_code}`;
        lat = location.lat;
        lng = location.lng;
        
        const addressRes = await api.post('/addresses', {
          address: fullAddress,
          latitude: location.lat,
          longitude: location.lng
        });
        addressId = addressRes.data.id;
      } else {
        const selected = savedAddresses.find(a => a.id.toString() === selectedAddressId);
        if (selected) {
          fullAddress = selected.address;
          lat = selected.latitude;
          lng = selected.longitude;
        }
      }

      const res = await api.post('/orders', {
        ...formData,
        estimated_weight: pricing.measuredWeight,
        load_count: pricing.loadCount,
        load_details: JSON.stringify(pricing.loads),
        total_amount: pricing.totalAmount,
        estimated_amount: pricing.totalAmount,
        address_id: addressId,
        pickup_address_text: fullAddress,
        delivery_address_text: fullAddress,
        pickup_latitude: lat,
        pickup_longitude: lng,
        delivery_latitude: lat,
        delivery_longitude: lng
      });

      setSuccessOrder(res.data);
      setTimeout(() => {
        navigate('/customer/dashboard');
      }, 2400);
    } catch (error) {
      console.error('Error submitting request', error);
      alert('Error submitting request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-[800px] mx-auto pb-xl space-y-lg">
      <div>
        <h1 className="font-h1 text-h1 text-primary dark:text-primary-fixed-dim">Request Service</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Schedule a new laundry pickup or drop-off</p>
      </div>
      
      <Card>
        <CardHeader className="border-b border-outline-variant/10 dark:border-outline/10">
          <CardTitle className="flex items-center gap-sm">
            <PlusCircle className="w-5 h-5 text-primary" />
            Service Details
          </CardTitle>
        </CardHeader>
        
        <form onSubmit={handleSubmit} className="p-lg space-y-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div className="space-y-sm">
              <Label htmlFor="service_type">Service Type</Label>
              <div className="relative">
                <select
                  id="service_type"
                  className="w-full px-md py-sm bg-white dark:bg-surface-container-highest border border-outline-variant/50 rounded-lg focus:ring-2 focus:ring-surface-variant focus:border-primary outline-none transition-all font-body-md text-body-md text-on-surface appearance-none"
                  value={formData.service_type}
                  onChange={(e) => setFormData({...formData, service_type: e.target.value})}
                >
                  <option value="PICKUP">Shop Pickup</option>
                  <option value="DROP_OFF">Customer Drop-off</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-md text-outline">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            </div>
            
            <div className="space-y-sm">
              <div className="flex justify-between items-center">
                <Label htmlFor="estimated_weight">Estimated Weight (kg)</Label>
                <span className="text-xs text-blue-600 font-bold">
                  {pricing.loadCount} Load{pricing.loadCount > 1 ? 's' : ''} (Est: ₱{pricing.totalAmount.toFixed(2)})
                </span>
              </div>
              <Input
                id="estimated_weight"
                type="number"
                step="0.5"
                placeholder="e.g. 14.0"
                value={formData.estimated_weight}
                onChange={(e) => setFormData({...formData, estimated_weight: e.target.value})}
              />

              {/* Load Breakdown Card */}
              {pricing.measuredWeight > 0 && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-1.5 text-xs">
                  <div className="flex justify-between font-bold text-gray-800 dark:text-gray-200">
                    <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5 text-blue-600" /> Package Distribution:</span>
                    <span className="text-blue-600">Total: ₱{pricing.totalAmount.toFixed(2)}</span>
                  </div>
                  {pricing.loads.map(l => (
                    <div key={l.loadNumber} className="flex justify-between text-[11px] text-gray-600 dark:text-gray-400">
                      <span>Load {l.loadNumber} ({l.price === 180 ? 'Up to 8 kg' : 'Up to 6 kg'}):</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">₱{l.price.toFixed(2)}</span>
                    </div>
                  ))}
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 pt-1 border-t border-gray-200 dark:border-gray-700">
                    Official price confirmed after worker weighing.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-sm">
              <Label htmlFor="preferred_date">Preferred Date</Label>
              <Input
                id="preferred_date"
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={formData.preferred_date}
                onChange={(e) => setFormData({...formData, preferred_date: e.target.value})}
              />
            </div>

            <div className="space-y-sm">
              <Label htmlFor="preferred_time">Preferred Time</Label>
              <div className="relative">
                <select
                  id="preferred_time"
                  className="w-full px-md py-sm bg-white dark:bg-surface-container-highest border border-outline-variant/50 rounded-lg focus:ring-2 focus:ring-surface-variant focus:border-primary outline-none transition-all font-body-md text-body-md text-on-surface appearance-none"
                  value={formData.preferred_time}
                  onChange={(e) => setFormData({...formData, preferred_time: e.target.value})}
                >
                  <option value="Morning">Morning (8AM - 12PM)</option>
                  <option value="Afternoon">Afternoon (1PM - 5PM)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-md text-outline">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-sm border-t border-outline-variant/10 pt-lg">
            <div className="flex items-center gap-xs">
              <MapPin className="w-5 h-5 text-primary" />
              <Label className="mb-0 text-lg">Location Details</Label>
            </div>
            
            <div className="mb-4">
              <select
                className="w-full px-md py-sm bg-white dark:bg-surface-container-highest border border-outline-variant/50 rounded-lg focus:ring-2 focus:ring-surface-variant focus:border-primary outline-none transition-all font-body-md text-body-md text-on-surface appearance-none"
                value={selectedAddressId}
                onChange={(e) => setSelectedAddressId(e.target.value)}
              >
                {savedAddresses.map(addr => (
                  <option key={addr.id} value={addr.id}>
                    {addr.address} {addr.latitude ? '(Mapped)' : '(No GIS Data)'}
                  </option>
                ))}
                <option value="new">+ Pin New Location on Map</option>
              </select>
            </div>

            {selectedAddressId === 'new' && (
              <div className="space-y-md bg-surface-container-lowest p-md rounded-xl border border-outline-variant/20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                  <div className="space-y-xs">
                    <Label>House/Street/Purok</Label>
                    <Input 
                      required
                      placeholder="Enter street or purok"
                      value={addressDetails.house_street}
                      onChange={e => setAddressDetails({...addressDetails, house_street: e.target.value})}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>Barangay</Label>
                    <Input 
                      required
                      value={addressDetails.barangay}
                      onChange={e => setAddressDetails({...addressDetails, barangay: e.target.value})}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>Municipality</Label>
                    <Input 
                      required
                      value={addressDetails.municipality}
                      onChange={e => setAddressDetails({...addressDetails, municipality: e.target.value})}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>Province</Label>
                    <Input 
                      required
                      value={addressDetails.province}
                      onChange={e => setAddressDetails({...addressDetails, province: e.target.value})}
                    />
                  </div>
                </div>

                <div className="rounded-xl overflow-hidden border border-outline-variant/30 shadow-sm relative z-0 h-[300px] mt-md">
                  <MapComponent onLocationSelect={(lat, lng, address) => setLocation({lat, lng, address: address || 'Selected on map'})} />
                </div>
                
                <div className="flex items-start gap-sm mt-xs bg-surface-container-low p-sm rounded-lg">
                  <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="font-body-sm text-on-surface-variant">Search for an address or click on the map to pin your GIS location for pickup/delivery.</p>
                </div>
                
                {location && (
                  <div className="p-sm bg-primary-fixed/20 border border-primary-fixed rounded-lg mt-sm">
                    <p className="font-body-sm text-on-surface break-words">
                      <span className="font-semibold mr-2">GIS Coordinates:</span>
                      {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {isCurrentlyOutside && (
              <div className="flex items-start gap-sm p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 rounded-r-lg mt-4">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-yellow-800 dark:text-yellow-400">Outside Service Area</h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-500 mt-1">Customer location is outside the default LaundryGo service area (Poblacion, Lagonglong). Order will require admin approval.</p>
                </div>
              </div>
            )}
            {!isCurrentlyOutside && selectedAddressId !== 'new' && (
                <div className="flex items-start gap-sm p-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded-r-lg mt-4">
                <Info className="w-5 h-5 text-green-600 dark:text-green-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-green-800 dark:text-green-400">Within Service Area</h4>
                  <p className="text-sm text-green-700 dark:text-green-500 mt-1">Location is within the default LaundryGo service area.</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-sm">
            <Label htmlFor="special_instructions">Special Instructions</Label>
            <textarea
              id="special_instructions"
              rows={3}
              placeholder="E.g., Please use hypoallergenic detergent..."
              className="w-full px-md py-sm bg-white dark:bg-surface-container-highest border border-outline-variant/50 rounded-lg focus:ring-2 focus:ring-surface-variant focus:border-primary outline-none transition-all font-body-md text-body-md text-on-surface placeholder:text-outline/60 resize-none"
              value={formData.special_instructions}
              onChange={(e) => setFormData({...formData, special_instructions: e.target.value})}
            />
          </div>

          <div className="flex items-center justify-end gap-md pt-lg border-t border-outline-variant/10 dark:border-outline/10">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/customer')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
