import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { User, Phone, Mail, Lock } from 'lucide-react';

export default function DriverProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({ name: '', email: '', phone: '', password: '' });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (user) {
      setProfileData({ name: user.name, email: user.email, phone: user.phone || '', password: '' });
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setLoading(true);
    try {
      const payload: any = { name: profileData.name, phone: profileData.phone };
      if (profileData.password) payload.password = profileData.password;
      
      await api.put('/users/profile/update', payload);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setProfileData({ ...profileData, password: '' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          My Profile
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage your personal information</p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Personal Details</h2>
        
        {message.text && (
          <div className={`p-3 rounded-lg text-sm mb-4 border ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <User className="h-4 w-4" /> Name
            </label>
            <input required type="text" value={profileData.name} onChange={(e) => setProfileData({...profileData, name: e.target.value})} className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors" />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Mail className="h-4 w-4" /> Email
            </label>
            <input disabled type="email" value={profileData.email} className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-not-allowed" />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Phone className="h-4 w-4" /> Phone
            </label>
            <input type="text" value={profileData.phone} onChange={(e) => setProfileData({...profileData, phone: e.target.value})} className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors" />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Lock className="h-4 w-4" /> New Password (optional)
            </label>
            <input type="password" value={profileData.password} onChange={(e) => setProfileData({...profileData, password: e.target.value})} placeholder="Leave blank to keep current" className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors" />
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 mt-2">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
