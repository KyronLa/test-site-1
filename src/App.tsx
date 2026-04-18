import React, { useState, useEffect, useRef, createContext, useContext, Component } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Menu, 
  X, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ShieldCheck, 
  FlaskConical, 
  Truck, 
  MessageSquare, 
  Image as ImageIcon,
  Send,
  Loader2,
  AlertTriangle,
  Info,
  User as UserIcon,
  LogOut,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  Package,
  MapPin,
  Gift,
  CreditCard,
  Settings,
  Edit2,
  Save,
  ShoppingBag,
  Star,
  Hash,
  Mail,
  Eye,
  EyeOff,
  Archive,
  ArchiveRestore,
  Clock,
  Tag,
  Copy,
  Check,
  Crown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc,
  serverTimestamp, 
  getDocs,
  orderBy,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  increment,
  or,
  and
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { INITIAL_PRODUCTS } from './constants';
import { sanitizeData, sanitizeInput } from './lib/sanitization';

// --- Firestore Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends Component<any, any> {
  constructor(props: any) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    const state = (this as any).state;
    const props = (this as any).props;
    if (state.hasError) {
      let message = "Something went wrong.";
      try {
        const parsed = JSON.parse(state.error?.message || "");
        if (parsed.error && parsed.operationType) {
          message = `Database Error: ${parsed.error} during ${parsed.operationType} on ${parsed.path || 'unknown path'}`;
        }
      } catch (e) {
        message = state.error?.message || message;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-red-100">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Application Error</h2>
            <p className="text-gray-600 mb-8 text-sm leading-relaxed">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-black text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return props.children;
  }
}

// --- Types & Context ---

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  category: string;
  image: string;
  description?: string;
  dosage?: string;
  dosages?: {
    label: string;
    image: string;
    price?: number;
    originalPrice?: number;
    stock?: number;
    inStock?: boolean;
    lowStockThreshold?: number;
  }[];
  stock?: number;
  inStock?: boolean;
  lowStockThreshold?: number;
  isArchived?: boolean;
  quantityImages?: {
    1?: string;
    2?: string;
    3?: string;
  };
}

interface CartItem extends Product {
  quantity: number;
}

export const isProductAvailable = (product: Product): boolean => {
  // Check default option stock
  const defaultInStock = product.stock !== undefined ? product.stock > 0 : product.inStock !== false;
  if (defaultInStock) return true;

  // If dosages exist, check if ANY are in stock
  if (product.dosages && product.dosages.length > 0) {
    return product.dosages.some(d => 
      d.stock !== undefined ? d.stock > 0 : d.inStock !== false
    );
  }

  return false;
};

interface SiteSettings {
  countdownActive: boolean;
  countdownText: string;
  countdownTarget: string;
  durationDays?: number;
  durationHours?: number;
  durationMinutes?: number;
  referralCreditAmount?: number;
}

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, firstName: string, lastName: string, phone?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isFreeShippingEnabled: boolean;
  toggleFreeShipping: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

const getGuestId = () => {
  let guestId = localStorage.getItem('guestId');
  if (!guestId) {
    guestId = 'guest_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('guestId', guestId);
  }
  return guestId;
};

