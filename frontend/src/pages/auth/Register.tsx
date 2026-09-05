import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import api from '../../services/api';
import { AuthCard, AuthError } from '../../components/auth/AuthCard';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";

const signUpSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  role: z.enum(["customer", "worker", "driver"]),
  password: z.string().min(8, "Password must be at least 8 characters"),
  terms: z.boolean().refine(val => val === true, "You must agree to the terms"),
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

export default function Register() {
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const navigate = useNavigate();

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", phone: "", role: "customer", password: "", terms: false as any },
  });

  const terms = watch("terms");

  const onSubmit = async (data: SignUpFormValues) => {
    setError(null);
    try {
      await api.post('/auth/register', { 
        name: data.name, 
        email: data.email, 
        password: data.password,
        phone: data.phone,
        role: data.role
      });
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Email already registered or registration failed.');
    }
  };

  return (
    <div className="bg-background min-h-screen flex items-center justify-center relative overflow-hidden w-full p-4 py-12">
      <AuthCard>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="p-8"
        >
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold text-primary">Create account</h1>
            <p className="mt-2 text-sm text-secondary">Get started with your account</p>
          </div>

          <AuthError message={error} />

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  disabled={isSubmitting}
                  className={errors.name ? "border-error" : ""}
                  {...register("name")}
                />
                {errors.name && <p className="text-xs text-error">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  disabled={isSubmitting}
                  className={errors.email ? "border-error" : ""}
                  {...register("email")}
                />
                {errors.email && <p className="text-xs text-error">{errors.email.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  disabled={isSubmitting}
                  className={errors.phone ? "border-error" : ""}
                  {...register("phone")}
                />
                {errors.phone && <p className="text-xs text-error">{errors.phone.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Account Role</Label>
                <select
                  id="role"
                  disabled={isSubmitting}
                  className="flex h-10 w-full rounded-md border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                  {...register("role")}
                >
                  <option value="customer">Customer</option>
                  <option value="worker">Worker/Admin</option>
                  <option value="driver">Driver</option>
                </select>
                {errors.role && <p className="text-xs text-error">{errors.role.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className={errors.password ? "border-error pr-10" : "pr-10"}
                  {...register("password")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {errors.password && <p className="text-xs text-error">{errors.password.message}</p>}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="terms"
                checked={terms === true}
                onCheckedChange={(checked) => setValue("terms", checked === true, { shouldValidate: true })}
                disabled={isSubmitting}
              />
              <div className="space-y-1">
                <Label htmlFor="terms" className="text-sm font-normal text-secondary">
                  I agree to the{" "}
                  <Button type="button" variant="link" className="h-auto p-0 text-primary h-auto inline">
                    Terms
                  </Button>{" "}
                  and{" "}
                  <Button type="button" variant="link" className="h-auto p-0 text-primary h-auto inline">
                    Privacy Policy
                  </Button>
                </Label>
              </div>
            </div>
            {errors.terms && <p className="text-xs text-error block -mt-4">{errors.terms.message}</p>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <div className="relative mt-6">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-surface-container-low px-2 text-secondary">Or continue with</span>
            </div>
          </div>
          
          <div className="w-full mt-6">
            <Button
              variant="outline"
              className="w-full h-10 border-outline-variant/50"
              disabled={isSubmitting}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                <path d="M1 1h22v22H1z" fill="none" />
              </svg>
              Google
            </Button>
          </div>

          <p className="mt-8 text-center text-sm text-secondary">
            Have an account?{" "}
            <Button
              variant="link"
              className="h-auto p-0 text-sm"
              onClick={() => navigate('/login')}
              disabled={isSubmitting}
            >
              Sign in
            </Button>
          </p>
        </motion.div>
      </AuthCard>
    </div>
  );
}
