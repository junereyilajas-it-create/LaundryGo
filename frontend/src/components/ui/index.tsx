import React, { type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react';

// Card
export function Card({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-surface-container-lowest dark:bg-surface-container-low rounded-xl shadow-[0px_4px_20px_rgba(26,54,93,0.05)] border border-outline-variant/10 dark:border-outline/10 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-lg flex justify-between items-center ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`font-h2 text-h2 text-primary dark:text-primary-fixed-dim ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardContent({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-lg pt-0 ${className}`} {...props}>
      {children}
    </div>
  );
}

// Button
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ className = '', variant = 'primary', size = 'md', children, ...props }: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center font-button rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variants = {
    primary: 'bg-primary-container text-on-primary hover:bg-on-primary-fixed-variant focus:ring-primary',
    secondary: 'bg-secondary-container text-on-secondary-container hover:bg-surface-variant focus:ring-secondary',
    outline: 'border border-outline-variant text-primary hover:bg-surface-container-low focus:ring-primary',
    ghost: 'text-primary hover:bg-surface-container-low focus:ring-primary',
    destructive: 'bg-error text-on-error hover:bg-error/90 focus:ring-error',
  };

  const sizes = {
    sm: 'text-body-sm py-xs px-sm',
    md: 'text-button py-sm px-md',
    lg: 'text-h3 py-md px-lg',
  };

  return (
    <button className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}

// Input
export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input 
      className={`w-full px-md py-sm bg-white dark:bg-surface-container-highest border border-outline-variant/50 rounded-lg focus:ring-2 focus:ring-surface-variant focus:border-primary outline-none transition-all font-body-md text-body-md text-on-surface placeholder:text-outline/60 ${className}`}
      {...props}
    />
  );
}

// Label
export function Label({ className = '', children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`font-label-md text-label-md text-primary dark:text-primary-fixed block mb-xs ${className}`} {...props}>
      {children}
    </label>
  );
}

// Badge
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'outline';
}

export function Badge({ className = '', variant = 'default', children, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-primary-fixed text-on-primary-fixed',
    success: 'bg-[#dcfce7] text-[#166534] dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-[#fef9c3] text-[#854d0e] dark:bg-yellow-900/30 dark:text-yellow-400',
    error: 'bg-error-container text-on-error-container',
    outline: 'border border-outline text-on-surface',
  };

  return (
    <span className={`px-sm py-xs rounded-full font-label-md text-[11px] uppercase tracking-wider inline-flex items-center justify-center ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
}
