import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Droplets, Truck, Clock, ShieldCheck, Sparkles, MapPin, 
  ArrowRight, Phone, Mail, ChevronRight, CheckCircle2, 
  Sun, Moon, Menu, X, ArrowUpRight, HelpCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { Button } from '../components/ui';

interface ServiceItem {
  id: number;
  name: string;
  description: string;
  price: number;
}

export default function LandingPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const { data } = await api.get('/services');
        if (Array.isArray(data) && data.length > 0) {
          setServices(data);
        } else {
          setServices(defaultServices);
        }
      } catch (err) {
        setServices(defaultServices);
      }
    };
    fetchServices();
  }, []);

  const defaultServices: ServiceItem[] = [
    { id: 1, name: 'Wash & Fold', description: 'Complete wash, tumble dry, and neat fold for your everyday casual wear.', price: 35.00 },
    { id: 2, name: 'Wash & Iron / Press', description: 'Freshly washed, dried, and professionally steam-pressed on hangers.', price: 50.00 },
    { id: 3, name: 'Dry Cleaning', description: 'Delicate care for formal suits, gowns, barongs, uniforms, and coats.', price: 120.00 },
    { id: 4, name: 'Comforter & Heavy Blankets', description: 'Deep hygienic wash for thick duvets, quilts, and large bed linens.', price: 150.00 },
    { id: 5, name: 'Shoe & Bag Refresh', description: 'Specialized deep scrubbing, sanitizing, and deodorizing for footwear.', price: 90.00 }
  ];

  const handleServiceAction = () => {
    navigate('/login');
  };

  const handleGetStarted = () => {
    navigate('/login');
  };

  const faqs = [
    {
      q: 'What areas in Misamis Oriental do you serve?',
      a: 'LaundriGo exclusively specializes in serving Poblacion, Lagonglong, Misamis Oriental (Zip Code 9006), offering fast doorstep pickup and delivery right to your home, office, or boarding house.'
    },
    {
      q: 'How does the laundry pickup and delivery process work?',
      a: 'Simply click "Request Laundry Service", select your preferred service and schedule, and pinpoint your address. Our verified driver will pick up your laundry bag, bring it to our facility for professional processing, and deliver it back fresh and clean.'
    },
    {
      q: 'Can I track my driver in real-time?',
      a: 'Yes! When your assigned driver marks your task as "On the Way", you can track their live GPS location and view their estimated time of arrival on your customer dashboard.'
    },
    {
      q: 'What payment methods are supported?',
      a: 'We accept cashless payments through GCash with instant server verification, as well as Cash on Delivery (COD) upon receiving your fresh laundry.'
    },
    {
      q: 'What is the standard turnaround time?',
      a: 'Our standard turnaround is 24 to 48 hours for wash and fold. Rush laundry requests can also be accommodated based on shop capacity.'
    }
  ];

  return (
    <div className={`min-h-screen bg-surface-bright dark:bg-gray-950 text-on-surface dark:text-gray-100 transition-colors duration-200 ${theme === 'dark' ? 'dark' : ''}`}>
      
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Droplets className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-gray-950 dark:text-white flex items-center gap-1">
                Laundri<span className="text-blue-600 dark:text-blue-400">Go</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wider text-blue-600 dark:text-blue-400 uppercase block -mt-1">
                Poblacion • Lagonglong
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#services" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Services
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              How It Works
            </a>
            <a href="#coverage" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Coverage
            </a>
            <a href="#benefits" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Benefits
            </a>
            <a href="#contact" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Contact
            </a>
          </nav>

          {/* Header Action Buttons */}
          <div className="hidden md:flex items-center gap-3">

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </button>

            {user ? (
              <Button
                variant="primary"
                onClick={() => navigate(user.role === 'customer' ? '/customer' : user.role === 'driver' ? '/driver' : '/worker')}
                className="gap-2 shadow-sm"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="border-gray-300 dark:border-gray-700"
                >
                  Sign In
                </Button>
                <Button
                  variant="primary"
                  onClick={handleGetStarted}
                  className="shadow-sm shadow-blue-600/20"
                >
                  Get Started
                </Button>
              </>
            )}
          </div>

          {/* Mobile Actions and Menu Button */}
          <div className="flex md:hidden items-center gap-2">

            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 pt-2 pb-6 space-y-3">
            <a 
              href="#services" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600"
            >
              Services
            </a>
            <a 
              href="#how-it-works" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600"
            >
              How It Works
            </a>
            <a 
              href="#coverage" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600"
            >
              Coverage
            </a>
            <a 
              href="#benefits" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600"
            >
              Benefits
            </a>
            <a 
              href="#contact" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600"
            >
              Contact
            </a>
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-2">
              {user ? (
                <Button
                  variant="primary"
                  className="w-full justify-center"
                  onClick={() => navigate(user.role === 'customer' ? '/customer' : user.role === 'driver' ? '/driver' : '/worker')}
                >
                  Dashboard
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="w-full justify-center"
                    onClick={() => navigate('/login')}
                  >
                    Sign In
                  </Button>
                  <Button
                    variant="primary"
                    className="w-full justify-center"
                    onClick={handleGetStarted}
                  >
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:py-24 bg-gradient-to-b from-blue-50/50 via-white to-transparent dark:from-blue-950/20 dark:via-gray-950 dark:to-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Content Column */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-7 space-y-6 text-center lg:text-left"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100/80 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-semibold tracking-wide border border-blue-200 dark:border-blue-800">
                <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Serving Poblacion, Lagonglong, Misamis Oriental
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-950 dark:text-white tracking-tight leading-[1.15]">
                Fresh, Clean Laundry <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 bg-clip-text text-transparent">
                  Delivered to Your Door.
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto lg:mx-0 font-normal leading-relaxed">
                Save hours every week. Schedule effortless laundry pickup, gentle eco-friendly washing, and prompt delivery anywhere in Poblacion, Lagonglong with real-time driver GPS tracking.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Button
                  size="lg"
                  onClick={handleServiceAction}
                  className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 text-base font-semibold"
                >
                  <Sparkles className="w-5 h-5" />
                  Request Laundry Service
                </Button>
                
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleGetStarted}
                  className="w-full sm:w-auto px-8 py-4 rounded-xl border-gray-300 dark:border-gray-700 text-base font-semibold hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>

              {/* Trust Badges */}
              <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-gray-200 dark:border-gray-800 text-left">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100">24-48h</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Fast Turnaround</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100">Live GPS</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Driver Tracking</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100">Sanitized</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Hygienic Care</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100">GCash / COD</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Easy Payment</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Visual Card Column */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="lg:col-span-5 relative"
            >
              <div className="relative mx-auto max-w-md rounded-2xl p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl">
                
                {/* Active Tracking Demonstration Card */}
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-full bg-blue-600 text-white text-[11px] font-bold uppercase tracking-wider">
                      Live Delivery
                    </span>
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
                      On The Way
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">Dave Driver</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Arriving in ~8 mins (Poblacion zone)</p>
                    </div>
                  </div>
                </div>

                {/* Service Highlights List */}
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                  Today's Popular Services
                </h3>
                <div className="space-y-2.5">
                  {services.slice(0, 3).map((svc) => (
                    <div 
                      key={svc.id}
                      className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 flex items-center justify-between hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{svc.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{svc.description}</p>
                      </div>
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400 shrink-0">
                        ₱{parseFloat(String(svc.price)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Instant CTA inside card */}
                <Button
                  onClick={handleServiceAction}
                  className="w-full mt-6 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                >
                  Schedule Your Pickup Now
                  <ArrowUpRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-2">
              Our Services
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
              Professional Laundry Solutions
            </h2>
            <p className="mt-4 text-base sm:text-lg text-gray-600 dark:text-gray-300">
              Tailored services for everyday clothing, delicate fabrics, uniforms, beddings, and corporate wear.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <motion.div
                key={service.id || index}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-600 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-5">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {service.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                    {service.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Starting at</span>
                    <span className="text-2xl font-black text-gray-900 dark:text-white">
                      ₱{parseFloat(String(service.price)).toFixed(2)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleServiceAction}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4"
                  >
                    Select
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-2">
              Simple 3-Step Process
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
              How LaundriGo Works
            </h2>
            <p className="mt-4 text-base sm:text-lg text-gray-600 dark:text-gray-300">
              Effortless pickup, meticulous processing, and prompt doorstep delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Step 1 */}
            <div className="p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm relative">
              <span className="absolute -top-4 left-8 px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-extrabold">
                Step 01
              </span>
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-6 mt-2">
                <Truck className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                Request Service
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Choose your laundry service and pin your address in Poblacion, Lagonglong. Our friendly driver arrives at your chosen schedule.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm relative">
              <span className="absolute -top-4 left-8 px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-extrabold">
                Step 02
              </span>
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-6 mt-2">
                <Droplets className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                Laundry Processing
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Your clothes are weighed, sorted, washed with premium detergents, tumble dried, and neatly folded or ironed in sanitized machines.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm relative">
              <span className="absolute -top-4 left-8 px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-extrabold">
                Step 03
              </span>
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-6 mt-2">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                Pickup or Delivery
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Track your driver live on the map as they return your fresh clothes. Pay conveniently via GCash or Cash on Delivery.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* Service Coverage Area */}
      <section id="coverage" className="py-20 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl p-8 sm:p-12 bg-gradient-to-br from-blue-900 to-indigo-950 text-white shadow-2xl relative overflow-hidden">
            <div className="relative z-10 max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold">
                <MapPin className="w-3.5 h-3.5" />
                Service Coverage
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Poblacion, Lagonglong, Misamis Oriental
              </h2>
              <p className="text-blue-100 text-base sm:text-lg leading-relaxed">
                We are proud to serve the local community of Poblacion, Lagonglong with free pickup and delivery on eligible laundry orders. Experience modern, hassle-free laundry care without leaving your doorstep.
              </p>
              <div className="pt-4 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium">Zip Code: 9006</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium">Residential & Commercial</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium">Same-day pickup available</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-2">
              Why LaundriGo
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
              Built for Speed, Care, and Convenience
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <Truck className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-4" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Doorstep Service</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No more carrying heavy bags. Our drivers pick up and deliver directly at your door.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <ShieldCheck className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-4" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Fabric Protection</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Gentle washing cycles, color preservation, and hypoallergenic detergents for delicate skin.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <MapPin className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-4" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Real-Time GPS</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Know exactly when your driver is approaching with our live interactive navigation map.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <Droplets className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-4" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Flexible Payment</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Pay safely using verified GCash checkout or convenient Cash on Delivery (COD).
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="py-20 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-2">
              Frequently Asked Questions
            </span>
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">
              Got Questions? We Have Answers.
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div 
                key={idx}
                className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-gray-900"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${activeFaq === idx ? 'rotate-90' : ''}`} />
                </button>
                {activeFaq === idx && (
                  <div className="p-5 pt-0 text-sm text-gray-600 dark:text-gray-300 leading-relaxed border-t border-gray-100 dark:border-gray-800">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-2">
                Get In Touch
              </span>
              <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6">
                We're Here to Help
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                Have questions about your order, special garment handling, or delivery schedules? Contact our friendly local team in Lagonglong.
              </p>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Headquarters</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Poblacion, Lagonglong, Misamis Oriental, 9006 Philippines</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Customer Support</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">0912-345-6789 / (088) 123-4567</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Email Address</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">support@laundrigo.ph</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Business Hours Card */}
            <div className="p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Operating Hours
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-gray-600 dark:text-gray-400">Monday – Friday</span>
                    <span className="font-semibold text-gray-900 dark:text-white">7:00 AM – 7:00 PM</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-gray-600 dark:text-gray-400">Saturday</span>
                    <span className="font-semibold text-gray-900 dark:text-white">8:00 AM – 6:00 PM</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-gray-600 dark:text-gray-400">Sunday</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">Pickup & Deliveries Only</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <Button 
                  onClick={handleServiceAction}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md"
                >
                  Book Your Laundry Request
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-gray-900 dark:text-white">LaundriGo</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">© 2026 LaundriGo. Poblacion, Lagonglong, Misamis Oriental.</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
            <a href="#services" className="hover:text-blue-600 transition-colors">Services</a>
            <a href="#how-it-works" className="hover:text-blue-600 transition-colors">How It Works</a>
            <a href="#coverage" className="hover:text-blue-600 transition-colors">Coverage</a>
            <a href="#contact" className="hover:text-blue-600 transition-colors">Contact</a>
            <button onClick={() => navigate('/login')} className="hover:text-blue-600 transition-colors font-medium">
              Sign In
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}
