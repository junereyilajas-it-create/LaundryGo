import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, Droplets, Lock } from 'lucide-react';
import api from '../../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [verifying, setVerifying] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setVerifying(false);
        setIsTokenValid(false);
        setErrorMessage('No password reset token provided. Please request a new reset link.');
        return;
      }

      try {
        const { data } = await api.get(`/auth/verify-reset-token?token=${token}`);
        if (data.valid) {
          setIsTokenValid(true);
          setTargetEmail(data.email || '');
        } else {
          setIsTokenValid(false);
          setErrorMessage(data.message || 'Invalid or expired password reset link.');
        }
      } catch (err: any) {
        setIsTokenValid(false);
        setErrorMessage(err.response?.data?.message || 'Invalid or expired reset token.');
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const isPasswordLengthValid = password.length >= 8;
  const doesPasswordMatch = confirmPassword.length > 0 && password === confirmPassword;

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
    setErrorMessage(null);

    if (!isPasswordLengthValid) {
      setPasswordTouched(true);
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (!doesPasswordMatch) {
      setConfirmTouched(true);
      setErrorMessage('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        password,
        confirm_password: confirmPassword
      });

      setSuccessMessage('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setSubmitting(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-surface-bright dark:bg-gray-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-sm text-gray-500">Verifying password reset security token...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-bright dark:bg-gray-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white shadow-md mb-3">
          <Droplets className="w-7 h-7" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
          Set New Password
        </h2>
        {targetEmail && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            For account: <span className="font-semibold text-gray-700 dark:text-gray-200">{targetEmail}</span>
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white dark:bg-gray-900 py-8 px-6 sm:px-10 shadow-xl rounded-2xl border border-gray-200 dark:border-gray-800">
          
          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {!isTokenValid ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-6">
                This reset link is either invalid, already used, or expired.
              </p>
              <Button
                variant="default"
                onClick={() => navigate('/login')}
                className="w-full"
              >
                Return to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="new-password" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    New Password
                  </Label>
                  {passwordTouched && (
                    <span className={`text-[11px] font-medium ${isPasswordLengthValid ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isPasswordLengthValid ? '≥ 8 characters' : 'Too short'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordTouched(true);
                    }}
                    disabled={submitting}
                    className={`rounded-lg h-10 pr-10 ${getPasswordBorderClass()}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-0 h-full px-3 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="confirm-password" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Confirm New Password
                  </Label>
                  {confirmTouched && confirmPassword.length > 0 && (
                    <span className={`text-[11px] font-medium ${doesPasswordMatch ? 'text-emerald-600' : 'text-red-500'}`}>
                      {doesPasswordMatch ? 'Passwords match' : 'Do not match'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setConfirmTouched(true);
                    }}
                    disabled={submitting}
                    className={`rounded-lg h-10 pr-10 ${getConfirmBorderClass()}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-0 top-0 h-full px-3 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating password...
                  </span>
                ) : (
                  'Reset Password'
                )}
              </Button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
