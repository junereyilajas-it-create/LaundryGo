import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, 
  Droplets, ArrowLeft, Truck, ShieldCheck 
} from 'lucide-react';
import api from '../../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Standard RFC email regex ensuring valid domain structure
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function Register() {
  const navigate = useNavigate();

  // Form Fields - All start completely empty
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'customer' | 'driver'>('customer');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Enforce empty fields on page load
  useEffect(() => {
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
  }, []);

  // Field Touched / Validated States
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Stage: 'idle' | 'registering' | 'success' | 'driver_pending' | 'failed'
  const [stage, setStage] = useState<'idle' | 'registering' | 'success' | 'driver_pending' | 'failed'>('idle');
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Real-time validations
  const isEmailValid = EMAIL_REGEX.test(email.trim().toLowerCase());
  const isPasswordLengthValid = password.length >= 8;
  const doesPasswordMatch = confirmPassword.length > 0 && password === confirmPassword;

  // Validation border classes
  const getEmailBorderClass = () => {
    if (!emailTouched && email.length === 0) return 'border-gray-200 dark:border-gray-700';
    return isEmailValid 
      ? 'border-emerald-500 ring-1 ring-emerald-500' 
      : 'border-red-500 ring-1 ring-red-500';
  };

  const getPasswordBorderClass = () => {
    if (!passwordTouched && password.length === 0) return 'border-gray-200 dark:border-gray-700';
    return isPasswordLengthValid 
      ? 'border-emerald-500 ring-1 ring-emerald-500' 
      : 'border-red-500 ring-1 ring-red-500';
  };

  const getConfirmBorderClass = () => {
    if (!confirmTouched && confirmPassword.length === 0) return 'border-gray-200 dark:border-gray-700';
    return doesPasswordMatch 
      ? 'border-emerald-500 ring-1 ring-emerald-500' 
      : 'border-red-500 ring-1 ring-red-500';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stage === 'registering') return; // Prevent duplicate submissions
    setGeneralError(null);

    // Validate fields before sending
    if (!name.trim()) {
      setGeneralError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !isEmailValid) {
      setEmailTouched(true);
      setGeneralError('Please enter a valid email address.');
      return;
    }
    if (!isPasswordLengthValid) {
      setPasswordTouched(true);
      setGeneralError('Password must be at least 8 characters long.');
      return;
    }
    if (!doesPasswordMatch) {
      setConfirmTouched(true);
      setGeneralError('Passwords do not match.');
      return;
    }
    if (!agreeTerms) {
      setGeneralError('Please agree to the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    // Step 1: Start loading animation sequence
    setStage('registering');
    const startTime = Date.now();

    try {
      const response = await api.post('/auth/register', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim(),
        role // Strictly customer or driver
      });

      // Requirement: Keep loading screen visible for approximately 2 seconds while processing
      const elapsed = Date.now() - startTime;
      const minDelay = 1800; // ~1.8 - 2.0 seconds
      if (elapsed < minDelay) {
        await new Promise((res) => setTimeout(res, minDelay - elapsed));
      }

      if (role === 'driver') {
        // Driver Registration: show pending administrator approval screen
        setStage('driver_pending');
      } else {
        // Customer Registration: Step 2: Show success screen for ~1 second, then navigate to login
        setStage('success');
        await new Promise((res) => setTimeout(res, 1000));
        navigate('/login');
      }
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      if (elapsed < 800) {
        await new Promise((res) => setTimeout(res, 800 - elapsed));
      }

      setStage('failed');

      // Check for duplicate email (409 Conflict) or specific duplicate key error
      if (err.response?.status === 409 || err.response?.data?.message?.toLowerCase().includes('already registered')) {
        setGeneralError('This email address is already registered. Please log in or use another email.');
      } else {
        setGeneralError(err.response?.data?.message || 'Registration failed. Please check your information and try again.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-surface-bright dark:bg-gray-950 flex flex-col justify-center py-6 sm:py-8 px-4 sm:px-6 lg:px-8 relative">
      
      {/* Back to Home Button */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Home</span>
        </button>
      </div>

      {/* Branded Loading & Success Screen Overlay */}
      <AnimatePresence>
        {(stage === 'registering' || stage === 'success') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4"
          >
            <div className="relative mb-5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-sky-400 flex items-center justify-center text-white shadow-xl shadow-blue-500/30">
                <Droplets className="w-8 h-8 sm:w-10 sm:h-10 animate-bounce" />
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Laundri<span className="text-blue-600 dark:text-blue-400">Go</span>
            </h2>

            {stage === 'registering' ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-base sm:text-lg">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating your account...
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Setting up your profile and security credentials
                </p>
              </div>
            ) : (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center gap-2 text-center"
              >
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-lg sm:text-xl">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  Account created successfully!
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Redirecting to the login screen...
                </p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Driver Pending Approval Modal */}
      <AnimatePresence>
        {stage === 'driver_pending' && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-7 border border-gray-200 dark:border-gray-800 shadow-2xl text-center space-y-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
                <Truck className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                  Driver Application Submitted
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1.5 leading-relaxed">
                  Your application has been received and is awaiting administrator approval.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-left text-xs space-y-1.5">
                <div className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Next Steps:</span>
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-[11px] leading-relaxed">
                  1. The Administrator will review your driver credentials.<br />
                  2. You will receive an SMS notification once approved.<br />
                  3. You can then log in to access the driver dashboard and deliveries.
                </p>
              </div>

              <Button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm"
              >
                Proceed to Login
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Registration Box */}
      <div className="w-full sm:max-w-2xl mx-auto">
        
        {/* Compact Header */}
        <div className="text-center mb-4 sm:mb-5">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 mb-2">
            <Droplets className="w-5 h-5" />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Create your account
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Join LaundriGo in Poblacion, Lagonglong
          </p>
        </div>

        {/* Compact Form Card */}
        <div className="bg-white dark:bg-gray-900 py-5 px-5 sm:px-8 shadow-xl rounded-2xl border border-gray-200 dark:border-gray-800">
          
          {generalError && (
            <motion.div 
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <span>{generalError}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-3.5">
            
            {/* ROW 1: Full Name & Phone Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <Label htmlFor="reg-name" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="reg-name"
                  name="name"
                  type="text"
                  autoComplete="off"
                  placeholder="e.g. Maria Santos"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (generalError) setGeneralError(null);
                  }}
                  disabled={stage === 'registering'}
                  className="rounded-lg h-9 text-xs sm:text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="reg-phone" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Phone Number (PH)
                </Label>
                <Input
                  id="reg-phone"
                  name="phone"
                  type="tel"
                  autoComplete="off"
                  placeholder="0912 345 6789"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (generalError) setGeneralError(null);
                  }}
                  disabled={stage === 'registering'}
                  className="rounded-lg h-9 text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* ROW 2: Email & Role Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label htmlFor="reg-email" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Email Address <span className="text-red-500">*</span>
                  </Label>
                  {emailTouched && (
                    <span className={`text-[10px] font-medium ${isEmailValid ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isEmailValid ? 'Valid' : 'Invalid'}
                    </span>
                  )}
                </div>
                <Input
                  id="reg-email"
                  name="email"
                  type="email"
                  autoComplete="off"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailTouched(true);
                    if (generalError) setGeneralError(null);
                  }}
                  disabled={stage === 'registering'}
                  className={`rounded-lg h-9 text-xs sm:text-sm transition-colors ${getEmailBorderClass()}`}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Registering As <span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-2 h-9">
                  <button
                    type="button"
                    onClick={() => setRole('customer')}
                    className={`h-full px-2.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 transition-all ${
                      role === 'customer'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shadow-sm'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <span>🧺</span>
                    <span>Customer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('driver')}
                    className={`h-full px-2.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 transition-all ${
                      role === 'driver'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shadow-sm'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <span>🚚</span>
                    <span>Driver</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ROW 3: Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label htmlFor="reg-password" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Password <span className="text-red-500">*</span>
                  </Label>
                  {passwordTouched && (
                    <span className={`text-[10px] font-medium ${isPasswordLengthValid ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isPasswordLengthValid ? '≥8 chars' : 'Too short'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="reg-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordTouched(true);
                      if (generalError) setGeneralError(null);
                    }}
                    disabled={stage === 'registering'}
                    className={`rounded-lg h-9 pr-9 text-xs sm:text-sm transition-colors ${getPasswordBorderClass()}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-0 h-full px-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label htmlFor="reg-confirm" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Confirm Password <span className="text-red-500">*</span>
                  </Label>
                  {confirmTouched && confirmPassword.length > 0 && (
                    <span className={`text-[10px] font-medium ${doesPasswordMatch ? 'text-emerald-600' : 'text-red-500'}`}>
                      {doesPasswordMatch ? 'Matches' : 'No match'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="reg-confirm"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setConfirmTouched(true);
                      if (generalError) setGeneralError(null);
                    }}
                    disabled={stage === 'registering'}
                    className={`rounded-lg h-9 pr-9 text-xs sm:text-sm transition-colors ${getConfirmBorderClass()}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-0 top-0 h-full px-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Terms and conditions */}
            <div className="flex items-center gap-2 pt-1">
              <input
                id="terms"
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => {
                  setAgreeTerms(e.target.checked);
                  if (generalError) setGeneralError(null);
                }}
                className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-700"
              />
              <label htmlFor="terms" className="text-[11px] text-gray-600 dark:text-gray-400 leading-tight">
                I agree to the <span className="text-blue-600 dark:text-blue-400 font-medium">Terms of Service</span> and <span className="text-blue-600 dark:text-blue-400 font-medium">Privacy Policy</span>.
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={stage === 'registering'}
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md shadow-blue-500/20 text-xs sm:text-sm mt-1"
            >
              {stage === 'registering' ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account...
                </span>
              ) : (
                role === 'driver' ? 'Submit Driver Application' : 'Register Account'
              )}
            </Button>
          </form>

          {/* Already have an account */}
          <div className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
            Already registered?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Sign in to your account
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
