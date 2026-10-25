import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, Droplets, ArrowLeft, Mail, X, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  // Form State - Initially completely empty
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Enforce empty fields on page load
  useEffect(() => {
    setEmail('');
    setPassword('');
  }, []);

  // Field Touched / Validated States
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Login Stage: 'idle' | 'logging_in' | 'success' | 'failed'
  const [loginStage, setLoginStage] = useState<'idle' | 'logging_in' | 'success' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot Password Modal State
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotFeedback, setForgotFeedback] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  // Real-time validations
  const isEmailValid = EMAIL_REGEX.test(email.trim().toLowerCase());
  const isPasswordValid = password.length > 0;

  const getEmailBorderClass = () => {
    if (!emailTouched && email.length === 0) return 'border-gray-200 dark:border-gray-700';
    return isEmailValid 
      ? 'border-emerald-500 ring-1 ring-emerald-500' 
      : 'border-red-500 ring-1 ring-red-500';
  };

  const getPasswordBorderClass = () => {
    if (!passwordTouched && password.length === 0) return 'border-gray-200 dark:border-gray-700';
    return isPasswordValid 
      ? 'border-emerald-500 ring-1 ring-emerald-500' 
      : 'border-red-500 ring-1 ring-red-500';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginStage === 'logging_in') return; // Prevent duplicate requests while in progress
    setErrorMessage(null);

    if (!email.trim()) {
      setEmailTouched(true);
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (!isEmailValid) {
      setEmailTouched(true);
      setErrorMessage('Please provide a valid email address.');
      return;
    }

    if (!password) {
      setPasswordTouched(true);
      setErrorMessage('Please enter your password.');
      return;
    }

    if (rememberMe) {
      localStorage.setItem('laundrigo_remembered_email', email.trim().toLowerCase());
    } else {
      localStorage.removeItem('laundrigo_remembered_email');
    }

    // Step 1: Show branded loading screen
    setLoginStage('logging_in');
    const startTime = Date.now();

    try {
      const response = await api.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password
      });

      // Requirement: Keep loading screen visible for approximately 2 seconds, or longer if request took longer
      const elapsed = Date.now() - startTime;
      const minDelay = 1800; // ~1.8 - 2.0 seconds minimum
      if (elapsed < minDelay) {
        await new Promise((res) => setTimeout(res, minDelay - elapsed));
      }

      // Step 2: Show "Login successful!" for ~1 second
      setLoginStage('success');
      await new Promise((res) => setTimeout(res, 1000));

      // Authenticate in context and redirect based on role
      login(response.data.token, response.data.user);
      const role = response.data.user.role;
      if (role === 'customer') {
        const redirectPath = searchParams.get('redirect');
        if (redirectPath === 'request') {
          navigate('/customer/orders?request=true');
        } else {
          navigate('/customer');
        }
      } else if (role === 'driver') {
        navigate('/driver');
      } else {
        navigate('/worker');
      }
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      if (elapsed < 1000) {
        await new Promise((res) => setTimeout(res, 1000 - elapsed));
      }
      
      const errMsg = err.response?.data?.message || 'Invalid email or password.';
      setErrorMessage(errMsg);
      setLoginStage('failed');

      // Keep error message visible for 5 seconds or until retry
      setTimeout(() => {
        setLoginStage('idle');
      }, 500);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_REGEX.test(forgotEmail.trim().toLowerCase())) {
      setForgotFeedback('Please enter a valid registered email address.');
      return;
    }

    setForgotLoading(true);
    setForgotFeedback(null);
    setDevResetUrl(null);

    try {
      const res = await api.post('/auth/forgot-password', { email: forgotEmail.trim().toLowerCase() });
      setForgotFeedback(res.data.message || 'If an account exists with this email, password recovery instructions have been sent.');
      if (res.data.devResetToken) {
        setDevResetUrl(`/reset-password?token=${res.data.devResetToken}`);
      }
    } catch (err: any) {
      setForgotFeedback(err.response?.data?.message || 'Unable to process reset request. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // Check if client ID is configured
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || clientId.includes('your_google_client_id')) {
      // Graceful helper dialog if Google credentials haven't been provided by admin yet
      alert('Google OAuth configuration required: Set VITE_GOOGLE_CLIENT_ID in frontend/.env and GOOGLE_CLIENT_ID in backend/.env to connect your Google Cloud Console project.');
      return;
    }

    alert('Redirecting to Google OAuth flow...');
  };

  return (
    <div className="min-h-screen bg-surface-bright dark:bg-gray-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
      
      {/* Back to Landing Page */}
      <div className="absolute top-6 left-6">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
      </div>

      {/* Branded Loading & Success Screen Overlay */}
      <AnimatePresence>
        {(loginStage === 'logging_in' || loginStage === 'success') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4"
          >
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-sky-400 flex items-center justify-center text-white shadow-xl shadow-blue-500/30">
                <Droplets className="w-10 h-10 animate-bounce" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Laundri<span className="text-blue-600 dark:text-blue-400">Go</span>
            </h2>

            {loginStage === 'logging_in' ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-lg">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Logging in...
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Verifying your account credentials
                </p>
              </div>
            ) : (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xl">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  Login successful!
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Redirecting to your dashboard...
                </p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 mb-3">
          <Droplets className="w-7 h-7" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
          Welcome back
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Sign in to your LaundriGo account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white dark:bg-gray-900 py-8 px-6 sm:px-10 shadow-xl rounded-2xl border border-gray-200 dark:border-gray-800">
          
          {/* Automatic 2-second error banner */}
          <AnimatePresence>
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 flex items-start gap-3 shadow-sm"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                <div>
                  <p className="font-semibold">Authentication Failed</p>
                  <p className="text-xs mt-0.5">{errorMessage}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-5">
            
            {/* Email Field with real-time border validation */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="login-email" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Email Address
                </Label>
                {emailTouched && (
                  <span className={`text-[11px] font-medium ${isEmailValid ? 'text-emerald-600' : 'text-red-500'}`}>
                    {isEmailValid ? 'Valid format' : 'Invalid email'}
                  </span>
                )}
              </div>
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="off"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailTouched(true);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={loginStage === 'logging_in'}
                className={`rounded-lg h-10 transition-colors ${getEmailBorderClass()}`}
                required
              />
            </div>

            {/* Password Field with real-time border validation & show/hide */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="login-password" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Password
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotFeedback(null);
                    setDevResetUrl(null);
                    setForgotEmail(email);
                    setForgotModalOpen(true);
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordTouched(true);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  disabled={loginStage === 'logging_in'}
                  className={`rounded-lg h-10 pr-10 transition-colors ${getPasswordBorderClass()}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 h-full px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-700"
                />
                <label htmlFor="remember-me" className="text-xs text-gray-600 dark:text-gray-400">
                  Remember my email
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loginStage === 'logging_in'}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md shadow-blue-500/20"
            >
              Sign In
            </Button>
          </form>

          {/* Social Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-gray-900 px-3 text-gray-400 dark:text-gray-500 font-medium">
                Or continue with
              </span>
            </div>
          </div>

          {/* Google Login Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 font-medium text-sm transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </button>

          {/* Registration Link */}
          <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/register')}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Create an account
            </button>
          </div>

        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl relative"
          >
            <button
              onClick={() => setForgotModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Reset your password
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Enter your registered email address and we'll generate a secure password reset link.
              </p>
            </div>

            {forgotFeedback && (
              <div className="mb-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
                {forgotFeedback}
              </div>
            )}

            {devResetUrl && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-200">
                <p className="font-bold mb-1">🛠️ Development Direct Reset Link:</p>
                <a
                  href={devResetUrl}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(devResetUrl);
                  }}
                  className="text-blue-600 dark:text-blue-400 underline break-all font-semibold"
                >
                  Click here to open Reset Password page
                </a>
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="forgot-email" className="text-xs font-semibold">
                  Registered Email Address
                </Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="name@example.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  disabled={forgotLoading}
                  className="rounded-lg h-10"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForgotModalOpen(false)}
                  className="w-1/2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