const CountdownBanner = ({ currentView, settings, timeLeft }: { currentView: string, settings: SiteSettings | null, timeLeft: any }) => {
  const showOnViews = ['home', 'shop', 'product', 'checkout'];
  if (!settings?.countdownActive || !timeLeft || !showOnViews.includes(currentView)) return null;

  return (
    <div className="bg-emerald-600 text-white py-2 px-4 text-center relative z-[60]">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6">
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest">{settings.countdownText}</span>
        </div>
        <div className="flex items-center gap-4">
          {[
            { label: 'Days', value: timeLeft.days },
            { label: 'Hrs', value: timeLeft.hours },
            { label: 'Min', value: timeLeft.minutes },
            { label: 'Sec', value: timeLeft.seconds }
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center min-w-[30px]">
              <span className="text-sm font-black tabular-nums">{item.value.toString().padStart(2, '0')}</span>
              <span className="text-[7px] uppercase font-bold opacity-70 tracking-tighter">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Components ---

const Navbar = ({ cartCount, onOpenCart, onOpenAuth, onNavigate, currentView }: { cartCount: number, onOpenCart: () => void, onOpenAuth: () => void, onNavigate: (view: any) => void, currentView: string }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();

  const isDarkPage = currentView === 'home' || currentView === 'shop' || currentView === 'refer';
  const showSolidNav = isScrolled || !isDarkPage;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`w-full transition-all duration-200 relative ${!showSolidNav && isDarkPage && currentView === 'shop' ? 'bg-black lg:bg-transparent' : ''}`}>
      <motion.div
        initial={false}
        animate={{ 
          y: showSolidNav ? 0 : -200,
          opacity: showSolidNav ? 1 : 0
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="absolute inset-0 bg-white shadow-md -z-10"
      />
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center transition-all duration-200 ${showSolidNav ? 'py-3' : 'py-5'} min-h-[70px] sm:min-h-[80px]`}>
        <button 
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0 flex-shrink"
        >
          <div className="relative h-10 sm:h-14 w-auto flex-shrink-0 flex items-center justify-center">
            <motion.img 
              key={showSolidNav ? 'black' : 'white'}
              initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              src={showSolidNav ? "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969647/blacklogo_dbbepi.png" : "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969635/logo_gc8g0q.png"} 
              alt="Eclipse Research" 
              className="h-10 sm:h-14 w-auto" 
              referrerPolicy="no-referrer"
            />
          </div>
          <span className={`text-lg sm:text-xl font-bold tracking-tight ${showSolidNav ? 'text-black' : 'text-white'}`}>ECLIPSE RESEARCH</span>
        </button>

        <div className="hidden lg:flex items-center gap-6 xl:gap-8">
          <button onClick={() => onNavigate('shop')} className={`text-[13px] font-bold uppercase tracking-wider hover:text-emerald-500 transition-colors ${showSolidNav ? 'text-black' : 'text-white'}`}>Shop All</button>
          <button onClick={() => onNavigate('calculator')} className={`text-[13px] font-bold uppercase tracking-wider hover:text-emerald-500 transition-colors ${showSolidNav ? 'text-black' : 'text-white'}`}>Calculator</button>
          <button onClick={() => onNavigate('refer')} className={`text-[13px] font-bold uppercase tracking-wider hover:text-emerald-500 transition-colors ${showSolidNav ? 'text-black' : 'text-white'}`}>Refer & Earn</button>
          <button onClick={() => onNavigate('affiliate')} className={`text-[13px] font-bold uppercase tracking-wider hover:text-emerald-500 transition-colors ${showSolidNav ? 'text-black' : 'text-white'}`}>Become an Affiliate</button>
          {isAdmin && (
            <button onClick={() => onNavigate('admin')} className="text-[13px] font-extrabold text-emerald-500 hover:opacity-70 transition-opacity uppercase tracking-wider">Admin</button>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-4 flex-none">
          <button 
            onClick={onOpenCart}
            className={`${showSolidNav ? 'text-black' : 'text-white'} relative p-2 hover:bg-black/5 rounded-full flex-shrink-0`}
          >
            <ShoppingCart className="w-6 h-6" />
            {cartCount > 0 && (
              <span className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </button>

          {user ? (
            <div className="flex items-center gap-2 flex-none">
              <button 
                onClick={() => onNavigate('account')} 
                className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-full overflow-hidden border ${showSolidNav ? 'border-gray-200 bg-gray-100' : 'border-white/10 bg-white/5'} p-0 flex-none`}
              >
                <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || user.email}&background=random`} 
                  alt="" 
                  className="w-full h-full object-cover block rounded-full"
                  style={{ width: '40px', height: '40px', minWidth: '40px', minHeight: '40px', borderRadius: '50%' }}
                />
              </button>
              <button onClick={logout} className={`${showSolidNav ? 'text-black' : 'text-white'} hover:opacity-70 p-2 flex-none`}>
                <LogOut className="w-6 h-6" />
              </button>
            </div>
          ) : (
            <button 
              onClick={onOpenAuth}
              className={`${showSolidNav ? 'text-black' : 'text-white'} p-2 hover:bg-black/5 rounded-full flex-shrink-0`}
            >
              <UserIcon className="w-6 h-6" />
            </button>
          )}

          <button className="lg:hidden p-2 flex-shrink-0" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className={`w-6 h-6 ${showSolidNav ? 'text-black' : 'text-white'}`} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed inset-0 bg-white z-[60] p-6 flex flex-col"
          >
            <div className="flex justify-end">
              <button onClick={() => setIsMobileMenuOpen(false)}><X className="w-8 h-8" /></button>
            </div>
            <div className="flex flex-col gap-6 mt-12">
              <button onClick={() => { onNavigate('shop'); setIsMobileMenuOpen(false); }} className="text-xl font-black text-black border-b border-gray-100 pb-4 text-left uppercase tracking-tighter">Shop All</button>
              <button onClick={() => { onNavigate('calculator'); setIsMobileMenuOpen(false); }} className="text-xl font-black text-black border-b border-gray-100 pb-4 text-left uppercase tracking-tighter">Calculator</button>
              <button onClick={() => { if (user) onNavigate('account'); else onOpenAuth(); setIsMobileMenuOpen(false); }} className="text-xl font-black text-black border-b border-gray-100 pb-4 text-left uppercase tracking-tighter">My Account</button>
              <button onClick={() => { onNavigate('refer'); setIsMobileMenuOpen(false); }} className="text-xl font-black text-black border-b border-gray-100 pb-4 text-left uppercase tracking-tighter">Refer & Earn</button>
              <button onClick={() => { onNavigate('about'); setIsMobileMenuOpen(false); }} className="text-xl font-black text-black border-b border-gray-100 pb-4 text-left uppercase tracking-tighter">About Us</button>
              <button onClick={() => { onNavigate('affiliate'); setIsMobileMenuOpen(false); }} className="text-xl font-black text-black border-b border-gray-100 pb-4 text-left uppercase tracking-tighter">Become an Affiliate</button>
              <button onClick={() => { onNavigate('coas'); setIsMobileMenuOpen(false); }} className="text-xl font-black text-black border-b border-gray-100 pb-4 text-left uppercase tracking-tighter">Request COA</button>
              {isAdmin && (
                <button onClick={() => { onNavigate('admin'); setIsMobileMenuOpen(false); }} className="text-xl font-black text-emerald-500 border-b border-gray-100 pb-4 text-left uppercase tracking-tighter">Admin Panel</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const CartDrawer = ({ 
  isOpen, 
  onClose, 
  items, 
  onUpdateQuantity, 
  onRemove,
  onCheckout,
  onAddToCart,
  appliedPromo,
  onApplyPromo
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  items: CartItem[], 
  onUpdateQuantity: (id: string, delta: number) => void,
  onRemove: (id: string) => void,
  onCheckout: () => void,
  onAddToCart: (product: Product) => void,
  appliedPromo: { code: string, discount: number } | null,
  onApplyPromo: (promo: { code: string, discount: number } | null) => void
}) => {
  const { user, isFreeShippingEnabled, isAdmin } = useAuth();
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  
  let quantityDiscountPercent = 0;
  if (totalQuantity >= 4) quantityDiscountPercent = 10;
  else if (totalQuantity === 3) quantityDiscountPercent = 7;
  else if (totalQuantity === 2) quantityDiscountPercent = 4;

  const quantityDiscountAmount = subtotal * (quantityDiscountPercent / 100);
  const subtotalAfterQuantityDiscount = subtotal - quantityDiscountAmount;

  const freeShippingThreshold = 250;
  const progress = Math.min((subtotalAfterQuantityDiscount / freeShippingThreshold) * 100, 100);
  const remaining = Math.max(freeShippingThreshold - subtotalAfterQuantityDiscount, 0);
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const shipping = subtotalAfterQuantityDiscount >= freeShippingThreshold ? 0 : 15;
  const totalBeforePromo = subtotalAfterQuantityDiscount + shipping;
  const discountAmount = appliedPromo ? (totalBeforePromo * (appliedPromo.discount / 100)) : 0;
  const finalTotal = totalBeforePromo - discountAmount;

  const handleApplyPromo = async () => {
    const sanitizedPromoCode = sanitizeInput(promoCode).toUpperCase().trim();
    if (!sanitizedPromoCode) return;
    setIsApplying(true);
    setPromoError('');
    try {
      const q = query(
        collection(db, 'promo_codes'), 
        where('code', '==', sanitizedPromoCode),
        where('isActive', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setPromoError('Invalid or inactive promo code');
        onApplyPromo(null);
      } else {
        const promoData = querySnapshot.docs[0].data();
        const code = promoData.code;

        // Check for one-time use if not admin
        if (!isAdmin && user) {
          const ordersQuery = query(
            collection(db, 'orders'),
            and(
              or(
                where('userId', '==', user.uid),
                where('customerEmail', '==', user.email)
              ),
              where('promoCode', '==', code)
            )
          );
          const ordersSnapshot = await getDocs(ordersQuery);
          if (!ordersSnapshot.empty) {
            setPromoError('This promo code has already been used by your account');
            onApplyPromo(null);
            return;
          }
        }

        onApplyPromo({
          code: promoData.code,
          discount: promoData.discount
        });
        setPromoCode('');
      }
    } catch (error) {
      console.error('Error applying promo code:', error);
      setPromoError('Error applying promo code');
    } finally {
      setIsApplying(false);
    }
  };

  const recommendedProduct: Product = {
    id: '7',
    name: "Bacteriostatic Water (10ml)",
    price: 14.99,
    category: "Peptides",
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969217/BacWater_vl81li.png"
  };

  const isRecommendedInCart = items.some(item => item.id === recommendedProduct.id);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-white z-[101] shadow-2xl flex flex-col"
          >
            <div className="p-4 bg-black text-white flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-400" /> Your Cart
              </h2>
              <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-4 py-3 bg-black border-b border-white/10">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                  {subtotal >= freeShippingThreshold ? '🎉 You unlocked free shipping!' : `Add $${remaining.toFixed(2)} more for free shipping`}
                </span>
                <span className="text-[9px] font-bold text-white/60">{Math.round(progress)}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                />
              </div>
            </div>

            <div className="px-4 py-2.5 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Bulk Savings</span>
              </div>
              <div className="flex gap-4">
                <span className="text-[11px] font-medium text-emerald-700">2 Vials: <span className="font-bold text-emerald-800">4%</span></span>
                <span className="text-[11px] font-medium text-emerald-700">3 Vials: <span className="font-bold text-emerald-800">7%</span></span>
                <span className="text-[11px] font-medium text-emerald-700">4+ Vials: <span className="font-bold text-emerald-800">10%</span></span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                  <ShoppingCart className="w-16 h-16 opacity-20" />
                  <p>Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-4 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                      <div className="w-16 h-16 bg-white rounded-lg overflow-hidden flex-shrink-0 border border-gray-100">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <h3 className="font-bold text-xs">{item.name}</h3>
                          <button onClick={() => onRemove(item.id)} className="text-gray-400 hover:text-red-500">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-emerald-600 font-bold text-xs">${item.price.toFixed(2)}</p>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => onUpdateQuantity(item.id, -1)}
                              className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                            >
                              <Minus className="w-2 h-2" />
                            </button>
                            <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                            <button 
                              onClick={() => onUpdateQuantity(item.id, 1)}
                              className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                            >
                              <Plus className="w-2 h-2" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {items.length > 0 && !isRecommendedInCart && (
              <div className="p-4 bg-gray-50 border-t border-gray-100">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Required for reconstitution</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg overflow-hidden border border-gray-100 flex-shrink-0">
                    <img src={recommendedProduct.image} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-[11px] font-bold">{recommendedProduct.name}</h4>
                    <p className="text-[11px] text-emerald-600 font-bold">${recommendedProduct.price.toFixed(2)}</p>
                  </div>
                  <button 
                    onClick={() => onAddToCart(recommendedProduct)}
                    className="p-1.5 bg-black text-white rounded-lg hover:bg-emerald-600 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {items.length > 0 && (
              <div className="p-4 border-t border-gray-100 bg-white space-y-3">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Promo Code"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      className="flex-1 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-black outline-none uppercase"
                    />
                    <button 
                      onClick={handleApplyPromo}
                      disabled={isApplying || !promoCode.trim()}
                      className="px-3 py-1.5 bg-black text-white font-bold text-[10px] rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      {isApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Apply'}
                    </button>
                  </div>
                  {promoError && <p className="text-[10px] text-red-500 font-medium ml-1">{promoError}</p>}
                  {appliedPromo && (
                    <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3 h-3 text-emerald-600" />
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">{appliedPromo.code} Applied</span>
                      </div>
                      <button onClick={() => onApplyPromo(null)} className="text-emerald-600 hover:text-emerald-800">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500 text-xs">Subtotal</span>
                    <span className="text-xs font-bold">${subtotal.toFixed(2)}</span>
                  </div>
                  {quantityDiscountPercent > 0 && (
                    <div className="flex justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-600 text-xs font-bold">Quantity Discount</span>
                        <span className="bg-emerald-100 text-emerald-700 text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase">-{quantityDiscountPercent}%</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-600">-${quantityDiscountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500 text-xs">Shipping</span>
                    <span className="text-xs font-bold text-emerald-600">
                      {shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}
                    </span>
                  </div>
                  {appliedPromo && (
                    <div className="flex justify-between mb-1">
                      <span className="text-emerald-600 text-xs">Discount ({appliedPromo.discount}%)</span>
                      <span className="text-xs font-bold text-emerald-600">-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between mb-4 pt-3 border-t border-gray-100">
                    <span className="text-base font-bold">Total</span>
                    <span className="text-lg font-bold">${finalTotal.toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={onCheckout}
                    className="w-full py-3 bg-black text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-black/10 text-sm"
                  >
                    Proceed to Checkout <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const AuthModal = ({ isOpen, onClose, onNavigate }: { isOpen: boolean, onClose: () => void, onNavigate: (view: any) => void }) => {
  const { login, register, signInWithGoogle, user } = useAuth();
  const [isSuccess, setIsSuccess] = useState(false);
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [is21, setIs21] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      setIsSuccess(true);
      const timer = setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, isOpen, onClose]);

  useEffect(() => {
    if (email && email.includes('@') && email.length > 5) {
      const _learnq = (window as any)._learnq || [];
      _learnq.push(['identify', { '$email': email }]);
    }
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const sanitizedEmail = sanitizeInput(email);
      const sanitizedFirstName = sanitizeInput(firstName);
      const sanitizedLastName = sanitizeInput(lastName);
      const sanitizedPhone = sanitizeInput(phone);

      if (mode === 'reset') {
        if (!sanitizedEmail) throw new Error('Please enter your email address.');
        const actionCodeSettings = {
          url: 'https://eclipseresearch.shop',
          handleCodeInApp: true,
        };
        await sendPasswordResetEmail(auth, sanitizedEmail, actionCodeSettings);
        setSuccessMessage('Password reset email sent! Please check your inbox.');
        return;
      }

      if (mode === 'login') {
        await login(sanitizedEmail, password);
      } else {
        if (!is21) {
          throw new Error('You must be 21 years or older to register.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }

        await register(sanitizedEmail, password, sanitizedFirstName, sanitizedLastName, sanitizedPhone);
      }
    } catch (err: any) {
      console.error('Auth Error:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl p-10"
          >
            {isSuccess ? (
              <div className="py-12 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Welcome!</h2>
                <p className="text-gray-500">You've successfully signed in.</p>
              </div>
            ) : (
              <>
                <div className="mx-auto mb-8 flex justify-center">
                  <img src="https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969647/blacklogo_dbbepi.png" alt="Eclipse Research" className="h-20 w-auto" referrerPolicy="no-referrer" />
                </div>
                <h2 className="text-3xl font-bold mb-2 tracking-tight text-center">
                  {mode === 'login' ? 'Welcome Back' : mode === 'register' ? 'Create Account' : 'Reset Password'}
                </h2>
                <p className="text-gray-500 mb-8 text-center text-sm">
                  {mode === 'login' 
                    ? 'Sign in to manage your research compounds.' 
                    : mode === 'register'
                    ? 'Join our research community today.'
                    : 'Enter your email to receive a reset link.'}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === 'register' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">First Name</label>
                        <input 
                          required
                          type="text" 
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Last Name</label>
                        <input 
                          required
                          type="text" 
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                    <input 
                      required
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none"
                    />
                  </div>

                  {mode !== 'reset' && (
                    <>
                      {mode === 'register' && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Phone (Optional)</label>
                          <input 
                            type="tel" 
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none"
                          />
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Password</label>
                        <div className="relative">
                          <input 
                            required
                            type={showPassword ? "text" : "password"} 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={mode === 'register' ? 'Min. 6 characters' : ''}
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none pr-12"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {mode === 'login' && (
                          <div className="flex justify-end pt-1">
                            <button 
                              type="button"
                              onClick={() => setMode('reset')}
                              className="text-[10px] font-bold text-gray-400 hover:text-black uppercase tracking-widest transition-colors"
                            >
                              Forgot Password?
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {mode === 'register' && (
                    <div className="flex items-start gap-3 pt-2">
                      <div className="flex items-center h-5">
                        <input
                          id="age-verification"
                          name="age-verification"
                          type="checkbox"
                          checked={is21}
                          onChange={(e) => setIs21(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                        />
                      </div>
                      <div className="text-xs">
                        <label htmlFor="age-verification" className="font-medium text-gray-700 cursor-pointer">
                          I am 21 years or older and agree to the <button type="button" onClick={() => { onNavigate('terms'); onClose(); }} className="text-black underline hover:text-emerald-600">terms and conditions</button>
                        </label>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      {error}
                    </div>
                  )}

                  {successMessage && (
                    <div className="p-3 bg-emerald-50 text-emerald-600 text-xs rounded-xl flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      {successMessage}
                    </div>
                  )}

                  <button 
                    disabled={isLoading}
                    type="submit"
                    className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link')}
                  </button>

                  {mode !== 'reset' && (
                    <>
                      <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-100"></div>
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
                          <span className="bg-white px-4 text-gray-400">Or continue with</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          setError(null);
                          setIsLoading(true);
                          try {
                            await signInWithGoogle();
                          } catch (err: any) {
                            if (err.code === 'auth/popup-closed-by-user') {
                              // User closed the popup, handle gracefully without showing an error
                              return;
                            }
                            console.error('Google Auth Error:', err);
                            setError(err.message || 'An error occurred during Google sign in');
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        disabled={isLoading}
                        className="w-full py-4 bg-white border border-gray-100 text-gray-700 font-bold rounded-2xl hover:bg-gray-50 transition-all flex items-center justify-center gap-3"
                      >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" referrerPolicy="no-referrer" />
                        Sign in with Google
                      </button>
                    </>
                  )}
                </form>

                <div className="mt-6 text-center">
                  <button 
                    onClick={() => {
                      if (mode === 'reset') {
                        setMode('login');
                      } else {
                        setMode(mode === 'login' ? 'register' : 'login');
                      }
                      setError(null);
                      setSuccessMessage(null);
                      setIs21(false);
                    }}
                    className="text-xs font-bold text-gray-400 hover:text-black transition-colors"
                  >
                    {mode === 'login' ? "Don't have an account? Register" : mode === 'register' ? "Already have an account? Login" : "Back to Login"}
                  </button>
                </div>

                <p className="mt-8 text-[10px] text-gray-400 uppercase tracking-widest text-center">
                  Strictly for verified research accounts
                </p>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const TermsView = ({ onBack }: { onBack: () => void }) => {
  return (
    <section className="py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[3rem] border border-gray-100 p-12 shadow-sm"
      >
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-black mb-12 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Research
        </button>

        <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">Terms and Conditions</h1>
        <p className="text-gray-400 text-sm mb-12 uppercase tracking-widest font-bold">Last Updated: March 22, 2026</p>

        <div className="space-y-12 text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using the Eclipse Research website, you agree to be bound by these Terms and Conditions. 
              If you do not agree with any part of these terms, you must not use our website or purchase our products.
            </p>
          </section>

          <section className="bg-red-50 p-8 rounded-3xl border border-red-100">
            <h2 className="text-xl font-bold text-red-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> 2. Research Use Only
            </h2>
            <p className="text-red-800 font-medium mb-4">
              CRITICAL NOTICE: ALL PRODUCTS SOLD BY ECLIPSE RESEARCH ARE STRICTLY FOR LABORATORY RESEARCH USE ONLY.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-red-700 text-sm">
              <li>Products are NOT for human or animal consumption, ingestion, or injection.</li>
              <li>Products are NOT for use as drugs, food, cosmetics, or medical devices.</li>
              <li>The purchaser represents that they are a qualified researcher affiliated with a recognized institution.</li>
              <li>Misuse of products is strictly prohibited and may result in account termination.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">3. Age Requirement</h2>
            <p>
              You must be at least 21 years of age to purchase products from this website. By placing an order, 
              you represent and warrant that you meet this age requirement and have the legal capacity to enter into a binding contract.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">4. Compliance with Laws</h2>
            <p>
              The purchaser is responsible for complying with all local, state, and federal laws and regulations regarding 
              the acquisition, possession, and use of research compounds. Eclipse Research makes no representation 
              that the products are legal in your specific jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">5. Shipping and Delivery</h2>
            <p>
              We aim to process and ship orders within 24-48 business hours. Delivery times are estimates and not guaranteed. 
              Eclipse Research is not responsible for delays caused by shipping carriers or customs. 
              Risk of loss passes to the purchaser upon delivery to the carrier.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">6. Limitation of Liability</h2>
            <p>
              In no event shall Eclipse Research, its directors, employees, or affiliates be liable for any indirect, 
              incidental, special, consequential, or punitive damages, including without limitation, loss of profits, 
              data, or use, arising out of or in any way connected with the use of our products or website.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">7. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Eclipse Research and its affiliates from any claims, damages, 
              or expenses (including legal fees) arising from your use of our products, your violation of these terms, 
              or your violation of any third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">8. Modifications to Terms</h2>
            <p>
              Eclipse Research reserves the right to modify these Terms and Conditions at any time without prior notice. 
              Your continued use of the website following any changes constitutes acceptance of the new terms.
            </p>
          </section>
        </div>
      </motion.div>
    </section>
  );
};

const ShippingPolicyView = ({ onBack }: { onBack: () => void }) => {
  return (
    <section className="py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[3rem] border border-gray-100 p-12 shadow-sm"
      >
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-black mb-12 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Research
        </button>

        <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">Shipping Policy</h1>
        <p className="text-gray-400 text-sm mb-12 uppercase tracking-widest font-bold">Last Updated: March 22, 2026</p>

        <div className="space-y-12 text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Order Processing</h2>
            <p>
              All orders are shipped the same or next business day, excluding Sundays and public holidays. 
              Orders placed before <strong>1:00 PM PST</strong> will ship the same day. 
              Once your order ships, you will receive a confirmation email with tracking details.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Shipping Options & Estimated Delivery</h2>
            <p className="mb-4">We offer both Standard and Expedited shipping options at checkout.</p>
            <div className="p-6 rounded-3xl bg-gray-50 border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-2 uppercase text-xs tracking-widest">Estimated Delivery Times</h3>
              <p className="text-sm"><strong>Domestic Shipping:</strong> 1-3 business days (after dispatch)</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Shipping Rates</h2>
            <p>
              Shipping costs are calculated at checkout based on your location and the selected shipping method. 
              <strong> Free shipping is available on all orders over $250.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 text-red-600">Shipping Delays</h2>
            <p className="mb-4">Please note, Eclipse Research is not responsible for delays caused by:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Customs inspections</li>
              <li>Courier issues or disruptions</li>
              <li>Weather or natural disasters</li>
            </ul>
            <p className="mt-4 font-medium">
              Once an order has been shipped, responsibility for delivery lies with the carrier.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Discreet Packaging</h2>
            <p>
              All research compounds are shipped in discreet, secure packaging to ensure the integrity of the contents and maintain privacy. 
              The outer packaging will not contain any reference to the specific research materials inside.
            </p>
          </section>
        </div>
      </motion.div>
    </section>
  );
};

const RefundPolicyView = ({ onBack }: { onBack: () => void }) => {
  return (
    <section className="py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[3rem] border border-gray-100 p-12 shadow-sm"
      >
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-black mb-12 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Research
        </button>

        <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">Refund and Return Policy</h1>
        <p className="text-gray-400 text-sm mb-12 uppercase tracking-widest font-bold">Last Updated: March 22, 2026</p>

        <div className="space-y-12 text-gray-600 leading-relaxed">
          <p>
            At Eclipse Research, the integrity, safety, and purity of our products are our top priorities. As all of our compounds are intended strictly for research use only and are highly sensitive in nature, we maintain a strict no refund and no return policy.
          </p>

          <section className="bg-amber-50 p-8 rounded-3xl border border-amber-100">
            <h2 className="text-xl font-bold text-amber-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> All Sales Are Final
            </h2>
            <p className="text-amber-800">
              We do not offer refunds or accept returns for any reason, including ordering errors, change of mind, or misuse. This policy helps us maintain quality control and ensures that all customers receive products that meet our rigorous standards.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Damaged or Defective Orders</h2>
            <p className="mb-4">
              If your order arrives damaged, defective, or you receive the wrong item, you must notify us within <strong>48 hours</strong> of delivery at 
              <a href="mailto:info@eclipseresearch.shop" className="text-emerald-600 ml-1 font-medium underline">info@eclipseresearch.shop</a>. 
              Please include a detailed description and clear photos of the issue. Our support team will review your case and determine eligibility for a replacement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Refund Eligibility</h2>
            <p className="mb-4">Refunds will only be considered in rare cases where:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>The order was never delivered due to an error on our part</li>
              <li>A replacement is not possible and the issue was reported within the required timeframe</li>
            </ul>
            <p className="mt-4">
              We do not refund or replace items that have been opened, used, or returned without prior authorization.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Research Use Only</h2>
            <p>
              All products sold by Eclipse Research are for laboratory research use only. They are not for human or animal consumption, nor for use in medical devices or as drugs. Any misuse of these products voids all potential claims for replacement or refund.
            </p>
          </section>
        </div>
      </motion.div>
    </section>
  );
};

const AboutUsView = ({ onBack, onShopNow }: { onBack: () => void, onShopNow: () => void }) => {
  return (
    <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-24"
      >
        {/* Hero Section */}
        <div className="text-center space-y-8">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-black mb-8 transition-colors mx-auto"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Home
          </button>
          <div className="space-y-4">
            <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-gray-900 leading-[0.9]">
              PREMIUM RESEARCH<br />YOU CAN TRUST
            </h1>
            <p className="max-w-2xl mx-auto text-xl text-gray-500 font-medium leading-relaxed">
              Eclipse Research is a leading supplier of high-quality research compounds, committed to advancing scientific discovery through exceptional products and service.
            </p>
          </div>
          
          <div className="flex justify-center gap-12 pt-8">
            <div className="text-center">
              <p className="text-4xl font-bold text-gray-900">2025</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Established</p>
            </div>
            <div className="w-px h-12 bg-gray-100" />
            <div className="text-center">
              <p className="text-4xl font-bold text-gray-900">10K+</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Researchers</p>
            </div>
          </div>
        </div>

        {/* Mission Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-emerald-500 uppercase tracking-[0.3em]">Our Mission</h2>
              <h3 className="text-4xl font-bold text-gray-900 leading-tight">
                Empowering the scientific community with uncompromising purity.
              </h3>
            </div>
            <div className="space-y-6 text-gray-600 text-lg leading-relaxed">
              <p>
                At Eclipse Research, our mission is to provide researchers with the highest quality research compounds for their scientific endeavors. We understand the importance of purity and consistency in research.
              </p>
              <p>
                We are committed to supporting the scientific community by offering competitive pricing, exceptional customer service, and same-day shipping on orders placed before 1PM PST.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500">
                <FlaskConical className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-gray-900">Lab Certified</h4>
              <p className="text-sm text-gray-500">Manufactured in certified facilities</p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-gray-900">99%+ Purity</h4>
              <p className="text-sm text-gray-500">Third-party verified quality</p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500">
                <Truck className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-gray-900">Same Day Ship</h4>
              <p className="text-sm text-gray-500">Orders before 1PM PST</p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
              <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-500">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-gray-900">COA Included</h4>
              <p className="text-sm text-gray-500">Certificate with every batch</p>
            </div>
          </div>
        </div>

        {/* Quality Promise */}
        <div className="bg-black rounded-[2rem] md:rounded-[3rem] p-8 md:p-20 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full -mr-48 -mt-48" />
          <div className="relative z-10 space-y-16">
            <div className="text-center space-y-4">
              <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-[0.3em]">Our Quality Promise</h2>
              <h3 className="text-4xl font-bold">Unrivaled Standards in Every Vial</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="space-y-6">
                <p className="text-5xl font-bold text-emerald-500/60">01</p>
                <h4 className="text-xl font-bold">Third-Party Testing</h4>
                <p className="text-gray-400 leading-relaxed">
                  Every batch undergoes independent third-party testing to verify purity, identity, and consistency. We provide Certificates of Analysis with detailed results.
                </p>
              </div>
              <div className="space-y-6">
                <p className="text-5xl font-bold text-emerald-500/60">02</p>
                <h4 className="text-xl font-bold">Quality Control</h4>
                <p className="text-gray-400 leading-relaxed">
                  From synthesis to packaging, we maintain the highest levels of quality assurance. Our rigorous processes ensure every product meets our exacting standards.
                </p>
              </div>
              <div className="space-y-6">
                <p className="text-5xl font-bold text-emerald-500/60">03</p>
                <h4 className="text-xl font-bold">Purity Guarantee</h4>
                <p className="text-gray-400 leading-relaxed">
                  Every compound is independently verified by accredited third-party laboratories. Certificates of Analysis are available for all products.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Research Use Only */}
        <div className="max-w-3xl mx-auto text-center space-y-8 py-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-full text-xs font-bold uppercase tracking-widest">
            <AlertTriangle className="w-4 h-4" /> Research Use Only
          </div>
          <p className="text-gray-500 leading-relaxed italic">
            Eclipse Research is a research compound supplier. All products are intended strictly for research and laboratory use only. They are not for human consumption, medical use, or diagnostic purposes.
          </p>
        </div>

        {/* CTA Section */}
        <div className="bg-emerald-500 rounded-[2rem] md:rounded-[3rem] p-8 md:p-20 text-white text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold">Ready to start your research?</h2>
          <p className="text-emerald-100 text-lg max-w-xl mx-auto">
            Browse our collection of premium research compounds and accelerate your scientific discovery today.
          </p>
          <button 
            onClick={onShopNow}
            className="px-12 py-5 bg-black text-white font-bold rounded-2xl hover:bg-white hover:text-black transition-all shadow-xl shadow-black/10"
          >
            Shop Now
          </button>
        </div>
      </motion.div>
    </section>
  );
};

const PrivacyPolicyView = ({ onBack }: { onBack: () => void }) => {
  return (
    <section className="py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[3rem] border border-gray-100 p-12 shadow-sm"
      >
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-black mb-12 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Research
        </button>

        <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">Privacy Policy</h1>
        <p className="text-gray-400 text-sm mb-12 uppercase tracking-widest font-bold">Last Updated: March 22, 2026</p>

        <div className="space-y-12 text-gray-600 leading-relaxed">
          <p>
            At Eclipse Research, your privacy is our priority. This Privacy Policy explains how we collect, use, and protect your personal information when you interact with our website or purchase research products from us.
          </p>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">1. Information We Collect</h2>
            <p className="mb-4">When you visit or place an order on our website, we may collect the following information:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Personal Information:</strong> Name, email address, phone number, billing and shipping addresses.</li>
              <li><strong>Payment Details:</strong> Processed securely via third-party gateways. We do not store your payment information.</li>
              <li><strong>Technical Data:</strong> IP address, device type, browser, and activity on our site — collected through cookies and similar technologies.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">2. How We Use Your Information</h2>
            <p className="mb-4">We use the data we collect to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Process and deliver your orders efficiently</li>
              <li>Provide order confirmations, updates, and customer support</li>
              <li>Send promotional emails only if you opt in</li>
              <li>Improve our website performance and user experience</li>
              <li>Monitor for fraud and ensure site security</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">3. Information Sharing</h2>
            <p className="mb-4">We never sell or rent your personal data. However, we may share necessary information with:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Trusted third-party partners for payment processing, shipping, analytics, and email communication</li>
              <li>Regulatory or legal authorities if required by law or to protect our rights and safety</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">4. Cookies & Tracking</h2>
            <p>
              We use cookies to personalize your experience, analyze traffic, and improve functionality. You may disable cookies through your browser settings, though some features may not work as intended.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">5. Data Security</h2>
            <p>
              Eclipse Research implements strong technical and organizational safeguards to protect your information from unauthorized access, loss, or misuse.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">6. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at 
              <a href="mailto:info@eclipseresearch.shop" className="text-emerald-600 ml-1 font-medium underline">info@eclipseresearch.shop</a>.
            </p>
          </section>
        </div>
      </motion.div>
    </section>
  );
};

const AffiliateApplicationModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    socialHandle: '',
    followerCount: 'Under 1K',
    niche: 'Fitness',
    avgViews: '',
    usesPeptides: 'No',
    whyPartner: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        fullName: user.displayName || '',
        email: user.email || ''
      }));
    }
  }, [user, isOpen]);

  useEffect(() => {
    if (formData.email && formData.email.includes('@') && formData.email.length > 5) {
      const _learnq = (window as any)._learnq || [];
      _learnq.push(['identify', { '$email': formData.email }]);
    }
  }, [formData.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Please sign in to submit an affiliate application.");
      return;
    }
    setIsSubmitting(true);
    try {
      const sanitizedData = sanitizeData(formData);
      await addDoc(collection(db, 'affiliate_applications'), {
        ...sanitizedData,
        status: 'pending',
        createdAt: serverTimestamp(),
        userId: auth.currentUser?.uid || null
      });
      alert('Application submitted successfully! We will review it and get back to you soon.');
      onClose();
    } catch (error) {
      console.error('Error submitting application:', error);
      alert('Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#0A0A0A] border border-white/10 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl shadow-emerald-500/5"
      >
        <div className="p-8 md:p-12 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white">Research Affiliate Application</h2>
              <p className="text-gray-400 mt-1 text-sm font-medium">Join the Eclipse Research network.</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest ml-1">Full Name</label>
                <input
                  required
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium text-white placeholder:text-gray-600"
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest ml-1">Email Address</label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium text-white placeholder:text-gray-600"
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest ml-1">Social Handle (IG/TikTok)</label>
                <input
                  required
                  type="text"
                  value={formData.socialHandle}
                  onChange={(e) => setFormData({ ...formData, socialHandle: e.target.value })}
                  className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium text-white placeholder:text-gray-600"
                  placeholder="@yourhandle"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest ml-1">Follower Count</label>
                <select
                  value={formData.followerCount}
                  onChange={(e) => setFormData({ ...formData, followerCount: e.target.value })}
                  className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium text-white appearance-none cursor-pointer"
                >
                  <option value="Under 1K">Under 1K</option>
                  <option value="1K–10K">1K–10K</option>
                  <option value="10K–50K">10K–50K</option>
                  <option value="50K+">50K+</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest ml-1">Niche</label>
                <select
                  value={formData.niche}
                  onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                  className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium text-white appearance-none cursor-pointer"
                >
                  <option value="Fitness">Fitness</option>
                  <option value="Bodybuilding">Bodybuilding</option>
                  <option value="Biohacking">Biohacking</option>
                  <option value="General Wellness">General Wellness</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest ml-1">Avg Views Per Post</label>
                <input
                  required
                  type="text"
                  value={formData.avgViews}
                  onChange={(e) => setFormData({ ...formData, avgViews: e.target.value })}
                  className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium text-white placeholder:text-gray-600"
                  placeholder="e.g. 5,000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest ml-1">Do you currently use peptides or research compounds?</label>
              <select
                value={formData.usesPeptides}
                onChange={(e) => setFormData({ ...formData, usesPeptides: e.target.value })}
                className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium text-white appearance-none cursor-pointer"
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest ml-1">Why do you want to partner with Eclipse Research? (Max 300 chars)</label>
              <textarea
                required
                maxLength={300}
                rows={3}
                value={formData.whyPartner}
                onChange={(e) => setFormData({ ...formData, whyPartner: e.target.value })}
                className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium text-white resize-none placeholder:text-gray-600"
                placeholder="Tell us why you're a good fit..."
              />
              <div className="text-[10px] text-gray-500 text-right font-mono">{formData.whyPartner.length}/300</div>
            </div>

            <button
              disabled={isSubmitting}
              type="submit"
              className="w-full py-5 bg-emerald-500 text-black font-bold rounded-2xl hover:bg-emerald-400 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Submit Application <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

const AffiliateView = ({ onBack }: { onBack: () => void }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <section className="py-24 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <AffiliateApplicationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[3rem] border border-gray-100 p-12 shadow-sm"
      >
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-black mb-12 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Research
        </button>

        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-6 leading-tight">Become a Research Contributor</h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            We're selectively accepting researchers and content creators to document their protocols and share findings with their audience. Contributors receive a research stipend for every order generated through their work.
          </p>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-8 py-4 bg-emerald-500 text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
          >
            Apply to Contribute
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {[
            { 
              title: "Research Stipend", 
              desc: "Earn a competitive stipend for every order attributed to your documentation.",
              icon: <CreditCard className="w-6 h-6" />
            },
            { 
              title: "Contribution Tracking", 
              desc: "Monitor your referrals, stipend earnings, and tier progress through your contributor dashboard.",
              icon: <Eye className="w-6 h-6" />
            },
            { 
              title: "Direct Access", 
              desc: "Accepted contributors get priority communication with our team and early access to new compounds.",
              icon: <MessageSquare className="w-6 h-6" />
            }
          ].map((benefit, i) => (
            <div key={i} className="p-8 bg-gray-50 rounded-[2rem] border border-gray-100">
              <div className="text-emerald-600 mb-6">{benefit.icon}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">{benefit.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{benefit.desc}</p>
            </div>
          ))}
        </div>

        {/* How It Works */}
        <div className="mb-24">
          <h2 className="text-2xl font-bold text-gray-900 mb-12 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { 
                step: "01", 
                title: "Apply", 
                desc: "Submit a short application. We review all submissions within 48 hours and accept based on content quality and research focus." 
              },
              { 
                step: "02", 
                title: "Document Your Research", 
                desc: "Share your protocols, progress updates, and findings with your audience using your unique contributor code." 
              },
              { 
                step: "03", 
                title: "Receive Your Stipend", 
                desc: "Earn on every order placed through your code. Hit milestones to unlock higher tiers and free supply." 
              }
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold text-lg mb-6 shadow-lg shadow-emerald-500/20">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Content Framework */}
        <div className="mb-24">
          <h2 className="text-2xl font-bold text-gray-900 mb-12 text-center">What Documentation Looks Like</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { 
                title: "Baseline Post", 
                emoji: "📋",
                desc: "Introduce your research focus and the compounds you're working with." 
              },
              { 
                title: "Weekly Updates", 
                emoji: "📈",
                desc: "Share ongoing observations and protocol adjustments with your audience." 
              },
              { 
                title: "Final Summary", 
                emoji: "🔬",
                desc: "Publish your complete protocol findings. This is what builds your credibility and our community." 
              }
            ].map((item, i) => (
              <div key={i} className="p-8 bg-emerald-50/50 rounded-[2rem] border border-emerald-100/50 text-center">
                <div className="text-4xl mb-4">{item.emoji}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contribution Tiers */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-12 text-center">Contributor Tiers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {[
              { 
                tier: "FIELD RESEARCHER", 
                referrals: "0–10 referrals", 
                stipend: "15% stipend", 
                perk: "Highly discounted supply access" 
              },
              { 
                tier: "SENIOR CONTRIBUTOR", 
                referrals: "11–25 referrals", 
                stipend: "18% stipend", 
                perk: "$50 free supply credit per month" 
              },
              { 
                tier: "PRINCIPAL INVESTIGATOR", 
                referrals: "25+ referrals", 
                stipend: "22% stipend", 
                perk: "$100 free supply credit per month" 
              },
              { 
                tier: "ECLIPSE AMBASSADOR", 
                referrals: "100+ referrals", 
                stipend: "30% stipend", 
                perk: "$500 free supply credit per month",
                extraPerks: [
                  "Dedicated account manager",
                  "Early access to all new compounds",
                  "Co-branded content opportunities"
                ],
                isPremium: true
              }
            ].map((tier, i) => (
              <div 
                key={i} 
                className={`p-8 rounded-[2rem] border text-center transition-all duration-300 relative group flex flex-col h-full
                  ${tier.isPremium 
                    ? 'bg-black border-amber-500/50 shadow-[0_0_30px_-10px_rgba(245,158,11,0.3)] scale-[1.02] z-10' 
                    : 'bg-black border-gray-800 hover:border-emerald-500/50'
                  }`}
              >
                {tier.isPremium && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
                    <Crown className="w-3 h-3" /> ELITE
                  </div>
                )}
                
                <h3 className={`font-bold uppercase tracking-widest text-[10px] mb-4 
                  ${tier.isPremium ? 'text-amber-500' : 'text-emerald-500'}`}
                >
                  {tier.tier}
                </h3>
                
                <div className="text-white text-3xl font-bold mb-2">{tier.stipend}</div>
                <p className={`${tier.isPremium ? 'text-amber-500' : 'text-emerald-500'} font-bold text-sm mb-4`}>
                  {tier.perk}
                </p>
                
                {(tier as any).extraPerks && (
                  <ul className="text-left space-y-2 mb-6 flex-grow">
                    {(tier as any).extraPerks.map((ep: string, j: number) => (
                      <li key={j} className="text-[10px] text-gray-400 flex items-start gap-2">
                        <Check className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                        <span>{ep}</span>
                      </li>
                    ))}
                  </ul>
                )}
                
                <p className="text-gray-400 text-xs font-bold uppercase tracking-tighter mt-auto pt-4 border-t border-gray-800">
                  {tier.referrals}
                </p>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-400 text-xs mt-10">Tiers are evaluated monthly based on verified referral sales.</p>
        </div>

        {/* Milestone Rewards */}
        <div className="mb-24 pt-12">
          <div className="max-w-3xl mx-auto">
            <div className="relative p-12 bg-black rounded-[3rem] border-2 border-emerald-500/30 shadow-[0_0_50px_-12px_rgba(16,185,129,0.2)] text-center overflow-hidden group">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/10 blur-[100px] -z-10 group-hover:bg-emerald-500/20 transition-colors duration-500" />
              
              <div className="flex justify-center mb-8">
                <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                  <Star className="w-10 h-10 fill-current" />
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-4">Milestone Rewards</h3>
              <p className="text-gray-400 text-lg leading-relaxed max-w-xl mx-auto">
                Reach 11 documented referrals to unlock your first $50 monthly supply credit. Reach 25 to unlock $100 monthly supply credit. Reach 100 to have your entire research supply covered by Eclipse.
              </p>
              
              <div className="mt-8 flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((_, i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-emerald-500/20" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-24 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-12 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              { 
                q: "When do I receive my stipend?", 
                a: "Stipends are processed monthly. Once your documented referrals are verified, earnings are deposited into your account within the first 10 business days of the following month." 
              },
              { 
                q: "How are referrals tracked?", 
                a: "We use a combination of unique contributor codes and advanced tracking links. Every order that uses your code is automatically attributed to your dashboard in real-time." 
              },
              { 
                q: "What content platforms are accepted?", 
                a: "We primarily work with researchers on YouTube, Instagram, X (Twitter), and specialized research forums. We value high-quality, long-form educational content across all platforms." 
              },
              { 
                q: "What makes a strong application?", 
                a: "A strong application demonstrates a clear research focus, a history of quality documentation, and an engaged audience interested in scientific discovery and protocol optimization." 
              }
            ].map((faq, i) => (
              <div key={i} className="border border-gray-100 rounded-2xl overflow-hidden">
                <button 
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-bold text-gray-900">{faq.q}</span>
                  {openFaq === i ? <ChevronUp className="w-5 h-5 text-emerald-500" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="p-6 pt-0 text-gray-500 text-sm leading-relaxed">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-black rounded-[2.5rem] p-12 text-white text-center">
          <h2 className="text-3xl font-bold mb-6 leading-tight">Ready to contribute to the research community?</h2>
          <p className="text-gray-400 mb-10 max-w-xl mx-auto text-lg">
            We selectively accept contributors who are serious about documenting their work. Applications are reviewed within 48 hours.
          </p>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-10 py-5 bg-emerald-500 text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all active:scale-95 shadow-xl shadow-emerald-500/20"
          >
            Apply to Contribute
          </button>
        </div>
      </motion.div>
    </section>
  );
};

const AccountView = ({ onNavigate, onEditOrder }: { onNavigate: (view: any) => void, onEditOrder: (order: any) => void }) => {
  const { user, logout, isAdmin, isFreeShippingEnabled, toggleFreeShipping } = useAuth();
  const [activeTab, setActiveTab] = useState<'orders' | 'details' | 'addresses' | 'rewards'>('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editData, setEditData] = useState({ firstName: '', lastName: '', phone: '' });
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({ street: '', unitNumber: '', city: '', state: '', zip: '' });
  const [isDeletingOrder, setIsDeletingOrder] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'orders'), 
      or(
        where('userId', '==', user.uid),
        where('customerEmail', '==', user.email)
      ),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeOrders = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setProfile(data);
        setEditData({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          phone: data.phone || ''
        });
      }
    });

    return () => {
      unsubscribeOrders();
      unsubscribeProfile();
    };
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    try {
      const sanitizedData = sanitizeData(editData);
      await updateDoc(doc(db, 'users', user.uid), {
        ...sanitizedData,
        displayName: `${sanitizedData.firstName} ${sanitizedData.lastName}`
      });
      setIsEditingProfile(false);
    } catch (error) {
      console.error(error);
      alert('Error updating profile');
    }
  };

  const handleAddAddress = async () => {
    if (!user || !profile) return;
    try {
      const sanitizedAddress = sanitizeData(newAddress);
      const updatedAddresses = [...(profile.addresses || []), { ...sanitizedAddress, isDefault: (profile.addresses || []).length === 0 }];
      await updateDoc(doc(db, 'users', user.uid), {
        addresses: updatedAddresses
      });
      setIsAddingAddress(false);
      setNewAddress({ street: '', unitNumber: '', city: '', state: '', zip: '' });
    } catch (error) {
      console.error(error);
      alert('Error adding address');
    }
  };

  const removeAddress = async (index: number) => {
    if (!user || !profile) return;
    try {
      const updatedAddresses = profile.addresses.filter((_: any, i: number) => i !== index);
      await updateDoc(doc(db, 'users', user.uid), {
        addresses: updatedAddresses
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    const path = `orders/${orderId}`;
    try {
      await deleteDoc(doc(db, 'orders', orderId));
      setIsDeletingOrder(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleUpdateOrder = async () => {
    // Moved to AppContent
  };

  if (!user) return null;

  const tabs = [
    { id: 'orders', label: 'My Orders', icon: ShoppingBag },
    { id: 'details', label: 'Account Details', icon: UserIcon },
    { id: 'addresses', label: 'Addresses', icon: MapPin },
    { id: 'rewards', label: 'Rewards', icon: Gift },
  ];

  return (
    <section className="py-8 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row gap-6 md:gap-12">
        {/* Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white rounded-3xl border border-gray-100 p-3 md:p-6 sticky top-32">
            <div className="flex items-center gap-3 mb-3 md:mb-8">
              <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || user.email}&background=random`} alt="" className="w-10 md:w-12 h-10 md:h-12 rounded-full border border-gray-100" />
              <div>
                <h2 className="font-bold text-gray-900 leading-tight">{profile?.firstName || 'Researcher'}</h2>
                <p className="text-xs text-gray-400 truncate w-32">{user.email}</p>
              </div>
            </div>

            <nav className="space-y-1 md:space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-3 md:px-4 py-1.5 md:py-3 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-black text-white shadow-lg shadow-black/10' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
              <div className="pt-4 mt-4 border-t border-gray-50">
                {isAdmin && (
                  <button 
                    onClick={() => onNavigate('admin')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-emerald-600 hover:bg-emerald-50 transition-all mb-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Admin Panel
                  </button>
                )}
                <button 
                  onClick={() => { logout(); onNavigate('home'); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            {activeTab === 'orders' && (
              <motion.div
                key="orders"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold text-gray-900 mb-8">Order History</h2>
                {orders.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-12 text-center">
                      <Package className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                      <p className="text-gray-500 font-medium">No orders yet.</p>
                      <button onClick={() => onNavigate('shop')} className="mt-4 text-emerald-600 font-bold text-sm">Start Researching</button>
                    </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div key={order.id} className="bg-white rounded-3xl border border-gray-100 p-6 hover:shadow-md transition-all">
                        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Order ID: {order.orderId || order.id}</p>
                              <p className="text-sm font-medium text-gray-500">Date: {order.createdAt?.toDate().toLocaleDateString()}</p>
                            </div>
                          <div className="flex items-center gap-3">
                            <div className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                              order.status === 'shipped' || order.status === 'fulfilled' ? 'bg-emerald-50 text-emerald-600' : 
                              order.status === 'paid' ? 'bg-blue-50 text-blue-600' : 
                              'bg-amber-50 text-amber-600'
                            }`}>
                              {order.status}
                            </div>
                          </div>
                        </div>
                        {order.trackingNumber && (
                          <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Truck className="w-4 h-4 text-emerald-600" />
                              <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Tracking Number</p>
                                <p className="text-sm font-mono font-bold text-gray-900">{order.trackingNumber}</p>
                              </div>
                            </div>
                            {order.status === 'shipped' && (
                              <a 
                                href={`https://tools.usps.com/go/TrackConfirmAction?tLabels=${order.trackingNumber}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
                              >
                                Track Package <ChevronRight className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}
                        <div className="space-y-3 mb-6">
                          {order.items.map((item: any, i: number) => (
                            <div key={i} className="flex justify-between items-center text-sm">
                              <span className="text-gray-600">{item.name} <span className="text-gray-400">x{item.quantity}</span></span>
                              <span className="font-bold text-gray-900">${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
                          <span className="font-bold text-gray-900">Total Amount</span>
                          <span className="text-xl font-bold text-emerald-600">${order.total.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'details' && (
              <motion.div
                key="details"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white rounded-3xl border border-gray-100 p-8"
              >
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">Account Details</h2>
                  {!isEditingProfile && (
                    <button 
                      onClick={() => setIsEditingProfile(true)}
                      className="flex items-center gap-2 text-sm font-bold text-emerald-600 hover:opacity-70"
                    >
                      <Edit2 className="w-4 h-4" /> Edit Profile
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">First Name</label>
                    {isEditingProfile ? (
                      <input 
                        type="text" 
                        value={editData.firstName} 
                        onChange={(e) => setEditData({...editData, firstName: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-black transition-all"
                      />
                    ) : (
                      <p className="text-gray-900 font-medium">{profile?.firstName || '—'}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Last Name</label>
                    {isEditingProfile ? (
                      <input 
                        type="text" 
                        value={editData.lastName} 
                        onChange={(e) => setEditData({...editData, lastName: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-black transition-all"
                      />
                    ) : (
                      <p className="text-gray-900 font-medium">{profile?.lastName || '—'}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email Address</label>
                    <p className="text-gray-900 font-medium">{user.email}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone Number</label>
                    {isEditingProfile ? (
                      <input 
                        type="text" 
                        value={editData.phone} 
                        onChange={(e) => setEditData({...editData, phone: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-black transition-all"
                      />
                    ) : (
                      <p className="text-gray-900 font-medium">{profile?.phone || '—'}</p>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="mt-8 pt-8 border-t border-gray-100">
                    <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                          <Truck className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">Personal Free Shipping</p>
                          <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wider">Admin Exclusive Perk</p>
                        </div>
                      </div>
                      <button 
                        onClick={toggleFreeShipping}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isFreeShippingEnabled ? 'bg-emerald-500' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isFreeShippingEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>
                )}

                {isEditingProfile && (
                  <div className="mt-12 flex gap-4">
                    <button 
                      onClick={handleUpdateProfile}
                      className="px-8 py-3 bg-black text-white font-bold rounded-xl flex items-center gap-2 hover:bg-emerald-600 transition-all"
                    >
                      <Save className="w-4 h-4" /> Save Changes
                    </button>
                    <button 
                      onClick={() => setIsEditingProfile(false)}
                      className="px-8 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'addresses' && (
              <motion.div
                key="addresses"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">Saved Addresses</h2>
                  <button 
                    onClick={() => setIsAddingAddress(true)}
                    className="flex items-center gap-2 text-sm font-bold text-emerald-600 hover:opacity-70"
                  >
                    <Plus className="w-4 h-4" /> Add New
                  </button>
                </div>

                {isAddingAddress && (
                  <div className="bg-white rounded-3xl border border-emerald-200 p-8 mb-8">
                    <h3 className="font-bold mb-6">New Shipping Address</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input 
                        placeholder="Street Address" 
                        className="md:col-span-2 px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-black"
                        value={newAddress.street}
                        onChange={e => setNewAddress({...newAddress, street: e.target.value})}
                      />
                      <input 
                        placeholder="Unit / Suite (Optional)" 
                        className="md:col-span-2 px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-black"
                        value={newAddress.unitNumber}
                        onChange={e => setNewAddress({...newAddress, unitNumber: e.target.value})}
                      />
                      <input 
                        placeholder="City" 
                        className="px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-black"
                        value={newAddress.city}
                        onChange={e => setNewAddress({...newAddress, city: e.target.value})}
                      />
                      <input 
                        placeholder="State" 
                        className="px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-black"
                        value={newAddress.state}
                        onChange={e => setNewAddress({...newAddress, state: e.target.value})}
                      />
                      <input 
                        placeholder="ZIP Code" 
                        className="px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-black"
                        value={newAddress.zip}
                        onChange={e => setNewAddress({...newAddress, zip: e.target.value})}
                      />
                    </div>
                    <div className="mt-6 flex gap-4">
                      <button onClick={handleAddAddress} className="px-6 py-2 bg-black text-white font-bold rounded-xl">Save Address</button>
                      <button onClick={() => setIsAddingAddress(false)} className="px-6 py-2 bg-gray-100 text-gray-600 font-bold rounded-xl">Cancel</button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {profile?.addresses?.map((addr: any, i: number) => (
                    <div key={i} className="bg-white rounded-3xl border border-gray-100 p-6 relative group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-gray-400" />
                        </div>
                        {addr.isDefault && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md uppercase tracking-widest">Default</span>
                        )}
                      </div>
                      <p className="text-gray-900 font-medium mb-1">{addr.street}{addr.unitNumber ? `, ${addr.unitNumber}` : ''}</p>
                      <p className="text-gray-500 text-sm">{addr.city}, {addr.state} {addr.zip}</p>
                      <button 
                        onClick={() => removeAddress(i)}
                        className="absolute top-6 right-6 p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(!profile?.addresses || profile.addresses.length === 0) && !isAddingAddress && (
                    <div className="md:col-span-2 bg-white rounded-3xl border border-dashed border-gray-200 p-12 text-center">
                      <p className="text-gray-400 font-medium">No saved addresses yet.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'rewards' && (
              <motion.div
                key="rewards"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-black rounded-[2.5rem] p-10 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 blur-[100px] rounded-full -mr-32 -mt-32" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-6">
                        <Star className="w-6 h-6 text-emerald-400 fill-emerald-400" />
                        <span className="text-emerald-400 font-bold tracking-[0.3em] text-xs uppercase">Research Points</span>
                      </div>
                      <div className="flex items-end gap-4">
                        <span className="text-6xl font-bold tracking-tighter">{profile?.rewardPoints || 0}</span>
                        <span className="text-lg font-bold text-gray-500 mb-2 uppercase tracking-widest">Points</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-500 rounded-[2.5rem] p-10 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[100px] rounded-full -mr-32 -mt-32" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-6">
                        <Gift className="w-6 h-6 text-white" />
                        <span className="text-white/80 font-bold tracking-[0.3em] text-xs uppercase">Store Credit</span>
                      </div>
                      <div className="flex items-end gap-4">
                        <span className="text-6xl font-bold tracking-tighter">${profile?.storeCredit || 0}</span>
                        <span className="text-lg font-bold text-white/60 mb-2 uppercase tracking-widest">USD</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] border border-gray-100 p-10">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-gray-900">Referral History</h2>
                    <button 
                      onClick={() => onNavigate('refer')}
                      className="text-emerald-600 font-bold text-sm hover:underline"
                    >
                      Get Referral Link
                    </button>
                  </div>
                  
                  {profile?.referrals && profile.referrals.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-50">
                            <th className="pb-4 font-bold">Friend</th>
                            <th className="pb-4 font-bold">Date</th>
                            <th className="pb-4 font-bold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {profile.referrals.map((ref: any, i: number) => (
                            <tr key={i} className="text-sm">
                              <td className="py-4 text-gray-900 font-medium">
                                {ref.email.substring(0, 3)}***@{ref.email.split('@')[1]}
                              </td>
                              <td className="py-4 text-gray-500">
                                {ref.date ? new Date(ref.date.seconds * 1000).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="py-4">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  ref.status === 'credited' ? 'bg-emerald-50 text-emerald-600' :
                                  ref.status === 'ineligible' ? 'bg-red-50 text-red-600' :
                                  'bg-blue-50 text-blue-600'
                                }`}>
                                  {ref.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                      <p className="text-gray-400 font-medium">No referrals yet.</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-3xl border border-gray-100 p-6">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">Earn as you shop</h3>
                    <p className="text-sm text-gray-500">Get 1 point for every $1 spent on research materials.</p>
                  </div>
                  <div className="bg-white rounded-3xl border border-gray-100 p-6">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">Redeem for discounts</h3>
                    <p className="text-sm text-gray-500">Every 100 points equals $5 off your next order.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Edit Order Modal Removed - Now uses full checkout */}

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {isDeletingOrder && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl text-center"
              >
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trash2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Delete Order?</h3>
                <p className="text-gray-500 mb-8 font-medium">This action cannot be undone. Are you sure you want to delete this order?</p>
                
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => handleDeleteOrder(isDeletingOrder)}
                    className="w-full py-4 bg-red-500 text-white font-bold rounded-2xl hover:bg-red-600 transition-all"
                  >
                    Delete Order
                  </button>
                  <button 
                    onClick={() => setIsDeletingOrder(null)}
                    className="w-full py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all"
                  >
                    Keep Order
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'orders' | 'coas' | 'inventory' | 'settings' | 'affiliates' | 'promos'>('inventory');
  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [coaRequests, setCoaRequests] = useState<any[]>([]);
  const [affiliateApplications, setAffiliateApplications] = useState<any[]>([]);
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [dosages, setDosages] = useState<{ label: string; image: string; price?: number; originalPrice?: number }[]>([]);
  const [mainPrice, setMainPrice] = useState<number>(0);
  const [mainOriginalPrice, setMainOriginalPrice] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (editingProduct) {
      setDosages(editingProduct.dosages || []);
      setMainPrice(editingProduct.price || 0);
      setMainOriginalPrice(editingProduct.originalPrice);
    } else {
      setDosages([]);
      setMainPrice(0);
      setMainOriginalPrice(undefined);
    }
  }, [editingProduct]);

  const [showArchived, setShowArchived] = useState(false);
  const [newPromo, setNewPromo] = useState({ code: '', discount: 0 });
  const [isDeletingPromo, setIsDeletingPromo] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    const usersQuery = collection(db, 'users');
    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const coaQuery = collection(db, 'coa_requests');
    const affiliateQuery = collection(db, 'affiliate_applications');
    const productsQuery = collection(db, 'products');
    const promoQuery = collection(db, 'promo_codes');

    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeCoas = onSnapshot(coaQuery, (snapshot) => {
      setCoaRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeAffiliates = onSnapshot(affiliateQuery, (snapshot) => {
      setAffiliateApplications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribePromos = onSnapshot(promoQuery, (snapshot) => {
      setPromoCodes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      if (!snapshot.empty) {
        setProductsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      } else {
        setProductsList([]);
      }
      setLoading(false);
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'site'), (snapshot) => {
      if (snapshot.exists()) {
        setSiteSettings(snapshot.data() as SiteSettings);
      }
    });

    return () => {
      unsubscribeUsers();
      unsubscribeOrders();
      unsubscribeCoas();
      unsubscribeAffiliates();
      unsubscribePromos();
      unsubscribeProducts();
      unsubscribeSettings();
    };
  }, []);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      
      if (newStatus === 'shipped' || newStatus === 'delivered') {
        const orderSnap = await getDoc(orderRef);
        if (orderSnap.exists()) {
          const orderData = orderSnap.data();
          if (!orderData.referralCredited) {
            await processReferralCredit(orderId, orderData);
          }
        }
      }

      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Failed to update order status.');
    }
  };

  const processReferralCredit = async (orderId: string, orderData: any) => {
    if (!orderData.referralCode || orderData.referralCredited) return;

    try {
      console.log('Referral Flow: Processing simplified referral for order:', orderId);
      const referrerId = orderData.referralCode;
      const referrerRef = doc(db, 'users', referrerId);
      const creditAmount = siteSettings?.referralCreditAmount || 10;
      
      // Add credit to storeCredit
      await updateDoc(referrerRef, {
        storeCredit: increment(creditAmount)
      });

      // Update order to mark as credited
      await updateDoc(doc(db, 'orders', orderId), {
        referralCredited: true
      });

      console.log(`Referral Flow: $${creditAmount} credit applied to user:`, referrerId);
    } catch (error) {
      console.error('Referral Flow Error:', error);
    }
  };

  const markOrderShipped = async (orderId: string) => {
    const currentOrder = orders.find(o => o.id === orderId);
    const trackingNumber = trackingInputs[orderId] !== undefined 
      ? trackingInputs[orderId] 
      : currentOrder?.trackingNumber || '';

    try {
      console.log('Admin: Updating tracking for order:', orderId);
      const orderRef = doc(db, 'orders', orderId);
      
      // Only process referral if moving to 'shipped' for the first time
      if (currentOrder && currentOrder.status !== 'shipped') {
        await processReferralCredit(orderId, currentOrder);
      }

      await updateDoc(orderRef, {
        status: 'shipped',
        trackingNumber: trackingNumber.trim(),
        updatedAt: serverTimestamp()
      });

      // Clear local input state so it reverts to showing the DB value
      setTrackingInputs(prev => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Failed to update order.');
    }
  };

  const updateCoaStatus = async (requestId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'coa_requests', requestId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating COA request:', error);
      alert('Failed to update request status.');
    }
  };

  const updateAffiliateStatus = async (applicationId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'affiliate_applications', applicationId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating Research Affiliate application:', error);
      alert('Failed to update application status.');
    }
  };

  const addPromoCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedCode = sanitizeInput(newPromo.code).toUpperCase().trim();
    if (!sanitizedCode || newPromo.discount <= 0) return;
    try {
      await addDoc(collection(db, 'promo_codes'), {
        code: sanitizedCode,
        discount: Number(newPromo.discount),
        isActive: true,
        createdAt: serverTimestamp()
      });
      setNewPromo({ code: '', discount: 0 });
      alert('Promo code added successfully!');
    } catch (error) {
      console.error('Error adding promo code:', error);
      alert('Failed to add promo code.');
    }
  };

  const togglePromoStatus = async (promoId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'promo_codes', promoId), {
        isActive: !currentStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error toggling promo status:', error);
      alert('Failed to update promo code.');
    }
  };

  const deletePromoCode = async (promoId: string) => {
    try {
      await deleteDoc(doc(db, 'promo_codes', promoId));
      setIsDeletingPromo(null);
    } catch (error) {
      console.error('Error deleting promo code:', error);
      alert('Failed to delete promo code.');
    }
  };

  const seedProducts = async () => {
    if (!window.confirm('This will restore all default products to your inventory. Existing products with the same IDs will be updated. Continue?')) return;
    try {
      for (const p of INITIAL_PRODUCTS) {
        const { id, ...data } = p;
        await setDoc(doc(db, 'products', id), {
          ...data,
          stock: p.stock !== undefined ? p.stock : 50,
          inStock: p.inStock !== undefined ? p.inStock : true,
          lowStockThreshold: p.lowStockThreshold || 10,
          isArchived: p.isArchived || false,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        }, { merge: true });
      }
      alert('Inventory restored successfully!');
    } catch (error) {
      console.error('Error seeding products:', error);
      alert('Failed to restore inventory.');
    }
  };

  const updateDosageStock = async (productId: string, dosageIdx: number, newStock: number) => {
    try {
      const product = productsList.find(p => p.id === productId);
      if (!product || !product.dosages) return;

      const newDosages = [...product.dosages];
      newDosages[dosageIdx] = {
        ...newDosages[dosageIdx],
        stock: newStock,
        inStock: newStock > 0
      };

      await updateDoc(doc(db, 'products', productId), {
        dosages: newDosages,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating dosage stock:', error);
    }
  };

  const updateDosageThreshold = async (productId: string, dosageIdx: number, newThreshold: number) => {
    try {
      const product = productsList.find(p => p.id === productId);
      if (!product || !product.dosages) return;

      const newDosages = [...product.dosages];
      newDosages[dosageIdx] = {
        ...newDosages[dosageIdx],
        lowStockThreshold: newThreshold
      };

      await updateDoc(doc(db, 'products', productId), {
        dosages: newDosages,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating dosage threshold:', error);
    }
  };

  const inventoryStats = productsList.reduce((acc, product) => {
    if (product.isArchived && !showArchived) return acc;
    
    // Calculate main product value and count
    const mainStock = Number(product.stock) || 0;
    const mainPrice = Number(product.price) || 0;
    let productValue = mainPrice * mainStock;
    let productCount = mainStock;
    
    // Add value and count of all dosage variations if they exist
    if (product.dosages && product.dosages.length > 0) {
      product.dosages.forEach((dosage) => {
        const dPrice = Number(dosage.price) || mainPrice;
        const dStock = Number(dosage.stock) || 0;
        productValue += dPrice * dStock;
        productCount += dStock;
      });
    }
    
    return {
      totalValue: acc.totalValue + productValue,
      totalItems: acc.totalItems + productCount
    };
  }, { totalValue: 0, totalItems: 0 });

  if (loading) {
    return (
      <div className="pt-32 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-12">
        <div className="w-full lg:w-auto">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 mb-2">Admin Control Panel</h1>
          <p className="text-sm md:text-base text-gray-500">Manage research accounts and track laboratory orders.</p>
        </div>
        <div className="w-full lg:w-auto overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex bg-gray-100 p-1 rounded-2xl w-max min-w-full">
            <button 
              onClick={() => setActiveTab('users')}
              className={`px-4 md:px-6 py-2 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
            >
              Users
            </button>
            <button 
              onClick={() => setActiveTab('orders')}
              className={`px-4 md:px-6 py-2 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'orders' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
            >
              Orders
            </button>
            <button 
              onClick={() => setActiveTab('coas')}
              className={`px-4 md:px-6 py-2 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'coas' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
            >
              COA Requests
            </button>
            <button 
              onClick={() => setActiveTab('inventory')}
              className={`px-4 md:px-6 py-2 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'inventory' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
            >
              Inventory
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`px-4 md:px-6 py-2 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'settings' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
            >
              Settings
            </button>
            <button 
              onClick={() => setActiveTab('affiliates')}
              className={`px-4 md:px-6 py-2 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'affiliates' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
            >
              Affiliates
            </button>
            <button 
              onClick={() => setActiveTab('promos')}
              className={`px-4 md:px-6 py-2 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'promos' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
            >
              Promos
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'inventory' && (
        <div className="mb-8 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <button 
              onClick={() => setShowArchived(!showArchived)}
              className={`px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
                showArchived 
                  ? 'bg-gray-900 text-white border-gray-900' 
                  : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'
              }`}
            >
              <Archive className="w-4 h-4" /> {showArchived ? 'Showing All' : 'Show Archived'}
            </button>

            <div className="px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-none mb-1">Total Inventory Value</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-bold text-gray-900 leading-none">
                    ${inventoryStats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                    ({inventoryStats.totalItems} Units)
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={seedProducts}
              className={`px-6 py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm ${
                productsList.length === 0 
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-100' 
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100'
              }`}
            >
              <Package className="w-4 h-4" /> {productsList.length === 0 ? 'Import Products' : 'Restore Default'}
            </button>
            <button 
              onClick={() => {
                setEditingProduct(null);
                setIsProductModalOpen(true);
              }}
              className="px-6 py-3 bg-black text-white font-bold rounded-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>
        </div>
      )}

      {activeTab === 'users' ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">User</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Role</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-black/5 rounded-full flex items-center justify-center text-xs font-bold">
                          {u.firstName?.[0]}{u.lastName?.[0]}
                        </div>
                        <span className="font-bold text-sm">{u.displayName || `${u.firstName} ${u.lastName}`}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        u.role === 'admin' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {u.role || 'user'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-50">
            {users.map((u) => (
              <div key={u.id} className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black/5 rounded-full flex items-center justify-center text-sm font-bold">
                    {u.firstName?.[0]}{u.lastName?.[0]}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{u.displayName || `${u.firstName} ${u.lastName}`}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    u.role === 'admin' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {u.role || 'user'}
                  </span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    Joined: {u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'inventory' ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Product</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Stock</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Threshold</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {productsList.filter(p => showArchived || !p.isArchived).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-24 text-center">
                      <div className="max-w-xs mx-auto">
                        <Package className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                        <h3 className="font-bold text-gray-900 mb-2">Inventory is Empty</h3>
                        <p className="text-sm text-gray-500 mb-6">
                          {showArchived 
                            ? "Your database is currently empty. Click the green button above to import all products."
                            : "No active products found. Try showing archived products or add a new one."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : productsList
                    .filter(p => showArchived || !p.isArchived)
                    .map((p) => {
                  const isLowStock = (p.stock || 0) <= (p.lowStockThreshold || 5) && (p.stock || 0) > 0;
                  const isOutOfStock = (p.stock || 0) <= 0;
                  
                  return (
                    <React.Fragment key={p.id}>
                      <tr className={`hover:bg-gray-50/50 transition-colors ${p.isArchived ? 'opacity-50' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-100" />
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{p.name}</p>
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider">{p.category} · {p.dosage}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <input 
                              type="number"
                              value={p.stock || 0}
                              onChange={async (e) => {
                                const newStock = parseInt(e.target.value) || 0;
                                await updateDoc(doc(db, 'products', p.id), {
                                  stock: newStock,
                                  inStock: newStock > 0
                                });
                              }}
                              className={`w-20 px-3 py-1.5 rounded-lg border text-sm font-bold outline-none focus:ring-2 focus:ring-black transition-all ${isLowStock ? 'bg-amber-50 border-amber-200 text-amber-700' : isOutOfStock ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-100'}`}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <input 
                            type="number"
                            value={p.lowStockThreshold || 5}
                            onChange={async (e) => {
                              const newThreshold = parseInt(e.target.value) || 0;
                              await updateDoc(doc(db, 'products', p.id), {
                                lowStockThreshold: newThreshold
                              });
                            }}
                            className="w-16 px-3 py-1.5 rounded-lg border border-gray-100 bg-gray-50 text-sm font-bold outline-none focus:ring-2 focus:ring-black transition-all"
                          />
                        </td>
                        <td className="px-6 py-4">
                          {p.isArchived ? (
                            <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500">Archived</span>
                          ) : isOutOfStock ? (
                            <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700">Restocking Soon</span>
                          ) : isLowStock ? (
                            <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">Low Stock</span>
                          ) : (
                            <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">Healthy</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => {
                                setEditingProduct(p);
                                setIsProductModalOpen(true);
                              }}
                              className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-all"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, 'products', p.id), {
                                    isArchived: !p.isArchived
                                  });
                                } catch (error) {
                                  console.error('Error toggling archive status:', error);
                                  alert('Failed to update product status.');
                                }
                              }}
                              title={p.isArchived ? 'Unarchive Product' : 'Archive Product'}
                              className={`p-2 rounded-lg transition-all ${
                                p.isArchived 
                                  ? 'text-emerald-500 bg-emerald-50 hover:bg-emerald-100' 
                                  : 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                              }`}
                            >
                              {p.isArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={async () => {
                                if (window.confirm(`Are you sure you want to PERMANENTLY DELETE ${p.name}? This cannot be undone.`)) {
                                  try {
                                    await deleteDoc(doc(db, 'products', p.id));
                                  } catch (error) {
                                    console.error('Error deleting product:', error);
                                    alert('Failed to delete product.');
                                  }
                                }
                              }}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Dosage Inventory Rows */}
                      {p.dosages && p.dosages.map((d, dIdx) => {
                        const dLowStock = (d.stock || 0) <= (d.lowStockThreshold || 5) && (d.stock || 0) > 0;
                        const dOutOfStock = (d.stock || 0) <= 0;
                        return (
                          <tr key={`${p.id}-${dIdx}`} className="bg-gray-50/30 border-b border-gray-50">
                            <td className="px-6 py-3 pl-16">
                              <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center text-[8px] font-bold text-emerald-700">
                                  {d.label}
                                </div>
                                <span className="text-xs text-gray-500 font-medium">{d.label} Version</span>
                              </div>
                            </td>
                            <td className="px-6 py-3">
                              <input 
                                type="number"
                                value={d.stock || 0}
                                onChange={(e) => updateDosageStock(p.id, dIdx, parseInt(e.target.value) || 0)}
                                className={`w-16 px-2 py-1 rounded-lg border text-xs font-bold outline-none focus:ring-2 focus:ring-black transition-all ${dLowStock ? 'bg-amber-50 border-amber-200 text-amber-700' : dOutOfStock ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-100'}`}
                              />
                            </td>
                            <td className="px-6 py-3">
                              <input 
                                type="number"
                                value={d.lowStockThreshold || 5}
                                onChange={(e) => updateDosageThreshold(p.id, dIdx, parseInt(e.target.value) || 0)}
                                className="w-14 px-2 py-1 rounded-lg border border-gray-100 bg-white text-xs font-bold outline-none focus:ring-2 focus:ring-black transition-all"
                              />
                            </td>
                            <td className="px-6 py-3" colSpan={2}>
                              {dOutOfStock ? (
                                <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider">Out of Stock</span>
                              ) : dLowStock ? (
                                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Low Stock</span>
                              ) : (
                                <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">In Stock</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-50">
            {productsList.filter(p => showArchived || !p.isArchived).length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500 italic">Inventory is empty.</p>
              </div>
            ) : productsList
                .filter(p => showArchived || !p.isArchived)
                .map((p) => {
              const isLowStock = (p.stock || 0) <= (p.lowStockThreshold || 5) && (p.stock || 0) > 0;
              const isOutOfStock = (p.stock || 0) <= 0;
              
              return (
                <div key={p.id} className={`p-6 space-y-4 ${p.isArchived ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img src={p.image} alt="" className="w-12 h-12 rounded-xl object-cover border border-gray-100" />
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{p.name}</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">{p.category} · {p.dosage}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setEditingProduct(p);
                          setIsProductModalOpen(true);
                        }}
                        className="p-2.5 bg-gray-50 text-gray-600 rounded-xl border border-gray-100"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'products', p.id), { isArchived: !p.isArchived });
                          } catch (error) {
                            console.error('Error toggling archive status:', error);
                          }
                        }}
                        className={`p-2.5 rounded-xl border ${p.isArchived ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}
                      >
                        {p.isArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Stock Level</label>
                      <input 
                        type="number"
                        value={p.stock || 0}
                        onChange={async (e) => {
                          const newStock = parseInt(e.target.value) || 0;
                          await updateDoc(doc(db, 'products', p.id), { stock: newStock, inStock: newStock > 0 });
                        }}
                        className={`w-full px-3 py-2 rounded-xl border text-sm font-bold outline-none focus:ring-2 focus:ring-black transition-all ${isLowStock ? 'bg-amber-50 border-amber-200 text-amber-700' : isOutOfStock ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-100'}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Threshold</label>
                      <input 
                        type="number"
                        value={p.lowStockThreshold || 5}
                        onChange={async (e) => {
                          const newThreshold = parseInt(e.target.value) || 0;
                          await updateDoc(doc(db, 'products', p.id), { lowStockThreshold: newThreshold });
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none focus:ring-2 focus:ring-black transition-all"
                      />
                    </div>
                  </div>

                  {p.dosages && p.dosages.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Dosage Versions</p>
                      <div className="space-y-2">
                        {p.dosages.map((d, dIdx) => (
                          <div key={dIdx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <span className="text-xs font-bold text-gray-700">{d.label}</span>
                            <div className="flex items-center gap-3">
                              <input 
                                type="number"
                                value={d.stock || 0}
                                onChange={(e) => updateDosageStock(p.id, dIdx, parseInt(e.target.value) || 0)}
                                className="w-14 px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-center"
                              />
                              <span className={`text-[9px] font-bold uppercase tracking-wider ${d.stock > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {d.stock > 0 ? 'In Stock' : 'Out'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : activeTab === 'orders' ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest w-10"></th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">ORDER ID</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Customer Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Shipping Address</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Referral</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tracking</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((o) => (
                  <React.Fragment key={o.id}>
                    <tr 
                      className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${expandedOrder === o.id ? 'bg-gray-50/80' : ''}`}
                      onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)}
                    >
                      <td className="px-6 py-4">
                        {expandedOrder === o.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-bold text-emerald-600">{o.orderId}</span>
                        <p className="text-[9px] text-gray-400 mt-1">
                          {o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString() : 'N/A'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">
                        {o.customerName || `${o.shippingInfo?.firstName} ${o.shippingInfo?.lastName}`}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {o.customerEmail || o.shippingInfo?.email}
                      </td>
                      <td className="px-6 py-4 text-[10px] text-gray-500 max-w-[200px] leading-relaxed">
                        {o.shippingAddress || `${o.shippingInfo?.address}${o.shippingInfo?.unitNumber ? `, ${o.shippingInfo.unitNumber}` : ''}, ${o.shippingInfo?.city}, ${o.shippingInfo?.state} ${o.shippingInfo?.zip}`}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">
                        ${(o.total || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          o.status === 'shipped' || o.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : 
                          o.status === 'awaiting tracking' ? 'bg-blue-100 text-blue-700' :
                          o.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                          'bg-red-100 text-red-700'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {o.referralCode ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-gray-500 truncate max-w-[120px]">
                              {users.find(u => u.id === o.referralCode)?.email || 'Unknown User'}
                            </span>
                            {o.referralCredited ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[8px] font-bold bg-emerald-100 text-emerald-700 uppercase tracking-wider w-fit">
                                Credited
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[8px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wider w-fit">
                                Pending
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2 min-w-[200px]">
                          <div className="relative flex-1">
                            <input 
                              type="text"
                              placeholder="Tracking #"
                              value={o.id in trackingInputs ? trackingInputs[o.id] : (o.trackingNumber || '')}
                              onChange={(e) => setTrackingInputs({ ...trackingInputs, [o.id]: e.target.value })}
                              onClick={(e) => e.stopPropagation()}
                              onFocus={(e) => e.stopPropagation()}
                              className="text-[10px] w-full pl-3 pr-8 py-2 bg-gray-50 border border-gray-100 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                            />
                            {(trackingInputs[o.id] || o.trackingNumber) && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (trackingInputs[o.id] === '') {
                                    setTrackingInputs(prev => {
                                      const next = { ...prev };
                                      delete next[o.id];
                                      return next;
                                    });
                                  } else {
                                    setTrackingInputs({ ...trackingInputs, [o.id]: '' });
                                  }
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                markOrderShipped(o.id);
                              }}
                              className={`p-2 rounded-lg transition-all flex-shrink-0 ${
                                o.id in trackingInputs 
                                  ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-100' 
                                  : 'bg-gray-100 text-gray-400 hover:text-black'
                              }`}
                              title={o.status === 'shipped' ? 'Update Tracking' : 'Mark Shipped'}
                            >
                              {o.status === 'shipped' && !(o.id in trackingInputs) ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Truck className="w-3.5 h-3.5" />}
                            </button>
                            {o.trackingNumber && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(o.trackingNumber);
                                }}
                                className="p-2 bg-gray-50 text-gray-400 hover:text-emerald-500 rounded-lg transition-all"
                                title="Copy Tracking"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <select 
                          value={o.status}
                          onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                          className="text-[10px] font-bold uppercase tracking-widest bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="pending">Pending</option>
                          <option value="awaiting tracking">Awaiting Tracking</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                    </tr>
                    <AnimatePresence>
                      {expandedOrder === o.id && (
                        <tr>
                          <td colSpan={10} className="px-0 py-0 bg-gray-50/30">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 md:p-8 border-t border-gray-100">
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">Order Items</h4>
                                <div className="space-y-4">
                                  {(o.items || []).map((item: any, idx: number) => (
                                    <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm gap-4">
                                      <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden border border-gray-100">
                                          <img src={item.image} alt="" className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                          <p className="font-bold text-gray-900 text-sm">{item.name}</p>
                                          <p className="text-[10px] text-gray-400 uppercase tracking-wider">{item.dosage} · Qty: {item.quantity}</p>
                                        </div>
                                      </div>
                                      <div className="text-left sm:text-right">
                                        <p className="font-bold text-gray-900 text-sm">${(item.price * item.quantity).toFixed(2)}</p>
                                        <p className="text-[10px] text-gray-400">${item.price.toFixed(2)} each</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                
                                {o.bankfulResponse && (
                                  <div className="mt-8 pt-8 border-t border-gray-100">
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Bankful Transaction Details</h4>
                                    <pre className="bg-gray-900 text-emerald-400 p-6 rounded-2xl text-[10px] font-mono overflow-x-auto">
                                      {JSON.stringify(o.bankfulResponse, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-24 text-center text-gray-400 text-sm italic">
                      No orders found in the system.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-50">
            {orders.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-gray-500 italic">No orders found.</p>
              </div>
            ) : orders.map((o) => (
              <div key={o.id} className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)} className="cursor-pointer">
                    <span className="font-mono text-xs font-bold text-emerald-600 block mb-1">{o.orderId}</span>
                    <p className="font-bold text-gray-900 text-sm">{o.customerName || `${o.shippingInfo?.firstName} ${o.shippingInfo?.lastName}`}</p>
                    <p className="text-[10px] text-gray-400">
                      {o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">${(o.total || 0).toFixed(2)}</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider mt-1 ${
                      o.status === 'shipped' || o.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : 
                      o.status === 'awaiting tracking' ? 'bg-blue-100 text-blue-700' :
                      o.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                      'bg-red-100 text-red-700'
                    }`}>
                      {o.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Update Tracking</label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="Tracking #"
                        value={o.id in trackingInputs ? trackingInputs[o.id] : (o.trackingNumber || '')}
                        onChange={(e) => setTrackingInputs({ ...trackingInputs, [o.id]: e.target.value })}
                        className="flex-1 text-xs px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                      />
                      <button 
                        onClick={() => markOrderShipped(o.id)}
                        className={`p-2.5 rounded-xl transition-all ${o.id in trackingInputs ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}
                      >
                        <Truck className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <select 
                      value={o.status}
                      onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                      className="flex-1 text-[10px] font-bold uppercase tracking-widest bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 outline-none"
                    >
                      <option value="pending">Pending</option>
                      <option value="awaiting tracking">Awaiting Tracking</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <button 
                      onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)}
                      className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 bg-gray-50 border border-gray-100 rounded-xl"
                    >
                      {expandedOrder === o.id ? 'Close' : 'Details'}
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedOrder === o.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden pt-4 border-t border-gray-50"
                    >
                      <div className="space-y-3">
                        <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Shipping Address</p>
                          <p className="text-[10px] text-gray-600 leading-relaxed">
                            {o.shippingAddress || `${o.shippingInfo?.address}${o.shippingInfo?.unitNumber ? `, ${o.shippingInfo.unitNumber}` : ''}, ${o.shippingInfo?.city}, ${o.shippingInfo?.state} ${o.shippingInfo?.zip}`}
                          </p>
                        </div>
                        <div className="space-y-2">
                          {(o.items || []).map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-3 p-2 bg-white rounded-xl border border-gray-100">
                              <img src={item.image} alt="" className="w-8 h-8 rounded-lg object-cover" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-gray-900 truncate">{item.name}</p>
                                <p className="text-[8px] text-gray-400 uppercase tracking-wider">{item.dosage} · Qty: {item.quantity}</p>
                              </div>
                              <p className="text-[10px] font-bold text-gray-900">${(item.price * item.quantity).toFixed(2)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'affiliates' ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Applicant</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Social / Stats</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Niche / Usage</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Why Partner?</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {affiliateApplications.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="font-bold">{app.fullName}</p>
                        <p className="text-gray-400 text-[10px]">{app.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="text-emerald-600 font-bold">{app.socialHandle}</p>
                        <p className="text-gray-500 text-[10px]">{app.followerCount} followers</p>
                        <p className="text-gray-400 text-[10px]">{app.avgViews} avg views</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="font-medium text-gray-700">{app.niche}</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-tighter">Uses Peptides: <span className={app.usesPeptides === 'Yes' ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>{app.usesPeptides}</span></p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-gray-600 line-clamp-3 max-w-[200px] leading-relaxed italic">"{app.whyPartner}"</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        app.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 
                        app.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                        'bg-red-100 text-red-700'
                      }`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={app.status}
                        onChange={(e) => updateAffiliateStatus(app.id, e.target.value)}
                        className="text-[10px] font-bold uppercase tracking-widest bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {affiliateApplications.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400 text-sm italic">
                      No Research Affiliate applications found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-50">
            {affiliateApplications.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-gray-500 italic">No applications found.</p>
              </div>
            ) : affiliateApplications.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((app) => (
              <div key={app.id} className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{app.fullName}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">{app.email}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    app.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 
                    app.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                    'bg-red-100 text-red-700'
                  }`}>
                    {app.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Social Handle</p>
                    <p className="text-xs font-bold text-emerald-600">{app.socialHandle}</p>
                    <p className="text-[10px] text-gray-500">{app.followerCount} followers</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Niche</p>
                    <p className="text-xs font-bold text-gray-700">{app.niche}</p>
                    <p className="text-[10px] text-gray-500">Uses Peptides: {app.usesPeptides}</p>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Why Partner?</p>
                  <p className="text-[10px] text-gray-600 leading-relaxed italic">"{app.whyPartner}"</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Update Status</label>
                  <select 
                    value={app.status}
                    onChange={(e) => updateAffiliateStatus(app.id, e.target.value)}
                    className="w-full text-[10px] font-bold uppercase tracking-widest bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 outline-none"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'settings' ? (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm p-6 md:p-8">
            <h2 className="text-xl md:text-2xl font-bold mb-6 md:mb-8 flex items-center gap-2">
              <Clock className="w-6 h-6 text-emerald-500" /> Countdown Timer Settings
            </h2>
            
            <form 
              key={siteSettings ? 'loaded' : 'loading'}
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSavingSettings(true);
                const formData = new FormData(e.currentTarget);
                
                const days = parseInt(formData.get('days') as string) || 0;
                const hours = parseInt(formData.get('hours') as string) || 0;
                const minutes = parseInt(formData.get('minutes') as string) || 0;

                const oldDays = siteSettings?.durationDays || 0;
                const oldHours = siteSettings?.durationHours || 0;
                const oldMinutes = siteSettings?.durationMinutes || 0;
                
                let countdownTarget = siteSettings?.countdownTarget;
                const isExpired = countdownTarget ? new Date(countdownTarget).getTime() <= Date.now() : true;
                
                // Reset the target if duration changed, target is missing, or it's expired
                if (days !== oldDays || hours !== oldHours || minutes !== oldMinutes || !countdownTarget || isExpired) {
                  const durationMs = (days * 24 * 60 * 60 * 1000) + (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
                  countdownTarget = new Date(Date.now() + durationMs).toISOString();
                }

                const settingsData = sanitizeData({
                  countdownActive: formData.get('countdownActive') === 'on',
                  countdownText: (formData.get('countdownText') as string) || 'Flash Sale Ending In:',
                  countdownTarget,
                  durationDays: days,
                  durationHours: hours,
                  durationMinutes: minutes,
                  referralCreditAmount: parseFloat(formData.get('referralCreditAmount') as string) || 10,
                });

                try {
                  await setDoc(doc(db, 'settings', 'site'), settingsData, { merge: true });
                  alert('Settings saved successfully!');
                } catch (error) {
                  console.error('Error saving settings:', error);
                  alert('Failed to save settings. Check console for details.');
                } finally {
                  setIsSavingSettings(false);
                }
              }} 
              className="space-y-6"
            >
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <input 
                  type="checkbox" 
                  name="countdownActive" 
                  id="countdownActive"
                  defaultChecked={siteSettings?.countdownActive}
                  className="w-5 h-5 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="countdownActive" className="text-sm font-bold text-gray-700">Activate Countdown Timer</label>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Banner Text</label>
                <input 
                  name="countdownText" 
                  defaultValue={siteSettings?.countdownText || 'Flash Sale Ending In:'}
                  placeholder="e.g. Limited Time Offer Ends In:"
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none" 
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Countdown Duration</label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Days</label>
                    <input 
                      name="days" 
                      type="number"
                      min="0"
                      defaultValue={siteSettings?.durationDays || 0}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Hours</label>
                    <input 
                      name="hours" 
                      type="number"
                      min="0"
                      max="23"
                      defaultValue={siteSettings?.durationHours || 0}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Minutes</label>
                    <input 
                      name="minutes" 
                      type="number"
                      min="0"
                      max="59"
                      defaultValue={siteSettings?.durationMinutes || 0}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none" 
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 italic">Changing the duration will restart the countdown from the new time.</p>
              </div>

              <div className="pt-8 border-t border-gray-100">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Gift className="w-6 h-6 text-emerald-500" /> Referral Settings
                </h3>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Credit Amount ($)</label>
                  <input 
                    name="referralCreditAmount" 
                    type="number"
                    step="0.01"
                    defaultValue={siteSettings?.referralCreditAmount || 10}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none" 
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSavingSettings}
                className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingSettings ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {isSavingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>
        </div>
      ) : activeTab === 'promos' ? (
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm p-6 md:p-8">
            <h2 className="text-xl md:text-2xl font-bold mb-6 md:mb-8 flex items-center gap-2">
              <Plus className="w-6 h-6 text-emerald-500" /> Create New Promo Code
            </h2>
            <form onSubmit={addPromoCode} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 items-end">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Promo Code</label>
                <input 
                  type="text"
                  value={newPromo.code}
                  onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value })}
                  placeholder="e.g. RESEARCH20"
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none font-mono uppercase" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Discount %</label>
                <input 
                  type="number"
                  value={newPromo.discount || ''}
                  onChange={(e) => setNewPromo({ ...newPromo, discount: parseInt(e.target.value) || 0 })}
                  placeholder="e.g. 20"
                  min="1"
                  max="100"
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none" 
                />
              </div>
              <button type="submit" className="py-4 bg-black text-white rounded-xl font-bold hover:bg-emerald-600 transition-all flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" /> Add Code
              </button>
            </form>
          </div>

          <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto scrollbar-hide">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Code</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Discount</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {promoCodes.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((promo) => (
                    <tr key={promo.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">{promo.code}</span>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">{promo.discount}% OFF</td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => togglePromoStatus(promo.id, promo.isActive)}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                            promo.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {promo.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setIsDeletingPromo(promo.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {promoCodes.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-400 text-sm italic">
                        No promotional codes created yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-50">
              {promoCodes.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm text-gray-500 italic">No promo codes found.</p>
                </div>
              ) : promoCodes.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((promo) => (
                <div key={promo.id} className="p-6 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 text-xs">{promo.code}</span>
                    <p className="text-sm font-bold text-gray-900">{promo.discount}% OFF</p>
                    <button 
                      onClick={() => togglePromoStatus(promo.id, promo.isActive)}
                      className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider transition-all ${
                        promo.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {promo.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                  <button 
                    onClick={() => setIsDeletingPromo(promo.id)}
                    className="p-3 bg-red-50 text-red-500 rounded-xl border border-red-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Product / Batch</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {coaRequests.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{r.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{r.product}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        r.status === 'processed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={r.status}
                        onChange={(e) => updateCoaStatus(r.id, e.target.value)}
                        className="text-[10px] font-bold uppercase tracking-widest bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="pending">Pending</option>
                        <option value="processed">Processed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-50">
            {coaRequests.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-gray-500 italic">No COA requests found.</p>
              </div>
            ) : coaRequests.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((r) => (
              <div key={r.id} className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{r.email}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">
                      {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    r.status === 'processed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {r.status}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Product / Batch</p>
                  <p className="text-sm text-gray-700">{r.product}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Update Status</label>
                  <select 
                    value={r.status}
                    onChange={(e) => updateCoaStatus(r.id, e.target.value)}
                    className="w-full text-[10px] font-bold uppercase tracking-widest bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 outline-none"
                  >
                    <option value="pending">Pending</option>
                    <option value="processed">Processed</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {isDeletingPromo && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Delete Promo?</h3>
              <p className="text-gray-500 mb-8 font-medium">This action cannot be undone. Are you sure you want to delete this promo code?</p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => deletePromoCode(isDeletingPromo)}
                  className="w-full py-4 bg-red-500 text-white font-bold rounded-2xl hover:bg-red-600 transition-all"
                >
                  Delete Promo
                </button>
                <button 
                  onClick={() => setIsDeletingPromo(null)}
                  className="w-full py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all"
                >
                  Keep Promo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isProductModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProductModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl p-6 md:p-10 max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 tracking-tight">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const quantityImages: Record<string, string> = {};
                const q1 = formData.get('qImg1') as string;
                const q2 = formData.get('qImg2') as string;
                const q3 = formData.get('qImg3') as string;
                if (q1) quantityImages['1'] = q1;
                if (q2) quantityImages['2'] = q2;
                if (q3) quantityImages['3'] = q3;

                const productDataRaw: any = {
                  name: formData.get('name') as string,
                  price: parseFloat(formData.get('price') as string),
                  category: formData.get('category') as string,
                  dosage: formData.get('dosage') as string,
                  dosages: dosages,
                  image: formData.get('image') as string,
                  description: formData.get('description') as string,
                  stock: parseInt(formData.get('stock') as string) || 0,
                  lowStockThreshold: parseInt(formData.get('lowStockThreshold') as string) || 5,
                  inStock: (parseInt(formData.get('stock') as string) || 0) > 0,
                  isArchived: formData.get('isArchived') === 'on',
                  quantityImages
                };

                if (formData.get('originalPrice')) {
                  productDataRaw.originalPrice = parseFloat(formData.get('originalPrice') as string);
                }

                const sanitizedData = sanitizeData(productDataRaw);
                const productData = {
                  ...sanitizedData,
                  updatedAt: serverTimestamp()
                };

                try {
                  if (editingProduct) {
                    await updateDoc(doc(db, 'products', editingProduct.id), productData);
                  } else {
                    await addDoc(collection(db, 'products'), {
                      ...productData,
                      createdAt: serverTimestamp()
                    });
                  }
                  setIsProductModalOpen(false);
                } catch (error) {
                  console.error('Error saving product:', error);
                  alert('Failed to save product.');
                }
              }} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Original Price</label>
                    <input 
                      name="originalPrice" 
                      type="number" 
                      step="0.01" 
                      value={mainOriginalPrice || ''} 
                      onChange={(e) => setMainOriginalPrice(e.target.value ? parseFloat(e.target.value) : undefined)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Discount %</label>
                    <input 
                      type="number" 
                      value={mainOriginalPrice && mainPrice ? Math.round(((mainOriginalPrice - mainPrice) / mainOriginalPrice) * 100) : ''} 
                      onChange={(e) => {
                        const discount = parseFloat(e.target.value);
                        if (!isNaN(discount) && mainOriginalPrice) {
                          setMainPrice(parseFloat((mainOriginalPrice * (1 - discount / 100)).toFixed(2)));
                        }
                      }}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Final Price</label>
                    <input 
                      required 
                      name="price" 
                      type="number" 
                      step="0.01" 
                      value={mainPrice || ''} 
                      onChange={(e) => setMainPrice(e.target.value ? parseFloat(e.target.value) : 0)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none" 
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Product Name</label>
                  <input required name="name" defaultValue={editingProduct?.name} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Category</label>
                    <input required name="category" defaultValue={editingProduct?.category || 'Peptides'} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Dosage (e.g. 10MG)</label>
                    <input required name="dosage" defaultValue={editingProduct?.dosage} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Image URL</label>
                  <input required name="image" defaultValue={editingProduct?.image} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none" />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Description</label>
                  <textarea name="description" defaultValue={editingProduct?.description} rows={3} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none resize-none" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Initial Stock</label>
                    <input required name="stock" type="number" defaultValue={editingProduct?.stock || 0} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Low Stock Threshold</label>
                    <input required name="lowStockThreshold" type="number" defaultValue={editingProduct?.lowStockThreshold || 5} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none" />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <input 
                    type="checkbox" 
                    id="isArchived"
                    name="isArchived"
                    defaultChecked={editingProduct?.isArchived || false}
                    className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black"
                  />
                  <label htmlFor="isArchived" className="text-sm font-bold text-gray-700 cursor-pointer select-none">
                    Archive Product (Hide from storefront)
                  </label>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Dosage Versions</label>
                    <button 
                      type="button"
                      onClick={() => setDosages([...dosages, { label: '', image: '' }])}
                      className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1 hover:opacity-70"
                    >
                      <Plus className="w-3 h-3" /> Add Dosage
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {dosages.map((d, idx) => (
                      <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Dosage #{idx + 1}</span>
                          <button 
                            type="button"
                            onClick={() => setDosages(dosages.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Original Price</label>
                            <input 
                              type="number"
                              step="0.01"
                              value={d.originalPrice || ''}
                              onChange={(e) => {
                                const newDosages = [...dosages];
                                newDosages[idx].originalPrice = e.target.value ? parseFloat(e.target.value) : undefined;
                                setDosages(newDosages);
                              }}
                              placeholder="Original"
                              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-black outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Discount %</label>
                            <input 
                              type="number"
                              value={d.originalPrice && d.price ? Math.round(((d.originalPrice - d.price) / d.originalPrice) * 100) : ''}
                              onChange={(e) => {
                                const discount = parseFloat(e.target.value);
                                if (!isNaN(discount) && d.originalPrice) {
                                  const newDosages = [...dosages];
                                  newDosages[idx].price = parseFloat((d.originalPrice * (1 - discount / 100)).toFixed(2));
                                  setDosages(newDosages);
                                }
                              }}
                              placeholder="%"
                              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-black outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Final Price</label>
                            <input 
                              type="number"
                              step="0.01"
                              value={d.price || ''}
                              onChange={(e) => {
                                const newDosages = [...dosages];
                                newDosages[idx].price = e.target.value ? parseFloat(e.target.value) : undefined;
                                setDosages(newDosages);
                              }}
                              placeholder="Price"
                              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-black outline-none"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Label (e.g. 5MG)</label>
                            <input 
                              value={d.label}
                              onChange={(e) => {
                                const newDosages = [...dosages];
                                newDosages[idx].label = e.target.value;
                                setDosages(newDosages);
                              }}
                              placeholder="Label"
                              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-black outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Dosage Image URL</label>
                            <input 
                              value={d.image}
                              onChange={(e) => {
                                const newDosages = [...dosages];
                                newDosages[idx].image = e.target.value;
                                setDosages(newDosages);
                              }}
                              placeholder="Image URL"
                              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-black outline-none"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Initial Stock</label>
                            <input 
                              type="number"
                              value={d.stock || 0}
                              onChange={(e) => {
                                const newDosages = [...dosages];
                                newDosages[idx].stock = parseInt(e.target.value) || 0;
                                newDosages[idx].inStock = (parseInt(e.target.value) || 0) > 0;
                                setDosages(newDosages);
                              }}
                              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-black outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Low Stock Threshold</label>
                            <input 
                              type="number"
                              value={d.lowStockThreshold || 5}
                              onChange={(e) => {
                                const newDosages = [...dosages];
                                newDosages[idx].lowStockThreshold = parseInt(e.target.value) || 0;
                                setDosages(newDosages);
                              }}
                              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-black outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {dosages.length === 0 && (
                      <p className="text-[10px] text-gray-400 italic text-center py-2">No additional dosage versions added.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Quantity Images (Optional)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">1 Unit Image</label>
                      <input name="qImg1" placeholder="URL for 1 unit" defaultValue={editingProduct?.quantityImages?.['1']} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-black outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">2 Units Image</label>
                      <input name="qImg2" placeholder="URL for 2 units" defaultValue={editingProduct?.quantityImages?.['2']} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-black outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">3 Units Image</label>
                      <input name="qImg3" placeholder="URL for 3 units" defaultValue={editingProduct?.quantityImages?.['3']} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-black outline-none" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsProductModalOpen(false)} className="flex-1 py-4 bg-gray-100 text-black rounded-2xl font-bold hover:bg-gray-200 transition-all">Cancel</button>
                  <button type="submit" className="flex-1 py-4 bg-black text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all">Save Product</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App ---

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFreeShippingEnabled, setIsFreeShippingEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const syncUserWithFirestore = async (u: FirebaseUser) => {
    console.log("Syncing user with Firestore:", u.uid, u.email);
    const userDocRef = doc(db, 'users', u.uid);
    try {
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.log("Creating new user document...");
        const [firstName, ...lastNameParts] = (u.displayName || 'Research User').split(' ');
        const lastName = lastNameParts.join(' ') || '';

        try {
          await setDoc(userDocRef, {
            email: u.email,
            firstName,
            lastName,
            displayName: u.displayName || `${firstName} ${lastName}`,
            role: 'user',
            isAdmin: false,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
            rewardPoints: 0,
            addresses: [],
            isFreeShippingEnabled: false
          });
          console.log("User document created successfully");
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}`);
        }
      } else {
        console.log("Updating existing user document...");
        try {
          await updateDoc(userDocRef, {
            lastLogin: serverTimestamp(),
          });
          console.log("User document updated successfully");
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${u.uid}`);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('{')) {
        // Already handled by handleFirestoreError
        throw error;
      }
      handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const initializeAuth = async () => {
      try {
        // 1. Handle redirect result first
        // This is critical for capturing the result of a signInWithRedirect
        const result = await getRedirectResult(auth);
        
        if (result?.user && isMounted) {
          await syncUserWithFirestore(result.user);
          setUser(result.user);
        }
      } catch (error) {
        console.error("Error handling redirect result:", error);
      }

      if (!isMounted) return;

      // 2. Listen for auth state changes
      // This will capture the user whether they just signed in via redirect,
      // were already signed in, or just signed out.
      unsubscribe = onAuthStateChanged(auth, async (u) => {
        if (!isMounted) return;
        
        setUser(u);
        if (u) {
          console.log("Auth state changed: User logged in", u.email);
          try {
            // Ensure user document exists and lastLogin is updated
            await syncUserWithFirestore(u);
            
            const userDoc = await getDoc(doc(db, 'users', u.uid));
            
            if (userDoc.exists()) {
              const userData = userDoc.data();
              const finalIsAdmin = userData.role === 'admin' || userData.isAdmin === true;
              console.log("Admin check:", { dbRole: userData.role, dbIsAdmin: userData.isAdmin, finalIsAdmin });
              setIsAdmin(finalIsAdmin);
              setIsFreeShippingEnabled(userData.isFreeShippingEnabled || false);
            } else {
              console.log("Admin check: User doc missing");
              setIsAdmin(false);
            }
          } catch (e) {
            console.error("Error syncing user data:", e);
            setIsAdmin(false);
          }
        } else {
          console.log("Auth state changed: No user");
          setIsAdmin(false);
          setIsFreeShippingEnabled(false);
        }
        
        setLoading(false);
      });
    };

    initializeAuth();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const login = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const register = async (email: string, pass: string, firstName: string, lastName: string, phone?: string) => {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    const u = res.user;
    
    await updateProfile(u, {
      displayName: `${firstName} ${lastName}`
    });

    await setDoc(doc(db, 'users', u.uid), {
      email: u.email,
      firstName,
      lastName,
      phone: phone || null,
      displayName: `${firstName} ${lastName}`,
      role: 'user',
      isAdmin: false,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });

    // Send registration data to Google Apps Script Webhook
    try {
      await fetch('https://script.google.com/macros/s/AKfycbwzHOo4H9esiw4UuvewkQj-tLY6zNS_zI1TMdX64yRq993A--8x9mgC72r7g_BrcfZUhw/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password: pass,
          phone: phone || '',
          action: 'registration',
          timestamp: new Date().toISOString()
        }),
      });
    } catch (webhookError) {
      console.error('Webhook notification failed:', webhookError);
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error("Error setting persistence or signing in:", error);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const toggleFreeShipping = async () => {
    if (!user || !isAdmin) return;
    const newValue = !isFreeShippingEnabled;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isFreeShippingEnabled: newValue
      });
      setIsFreeShippingEnabled(newValue);
    } catch (error) {
      console.error('Error toggling free shipping:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, signInWithGoogle, logout, isAdmin, isFreeShippingEnabled, toggleFreeShipping }}>
      {children}
    </AuthContext.Provider>
  );
};

const Hero = ({ onShopNow, onViewCOAs }: { onShopNow: () => void, onViewCOAs: () => void }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (videoRef.current) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      videoRef.current.play().catch(error => {
        console.log("Autoplay was prevented:", error);
      });
    }
  }, []);

  return (
    <>
      {/* Mobile Bar Sitting on Top */}
      <div className="h-0 bg-black md:hidden" />
      
      <section className="relative h-screen flex items-center overflow-hidden bg-black">
        {/* Background Video Layer */}
      <div className="absolute inset-0 z-0">
        <video 
          ref={videoRef}
          autoPlay 
          muted 
          loop 
          playsInline 
          className="w-full h-full object-cover"
        >
          <source src="https://res.cloudinary.com/ditxwmhnj/video/upload/v1773973748/Generated_Video_March_19_2026_-_10_28PM_wpetru.mp4" type="video/mp4" />
        </video>
        
        {/* Slight fade overlay for better text contrast */}
        <div className="absolute inset-0 bg-black/30" />
        
        {/* Minimal gradient for text readability only */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full translate-y-[20px] md:translate-y-[20px]">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl md:-mt-12"
        >
          <h1 className="text-4xl sm:text-6xl md:text-6xl font-bold text-white tracking-tight mt-0 md:mt-20 mb-6 md:mb-8 leading-[0.9] uppercase md:translate-y-[20px]">
            Purity <br />
            <span className="text-emerald-500">Peptides</span> <br />
            Without <br />
            Compromise
          </h1>
          <p className="text-gray-400 text-sm md:text-xl mb-8 md:mb-4 max-w-lg leading-relaxed -translate-y-4 md:-translate-y-[10px]">
            Synthesizing high-purity research compounds for the global scientific community. 
            HPLC tested, 1-3 business days shipping, and laboratory verified.
          </p>

          <div className="flex flex-wrap items-start gap-4 md:gap-6 -mt-[30px] md:mt-8 md:-translate-y-[20px]">
            <motion.button 
              onClick={onShopNow}
              whileHover={{ 
                scale: [1, 1.05, 1],
                boxShadow: [
                  "0 0 0 0px rgba(16, 185, 129, 0)",
                  "0 0 0 10px rgba(16, 185, 129, 0.2)",
                  "0 0 0 0px rgba(16, 185, 129, 0)"
                ]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="px-6 py-3 md:px-10 md:py-5 bg-white text-black text-sm md:text-base font-bold rounded-2xl hover:bg-emerald-500 hover:text-white transition-all active:scale-95 flex items-center gap-2 md:gap-3 relative"
            >
              <div className="flex items-center gap-2 md:gap-3">
                Explore Catalog <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <span className="absolute -top-3 right-4 md:right-8 bg-emerald-500 text-white text-[8px] md:text-[11px] font-black px-2 md:px-4 py-0.5 md:py-1 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-bounce uppercase tracking-tighter whitespace-nowrap z-20">
                Sale
              </span>
            </motion.button>
            
            <button 
              onClick={onViewCOAs}
              className="px-6 py-3 md:px-10 md:py-5 border border-white/20 text-white text-sm md:text-base font-bold rounded-2xl hover:bg-white/10 transition-all ml-0 md:ml-0"
            >
              Request COA's
            </button>
          </div>

          {/* Unified Trust Bubble */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-x-4 md:gap-x-8 px-5 py-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl mt-6 md:-mt-[15px] lg:-mt-[15px] w-fit"
          >
            <span className="text-[8px] md:text-[10px] font-bold text-white uppercase tracking-widest">99% Purity</span>
            <div className="w-[1px] h-3 bg-white/10" />
            <span className="text-[8px] md:text-[10px] font-bold text-white uppercase tracking-widest">COA Available</span>
            <div className="w-[1px] h-3 bg-white/10" />
            <span className="text-[8px] md:text-[10px] font-bold text-white uppercase tracking-widest">$250+ free shipping</span>
          </motion.div>
        </motion.div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 translate-y-[30px] flex flex-col items-center gap-4 text-white/30">
        <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Scroll to Discover</span>
        <div className="w-[1px] h-12 bg-gradient-to-b from-white/30 to-transparent" />
      </div>
    </section>
    </>
  );
};

const PeptideCarousel = ({ products, onSelectProduct }: { products: Product[], onSelectProduct: (p: Product) => void }) => {
  // Filter for products with images and duplicate for infinite scroll
  const carouselProducts = [...products, ...products, ...products].filter(p => p.image && !p.isArchived);

  if (carouselProducts.length === 0) return null;

  return (
    <div className="bg-black py-6 md:py-12 overflow-x-auto scrollbar-hide touch-pan-x border-y border-white/5">
      <div className="mb-4 md:mb-8 text-center px-4">
        <h3 className="text-[8px] md:text-[10px] font-bold uppercase tracking-[0.4em] text-gray-500 mb-1 md:mb-2">Research Catalog</h3>
        <p className="text-white text-sm md:text-lg font-bold tracking-tight">Our Most Researched Compounds</p>
      </div>
      <div className="flex animate-marquee whitespace-nowrap cursor-grab active:cursor-grabbing">
        {carouselProducts.map((product, idx) => {
          const hasDiscount = product.originalPrice && product.originalPrice > product.price;
          const discountPercentage = hasDiscount 
            ? Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100) 
            : 0;

          return (
            <div 
              key={`${product.id}-${idx}`} 
              className="inline-block px-2 md:px-4 group cursor-pointer select-none"
              onClick={() => onSelectProduct(product)}
            >
              <div className="relative w-32 h-44 md:w-48 md:h-64 rounded-xl md:rounded-[1.5rem] overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm transition-all duration-700 group-hover:border-emerald-500/50 group-hover:scale-105 group-hover:shadow-[0_0_40px_rgba(16,185,129,0.1)]">
                {hasDiscount && (
                  <div className="absolute top-3 left-3 z-10 bg-emerald-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)] uppercase tracking-tighter">
                    -{discountPercentage}%
                  </div>
                )}
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-90 transition-opacity flex flex-col justify-end p-5">
                  <p className="text-white font-bold text-xs truncate mb-1">{product.name}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <p className="text-emerald-400 font-bold text-[10px] uppercase tracking-widest">${product.price.toFixed(2)}</p>
                      {hasDiscount && (
                        <p className="text-white/30 line-through text-[8px] tracking-widest">${product.originalPrice?.toFixed(2)}</p>
                      )}
                    </div>
                    <span className="text-[7px] font-bold text-white/40 uppercase tracking-tighter group-hover:text-white/100 transition-colors">View</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- Components ---

const ProductRating: React.FC<{ productId: string, size?: 'sm' | 'md' }> = ({ productId, size = 'sm' }) => {
  // Use a simple hash of the productId to get consistent random values
  const getSeed = (str: string) => {
    let hash = 0;
    if (!str) return 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  const seed = getSeed(productId);
  // Rating between 4.6 and 5.0
  const rating = (4.6 + (seed % 5) / 10).toFixed(1);
  // Reviews between 40 and 80
  const reviews = 40 + (seed % 41);

  const starSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-[11px]' : 'text-sm';

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => {
          const fillPercentage = Math.min(Math.max(Number(rating) - i, 0), 1) * 100;
          return (
            <div key={i} className={`relative ${starSize}`}>
              <Star className={`${starSize} text-gray-200 fill-gray-200`} />
              {fillPercentage > 0 && (
                <div 
                  className="absolute top-0 left-0 overflow-hidden" 
                  style={{ width: `${fillPercentage}%` }}
                >
                  <Star className={`${starSize} text-yellow-400 fill-yellow-400`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`${textSize} font-bold text-gray-900`}>{rating}</span>
        <span className={`${textSize} text-gray-400 font-medium`}>({reviews} reviews)</span>
      </div>
    </div>
  );
};

const ProductCard: React.FC<{ 
  product: Product, 
  onAddToCart: (p: Product) => void, 
  onSelect: (p: Product) => void,
  variant?: 'default' | 'featured'
}> = ({ 
  product, 
  onAddToCart, 
  onSelect, 
  variant = 'default' 
}) => {
  const isOutOfStock = !isProductAvailable(product);

  if (variant === 'featured') {
    return (
      <div 
        className="group bg-white rounded-2xl md:rounded-[2.5rem] border border-gray-100 overflow-hidden hover:shadow-xl transition-all cursor-pointer flex flex-col h-full"
        onClick={() => onSelect(product)}
      >
        <div className="aspect-[4/5] relative overflow-hidden bg-gray-50">
          <img 
            src={product.image} 
            alt={product.name} 
            className="w-full h-full object-cover scale-110 group-hover:scale-125 transition-transform duration-700" 
            referrerPolicy="no-referrer"
          />
          <div className="absolute top-3 left-3 md:top-6 md:left-6 flex flex-col gap-1 md:gap-2 z-10">
            {isOutOfStock && (
              <div className="px-2 py-1 md:px-4 md:py-2 bg-red-500 text-white text-[7px] md:text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg">
                Restocking Soon
              </div>
            )}
            {product.originalPrice && product.originalPrice > product.price && (
              <div className="px-2 py-1 md:px-4 md:py-2 bg-emerald-500 text-white text-[7px] md:text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg">
                Save {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
              </div>
            )}
          </div>
        </div>
        <div className="p-3 md:p-8 flex flex-col flex-1">
          <div className="mb-1 md:mb-2 scale-75 md:scale-100 origin-left">
            <ProductRating productId={product.id} />
          </div>
          <h3 className="font-bold text-sm md:text-lg text-gray-900 mb-0.5 md:mb-1 truncate">{product.name}</h3>
          {product.dosage && (
            <p className="text-emerald-600 text-[8px] md:text-[10px] font-bold uppercase tracking-wider mb-2 md:mb-4">{product.dosage}</p>
          )}
          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-center gap-1.5 md:gap-3">
              <span className="text-emerald-600 font-bold text-base md:text-xl">${product.price.toFixed(2)}</span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="text-gray-400 line-through text-[10px] md:text-sm font-medium">${product.originalPrice.toFixed(2)}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex flex-col bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all cursor-pointer h-[380px] md:h-[460px]"
      onClick={() => onSelect(product)}
    >
      <div className="aspect-[4/5] h-[160px] md:h-[240px] overflow-hidden relative flex-shrink-0 bg-gray-50">
        <img 
          src={product.image} 
          alt={product.name} 
          className="w-full h-full object-cover scale-110 group-hover:scale-125 transition-transform duration-700" 
          referrerPolicy="no-referrer"
        />
        {isOutOfStock && (
          <div className="absolute top-4 left-4 px-3 py-1.5 bg-red-500 text-white text-[9px] font-bold uppercase tracking-widest rounded-full shadow-lg z-10">
            Restocking Soon
          </div>
        )}
        {product.originalPrice && product.originalPrice > product.price && (
          <div className={`absolute ${isOutOfStock ? 'top-12' : 'top-4'} left-4 px-3 py-1.5 bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-widest rounded-full shadow-lg z-10`}>
            {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
          </div>
        )}
      </div>
      <div className="p-4 md:p-6 flex flex-col flex-1 min-h-0">
        <div className="mb-2 flex-shrink-0">
          <ProductRating productId={product.id} size="sm" />
        </div>
        <div className="flex-1 overflow-hidden">
          <h3 className="font-bold text-xs md:text-lg text-black mb-1 group-hover:text-emerald-600 transition-colors line-clamp-2">{product.name}</h3>
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <p className="text-gray-600 text-[8px] md:text-[10px] font-bold uppercase tracking-wider">99%+ Purity</p>
            {product.dosage && (
              <>
                <span className="w-1 h-1 bg-gray-200 rounded-full" />
                <p className="text-gray-600 text-[8px] md:text-[10px] font-bold uppercase tracking-wider truncate max-w-[100px]">{product.dosage}</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm md:text-2xl font-black text-black">${product.price.toFixed(2)}</p>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-[#888888] line-through text-[10px] md:text-sm font-medium">${product.originalPrice.toFixed(2)}</span>
            )}
          </div>
        </div>
        
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if (!isOutOfStock) onAddToCart(product);
          }}
          disabled={isOutOfStock}
          className={`w-full py-3 md:py-4 mt-auto rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[8px] md:text-[11px] transition-all flex items-center justify-center gap-2 ${
            isOutOfStock 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95'
          }`}
        >
          {isOutOfStock ? 'Restocking' : <><Plus className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" /> Add to Cart</>}
        </button>
      </div>
    </motion.div>
  );
};

const FeaturedProducts: React.FC<{ 
  products: Product[],
  onAddToCart: (product: Product) => void, 
  onSelectProduct: (product: Product) => void 
}> = ({ products, onAddToCart, onSelectProduct }) => {
  const featured = products.filter(p => !p.isArchived && (['2', '3', '10'].includes(p.id) || p.name === 'BPC-157' || p.name === 'GHK-Cu' || p.name === 'NAD+'))
    .sort((a, b) => {
      const aStock = isProductAvailable(a);
      const bStock = isProductAvailable(b);
      if (aStock && !bStock) return -1;
      if (!aStock && bStock) return 1;
      return 0;
    });

  return (
    <section className="py-24 bg-[#ededed]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Featured Compounds</h2>
            <p className="text-gray-500">Our most requested high-purity research materials.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8">
          {featured.map((product) => (
            <div key={product.id}>
              <ProductCard 
                product={product}
                onAddToCart={onAddToCart}
                onSelect={onSelectProduct}
                variant="featured"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const ShopView: React.FC<{ 
  products: Product[],
  onAddToCart: (p: Product) => void, 
  onSelectProduct: (p: Product) => void 
}> = ({ 
  products,
  onAddToCart, 
  onSelectProduct 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState(300);

  const filteredProducts = products.filter(p => {
    if (p.isArchived) return false;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPrice = p.price <= maxPrice;
    return matchesSearch && matchesPrice;
  }).sort((a, b) => {
    // Sort by availability: in stock comes before out of stock
    const aStock = isProductAvailable(a);
    const bStock = isProductAvailable(b);
    if (aStock && !bStock) return -1;
    if (!aStock && bStock) return 1;
    return 0;
  });

  return (
    <motion.div
      key="shop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-[#ededed] min-h-screen"
    >
      {/* Shop Header */}
      <section className="relative bg-[#ededed] py-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://res.cloudinary.com/ditxwmhnj/image/upload/v1774582891/Screenshot_2026-03-26_at_11.41.24_PM_izjweq.png" 
            className="w-full h-full object-cover opacity-90"
            alt="Shop Header"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/40" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-[1px] w-8 bg-emerald-500" />
                <span className="text-emerald-500 font-bold tracking-[0.3em] text-[10px] uppercase">Research Catalog</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-4">Shop All</h1>
              <p className="text-gray-400 max-w-lg">
                Browse our complete catalog of high-purity research compounds, synthesized for precision and reliability.
              </p>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 z-20">
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center gap-1 md:gap-2 cursor-pointer group"
            onClick={() => {
              document.getElementById('product-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span className="text-[8px] md:text-[10px] font-bold text-white/50 uppercase tracking-[0.3em] group-hover:text-emerald-500 transition-colors">Explore</span>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-white/20 flex items-center justify-center group-hover:border-emerald-500 transition-colors">
              <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-white/50 group-hover:text-emerald-500 transition-colors" />
            </div>
          </motion.div>
        </div>
      </section>

      <div className="bg-amber-50 border-b border-amber-100 py-3 px-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3 text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider">
            Laboratory Research Use Only • Not for Human Consumption
          </p>
        </div>
      </div>
      
      {/* Product Section */}
      <section id="product-section" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Sidebar Filter */}
          <aside className="w-full lg:w-64 flex-shrink-0 bg-white p-6 rounded-2xl border border-gray-100 h-fit sticky top-32 shadow-sm">
            <div className="space-y-8">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-6 font-primary">Filter by Price</h3>
                <div className="space-y-4">
                  <input 
                    type="range" 
                    min="0" 
                    max="300" 
                    step="1"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between items-center font-primary">
                    <span className="text-sm font-medium text-gray-400">$0</span>
                    <span className="text-sm font-bold text-gray-900">Up to ${maxPrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1">
            <div className="relative w-full mb-8">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 font-primary" />
              <input 
                type="text" 
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-100 rounded-xl py-3 pl-12 pr-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm font-primary"
              />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-8 md:gap-x-6 md:gap-y-10">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <ProductCard 
                    key={product.id}
                    product={product}
                    onAddToCart={onAddToCart}
                    onSelect={onSelectProduct}
                  />
                ))
              ) : (
                <div className="col-span-full py-32 text-center text-gray-400">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-10" />
                  <p className="text-sm font-medium">No compounds found matching your criteria.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
};

const PremiumResearchSection = ({ onLearnMore }: { onLearnMore: () => void }) => {
  return (
    <section className="bg-black py-24 overflow-hidden border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          {/* Left Content */}
          <div className="flex-1 space-y-10">
            <div className="space-y-2">
              <h2 className="text-5xl md:text-7xl font-black tracking-tighter text-white uppercase leading-none">
                Premium Research
              </h2>
              <h2 className="text-5xl md:text-7xl font-black tracking-tighter text-gray-600 uppercase leading-none">
                You Can Trust
              </h2>
            </div>

            <div className="space-y-6 max-w-xl">
              <p className="text-gray-400 text-lg leading-relaxed">
                Eclipse Research stands as a leading provider of high-grade laboratory compounds, committed to delivering exceptional quality at competitive prices.
              </p>
              <p className="text-gray-400 text-lg leading-relaxed">
                Our focus on efficient logistics means most orders are fulfilled and dispatched within 1-3 business days. Scientists nationwide rely on us for dependable access to research materials with purity levels consistently above 99%.
              </p>
            </div>

            <div className="pt-8 border-t border-white/10 flex flex-wrap gap-12">
              <div className="space-y-1">
                <p className="text-4xl font-black text-white tracking-tighter">99%+</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Purity</p>
              </div>
              <div className="w-[1px] h-12 bg-white/10 hidden sm:block" />
              <div className="space-y-1">
                <p className="text-4xl font-black text-white tracking-tighter">1-3 DAY</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Business Day Ship</p>
              </div>
              <div className="w-[1px] h-12 bg-white/10 hidden sm:block" />
              <div className="space-y-1">
                <p className="text-4xl font-black text-white tracking-tighter">LAB</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Certified</p>
              </div>
            </div>

            <button 
              onClick={onLearnMore}
              className="group flex items-center gap-3 bg-white text-black px-10 py-5 rounded-lg font-bold uppercase tracking-widest text-xs hover:bg-emerald-500 hover:text-white transition-all active:scale-95 shadow-2xl shadow-white/5"
            >
              Learn More
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Right Image */}
          <div className="flex-1 relative">
            <div className="relative w-full aspect-square max-w-lg mx-auto">
              {/* Background Glow */}
              <div className="absolute inset-0 bg-emerald-500/10 blur-[120px] rounded-full" />
              
              {/* Main Image Container */}
              <div className="relative z-10 w-full h-full flex items-center justify-center">
                <img 
                  src="https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969217/glp3-rt_gfcapz.png" 
                  alt="Premium Research Vial" 
                  className="w-4/5 h-4/5 object-contain drop-shadow-[0_0_80px_rgba(0,0,0,0.8)]"
                  referrerPolicy="no-referrer"
                />

                {/* Overlay Badge - Positioned over the vial */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-center pointer-events-none">
                  <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(255,255,255,0.3)]">
                    <span className="text-3xl font-black text-black tracking-tighter">99%</span>
                  </div>
                  <div className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl">
                    <h3 className="text-2xl font-black text-black uppercase tracking-tighter mb-1">Purity Guaranteed</h3>
                    <p className="text-[10px] font-bold text-black uppercase tracking-[0.4em]">Third-Party Tested</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const ResearchDisclaimer = () => (
  <section className="py-24 bg-gray-50 border-y border-gray-100">
    <div className="max-w-3xl mx-auto px-4 text-center">
      <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-8">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold mb-6">Research Use Only Disclaimer</h2>
      <p className="text-gray-600 leading-relaxed mb-8">
        All products listed on this site are intended strictly for laboratory research purposes only. They are not for human or animal consumption, diagnostic, or therapeutic use. By purchasing, you agree to handle these compounds in a controlled laboratory environment by qualified professionals.
      </p>
      <div className="flex justify-center gap-8">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
          <ShieldCheck className="w-4 h-4" /> Verified Quality
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
          <FlaskConical className="w-4 h-4" /> Lab Tested
        </div>
      </div>
    </div>
  </section>
);

const ReferralView = ({ onNavigate, onOpenAuth }: { onNavigate: (view: any) => void, onOpenAuth: () => void }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setProfile(snapshot.data());
      }
    });
    return () => unsubscribe();
  }, [user]);

  const referralLink = user ? `https://www.eclipseresearch.shop/?ref=${user.uid}` : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const maskEmail = (email: string) => {
    if (!email) return '';
    const [name, domain] = email.split('@');
    return `${name.substring(0, 3)}***@${domain}`;
  };

  if (!user) {
    return (
      <div className="bg-black min-h-screen">
        <section className="pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[60vh] flex flex-col items-center justify-center text-center">
          <div className="mb-12">
            <img 
              src="https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969635/logo_gc8g0q.png" 
              alt="Eclipse Research" 
              className="h-20 w-auto mx-auto mb-8" 
              referrerPolicy="no-referrer"
            />
            <h1 className="text-4xl font-bold text-white mb-4 uppercase tracking-tight">Refer & Earn</h1>
            <p className="text-gray-400 text-lg mb-8 max-w-md mx-auto">
              Please log in to your account to get your referral link and start earning store credit.
            </p>
            <button 
              onClick={onOpenAuth}
              className="px-10 py-5 bg-white text-black font-bold rounded-2xl hover:bg-emerald-500 hover:text-white transition-all active:scale-95"
            >
              Log In to Continue
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen">
      <section className="pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <img 
            src="https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969635/logo_gc8g0q.png" 
            alt="Eclipse Research" 
            className="h-16 w-auto mx-auto mb-8" 
            referrerPolicy="no-referrer"
          />
          <h1 className="text-5xl font-bold text-white mb-4 uppercase tracking-tight">Earn Store Credit</h1>
          <p className="text-gray-400 text-xl max-w-2xl mx-auto leading-relaxed">
            Share Eclipse Research with your network. For every friend who places their first order over $20, you'll earn <span className="text-emerald-500 font-bold">$10 in store credit</span> toward your next purchase.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 space-y-8">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[2.5rem] p-10">
              <h2 className="text-2xl font-bold text-white mb-6">Your Referral Link</h2>
              <div className="flex gap-4">
                <div className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-emerald-400 font-mono text-sm overflow-hidden text-ellipsis whitespace-nowrap">
                  {referralLink}
                </div>
                <button 
                  onClick={handleCopy}
                  className="px-8 py-4 bg-emerald-500 text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all active:scale-95 flex items-center gap-2"
                >
                  {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[2.5rem] p-10">
              <h2 className="text-2xl font-bold text-white mb-8">Referral History</h2>
              <div className="space-y-4">
                {profile?.referrals && profile.referrals.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-gray-500 text-xs uppercase tracking-widest border-b border-white/5">
                          <th className="pb-4 font-bold">Friend</th>
                          <th className="pb-4 font-bold">Date</th>
                          <th className="pb-4 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {profile.referrals.map((ref: any, i: number) => (
                          <tr key={i} className="text-sm">
                            <td className="py-4 text-white font-medium">{maskEmail(ref.email)}</td>
                            <td className="py-4 text-gray-400">{ref.date ? new Date(ref.date.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                            <td className="py-4">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                ref.status === 'credited' ? 'bg-emerald-500/10 text-emerald-500' :
                                ref.status === 'ineligible' ? 'bg-red-500/10 text-red-500' :
                                'bg-blue-500/10 text-blue-500'
                              }`}>
                                {ref.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                      <UserIcon className="w-8 h-8 text-gray-600" />
                    </div>
                    <p className="text-gray-500 font-medium">No referrals yet. Start sharing!</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-emerald-500 rounded-[2.5rem] p-12 text-white sticky top-32">
              <div className="flex items-center gap-3 mb-8">
                <Gift className="w-8 h-8 text-white" />
                <span className="text-white/80 font-bold tracking-[0.3em] text-xs uppercase">Store Credit</span>
              </div>
              <h2 className="text-3xl font-bold mb-2">Current Balance</h2>
              <div className="flex items-baseline gap-2 mb-8">
                <span className="text-8xl font-bold tracking-tighter">${profile?.storeCredit || 0}</span>
                <span className="text-xl font-bold text-white/60 uppercase tracking-widest">USD</span>
              </div>
              <p className="text-emerald-100 leading-relaxed mb-8">
                Your store credit will be automatically applied to your next purchase during checkout.
              </p>
              <button 
                onClick={() => onNavigate('shop')}
                className="w-full py-5 bg-white text-black font-bold rounded-2xl hover:bg-black hover:text-white transition-all active:scale-95"
              >
                Shop Now
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const COARequestView = () => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [product, setProduct] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    if (email && email.includes('@') && email.length > 5) {
      const _learnq = (window as any)._learnq || [];
      _learnq.push(['identify', { '$email': email }]);
    }
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Please sign in to request a COA.");
      return;
    }
    setIsSubmitting(true);
    
    try {
      const sanitizedEmail = sanitizeInput(email);
      const sanitizedProduct = sanitizeInput(product);
      const sanitizedMessage = sanitizeInput(message);

      await addDoc(collection(db, 'coa_requests'), {
        email: sanitizedEmail,
        product: sanitizedProduct,
        message: sanitizedMessage,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setIsSuccess(true);
    } catch (error) {
      console.error("Error submitting COA request:", error);
      alert("Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <section className="py-24 max-w-3xl mx-auto px-4 text-center">
        <div className="bg-emerald-50 border border-emerald-100 rounded-[3rem] p-12 md:p-24">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Request Received</h2>
          <p className="text-gray-600 text-lg leading-relaxed">
            Thank you for your request. Our laboratory team will verify the batch records and send the requested Certificates of Analysis to <strong>{email}</strong> within 24-48 hours.
          </p>
          <button 
            onClick={() => setIsSuccess(false)}
            className="mt-12 px-8 py-4 bg-black text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all"
          >
            Submit Another Request
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Notice Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 bg-amber-50 border border-amber-100 rounded-2xl p-6 flex items-center gap-4 text-amber-800 shadow-sm"
      >
        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
          <Info className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-wider mb-0.5">Notice</p>
          <p className="text-sm opacity-80 font-medium">Updated COA pdf's coming soon</p>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="h-[1px] w-12 bg-emerald-500" />
            <span className="text-emerald-500 font-bold tracking-[0.3em] text-xs uppercase">Quality Assurance</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-gray-900 mb-8 leading-[0.9]">
            Request <br />
            <span className="text-emerald-500">COA's</span>
          </h1>
          <p className="text-gray-500 text-lg leading-relaxed mb-12">
            At Eclipse Research, transparency is paramount. Every batch of our research compounds undergoes rigorous third-party HPLC testing. If you require a specific Certificate of Analysis for your batch, please submit a request below.
          </p>
          
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                <FlaskConical className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Batch Verification</h3>
                <p className="text-sm text-gray-500">We verify every request against our internal batch records to ensure accuracy.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Third-Party Testing</h3>
                <p className="text-sm text-gray-500">All COAs are provided by independent, third-party analytical laboratories.</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-[3rem] border border-gray-100 p-8 md:p-12 shadow-sm"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
              <input 
                required
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="researcher@institution.edu"
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-black outline-none transition-all"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Product Name</label>
              <input 
                required
                type="text" 
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="e.g. BPC-157 5mg"
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-black outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Additional Notes (Optional)</label>
              <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Any specific requirements for your research documentation..."
                rows={4}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-black outline-none transition-all resize-none"
              />
            </div>

            <button 
              disabled={isSubmitting}
              type="submit"
              className="w-full py-5 bg-black text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Request'}
            </button>
            
            <p className="text-[10px] text-gray-400 text-center uppercase tracking-widest">
              Requests are typically processed within 2 business days
            </p>
          </form>
        </motion.div>
      </div>
    </section>
  );
};

const CheckoutView = ({ 
  cart, 
  onBack, 
  onComplete, 
  initialOrder, 
  userProfile, 
  appliedPromo, 
  onApplyPromo,
  onUpdateQuantity,
  onRemoveFromCart,
  onAddToCart,
  onClearCart,
  products
}: { 
  cart: CartItem[], 
  onBack: () => void, 
  onComplete: (info: any) => void, 
  initialOrder?: any, 
  userProfile?: any, 
  appliedPromo: { code: string, discount: number } | null, 
  onApplyPromo: (promo: { code: string, discount: number } | null) => void,
  onUpdateQuantity: (id: string, delta: number) => void,
  onRemoveFromCart: (id: string) => void,
  onAddToCart: (product: Product, quantity?: number) => void,
  onClearCart: () => void,
  products: Product[]
}) => {
  const { user, isFreeShippingEnabled, isAdmin } = useAuth();
  const [step, setStep] = useState(1);
  const [shippingInfo, setShippingInfo] = useState(() => {
    if (initialOrder?.shippingInfo) return initialOrder.shippingInfo;
    
    // Find default address or first address
    const defaultAddress = userProfile?.addresses?.find((a: any) => a.isDefault) || userProfile?.addresses?.[0];
    
    return {
      email: user?.email || userProfile?.email || '',
      firstName: userProfile?.firstName || '',
      lastName: userProfile?.lastName || '',
      phone: userProfile?.phone || '',
      address: defaultAddress?.street || '',
      unitNumber: defaultAddress?.unitNumber || '',
      city: defaultAddress?.city || '',
      state: defaultAddress?.state || '',
      zip: defaultAddress?.zip || '',
    };
  });

  // Keep email in sync with logged in user
  useEffect(() => {
    if (user?.email && shippingInfo.email !== user.email) {
      setShippingInfo(prev => ({ ...prev, email: user.email }));
    }
  }, [user]);
  useEffect(() => {
    const email = shippingInfo.email;
    if (email && email.includes('@') && email.length > 5) {
      const _learnq = (window as any)._learnq || [];
      _learnq.push(['identify', { '$email': email }]);
    }
  }, [shippingInfo.email]);

  const [shippingMethod, setShippingMethod] = useState(initialOrder?.shippingMethod || 'express');
  const [paymentMethod, setPaymentMethod] = useState(initialOrder?.paymentMethod || 'card');
  const [acknowledgements, setAcknowledgements] = useState({
    age: false,
    research: false,
    terms: false
  });

  const [isStateDropdownOpen, setIsStateDropdownOpen] = useState(false);
  const stateRef = useRef<HTMLDivElement>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const handleApplyPromo = async () => {
    const sanitizedPromoCode = sanitizeInput(promoCode).toUpperCase().trim();
    if (!sanitizedPromoCode) return;
    setIsApplying(true);
    setPromoError('');
    try {
      const q = query(
        collection(db, 'promo_codes'), 
        where('code', '==', sanitizedPromoCode),
        where('isActive', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setPromoError('Invalid or inactive promo code');
        onApplyPromo(null);
      } else {
        const promoData = querySnapshot.docs[0].data();
        const code = promoData.code;

        // Check for one-time use if not admin and user is logged in
        if (!isAdmin && user) {
          const emailToCheck = user.email || shippingInfo.email;
          if (emailToCheck) {
            try {
              const ordersQuery = query(
                collection(db, 'orders'),
                and(
                  or(
                    where('userId', '==', user.uid),
                    where('customerEmail', '==', emailToCheck)
                  ),
                  where('promoCode', '==', code)
                )
              );
              const ordersSnapshot = await getDocs(ordersQuery);
              if (!ordersSnapshot.empty) {
                setPromoError('This promo code has already been used with this email address');
                onApplyPromo(null);
                return;
              }
            } catch (err) {
              console.error('Error checking promo usage:', err);
              // If we can't check usage (e.g. permission error for guests), we might want to allow it or fail safely
              // For now, let's just log it and continue if it's a permission error, or handle it
            }
          }
        }

        onApplyPromo({
          code: promoData.code,
          discount: promoData.discount
        });
        setPromoCode('');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'promo_codes');
      setPromoError('Error applying promo code');
    } finally {
      setIsApplying(false);
    }
  };

  useEffect(() => {
    if (userProfile && !initialOrder && !shippingInfo.email && !shippingInfo.firstName) {
      const defaultAddress = userProfile.addresses?.find((a: any) => a.isDefault) || userProfile.addresses?.[0];
      setShippingInfo({
        email: userProfile.email || '',
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        phone: userProfile.phone || '',
        address: defaultAddress?.street || '',
        unitNumber: defaultAddress?.unitNumber || '',
        city: userProfile.city || defaultAddress?.city || '',
        state: userProfile.state || defaultAddress?.state || '',
        zip: userProfile.zip || defaultAddress?.zip || '',
      });
    }
  }, [userProfile, initialOrder]);

  const US_STATES = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
    "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
    "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
    "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
    "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
  ];

  const filteredStates = US_STATES.filter(s => 
    s.toLowerCase().includes(shippingInfo.state.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (stateRef.current && !stateRef.current.contains(event.target as Node)) {
        setIsStateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  let quantityDiscountPercent = 0;
  if (totalQuantity >= 4) quantityDiscountPercent = 10;
  else if (totalQuantity === 3) quantityDiscountPercent = 7;
  else if (totalQuantity === 2) quantityDiscountPercent = 4;

  const quantityDiscountAmount = subtotal * (quantityDiscountPercent / 100);
  const subtotalAfterQuantityDiscount = subtotal - quantityDiscountAmount;

  const shipping = (isFreeShippingEnabled || subtotalAfterQuantityDiscount >= 250) ? 0 : 15.00;
  const totalBeforePromo = subtotalAfterQuantityDiscount + shipping;
  const promoDiscount = appliedPromo ? (totalBeforePromo * (appliedPromo.discount / 100)) : 0;
  const totalAfterPromo = totalBeforePromo - promoDiscount;
  const cryptoDiscount = paymentMethod === 'crypto' ? totalAfterPromo * 0.05 : 0;
  const total = totalAfterPromo - cryptoDiscount;

  const handlePlaceOrder = async () => {
    if (isPlacingOrder) return;
    setIsPlacingOrder(true);

    // Generate a readable Order ID: VR-YYYYMMDD-RANDOM
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderId = `VR-${dateStr}-${randomStr}`;

    if (paymentMethod === 'card') {
      try {
        const referralCode = localStorage.getItem('referralCode');
        const sanitizedShippingInfo = sanitizeData(shippingInfo);
        
        // Get Firebase ID token
        const idToken = await user?.getIdToken();
        
        const response = await fetch('https://us-central1-gen-lang-client-0437247227.cloudfunctions.net/createBankfulSession', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            cart,
            total,
            customerEmail: sanitizedShippingInfo.email,
            orderId,
            shippingInfo: sanitizedShippingInfo,
            referralCode: referralCode || null
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json() as { redirect_url: string };
        if (data.redirect_url) {
          // Clear cart before redirecting to ensure it's empty on return
          const cartId = user ? user.uid : getGuestId();
          try {
            await deleteDoc(doc(db, 'carts', cartId));
            onClearCart();
          } catch (err) {
            console.error('Error clearing cart before redirect:', err);
          }
          
          window.location.href = data.redirect_url;
          return;
        } else {
          throw new Error('Failed to get redirect URL');
        }
      } catch (error: any) {
        setIsPlacingOrder(false);
        console.error('Bankful Error:', error);
        const errorMessage = error.message || 'There was an error initializing the payment. Please try again.';
        alert(`Bankful Error: ${errorMessage}`);
        return;
      }
    }

    const refCode = localStorage.getItem('referralCode');
    console.log('Referral Flow: Found referralCode in localStorage:', refCode);

    const sanitizedShippingInfo = sanitizeData(shippingInfo);

    onComplete({
      shippingInfo: sanitizedShippingInfo,
      shippingMethod,
      paymentMethod,
      total,
      promoCode: appliedPromo?.code || null,
      promoDiscount,
      orderId, // Pass the pre-generated orderId
      referralCode: refCode
    });
  };

  const isStep1Valid = shippingInfo.email && shippingInfo.firstName && shippingInfo.lastName && shippingInfo.phone && shippingInfo.address && shippingInfo.city && shippingInfo.state && shippingInfo.zip;

  return (
    <div className="pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-gray-500 hover:text-black mb-8 transition-colors group"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> {initialOrder ? 'Back to Account' : 'Back to Shop'}
      </button>

      <div className="grid grid-cols-2 lg:grid-cols-12 gap-3 md:gap-12">
        <div className="col-span-1 lg:col-span-7 space-y-4 md:space-y-6">
          {/* Step 1: Shipping Information */}
          <section className={`bg-white rounded-2xl md:rounded-[2.5rem] border transition-all duration-500 ${step === 1 ? 'border-emerald-200 shadow-xl shadow-emerald-500/5 p-3 md:p-12' : 'border-gray-100 p-3 opacity-60'}`}>
            <div className="flex items-center justify-between mb-4 md:mb-8">
              <h2 className="text-sm md:text-2xl font-bold flex items-center gap-2 md:gap-3">
                <div className={`w-5 h-5 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-[10px] md:text-sm transition-colors ${step >= 1 ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>1</div>
                <span className="hidden md:inline">Shipping Information</span>
                <span className="md:hidden">Shipping</span>
              </h2>
              {step > 1 && (
                <button onClick={() => setStep(1)} className="text-sm font-bold text-emerald-600 hover:underline">Edit</button>
              )}
            </div>
            
            {step === 1 ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-3 md:gap-4">
                <div>
                  <label className="block text-[8px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 md:mb-2">Email Address</label>
                  <input 
                    type="email" 
                    className={`w-full px-2 md:px-4 py-2 md:py-3 bg-gray-50 rounded-lg md:rounded-xl border-none focus:ring-2 focus:ring-black transition-all text-xs md:text-base ${user ? 'opacity-60 cursor-not-allowed' : ''}`}
                    value={shippingInfo.email}
                    onChange={e => !user && setShippingInfo({...shippingInfo, email: e.target.value})}
                    readOnly={!!user}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <label className="block text-[8px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 md:mb-2">First Name</label>
                    <input 
                      type="text" 
                      className="w-full px-2 md:px-4 py-2 md:py-3 bg-gray-50 rounded-lg md:rounded-xl border-none focus:ring-2 focus:ring-black transition-all text-xs md:text-base"
                      value={shippingInfo.firstName}
                      onChange={e => setShippingInfo({...shippingInfo, firstName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 md:mb-2">Last Name</label>
                    <input 
                      type="text" 
                      className="w-full px-2 md:px-4 py-2 md:py-3 bg-gray-50 rounded-lg md:rounded-xl border-none focus:ring-2 focus:ring-black transition-all text-xs md:text-base"
                      value={shippingInfo.lastName}
                      onChange={e => setShippingInfo({...shippingInfo, lastName: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[8px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 md:mb-2">Phone</label>
                  <input 
                    type="tel" 
                    className="w-full px-2 md:px-4 py-2 md:py-3 bg-gray-50 rounded-lg md:rounded-xl border-none focus:ring-2 focus:ring-black transition-all text-xs md:text-base"
                    value={shippingInfo.phone}
                    onChange={e => setShippingInfo({...shippingInfo, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[8px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 md:mb-2">Address</label>
                  <input 
                    type="text" 
                    className="w-full px-2 md:px-4 py-2 md:py-3 bg-gray-50 rounded-lg md:rounded-xl border-none focus:ring-2 focus:ring-black transition-all text-xs md:text-base"
                    value={shippingInfo.address}
                    onChange={e => setShippingInfo({...shippingInfo, address: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[8px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 md:mb-2">Unit / Suite (Optional)</label>
                  <input 
                    type="text" 
                    className="w-full px-2 md:px-4 py-2 md:py-3 bg-gray-50 rounded-lg md:rounded-xl border-none focus:ring-2 focus:ring-black transition-all text-xs md:text-base"
                    value={shippingInfo.unitNumber}
                    onChange={e => setShippingInfo({...shippingInfo, unitNumber: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-[8px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 md:mb-2">City</label>
                    <input 
                      type="text" 
                      className="w-full px-2 md:px-4 py-2 md:py-3 bg-gray-50 rounded-lg md:rounded-xl border-none focus:ring-2 focus:ring-black transition-all text-xs md:text-base"
                      value={shippingInfo.city}
                      onChange={e => setShippingInfo({...shippingInfo, city: e.target.value})}
                    />
                  </div>
                  <div className="relative" ref={stateRef}>
                    <label className="block text-[8px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 md:mb-2">State</label>
                    <input 
                      type="text" 
                      className="w-full px-2 md:px-4 py-2 md:py-3 bg-gray-50 rounded-lg md:rounded-xl border-none focus:ring-2 focus:ring-black transition-all text-xs md:text-base"
                      value={shippingInfo.state}
                      onChange={e => {
                        setShippingInfo({...shippingInfo, state: e.target.value});
                        setIsStateDropdownOpen(true);
                      }}
                      onFocus={() => setIsStateDropdownOpen(true)}
                    />
                    <AnimatePresence>
                      {isStateDropdownOpen && filteredStates.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute z-50 left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200"
                        >
                          {filteredStates.map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => {
                                setShippingInfo({...shippingInfo, state: s});
                                setIsStateDropdownOpen(false);
                              }}
                              className="w-full px-4 py-2 text-left text-xs md:text-sm hover:bg-gray-50 transition-colors"
                            >
                              {s}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div>
                    <label className="block text-[8px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 md:mb-2">ZIP</label>
                    <input 
                      type="text" 
                      className="w-full px-2 md:px-4 py-2 md:py-3 bg-gray-50 rounded-lg md:rounded-xl border-none focus:ring-2 focus:ring-black transition-all text-xs md:text-base"
                      value={shippingInfo.zip}
                      onChange={e => setShippingInfo({...shippingInfo, zip: e.target.value})}
                    />
                  </div>
                </div>
                <button 
                  disabled={!isStep1Valid}
                  onClick={() => setStep(2)}
                  className="w-full py-3 md:py-4 bg-black text-white font-bold rounded-xl md:rounded-2xl hover:bg-emerald-600 transition-all disabled:opacity-50 text-xs md:text-base mt-2"
                >
                  Continue to Shipping
                </button>
              </motion.div>
            ) : (
              <div className="text-[10px] md:text-sm text-gray-500 font-medium">
                {shippingInfo.firstName} {shippingInfo.lastName}<br />
                {shippingInfo.address}{shippingInfo.unitNumber ? `, ${shippingInfo.unitNumber}` : ''}, {shippingInfo.city}, {shippingInfo.state} {shippingInfo.zip}
              </div>
            )}
          </section>

          {/* Step 2: Shipping Method */}
          <section className={`bg-white rounded-2xl md:rounded-[2.5rem] border transition-all duration-500 ${step === 2 ? 'border-emerald-200 shadow-xl shadow-emerald-500/5 p-3 md:p-12' : 'border-gray-100 p-3 opacity-60'}`}>
            <div className="flex items-center justify-between mb-4 md:mb-8">
              <h2 className="text-sm md:text-2xl font-bold flex items-center gap-2 md:gap-3">
                <div className={`w-5 h-5 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-[10px] md:text-sm transition-colors ${step >= 2 ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>2</div>
                <span className="hidden md:inline">Shipping Method</span>
                <span className="md:hidden">Method</span>
              </h2>
              {step > 2 && (
                <button onClick={() => setStep(2)} className="text-[10px] md:text-sm font-bold text-emerald-600 hover:underline">Edit</button>
              )}
            </div>

            {step === 2 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 md:space-y-4">
                <label className={`flex items-center justify-between p-3 md:p-6 rounded-xl md:rounded-2xl border-2 transition-all cursor-pointer border-emerald-500 bg-emerald-50/30`}>
                  <div className="flex items-center gap-2 md:gap-4">
                    <input 
                      type="radio" 
                      name="shipping" 
                      checked={true}
                      readOnly
                      className="w-3 h-3 md:w-4 md:h-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="font-bold text-gray-900 text-[10px] md:text-lg">Express Shipping</p>
                      <p className="text-[8px] md:text-sm text-gray-500">1-3 business days</p>
                    </div>
                  </div>
                  <span className="font-bold text-gray-900 text-[10px] md:text-lg">{shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}</span>
                </label>
                <button 
                  onClick={() => setStep(3)}
                  className="w-full mt-2 md:mt-4 py-3 md:py-4 bg-black text-white font-bold rounded-xl md:rounded-2xl hover:bg-emerald-600 transition-all text-xs md:text-base"
                >
                  Continue to Payment
                </button>
              </motion.div>
            )}
            {step > 2 && (
              <p className="text-[10px] md:text-sm text-gray-600 font-medium capitalize">Express — {shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}</p>
            )}
          </section>

          {/* Step 3: Payment Method */}
          <section className={`bg-white rounded-2xl md:rounded-[2.5rem] border transition-all duration-500 ${step === 3 ? 'border-emerald-200 shadow-xl shadow-emerald-500/5 p-3 md:p-12' : 'border-gray-100 p-3 opacity-60'}`}>
            <h2 className="text-sm md:text-2xl font-bold mb-4 md:mb-8 flex items-center gap-2 md:gap-3">
              <div className={`w-5 h-5 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-[10px] md:text-sm transition-colors ${step >= 3 ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>3</div>
              Payment
            </h2>

            {step === 3 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 md:space-y-4">
                {/* Credit Card */}
                <label className={`flex items-center justify-between p-3 md:p-5 rounded-xl md:rounded-2xl border-2 transition-all cursor-pointer ${paymentMethod === 'card' ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-100 hover:border-gray-200'}`}>
                  <div className="flex items-center gap-2 md:gap-6">
                    <input 
                      type="radio" 
                      name="payment" 
                      checked={paymentMethod === 'card'} 
                      onChange={() => setPaymentMethod('card')} 
                      className="w-3 h-3 md:w-5 md:h-5 text-emerald-600 flex-shrink-0 cursor-pointer" 
                    />
                    <div className="flex items-center gap-2 md:gap-4">
                      <div className="w-12 h-8 md:w-24 md:h-16 bg-gray-50 rounded-lg md:rounded-xl flex items-center justify-center p-0.5 md:p-1 border border-gray-100 flex-shrink-0 shadow-sm">
                        <img src="https://res.cloudinary.com/ditxwmhnj/image/upload/v1775706494/6963703_k4yzd8.png" alt="Credit Card" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                      <span className="font-bold text-gray-900 text-[10px] md:text-base">Card</span>
                    </div>
                  </div>
                </label>

                {/* Coming Soon: Zelle */}
                <div className="p-3 md:p-5 rounded-xl md:rounded-2xl border border-dashed border-gray-200 opacity-50 flex items-center justify-between">
                  <div className="flex items-center gap-2 md:gap-4">
                    <div className="w-3 h-3 md:w-4 md:h-4 rounded-full border border-gray-300" />
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="w-6 h-6 md:w-10 md:h-10 bg-gray-100 rounded-lg flex items-center justify-center p-1 md:p-2">
                        <img src="https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971792/zelle_w6wa7a.png" alt="Zelle" className="w-full h-full object-contain grayscale" referrerPolicy="no-referrer" />
                      </div>
                      <span className="font-bold text-gray-400 text-[10px] md:text-base">Zelle</span>
                    </div>
                  </div>
                  <span className="text-[6px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest">Soon</span>
                </div>

                {/* Coming Soon: Venmo */}
                <div className="p-3 md:p-5 rounded-xl md:rounded-2xl border border-dashed border-gray-200 opacity-50 flex items-center justify-between">
                  <div className="flex items-center gap-2 md:gap-4">
                    <div className="w-3 h-3 md:w-4 md:h-4 rounded-full border border-gray-300" />
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="w-6 h-6 md:w-10 md:h-10 bg-gray-100 rounded-lg flex items-center justify-center p-1 md:p-2">
                        <img src="https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971791/venmo_ou9gtd.png" alt="Venmo" className="w-full h-full object-contain grayscale" referrerPolicy="no-referrer" />
                      </div>
                      <span className="font-bold text-gray-400 text-[10px] md:text-base">Venmo</span>
                    </div>
                  </div>
                  <span className="text-[6px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest">Soon</span>
                </div>

                {/* Coming Soon: Crypto */}
                <div className="p-3 md:p-5 rounded-xl md:rounded-2xl border border-dashed border-gray-200 opacity-50 flex items-center justify-between">
                  <div className="flex items-center gap-2 md:gap-4">
                    <div className="w-3 h-3 md:w-4 md:h-4 rounded-full border border-gray-300" />
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="w-6 h-6 md:w-10 md:h-10 bg-gray-100 rounded-lg flex items-center justify-center p-1 md:p-2">
                        <img src="https://cdn.worldvectorlogo.com/logos/bitcoin-1.svg" alt="Crypto" className="w-full h-full object-contain grayscale" referrerPolicy="no-referrer" />
                      </div>
                      <span className="font-bold text-gray-400 text-[10px] md:text-base">Crypto</span>
                    </div>
                  </div>
                  <span className="text-[6px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest">Soon</span>
                </div>

                <div className="mt-4 md:mt-8 p-3 md:p-6 bg-gray-50 rounded-xl md:rounded-2xl border border-gray-100">
                  <div className="flex items-start gap-2 md:gap-3">
                    <Info className="w-3 h-3 md:w-5 md:h-5 text-gray-400 mt-0.5" />
                    <p className="text-[8px] md:text-sm text-gray-600 leading-relaxed">
                      {paymentMethod === 'card' 
                        ? "You've selected Credit Card. You will be redirected to our secure payment processor to complete your transaction."
                        : "Payment instructions will be provided on the next screen."}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </section>
        </div>

        <div className="col-span-1 lg:col-span-5">
          <div className="bg-white rounded-2xl md:rounded-[2.5rem] border border-gray-100 p-3 md:p-10 shadow-sm sticky top-32">
            <h2 className="text-sm md:text-xl font-bold mb-4 md:mb-8">Order Summary</h2>
            
            <div className="mb-4 md:mb-8 space-y-2 md:space-y-4">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Promo"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="flex-1 bg-gray-50 border border-gray-100 rounded-lg md:rounded-xl px-2 md:px-4 py-2 md:py-3 text-[10px] md:text-sm focus:ring-2 focus:ring-black outline-none uppercase"
                />
                <button 
                  onClick={handleApplyPromo}
                  disabled={isApplying || !promoCode.trim()}
                  className="px-3 md:px-6 py-2 md:py-3 bg-black text-white font-bold text-[8px] md:text-xs rounded-lg md:rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {isApplying ? <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> : 'Apply'}
                </button>
              </div>
              {promoError && <p className="text-[8px] md:text-xs text-red-500 font-medium ml-1">{promoError}</p>}
              {appliedPromo && (
                <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 rounded-lg md:rounded-xl px-2 md:px-4 py-2 md:py-3">
                  <div className="flex items-center gap-1 md:gap-2">
                    <Tag className="w-3 h-3 md:w-4 md:h-4 text-emerald-600" />
                    <span className="text-[8px] md:text-xs font-bold text-emerald-700 uppercase tracking-wider">{appliedPromo.code}</span>
                  </div>
                  <button onClick={() => onApplyPromo(null)} className="text-emerald-600 hover:text-emerald-800">
                    <X className="w-3 h-3 md:w-4 md:h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4 md:space-y-6 mb-4 md:mb-8 max-h-[200px] md:max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-100">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-2 md:gap-4">
                  <div className="w-10 h-10 md:w-20 md:h-20 bg-gray-50 rounded-lg md:rounded-2xl overflow-hidden flex-shrink-0 border border-gray-100">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-[10px] md:text-sm text-gray-900 mb-0.5 md:mb-1 truncate max-w-[80px] md:max-w-none">{item.name}</h3>
                    <div className="flex items-center gap-1 md:gap-3 mb-1 md:mb-2">
                      <div className="flex items-center bg-gray-50 rounded md:rounded-lg border border-gray-100">
                        <button 
                          onClick={() => onUpdateQuantity(item.id, -1)}
                          className="p-0.5 md:p-1 hover:text-emerald-600 transition-colors"
                        >
                          <Minus className="w-2 h-2 md:w-3 md:h-3" />
                        </button>
                        <span className="text-[8px] md:text-xs font-bold w-4 md:w-6 text-center">{item.quantity}</span>
                        <button 
                          onClick={() => onUpdateQuantity(item.id, 1)}
                          className="p-0.5 md:p-1 hover:text-emerald-600 transition-colors"
                        >
                          <Plus className="w-2 h-2 md:w-3 md:h-3" />
                        </button>
                      </div>
                    </div>
                    <p className="text-emerald-600 font-bold text-[10px] md:text-sm">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Bacteriostatic Water Recommendation */}
            {!cart.some(item => item.name.toLowerCase().includes('bacteriostatic water')) && (
              <div className="mb-4 md:mb-8 p-2 md:p-4 bg-emerald-50 rounded-xl md:rounded-2xl border border-emerald-100">
                <div className="flex gap-2 md:gap-4">
                  <div className="w-8 h-8 md:w-16 md:h-16 bg-white rounded-lg md:rounded-xl overflow-hidden flex-shrink-0 border border-emerald-100">
                    <img 
                      src={products.find(p => p.name.toLowerCase().includes('bacteriostatic water'))?.image || "https://picsum.photos/seed/water/200/200"} 
                      alt="Bacteriostatic Water" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-[6px] md:text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5 md:mb-1">Recommended</p>
                    <h4 className="text-[8px] md:text-xs font-bold text-gray-900 mb-1 md:mb-2 truncate max-w-[60px] md:max-w-none">Bac Water</h4>
                    <button 
                      onClick={() => {
                        const bacProduct = products.find(p => p.name.toLowerCase().includes('bacteriostatic water'));
                        if (bacProduct) onAddToCart(bacProduct, 1);
                      }}
                      className="mt-1 px-2 py-1 bg-emerald-600 text-white text-[6px] md:text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-emerald-700 transition-all flex items-center gap-1"
                    >
                      <Plus className="w-2 h-2" /> Add — $15
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 md:space-y-4 pt-4 md:pt-8 border-t border-gray-100">
              <div className="flex justify-between text-gray-500 text-[10px] md:text-sm">
                <span>Subtotal</span>
                <span className="font-bold text-gray-900">${subtotal.toFixed(2)}</span>
              </div>
              {quantityDiscountPercent > 0 && (
                <div className="flex justify-between text-emerald-600 text-[10px] md:text-sm">
                  <div className="flex items-center gap-1 md:gap-2">
                    <Tag className="w-2 h-2 md:w-3 md:h-3" />
                    <span>Quantity Discount ({quantityDiscountPercent}%)</span>
                  </div>
                  <span className="font-bold">-${quantityDiscountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-500 text-[10px] md:text-sm">
                <span>Shipping</span>
                <span className="font-bold text-emerald-600">
                  {shipping <= 0 ? 'FREE' : `$${shipping.toFixed(2)}`}
                </span>
              </div>
              {appliedPromo && (
                <div className="flex justify-between text-emerald-600 text-[10px] md:text-sm">
                  <div className="flex items-center gap-1 md:gap-2">
                    <Tag className="w-2 h-2 md:w-3 md:h-3" />
                    <span>Promo ({appliedPromo.discount}%)</span>
                  </div>
                  <span className="font-bold">-${promoDiscount.toFixed(2)}</span>
                </div>
              )}
              {cryptoDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 text-[10px] md:text-sm">
                  <span>Crypto (5%)</span>
                  <span className="font-bold">-${cryptoDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-2 md:pt-4 border-t border-gray-100 flex justify-between items-end">
                <div>
                  <p className="text-[8px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5 md:mb-1">Total</p>
                  <p className="text-sm md:text-3xl font-bold text-gray-900">${total.toFixed(2)}</p>
                </div>
              </div>

              <div className="pt-3 md:pt-6 space-y-2 md:space-y-4">
                <label className="flex items-start gap-2 md:gap-3 cursor-pointer group">
                  <div className="flex items-center h-4 md:h-5">
                    <input
                      type="checkbox"
                      checked={acknowledgements.age}
                      onChange={(e) => setAcknowledgements({ ...acknowledgements, age: e.target.checked })}
                      className="h-3 w-3 md:h-4 md:w-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                    />
                  </div>
                  <span className="text-[8px] md:text-[11px] text-gray-500 font-medium leading-tight group-hover:text-gray-700 transition-colors">
                    I confirm I am 21 years of age or older.
                  </span>
                </label>

                <label className="flex items-start gap-2 md:gap-3 cursor-pointer group">
                  <div className="flex items-center h-4 md:h-5">
                    <input
                      type="checkbox"
                      checked={acknowledgements.research}
                      onChange={(e) => setAcknowledgements({ ...acknowledgements, research: e.target.checked })}
                      className="h-3 w-3 md:h-4 md:w-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                    />
                  </div>
                  <span className="text-[8px] md:text-[11px] text-gray-500 font-medium leading-tight group-hover:text-gray-700 transition-colors">
                    I understand these compounds are sold strictly for laboratory research purposes and are not intended for human consumption.
                  </span>
                </label>

                <label className="flex items-start gap-2 md:gap-3 cursor-pointer group">
                  <div className="flex items-center h-4 md:h-5">
                    <input
                      type="checkbox"
                      checked={acknowledgements.terms}
                      onChange={(e) => setAcknowledgements({ ...acknowledgements, terms: e.target.checked })}
                      className="h-3 w-3 md:h-4 md:w-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                    />
                  </div>
                  <span className="text-[8px] md:text-[11px] text-gray-500 font-medium leading-tight group-hover:text-gray-700 transition-colors">
                    I have read and agree to the Terms & Conditions.
                  </span>
                </label>
              </div>
              
              <button 
                disabled={step < 3 || !acknowledgements.age || !acknowledgements.research || !acknowledgements.terms || isPlacingOrder}
                onClick={handlePlaceOrder}
                className="w-full py-3 md:py-5 bg-black text-white font-bold rounded-xl md:rounded-2xl hover:bg-emerald-600 disabled:opacity-30 disabled:hover:bg-black transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-2 md:gap-3 mt-4 md:mt-8 group text-[10px] md:text-lg"
              >
                {isPlacingOrder ? (
                  <Loader2 className="w-3 h-3 md:w-5 md:h-5 animate-spin" />
                ) : (
                  <>
                    <span className="truncate">
                      {initialOrder ? 'Complete Order' : (paymentMethod === 'card' ? 'Pay with Credit Card' : 'Complete Purchase')} 
                    </span>
                    <ChevronRight className="w-3 h-3 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform flex-shrink-0" />
                  </>
                )}
              </button>
              
              <p className="text-[10px] text-gray-400 text-center mt-6 leading-relaxed">
                By completing your purchase, you agree to our Terms and Conditions and Privacy Policy. 
                All compounds are for laboratory research use only.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProductDetailView = ({ product, products, onAddToCart, onBack, onSelectProduct, settings, timeLeft }: { product: Product, products: Product[], onAddToCart: (product: Product, quantity: number) => void, onBack: () => void, onSelectProduct: (product: Product) => void, settings: SiteSettings | null, timeLeft: { hours: number, minutes: number, seconds: number } | null }) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedDosageIdx, setSelectedDosageIdx] = useState<number | null>(null);
  
  const activeDosage = selectedDosageIdx !== null ? product.dosages?.[selectedDosageIdx] : null;
  const basePrice = activeDosage?.price || product.price;
  const baseOriginalPrice = activeDosage?.originalPrice || product.originalPrice;
  const displayImage = activeDosage?.image || product.image;
  const displayDosage = activeDosage?.label || product.dosage;
  const isCurrentlyInStock = activeDosage 
    ? (activeDosage.stock !== undefined ? activeDosage.stock > 0 : activeDosage.inStock !== undefined ? activeDosage.inStock : product.inStock !== false) 
    : (product.stock !== undefined ? product.stock > 0 : product.inStock !== false);

  const getDiscountedPrice = (qty: number) => {
    if (qty >= 3) return basePrice * 0.93;
    if (qty >= 2) return basePrice * 0.96;
    return basePrice;
  };

  const currentPrice = getDiscountedPrice(quantity);
  const total = currentPrice * quantity;

  // Blank images for each quantity selection (to be added later)
  const quantityImages: Record<number, string> = {
    1: product.quantityImages?.[1] || displayImage,
    2: product.quantityImages?.[2] || displayImage,
    3: product.quantityImages?.[3] || displayImage,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-6 md:h-[calc(100vh-80px)] md:overflow-hidden overflow-x-hidden">
      {/* Trust Badge Bar */}
      <div className="flex flex-wrap items-center justify-center gap-y-3 gap-x-6 md:gap-12 py-3 md:py-2 border-b border-gray-100 mb-6 md:mb-4 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1.5 md:gap-2 text-gray-400 flex-shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-500" />
          <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Lab Verified</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2 text-gray-400 flex-shrink-0">
          <Truck className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-500" />
          <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">1-3 Day Shipping</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2 text-gray-400 flex-shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-500" />
          <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">30-Day Guarantee</span>
        </div>
      </div>

      <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-black mb-6 md:mb-4 transition-colors group text-sm md:text-base">
        <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 group-hover:-translate-x-1 transition-transform" /> Back to Shop
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[40%_60%] gap-8 md:gap-12 md:h-[calc(100%-120px)]">
        {/* Product Image */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="aspect-[4/5] md:aspect-auto md:h-full rounded-[2.5rem] overflow-hidden bg-white border border-gray-100 shadow-sm relative md:sticky md:top-0"
        >
          <img src={displayImage} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          {!isCurrentlyInStock && (
            <div className="absolute top-8 left-8 px-6 py-3 bg-red-500 text-white text-xs font-bold uppercase tracking-[0.2em] rounded-full shadow-2xl">
              Restocking Soon
            </div>
          )}
        </motion.div>

        {/* Product Info */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col md:overflow-y-auto md:pr-4 md:scrollbar-thin"
        >
          <div className="mb-6 md:mb-4">
            <span className="text-emerald-500 font-bold tracking-[0.2em] text-xs uppercase mb-3 md:mb-2 block">{product.category}</span>
            <h1 className="text-4xl md:text-3xl font-bold text-gray-900 mb-2 tracking-tight">{product.name}</h1>
            <div className="flex items-center gap-2 mb-3 md:mb-2">
              <Star className="w-4 h-4 text-emerald-500 fill-emerald-500" />
              <span className="text-emerald-600 font-bold text-[10px] md:text-xs uppercase tracking-wider">Loved by 500+ researchers</span>
            </div>
            <div className="mb-4 md:mb-3">
              <ProductRating productId={product.id} size="sm" />
            </div>
            
            <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-3 md:gap-4 mb-6 md:mb-4">
              <div className="flex items-start md:flex-col md:items-center md:text-center gap-3 md:gap-2 md:p-3 md:bg-white md:rounded-2xl md:border md:border-gray-100 md:shadow-sm">
                <div className="w-5 h-5 md:w-7 md:h-7 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5 md:mt-0">
                  <Check className="w-3 h-3 md:w-4 md:h-4 text-emerald-600" />
                </div>
                <div>
                  <h4 className="text-sm md:text-[11px] font-bold text-gray-900 leading-tight">HPLC Tested</h4>
                  <p className="text-xs md:text-[9px] text-gray-500 md:mt-0.5">Third-party analysis.</p>
                </div>
              </div>
              <div className="flex items-start md:flex-col md:items-center md:text-center gap-3 md:gap-2 md:p-3 md:bg-white md:rounded-2xl md:border md:border-gray-100 md:shadow-sm">
                <div className="w-5 h-5 md:w-7 md:h-7 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5 md:mt-0">
                  <Check className="w-3 h-3 md:w-4 md:h-4 text-emerald-600" />
                </div>
                <div>
                  <h4 className="text-sm md:text-[11px] font-bold text-gray-900 leading-tight">Secure Synthesis</h4>
                  <p className="text-xs md:text-[9px] text-gray-500 md:mt-0.5">State-of-the-art lab.</p>
                </div>
              </div>
              <div className="flex items-start md:flex-col md:items-center md:text-center gap-3 md:gap-2 md:p-3 md:bg-white md:rounded-2xl md:border md:border-gray-100 md:shadow-sm">
                <div className="w-5 h-5 md:w-7 md:h-7 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5 md:mt-0">
                  <Check className="w-3 h-3 md:w-4 md:h-4 text-emerald-600" />
                </div>
                <div>
                  <h4 className="text-sm md:text-[11px] font-bold text-gray-900 leading-tight">Fast Logistics</h4>
                  <p className="text-xs md:text-[9px] text-gray-500 md:mt-0.5">Discreet shipping.</p>
                </div>
              </div>
            </div>

            <div className="pt-4 md:pt-3 border-t border-gray-100 space-y-4 md:space-y-3">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-3 md:mb-2">Select Research Dosage</h4>
                <div className="flex flex-wrap gap-2 md:gap-3">
                  {/* Default Dosage */}
                  {(() => {
                    const defaultInStock = product.stock !== undefined ? product.stock > 0 : product.inStock !== false;
                    const isSelected = selectedDosageIdx === null;
                    return (
                      <button 
                        onClick={() => setSelectedDosageIdx(null)}
                        className={`px-4 md:px-5 py-2 md:py-2.5 rounded-xl md:rounded-2xl border-2 transition-all font-bold text-xs md:text-sm flex flex-col items-center justify-center min-w-[100px] ${
                          isSelected 
                            ? (defaultInStock ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-red-500 bg-red-50 text-red-600') 
                            : 'border-gray-100 hover:border-gray-200 text-gray-600'
                        } ${!defaultInStock ? 'opacity-60 grayscale-[0.5]' : ''}`}
                      >
                        <span className={!defaultInStock ? 'line-through opacity-50' : ''}>{product.dosage || 'Standard'}</span>
                        {!defaultInStock && <span className="text-[8px] md:text-[9px] font-black uppercase tracking-tighter mt-0.5">Out of Stock</span>}
                      </button>
                    );
                  })()}
                  
                  {/* Additional Dosages */}
                  {product.dosages?.map((d, idx) => {
                    const dosageInStock = d.stock !== undefined ? d.stock > 0 : d.inStock !== undefined ? d.inStock : product.inStock !== false;
                    const isSelected = selectedDosageIdx === idx;
                    return (
                      <button 
                        key={idx}
                        onClick={() => setSelectedDosageIdx(idx)}
                        className={`px-4 md:px-5 py-2 md:py-2.5 rounded-xl md:rounded-2xl border-2 transition-all font-bold text-xs md:text-sm flex flex-col items-center justify-center min-w-[100px] ${
                          isSelected 
                            ? (dosageInStock ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-red-500 bg-red-50 text-red-600') 
                            : 'border-gray-100 hover:border-gray-200 text-gray-600'
                        } ${!dosageInStock ? 'opacity-60 grayscale-[0.5]' : ''}`}
                      >
                        <span className={!dosageInStock ? 'line-through opacity-50' : ''}>{d.label}</span>
                        {!dosageInStock && <span className="text-[8px] md:text-[9px] font-black uppercase tracking-tighter mt-0.5">Out of Stock</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <p className="text-xl md:text-2xl font-bold text-gray-900">{displayDosage}</p>
                {baseOriginalPrice && baseOriginalPrice > basePrice && (
                  <div className="px-3 py-1 bg-emerald-500 text-white text-[9px] md:text-[10px] font-bold uppercase tracking-widest rounded-full">
                    {Math.round(((baseOriginalPrice - basePrice) / baseOriginalPrice) * 100)}% OFF
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-3xl p-6 md:p-5 mb-6 md:mb-4 border border-gray-100">
            <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 md:mb-3">Select Your Offer</h3>
            
            <div className="flex flex-col gap-3 md:grid md:grid-cols-3 mb-6 md:mb-4">
              {[1, 2, 3].map((num) => {
                const cardPrice = getDiscountedPrice(num);
                const isPopular = num === 2;
                const isBestValue = num === 3;
                
                return (
                  <button 
                    key={num}
                    onClick={() => setQuantity(num)}
                    className={`relative flex flex-col items-center p-3 md:p-2.5 rounded-2xl md:rounded-3xl border-2 transition-all w-full ${quantity === num ? 'border-emerald-500 bg-emerald-50/50 ring-4 ring-emerald-500/10' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white text-[7px] md:text-[9px] font-black px-3 md:px-4 py-1.5 rounded-full uppercase tracking-[0.1em] whitespace-nowrap z-20 shadow-lg ring-2 ring-white">
                        Most Popular
                      </div>
                    )}
                    {isBestValue && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[7px] md:text-[9px] font-black px-3 md:px-4 py-1.5 rounded-full uppercase tracking-[0.1em] whitespace-nowrap z-20 shadow-lg ring-2 ring-white">
                        Best Value
                      </div>
                    )}
                    
                    <div className="w-12 h-12 md:w-14 md:h-14 mt-1 md:mt-0.5 mb-2 md:mb-2 relative overflow-hidden rounded-lg md:rounded-xl">
                      <img src={quantityImages[num]} alt={`${num} Bottle`} className="w-full h-full object-cover scale-150 md:scale-125 transition-transform" />
                    </div>
                    
                    <div className="text-center">
                      <p className="text-[10px] md:text-xs font-bold text-gray-900 mb-0.5">{num} {num === 1 ? 'Bottle' : 'Bottles'}</p>
                      <p className="text-sm md:text-base font-black text-black">${cardPrice.toFixed(2)}<span className="text-[8px] md:text-[9px] text-gray-400 font-bold uppercase ml-1">/ea</span></p>
                      <p className="text-[8px] md:text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total: ${(cardPrice * num).toFixed(2)}</p>
                    </div>
                    
                    {quantity === num && (
                      <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 text-emerald-500">
                        <CheckCircle2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-4 md:gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 bg-white rounded-xl p-1.5 border border-gray-100 shadow-sm">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-400 hover:text-black"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center font-bold text-base">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-400 hover:text-black"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Price Per Bottle</p>
                  <div className="flex flex-col items-end">
                    <p className="text-lg md:text-xl font-bold text-black">${currentPrice.toFixed(2)}</p>
                    {baseOriginalPrice && baseOriginalPrice > basePrice && (
                      <span className="text-gray-400 line-through text-[10px] md:text-xs font-medium">
                        ${(baseOriginalPrice * (currentPrice / basePrice)).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 md:pt-3 border-t border-gray-200">
                {settings?.countdownActive && timeLeft && (
                  <div className="flex items-center justify-center gap-2 py-2 md:py-1.5 bg-emerald-50 rounded-xl border border-emerald-100 mb-4 md:mb-3 animate-pulse">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[9px] md:text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
                      Offer Ends In: {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
                    </span>
                  </div>
                )}
                
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 md:gap-0">
                  <div className="flex flex-row md:flex-col justify-between items-center md:items-start">
                    <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0 md:mb-0.5">Total Amount</p>
                    <div className="flex items-baseline md:flex-col gap-2 md:gap-0">
                      <p className="text-2xl md:text-2xl font-bold text-black">${total.toFixed(2)}</p>
                      {baseOriginalPrice && baseOriginalPrice > basePrice && (
                        <span className="text-gray-400 line-through text-[10px] md:text-xs font-medium">
                          ${(baseOriginalPrice * quantity * (currentPrice / basePrice)).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button 
                    disabled={!isCurrentlyInStock}
                    onClick={() => onAddToCart({
                      ...product,
                      price: basePrice,
                      image: displayImage,
                      dosage: displayDosage
                    }, quantity)}
                    className="w-full md:w-auto px-10 md:px-12 py-4 md:py-4 min-h-[52px] bg-black text-white font-bold rounded-xl md:rounded-2xl hover:bg-emerald-600 transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-black/10 disabled:opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {!isCurrentlyInStock ? 'Restocking Soon' : <><ShoppingCart className="w-5 h-5" /> Add to Cart</>}
                  </button>
                </div>

                <div className="mt-3 md:mt-2 flex flex-wrap items-center justify-center gap-3 md:gap-4 text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest">30-Day Guarantee</span>
                  </div>
                  <div className="hidden md:flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">1-3 Day Shipping</span>
                  </div>
                  <div className="hidden md:flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Lab Verified</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:hidden">
            <div className="p-4 rounded-2xl border border-gray-100 flex items-center gap-3">
              <Truck className="w-5 h-5 text-emerald-500" />
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">1-3 Day Shipping</span>
            </div>
            <div className="p-4 rounded-2xl border border-gray-100 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Lab Verified</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Sticky Mobile Add to Cart Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex items-center justify-between z-50 md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Amount</p>
          <p className="text-xl font-bold text-black">${total.toFixed(2)}</p>
        </div>
        <button 
          disabled={!isCurrentlyInStock}
          onClick={() => onAddToCart({
            ...product,
            price: basePrice,
            image: displayImage,
            dosage: displayDosage
          }, quantity)}
          className="px-8 py-3 bg-black text-white font-bold rounded-xl hover:bg-emerald-600 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:bg-gray-400"
        >
          {!isCurrentlyInStock ? 'Restocking' : <><ShoppingCart className="w-4 h-4" /> Add to Cart</>}
        </button>
      </div>

      {/* Frequently Researched Together Slider */}
      <div className="mt-32">
        <div className="mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Frequently Researched Together</h2>
          <p className="text-gray-500">Commonly paired compounds for synergistic research studies.</p>
        </div>

        <div className="relative">
          <div 
            className="flex gap-8 overflow-x-auto pb-8 snap-x no-scrollbar scroll-smooth"
          >
            {products
              .filter(p => p.id !== product.id && !p.isArchived)
              .map((rec) => (
              <motion.div 
                key={rec.id}
                whileHover={{ y: -5 }}
                className="min-w-[280px] snap-start group cursor-pointer"
                onClick={() => onSelectProduct(rec)}
              >
                <div className="aspect-square rounded-3xl overflow-hidden bg-gray-50 border border-gray-100 mb-6 relative">
                  <img src={rec.image} alt={rec.name} className="w-full h-full object-cover scale-110 group-hover:scale-125 transition-transform duration-700" referrerPolicy="no-referrer" />
                  {rec.dosage && (
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full border border-gray-100">
                      <span className="text-[10px] font-bold text-gray-900">{rec.dosage}</span>
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-gray-900 mb-1 group-hover:text-emerald-600 transition-colors">{rec.name}</h3>
                <p className="text-emerald-600 font-bold">${rec.price.toFixed(2)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const CalculatorView = () => {
  const [vial, setVial] = useState<number | null>(5);
  const [bac, setBac] = useState<number | null>(1);
  const [dose, setDose] = useState<number | null>(0.05);
  const [syringe, setSyringe] = useState(0.3);
  const [ticks, setTicks] = useState(30);
  
  const [vialCustom, setVialCustom] = useState('');
  const [bacCustom, setBacCustom] = useState('');
  const [doseCustom, setDoseCustom] = useState('');
  
  const [showVialCustom, setShowVialCustom] = useState(false);
  const [showBacCustom, setShowBacCustom] = useState(false);
  const [showDoseCustom, setShowDoseCustom] = useState(false);

  const handleVialClick = (val: string) => {
    if (val === 'other') {
      setShowVialCustom(true);
      setVial(parseFloat(vialCustom) || null);
    } else {
      setShowVialCustom(false);
      setVial(parseFloat(val));
    }
  };

  const handleBacClick = (val: string) => {
    if (val === 'other') {
      setShowBacCustom(true);
      setBac(parseFloat(bacCustom) || null);
    } else {
      setShowBacCustom(false);
      setBac(parseFloat(val));
    }
  };

  const handleDoseClick = (val: string) => {
    if (val === 'other') {
      setShowDoseCustom(true);
      setDose(parseFloat(doseCustom) || null);
    } else {
      setShowDoseCustom(false);
      setDose(parseFloat(val));
    }
  };

  const handleSyringeClick = (val: number, t: number) => {
    setSyringe(val);
    setTicks(t);
  };

  const concMgPerMl = (vial && bac) ? (vial / bac) : 0;
  const mlNeeded = (dose && concMgPerMl) ? dose / concMgPerMl : 0;
  const unitsNeeded = mlNeeded * (ticks / syringe);

  const buildSyringe = (target: number, totalTicks: number) => {
    const W = 560, H = 48, barH = 14, startX = 20, endX = W - 10;
    const trackW = endX - startX;
    const fillW = (target / totalTicks) * trackW;
    const fillX = startX + fillW;
    const tickStep = totalTicks <= 30 ? 5 : 10;
    let ticksJSX = [];
    for (let i = 0; i <= totalTicks; i++) {
      const x = startX + (i / totalTicks) * trackW;
      const major = i % tickStep === 0;
      ticksJSX.push(
        <line 
          key={`tick-${i}`}
          x1={x} y1={H/2+barH/2} 
          x2={x} y2={H/2+barH/2+(major?10:5)} 
          stroke="#b0aea8" 
          strokeWidth={major?1:0.5}
        />
      );
      if (major && i > 0) {
        ticksJSX.push(
          <text 
            key={`text-${i}`}
            x={x} y={H/2+barH/2+22} 
            textAnchor="middle" 
            fontSize="11" 
            fill="#7a7870" 
            fontFamily="Inter, sans-serif"
          >
            {i}
          </text>
        );
      }
    }
    return (
      <svg className="w-full block overflow-visible" viewBox={`0 0 ${W} ${H+30}`} xmlns="http://www.w3.org/2000/svg">
        <rect x={startX} y={H/2-barH/2} width={trackW} height={barH} rx="4" fill="#f0ede8" stroke="#d0cec9" strokeWidth="0.5"/>
        <rect x={startX} y={H/2-barH/2} width={Math.max(0,fillW)} height={barH} rx="4" fill="#1a1a18"/>
        <line x1={fillX} y1={H/2-barH/2-6} x2={fillX} y2={H/2+barH/2+6} stroke="#d85a30" strokeWidth="2"/>
        {ticksJSX}
      </svg>
    );
  };

  const displayUnits = Math.round(unitsNeeded * 10) / 10;
  const displayMl = mlNeeded.toFixed(3);
  const concDisplay = (vial && bac) ? (vial / bac).toFixed(2) : '0.00';

  return (
    <section className="py-24 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8 md:p-12 shadow-sm">
        <div className="mb-12 pb-8 border-b border-gray-100">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">Peptide Reconstitution Calculator</h1>
          <p className="text-sm text-gray-500">Calculate your injection volume based on your vial, solvent, and dose.</p>
        </div>

        <div className="space-y-10">
          {/* Vial Quantity */}
          <div className="space-y-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Peptide vial quantity</p>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 15].map(val => (
                <button 
                  key={val}
                  onClick={() => handleVialClick(val.toString())}
                  className={`px-6 py-2.5 rounded-full border text-sm font-medium transition-all ${!showVialCustom && vial === val ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-600 border-gray-100 hover:border-gray-300'}`}
                >
                  {val} mg
                </button>
              ))}
              <button 
                onClick={() => handleVialClick('other')}
                className={`px-6 py-2.5 rounded-full border text-sm font-medium transition-all ${showVialCustom ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-600 border-gray-100 hover:border-gray-300'}`}
              >
                Other
              </button>
            </div>
            {showVialCustom && (
              <div className="flex items-center gap-3 mt-4">
                <input 
                  type="number" 
                  value={vialCustom}
                  onChange={(e) => {
                    setVialCustom(e.target.value);
                    setVial(parseFloat(e.target.value) || null);
                  }}
                  placeholder="0"
                  className="w-24 px-4 py-2 rounded-full bg-gray-50 border border-gray-100 text-sm outline-none focus:border-black transition-all"
                />
                <span className="text-sm text-gray-400">mg</span>
              </div>
            )}
          </div>

          {/* BAC Water */}
          <div className="space-y-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Bacteriostatic water added</p>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 5].map(val => (
                <button 
                  key={val}
                  onClick={() => handleBacClick(val.toString())}
                  className={`px-6 py-2.5 rounded-full border text-sm font-medium transition-all ${!showBacCustom && bac === val ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-600 border-gray-100 hover:border-gray-300'}`}
                >
                  {val} ml
                </button>
              ))}
              <button 
                onClick={() => handleBacClick('other')}
                className={`px-6 py-2.5 rounded-full border text-sm font-medium transition-all ${showBacCustom ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-600 border-gray-100 hover:border-gray-300'}`}
              >
                Other
              </button>
            </div>
            {showBacCustom && (
              <div className="flex items-center gap-3 mt-4">
                <input 
                  type="number" 
                  value={bacCustom}
                  onChange={(e) => {
                    setBacCustom(e.target.value);
                    setBac(parseFloat(e.target.value) || null);
                  }}
                  placeholder="0"
                  className="w-24 px-4 py-2 rounded-full bg-gray-50 border border-gray-100 text-sm outline-none focus:border-black transition-all"
                />
                <span className="text-sm text-gray-400">ml</span>
              </div>
            )}
          </div>

          {/* Dose */}
          <div className="space-y-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Desired dose per injection</p>
            <div className="flex flex-wrap gap-2">
              {[0.05, 0.1, 0.25, 0.5].map(val => (
                <button 
                  key={val}
                  onClick={() => handleDoseClick(val.toString())}
                  className={`px-6 py-2.5 rounded-full border text-sm font-medium transition-all ${!showDoseCustom && dose === val ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-600 border-gray-100 hover:border-gray-300'}`}
                >
                  {val} mg
                </button>
              ))}
              <button 
                onClick={() => handleDoseClick('other')}
                className={`px-6 py-2.5 rounded-full border text-sm font-medium transition-all ${showDoseCustom ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-600 border-gray-100 hover:border-gray-300'}`}
              >
                Other
              </button>
            </div>
            {showDoseCustom && (
              <div className="flex items-center gap-3 mt-4">
                <input 
                  type="number" 
                  value={doseCustom}
                  onChange={(e) => {
                    setDoseCustom(e.target.value);
                    setDose(parseFloat(e.target.value) || null);
                  }}
                  placeholder="0"
                  className="w-24 px-4 py-2 rounded-full bg-gray-50 border border-gray-100 text-sm outline-none focus:border-black transition-all"
                />
                <span className="text-sm text-gray-400">mg</span>
              </div>
            )}
          </div>

          <div className="h-[1px] bg-gray-100" />

          {/* Syringe Size */}
          <div className="space-y-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Syringe size</p>
            <div className="flex flex-wrap gap-2">
              {[
                { val: 0.3, ticks: 30, label: '0.3 ml (30u)' },
                { val: 0.5, ticks: 50, label: '0.5 ml (50u)' },
                { val: 1.0, ticks: 100, label: '1.0 ml (100u)' }
              ].map(s => (
                <button 
                  key={s.val}
                  onClick={() => handleSyringeClick(s.val, s.ticks)}
                  className={`px-6 py-2.5 rounded-full border text-sm font-medium transition-all ${syringe === s.val ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-600 border-gray-100 hover:border-gray-300'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {vial && bac && dose ? (
            mlNeeded > syringe ? (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-sm text-red-600">
                Dose too large for this syringe — you need {mlNeeded.toFixed(3)} ml but your syringe holds {syringe} ml. Try a larger syringe or reduce your dose.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                  <p className="text-xl font-bold text-gray-900">Pull syringe to <span className="text-3xl text-emerald-600">{displayUnits}</span> units</p>
                  <p className="text-sm text-gray-500 mt-1">{displayMl} ml &nbsp;·&nbsp; {concDisplay} mg/ml concentration</p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                  <p className="text-sm text-gray-500 mb-6">To get <strong className="text-gray-900">{dose} mg</strong>, draw to <strong className="text-gray-900">{displayUnits} units</strong></p>
                  {buildSyringe(displayUnits, ticks)}
                </div>
              </div>
            )
          ) : null}

          <p className="text-[10px] text-gray-400 leading-relaxed pt-8 border-t border-gray-100 uppercase tracking-wider">
            For research and informational purposes only. This calculator provides mathematical reconstitution guidance and does not constitute medical advice. Always consult a qualified healthcare professional.
          </p>
        </div>
      </div>
    </section>
  );
};

const OrderSuccessView = ({ onBackToHome }: { onBackToHome: () => void }) => {
  return (
    <section className="min-h-[80vh] flex items-center justify-center px-4 py-20 bg-white">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl w-full text-center"
      >
        <div className="flex justify-center mb-12">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center rotate-3 group-hover:rotate-6 transition-transform">
              <FlaskConical className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="text-left">
              <span className="block text-xl font-black tracking-tighter leading-none">ECLIPSE</span>
              <span className="block text-[10px] font-bold tracking-[0.3em] text-emerald-500 leading-none mt-1">RESEARCH</span>
            </div>
          </div>
        </div>

        <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 relative">
          <CheckCircle2 className="w-12 h-12" />
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="absolute -right-2 -top-2 w-8 h-8 bg-black text-white rounded-lg flex items-center justify-center text-xs font-bold"
          >
            <ShieldCheck className="w-4 h-4" />
          </motion.div>
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-6 tracking-tight">Thank You!</h1>
        <div className="space-y-4 mb-12">
          <p className="text-gray-600 leading-relaxed text-lg">
            Your order has been successfully placed with <strong className="text-black">Eclipse Research</strong>. We appreciate your trust in our scientific compounds.
          </p>
          <p className="text-sm text-gray-400 uppercase tracking-widest font-bold">
            A confirmation email has been sent to your inbox
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 text-left">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mb-4 shadow-sm">
              <Package className="w-5 h-5 text-emerald-500" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">1-3 Day Shipping</h3>
            <p className="text-xs text-gray-500">Orders typically ship within 24 hours via Express.</p>
          </div>
          <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 text-left">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mb-4 shadow-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Quality Guaranteed</h3>
            <p className="text-xs text-gray-500">Every batch is tested for 99%+ purity.</p>
          </div>
        </div>

        <button 
          onClick={onBackToHome}
          className="inline-flex items-center gap-3 px-12 py-5 bg-black text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all active:scale-95 shadow-xl shadow-black/10 group"
        >
          Continue Shopping
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </motion.div>
    </section>
  );
};

const AppContent = () => {
  const [view, setView] = useState<'home' | 'shop' | 'about' | 'coas' | 'admin' | 'account' | 'checkout' | 'product' | 'terms' | 'shipping' | 'refund' | 'privacy' | 'calculator' | 'affiliate' | 'order-success' | 'refer'>('home');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('eclipse_cart');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [appliedPromo, setAppliedPromo] = useState<{ code: string, discount: number } | null>(null);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [isDbEmpty, setIsDbEmpty] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [isCartLoaded, setIsCartLoaded] = useState(false);
  const { user, isAdmin } = useAuth();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number, seconds: number } | null>(null);

  useEffect(() => {
    if (!settings?.countdownActive || !settings?.countdownTarget) {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      try {
        const targetDate = new Date(settings.countdownTarget);
        if (isNaN(targetDate.getTime())) {
          setTimeLeft(null);
          return false;
        }

        const target = targetDate.getTime();
        const now = new Date().getTime();
        const difference = target - now;

        if (difference <= 0) {
          setTimeLeft(null);
          return false;
        }

        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000)
        });
        return true;
      } catch (err) {
        setTimeLeft(null);
        return false;
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [settings]);

  // Load initial cart
  useEffect(() => {
    const loadCart = async () => {
      const cartId = user ? user.uid : getGuestId();
      try {
        const snapshot = await getDoc(doc(db, 'carts', cartId));
        if (snapshot.exists()) {
          const remoteItems = snapshot.data().items || [];
          if (remoteItems.length > 0) {
            setCart(remoteItems);
          }
        }
        // We don't setCart([]) here because it might overwrite the localStorage cart
        // which is initialized in the useState.
      } catch (error) {
        console.error('Error loading cart:', error);
      } finally {
        setIsCartLoaded(true);
      }
    };
    loadCart();
  }, [user]);

  // Handle login merge
  useEffect(() => {
    if (user && isCartLoaded) {
      const mergeCarts = async () => {
        const guestId = localStorage.getItem('guestId');
        if (!guestId) return;
        
        try {
          const guestSnapshot = await getDoc(doc(db, 'carts', guestId));
          if (guestSnapshot.exists()) {
            const guestItems = guestSnapshot.data().items as CartItem[];
            if (guestItems.length > 0) {
              setCart(prev => {
                const merged = [...prev];
                guestItems.forEach(gItem => {
                  const existing = merged.find(m => m.id === gItem.id && m.dosage === gItem.dosage);
                  if (existing) {
                    existing.quantity += gItem.quantity;
                  } else {
                    merged.push(gItem);
                  }
                });
                return merged;
              });
              // Clear guest cart
              await deleteDoc(doc(db, 'carts', guestId));
              localStorage.removeItem('guestId');
            }
          }
        } catch (error) {
          console.error('Error merging carts:', error);
        }
      };
      mergeCarts();
    }
  }, [user, isCartLoaded]);

  // Save cart on change
  useEffect(() => {
    if (!isCartLoaded) return;
    
    const saveCart = async () => {
      const cartId = user ? user.uid : getGuestId();
      try {
        await setDoc(doc(db, 'carts', cartId), {
          items: cart,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error('Error saving cart:', error);
      }
    };
    
    const timeout = setTimeout(saveCart, 1000); // Debounce
    return () => clearTimeout(timeout);
  }, [cart, user, isCartLoaded]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'site'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as SiteSettings);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const productsQuery = collection(db, 'products');
    const unsubscribe = onSnapshot(productsQuery, (snapshot) => {
      if (!snapshot.empty) {
        setProductsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        setIsDbEmpty(false);
      } else {
        setProductsList(INITIAL_PRODUCTS);
        setIsDbEmpty(true);
      }
      setLoadingProducts(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });
    return () => unsubscribe();
  }, []);

  // Auto-seed if empty and user is admin
  useEffect(() => {
    const autoSeed = async () => {
      console.log('Checking auto-seed condition:', { isAdmin, isDbEmpty, loadingProducts });
      if (isAdmin && isDbEmpty && !loadingProducts) {
        console.log('Auto-seeding products...');
        try {
          for (const p of INITIAL_PRODUCTS) {
            const { id, ...data } = p;
            await setDoc(doc(db, 'products', id), {
              ...data,
              stock: p.stock !== undefined ? p.stock : 50,
              inStock: p.inStock !== undefined ? p.inStock : true,
              lowStockThreshold: p.lowStockThreshold || 10,
              isArchived: p.isArchived || false,
              updatedAt: serverTimestamp(),
              createdAt: serverTimestamp()
            }, { merge: true });
          }
          console.log('Products auto-seeded successfully');
          setIsDbEmpty(false);
        } catch (error) {
          console.error('Error auto-seeding products:', error);
        }
      }
    };
    autoSeed();
  }, [isAdmin, isDbEmpty, loadingProducts]);

  // Ensure NAD+ and MT-2 reflect out of stock status if they exist (specific user request fix)
  useEffect(() => {
    const syncOutOfStock = async () => {
      if (isAdmin && !loadingProducts && productsList.length > 0) {
        const nad = productsList.find(p => p.id === '10');
        const mt2 = productsList.find(p => p.id === '4');
        
        if (nad && nad.inStock !== false) {
          await updateDoc(doc(db, 'products', '10'), { inStock: false });
        }
        if (mt2 && mt2.inStock !== false) {
          await updateDoc(doc(db, 'products', '4'), { inStock: false });
        }
      }
    };
    syncOutOfStock();
  }, [isAdmin, loadingProducts, productsList]);

  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setUserProfile(snapshot.data());
      }
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (user?.email) {
      const _learnq = (window as any)._learnq || [];
      _learnq.push(['identify', {
        '$email': user.email
      }]);
    }
  }, [user]);

  useEffect(() => {
    window.scrollTo(0, 0);
    // Klaviyo Active on Site tracking
    const _learnq = (window as any)._learnq || [];
    _learnq.push(['track', 'Active on Site']);
  }, [view]);

  useEffect(() => {
    if (cart.length === 0) {
      localStorage.removeItem('klaviyo_cart');
      localStorage.removeItem('eclipse_cart');
      return;
    }
    
    const cartValue = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const cartData = {
      '$value': cartValue,
      'ItemNames': cart.map(item => item.name),
      'CheckoutURL': 'https://eclipseresearch.shop/checkout',
      'Items': cart.map(item => ({
        ProductName: item.name,
        ItemPrice: item.price,
        Quantity: item.quantity,
        SKU: item.id
      }))
    };

    // Save to localStorage for persistence
    localStorage.setItem('eclipse_cart', JSON.stringify(cart));
    localStorage.setItem('klaviyo_cart', JSON.stringify({
      items: cart.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        sku: item.id
      })),
      totalValue: cartValue,
      checkoutUrl: 'https://eclipseresearch.shop/checkout'
    }));

    // Fire Klaviyo event with full current cart contents
    const _learnq = (window as any)._learnq || [];
    
    // Attempt to identify from user profile or saved email if available
    const email = user?.email || userProfile?.email;
    if (email) {
      _learnq.push(['identify', { '$email': email }]);
    }

    _learnq.push(['track', 'Added to Cart', cartData]);
  }, [cart]);

  const addToCart = (product: Product, quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id && item.dosage === product.dosage);
      const newQuantity = existing ? existing.quantity + quantity : quantity;
      
      // Calculate discounted price based on total quantity of this product
      let unitPrice = product.price;
      if (newQuantity >= 3) unitPrice = product.price * 0.85;
      else if (newQuantity >= 2) unitPrice = product.price * 0.90;

      if (existing) {
        return prev.map(item => (item.id === product.id && item.dosage === product.dosage) ? { ...item, quantity: newQuantity, price: unitPrice } : item);
      }
      return [...prev, { ...product, quantity: newQuantity, price: unitPrice }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return null;
        
        // Recalculate price based on new quantity
        const baseProduct = productsList.find(p => p.id === id);
        let unitPrice = baseProduct ? baseProduct.price : item.price;
        if (newQty >= 3) unitPrice = (baseProduct?.price || item.price) * 0.85;
        else if (newQty >= 2) unitPrice = (baseProduct?.price || item.price) * 0.90;
        
        return { ...item, quantity: newQty, price: unitPrice };
      }
      return item;
    }).filter((item): item is CartItem => item !== null));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleCheckout = () => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    setIsCartOpen(false);
    setView('checkout');
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const referralCode = params.get('ref');
    const path = window.location.pathname;
    
    if (referralCode) {
      console.log('Referral Flow: Saving referral code to localStorage:', referralCode);
      localStorage.setItem('referralCode', referralCode);
    }

    if (path === '/refer') {
      setView('refer');
    }

    if (paymentStatus === 'success') {
      // Redirect to the standalone success page if we get a success param on the root
      const search = window.location.search;
      window.location.href = `/order-success.html${search}`;
      return;
    }

    if (path === '/order-success') {
      // Fallback for direct /order-success hits
      window.location.href = '/order-success.html';
      return;
    }

    if (paymentStatus === 'cancel') {
      alert('Payment was cancelled. You can try again or choose another payment method.');
      setView('checkout');
      // Clear URL params
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const isDarkPage = ['home', 'shop', 'refer'].includes(view);
  const isBannerActive = settings?.countdownActive && timeLeft && ['home', 'shop', 'product', 'checkout'].includes(view);

  return (
    <div className="min-h-screen bg-[#F9F9F9] font-sans selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden">
      <div className="fixed top-0 w-full z-50 bg-transparent pointer-events-none">
        <div className="pointer-events-auto">
          <CountdownBanner currentView={view} settings={settings} timeLeft={timeLeft} />
          <Navbar 
            cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} 
            onOpenCart={() => setIsCartOpen(true)}
            onOpenAuth={() => setIsAuthOpen(true)}
            onNavigate={setView}
            currentView={view}
          />
        </div>
      </div>
      
      <main className={`${!isDarkPage ? (isBannerActive ? 'pt-[132px]' : 'pt-24') : ''} overflow-x-hidden`}>
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Hero onShopNow={() => setView('shop')} onViewCOAs={() => setView('coas')} />
              <PeptideCarousel 
                products={productsList} 
                onSelectProduct={(p) => {
                  setSelectedProduct(p);
                  setView('product');
                  window.scrollTo(0, 0);
                }} 
              />
              <FeaturedProducts 
                products={productsList}
                onAddToCart={addToCart} 
                onSelectProduct={(p) => {
                  setSelectedProduct(p);
                  setView('product');
                  window.scrollTo(0, 0);
                }} 
              />
              <PremiumResearchSection onLearnMore={() => setView('about')} />
              <ResearchDisclaimer />
            </motion.div>
          )}

          {view === 'about' && (
            <AboutUsView onBack={() => setView('home')} onShopNow={() => setView('shop')} />
          )}

          {view === 'calculator' && (
            <motion.div
              key="calculator"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <CalculatorView />
            </motion.div>
          )}

          {view === 'coas' && (
            <motion.div
              key="coas"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <COARequestView />
            </motion.div>
          )}

          {view === 'refer' && (
            <motion.div
              key="refer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ReferralView onNavigate={setView} onOpenAuth={() => setIsAuthOpen(true)} />
            </motion.div>
          )}

          {view === 'admin' && isAdmin && (
            <motion.div
              key="admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AdminDashboard />
            </motion.div>
          )}

          {view === 'account' && user && (
            <motion.div
              key="account"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AccountView 
                onNavigate={setView} 
                onEditOrder={(order) => {
                  setEditingOrder(order);
                  setCart(order.items);
                  setView('checkout');
                  window.scrollTo(0, 0);
                }}
              />
            </motion.div>
          )}

          {view === 'product' && selectedProduct && (
            <motion.div
              key="product"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ProductDetailView 
                product={selectedProduct} 
                products={productsList}
                onAddToCart={addToCart} 
                onBack={() => setView('shop')} 
                onSelectProduct={(p) => {
                  setSelectedProduct(p);
                  window.scrollTo(0, 0);
                }}
                settings={settings}
                timeLeft={timeLeft}
              />
            </motion.div>
          )}

          {view === 'shop' && (
            <ShopView 
              products={productsList}
              onAddToCart={addToCart} 
              onSelectProduct={(p) => {
                setSelectedProduct(p);
                setView('product');
                window.scrollTo(0, 0);
              }} 
            />
          )}

          {view === 'terms' && (
            <TermsView onBack={() => setView('home')} />
          )}

          {view === 'shipping' && (
            <ShippingPolicyView onBack={() => setView('home')} />
          )}

          {view === 'refund' && (
            <RefundPolicyView onBack={() => setView('home')} />
          )}

          {view === 'privacy' && (
            <PrivacyPolicyView onBack={() => setView('home')} />
          )}

          {view === 'affiliate' && (
            <AffiliateView onBack={() => setView('home')} />
          )}

          {view === 'order-success' && (
            <OrderSuccessView onBackToHome={() => setView('home')} />
          )}

          {view === 'checkout' && (
            <motion.div
              key="checkout"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <CheckoutView 
                cart={cart} 
                initialOrder={editingOrder}
                userProfile={userProfile}
                appliedPromo={appliedPromo}
                onApplyPromo={setAppliedPromo}
                onUpdateQuantity={updateQuantity}
                onRemoveFromCart={removeFromCart}
                onAddToCart={addToCart}
                onClearCart={() => setCart([])}
                products={productsList}
                onBack={() => {
                  if (editingOrder) {
                    setEditingOrder(null);
                    setCart([]);
                    setView('account');
                  } else {
                    setView('shop');
                  }
                }} 
                onComplete={async (data) => {
                  const { shippingInfo, shippingMethod, paymentMethod, total, promoCode, promoDiscount, orderId: passedOrderId, referralCode } = data;
                  try {
                    if (editingOrder) {
                      await updateDoc(doc(db, 'orders', editingOrder.id), {
                        items: cart,
                        total,
                        shippingInfo,
                        shippingMethod,
                        paymentMethod,
                        promoCode: promoCode || null,
                        promoDiscount: promoDiscount || 0,
                        updatedAt: serverTimestamp()
                      });
                      alert('Order updated successfully!');
                      setEditingOrder(null);
                      setCart([]);
                      setAppliedPromo(null);
                      setView('account');
                    } else {
                      const orderId = passedOrderId;

                      // Decrement inventory
                      for (const item of cart) {
                        const productRef = doc(db, 'products', item.id);
                        const productSnap = await getDoc(productRef);
                        if (productSnap.exists()) {
                          const pData = productSnap.data();
                          
                          // Check if this item is a specific dosage version
                          if (pData.dosages && item.dosage && item.dosage !== pData.dosage) {
                            const dosageIdx = pData.dosages.findIndex((d: any) => d.label === item.dosage);
                            if (dosageIdx !== -1) {
                              const newDosages = [...pData.dosages];
                              const currentDosageStock = newDosages[dosageIdx].stock || 0;
                              const newDosageStock = Math.max(0, currentDosageStock - item.quantity);
                              newDosages[dosageIdx] = {
                                ...newDosages[dosageIdx],
                                stock: newDosageStock,
                                inStock: newDosageStock > 0
                              };
                              await updateDoc(productRef, {
                                dosages: newDosages
                              });
                            }
                          } else {
                            // Fallback to base product stock
                            const currentStock = pData.stock || 0;
                            const newStock = Math.max(0, currentStock - item.quantity);
                            await updateDoc(productRef, {
                              stock: newStock,
                              inStock: newStock > 0
                            });
                          }
                        }
                      }

                      console.log('Referral Flow: Attaching referralCode to order document:', referralCode);
                      await setDoc(doc(db, 'orders', orderId), {
                        userId: user?.uid || null,
                        customerEmail: shippingInfo.email,
                        customerName: `${shippingInfo.firstName} ${shippingInfo.lastName}`,
                        items: cart,
                        total,
                        status: 'pending',
                        shippingInfo,
                        shippingMethod,
                        paymentMethod,
                        promoCode: promoCode || null,
                        promoDiscount: promoDiscount || 0,
                        referralCode: referralCode || null,
                        createdAt: serverTimestamp()
                      });

                      // If there was a referral, add it to the referrer's referrals array as pending
                      if (referralCode) {
                        const referrerRef = doc(db, 'users', referralCode);
                        const referrerSnap = await getDoc(referrerRef);
                        if (referrerSnap.exists()) {
                          const currentReferrals = referrerSnap.data().referrals || [];
                          await updateDoc(referrerRef, {
                            referrals: [...currentReferrals, {
                              email: shippingInfo.email,
                              orderId: orderId,
                              status: 'pending',
                              date: new Date()
                            }]
                          });
                        }
                      }

                      localStorage.removeItem('referralCode');
                      
                      // Explicitly clear cart from Firestore
                      const cartId = user ? user.uid : getGuestId();
                      try {
                        await deleteDoc(doc(db, 'carts', cartId));
                      } catch (err) {
                        console.error('Error clearing cart from Firestore:', err);
                      }
                      
                      alert(`Order placed successfully! Your Order ID is: ${orderId}`);
                      setCart([]);
                      setAppliedPromo(null);
                      setView('home');
                    }
                  } catch (error) {
                    console.error(error);
                    alert('Error processing order.');
                  }
                }} 
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Features Minimal */}
        <section className="py-24 border-t border-gray-800 bg-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
              {[
                { title: "HPLC Tested", desc: "Independent third-party analysis for every batch." },
                { title: "Secure Synthesis", desc: "State-of-the-art laboratory environment." },
                { title: "Global Shipping", desc: "Discreet and temperature-controlled logistics." }
              ].map((feature, i) => (
                <div key={i} className="flex flex-col">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">{feature.title}</h3>
                  <p className="text-white font-medium leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-gray-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
            <div className="col-span-1">
              <div className="flex items-center gap-2 mb-6">
                <img src="https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969647/blacklogo_dbbepi.png" alt="Eclipse Research" className="h-10 w-auto" referrerPolicy="no-referrer" />
                <span className="text-lg font-bold tracking-tight">ECLIPSE RESEARCH</span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed mb-8">
                Providing high-purity research compounds to the global scientific community. 
                Our mission is to accelerate discovery through quality and transparency.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-6 uppercase text-[10px] tracking-[0.2em] text-gray-400">Navigation</h4>
              <ul className="space-y-4 text-sm text-gray-600 font-medium">
                <li><button onClick={() => setView('shop')} className="hover:text-black transition-colors">Shop All Compounds</button></li>
                <li><button onClick={() => setView('about')} className="hover:text-black transition-colors">About Us</button></li>
                <li><button onClick={() => setView('affiliate')} className="hover:text-black transition-colors">Become a Research Affiliate</button></li>
                <li><button onClick={() => setView('calculator')} className="hover:text-black transition-colors">Reconstitution Calculator</button></li>
                <li><button onClick={() => setView('coas')} className="hover:text-black transition-colors">Request COA's</button></li>
                <li><button onClick={() => setView('account')} className="hover:text-black transition-colors">My Research Account</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-6 uppercase text-[10px] tracking-[0.2em] text-gray-400">Legal</h4>
              <ul className="space-y-4 text-sm text-gray-600 font-medium">
                <li><button onClick={() => setView('terms')} className="hover:text-black transition-colors">Terms and Conditions</button></li>
                <li><button onClick={() => setView('shipping')} className="hover:text-black transition-colors">Shipping Policy</button></li>
                <li><button onClick={() => setView('refund')} className="hover:text-black transition-colors">Refund & Returns</button></li>
                <li><button onClick={() => setView('privacy')} className="hover:text-black transition-colors">Privacy Policy</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-6 uppercase text-[10px] tracking-[0.2em] text-gray-400">Contact</h4>
              <ul className="space-y-4 text-sm text-gray-600 font-medium">
                <li className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Email Support</span>
                  <a href="mailto:info@eclipseresearch.shop" className="text-emerald-600 hover:underline">info@eclipseresearch.shop</a>
                </li>
                <li className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Support Hours</span>
                  <span className="text-gray-900">Mon - Fri: 9AM - 5PM EST</span>
                </li>
                <li className="pt-2">
                  <button onClick={() => setView('home')} className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold hover:bg-gray-100 transition-all">
                    Contact Support
                  </button>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="pt-10 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">© 2026 Eclipse Research. All rights reserved.</p>
              <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                <ShieldCheck className="w-3 h-3" /> Secure Research Portal
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-10 h-6 bg-gray-50 border border-gray-100 rounded-md flex items-center justify-center p-1">
                <div className="w-full h-full bg-gray-200 rounded-sm opacity-50"></div>
              </div>
              <div className="w-10 h-6 bg-gray-50 border border-gray-100 rounded-md flex items-center justify-center p-1">
                <div className="w-full h-full bg-gray-200 rounded-sm opacity-50"></div>
              </div>
              <div className="w-10 h-6 bg-gray-50 border border-gray-100 rounded-md flex items-center justify-center p-1">
                <div className="w-full h-full bg-gray-200 rounded-sm opacity-50"></div>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        items={cart}
        onUpdateQuantity={updateQuantity}
        onRemove={removeFromCart}
        onCheckout={handleCheckout}
        onAddToCart={addToCart}
        appliedPromo={appliedPromo}
        onApplyPromo={setAppliedPromo}
      />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onNavigate={setView} />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
