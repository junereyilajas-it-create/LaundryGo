import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import MapComponent from '../../components/map/MapComponent';
import { Card, CardHeader, CardTitle, Input, Label, Button } from '../../components/ui';
import { PlusCircle, MapPin, Info } from 'lucide-react';

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
  
  const [location, setLocation] = useState<{lat: number, lng: number, address: string} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let addressId = null;
      if (location) {
        const addressRes = await api.post('/addresses', {
          address: location.address || 'Selected on map',
          latitude: location.lat,
          longitude: location.lng
        });
        addressId = addressRes.data.id;
      }

      await api.post('/orders', {
        ...formData,
        estimated_weight: parseFloat(formData.estimated_weight) || 0,
        address_id: addressId
      });
      navigate('/customer');
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
              <Label htmlFor="estimated_weight">Estimated Weight (kg)</Label>
              <Input
                id="estimated_weight"
                type="number"
                step="0.1"
                placeholder="e.g. 5.5"
                value={formData.estimated_weight}
                onChange={(e) => setFormData({...formData, estimated_weight: e.target.value})}
              />
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

          <div className="space-y-sm">
            <div className="flex items-center gap-xs">
              <MapPin className="w-5 h-5 text-primary" />
              <Label className="mb-0">Location</Label>
            </div>
            <div className="rounded-xl overflow-hidden border border-outline-variant/30 shadow-sm relative z-0 h-[300px]">
              <MapComponent onLocationSelect={(lat, lng, address) => setLocation({lat, lng, address: address || 'Selected on map'})} />
            </div>
            
            <div className="flex items-start gap-sm mt-xs bg-surface-container-low p-sm rounded-lg">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="font-body-sm text-on-surface-variant">Search for an address or click on the map to pin your location.</p>
            </div>
            
            {location && location.address && (
              <div className="p-sm bg-primary-fixed/20 border border-primary-fixed rounded-lg mt-sm">
                <p className="font-body-sm text-on-surface break-words">
                  <span className="font-semibold mr-2">Selected Address:</span>
                  {location.address}
                </p>
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
