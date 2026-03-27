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
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { 
  signInWithPopup, 
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
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';

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

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  description?: string;
  dosage?: string;
  quantityImages?: {
    1?: string;
    2?: string;
    3?: string;
  };
}

interface CartItem extends Product {
  quantity: number;
}

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, firstName: string, lastName: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Components ---

const Navbar = ({ cartCount, onOpenCart, onOpenAuth, onNavigate, currentView }: { cartCount: number, onOpenCart: () => void, onOpenAuth: () => void, onNavigate: (view: any) => void, currentView: string }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();

  const isDarkPage = currentView === 'home' || currentView === 'shop' || currentView === 'track' || currentView === 'about';
  const showSolidNav = isScrolled || !isDarkPage;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className="fixed top-0 w-full z-50 transition-all duration-200">
      <motion.div
        initial={false}
        animate={{ 
          y: showSolidNav ? 0 : -100,
          opacity: showSolidNav ? 1 : 0
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="absolute inset-0 bg-white shadow-md -z-10"
      />
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center transition-all duration-200 ${showSolidNav ? 'py-3' : 'py-5'}`}>
        <button 
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="relative h-14 w-auto flex items-center justify-center">
            <motion.img 
              key={showSolidNav ? 'black' : 'white'}
              initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              src={showSolidNav ? "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969647/blacklogo_dbbepi.png" : "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969635/logo_gc8g0q.png"} 
              alt="Eclipse Research" 
              className="h-14 w-auto" 
              referrerPolicy="no-referrer"
            />
          </div>
          <span className={`text-xl font-bold tracking-tight ${showSolidNav ? 'text-black' : 'text-white'}`}>ECLIPSE RESEARCH</span>
        </button>

        <div className="hidden md:flex items-center gap-8">
          <button onClick={() => onNavigate('shop')} className={`text-sm font-medium hover:opacity-70 transition-opacity ${showSolidNav ? 'text-black' : 'text-white'}`}>Shop All</button>
          <button onClick={() => onNavigate('calculator')} className={`text-sm font-medium hover:opacity-70 transition-opacity ${showSolidNav ? 'text-black' : 'text-white'}`}>Calculator</button>
          <button onClick={() => onNavigate('about')} className={`text-sm font-medium hover:opacity-70 transition-opacity ${showSolidNav ? 'text-black' : 'text-white'}`}>About Us</button>
          <button onClick={() => onNavigate('affiliate')} className={`text-sm font-medium hover:opacity-70 transition-opacity ${showSolidNav ? 'text-black' : 'text-white'}`}>Affiliate</button>
          {isAdmin && (
            <button onClick={() => onNavigate('admin')} className={`text-sm font-bold text-emerald-500 hover:opacity-70 transition-opacity`}>Admin Panel</button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={onOpenCart}
            className={`${showSolidNav ? 'text-black' : 'text-white'} relative p-2 hover:bg-black/5 rounded-full`}
          >
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </button>

          {user ? (
            <div className="flex items-center gap-3">
              <button onClick={() => onNavigate('account')} className="flex items-center gap-2">
                <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || user.email}&background=random`} alt="" className="w-8 h-8 rounded-full border border-gray-200" />
              </button>
              <button onClick={logout} className={`${showSolidNav ? 'text-black' : 'text-white'} hover:opacity-70`}>
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={onOpenAuth}
              className={`${showSolidNav ? 'text-black' : 'text-white'} p-2 hover:bg-black/5 rounded-full`}
            >
              <UserIcon className="w-5 h-5" />
            </button>
          )}

          <button className="md:hidden" onClick={() => setIsMobileMenuOpen(true)}>
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
              <button onClick={() => { onNavigate('shop'); setIsMobileMenuOpen(false); }} className="text-2xl font-bold text-black border-b border-gray-100 pb-4 text-left">Shop All</button>
              <button onClick={() => { onNavigate('about'); setIsMobileMenuOpen(false); }} className="text-2xl font-bold text-black border-b border-gray-100 pb-4 text-left">About Us</button>
              <button onClick={() => { onNavigate('affiliate'); setIsMobileMenuOpen(false); }} className="text-2xl font-bold text-black border-b border-gray-100 pb-4 text-left">Become an Affiliate</button>
              <button onClick={() => { onNavigate('track'); setIsMobileMenuOpen(false); }} className="text-2xl font-bold text-black border-b border-gray-100 pb-4 text-left">Track Order</button>
              <button onClick={() => { onNavigate('calculator'); setIsMobileMenuOpen(false); }} className="text-2xl font-bold text-black border-b border-gray-100 pb-4 text-left">Calculator</button>
              <button onClick={() => { onNavigate('coas'); setIsMobileMenuOpen(false); }} className="text-2xl font-bold text-black border-b border-gray-100 pb-4 text-left">Request COA's</button>
              {user && (
                <button onClick={() => { onNavigate('account'); setIsMobileMenuOpen(false); }} className="text-2xl font-bold text-black border-b border-gray-100 pb-4 text-left">My Account</button>
              )}
              {isAdmin && (
                <button onClick={() => { onNavigate('admin'); setIsMobileMenuOpen(false); }} className="text-2xl font-bold text-emerald-500 border-b border-gray-100 pb-4 text-left">Admin Panel</button>
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
  onAddToCart
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  items: CartItem[], 
  onUpdateQuantity: (id: string, delta: number) => void,
  onRemove: (id: string) => void,
  onCheckout: () => void,
  onAddToCart: (product: Product) => void
}) => {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const freeShippingThreshold = 300;
  const progress = Math.min((total / freeShippingThreshold) * 100, 100);
  const remaining = Math.max(freeShippingThreshold - total, 0);
  const [promoCode, setPromoCode] = useState('');

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
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> Your Cart
              </h2>
              <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                  {total >= freeShippingThreshold ? '🎉 You unlocked free shipping!' : `Add $${remaining.toFixed(2)} more for free shipping`}
                </span>
                <span className="text-[9px] font-bold text-emerald-600">{Math.round(progress)}%</span>
              </div>
              <div className="w-full h-1.5 bg-emerald-200 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-emerald-500"
                />
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
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Recommended for your research</p>
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
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Promo Code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="flex-1 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-black outline-none"
                  />
                  <button className="px-3 py-1.5 bg-gray-100 text-black font-bold text-[10px] rounded-lg hover:bg-gray-200 transition-colors">
                    Apply
                  </button>
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500 text-xs">Subtotal</span>
                    <span className="text-xs font-bold">${total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mb-3">
                    <span className="text-gray-500 text-xs">Shipping</span>
                    <span className="text-xs font-bold text-emerald-600">
                      {total >= freeShippingThreshold ? 'FREE' : '$15.00'}
                    </span>
                  </div>
                  <div className="flex justify-between mb-4 pt-3 border-t border-gray-100">
                    <span className="text-base font-bold">Total</span>
                    <span className="text-lg font-bold">${(total + (total >= freeShippingThreshold ? 0 : 15)).toFixed(2)}</span>
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
  const { login, register, user } = useAuth();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'reset') {
        if (!email) throw new Error('Please enter your email address.');
        await sendPasswordResetEmail(auth, email);
        setSuccessMessage('Password reset email sent! Please check your inbox.');
        return;
      }

      if (mode === 'login') {
        try {
          await login(email, password);
        } catch (err: any) {
          // Special case: If admin login fails and it's the requested credentials, try to register
          if (email === 'info@eclipseresearch.shop' && password === 'KyronMakesMunyun1028' && (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential')) {
            await register(email, password, 'Super', 'Admin');
          } else {
            throw err;
          }
        }
      } else {
        if (!is21) {
          throw new Error('You must be 21 years or older to register.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }

        await register(email, password, firstName, lastName, phone);
      }
    } catch (err: any) {
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
              <p className="text-sm"><strong>Domestic Shipping:</strong> 2-4 business days (after dispatch)</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
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
        <div className="bg-black rounded-[3rem] p-12 md:p-20 text-white relative overflow-hidden">
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
        <div className="bg-emerald-500 rounded-[3rem] p-12 md:p-20 text-white text-center space-y-8">
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

const TrackOrderView = ({ onBack }: { onBack: () => void }) => {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<any | null>(null);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOrder(null);

    const cleanOrderNumber = orderNumber.trim();
    const cleanEmail = email.trim().toLowerCase();

    try {
      // Use getDoc for direct ID lookup
      const orderDoc = await getDoc(doc(db, 'orders', cleanOrderNumber));
      
      if (orderDoc.exists()) {
        const data = orderDoc.data();
        
        // Security check: Verify email matches the order
        if (data.shippingInfo.email.toLowerCase() === cleanEmail) {
          setOrder({ id: orderDoc.id, ...data });
        } else {
          setError('Order not found or email mismatch. Please check your details.');
        }
      } else {
        setError('Order not found. Please verify your Order Number.');
      }
    } catch (err) {
      console.error('Tracking Error:', err);
      // Use handleFirestoreError logic for better AIS Agent debugging
      if (err instanceof Error && err.message.includes('insufficient permissions')) {
        setError('Security error: Access denied. Please ensure you are using the correct Order ID.');
      } else {
        setError('An error occurred while fetching the order. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-emerald-500/30">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <motion.button 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={onBack}
            className="flex items-center gap-2 text-[10px] font-bold text-gray-500 hover:text-emerald-500 mb-12 transition-all uppercase tracking-widest group"
          >
            <ChevronLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> 
            Back to Home
          </motion.button>

          <div className="text-center space-y-6 mb-20">
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.5em]"
            >
              Order Status
            </motion.p>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-6xl md:text-8xl font-bold tracking-tighter leading-none"
            >
              TRACK YOUR <br />
              <span className="text-emerald-500">ORDER</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="max-w-md mx-auto text-gray-300 font-medium leading-relaxed text-base"
            >
              Enter your Order Number and billing email to check the status of your research compounds. 
              Your Order Number was provided in your confirmation email.
            </motion.p>
          </div>

          {!order ? (
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-8 md:p-16 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
              
              <form onSubmit={handleTrack} className="space-y-10">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-[0.2em] ml-1">Order Number</label>
                  <div className="relative">
                    <Hash className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. VR-20250220-0001"
                      value={orderNumber}
                      onChange={e => setOrderNumber(e.target.value)}
                      className="w-full bg-black border border-white/20 rounded-2xl px-14 py-5 focus:outline-none focus:border-emerald-500 transition-all text-white placeholder:text-gray-600 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-[0.2em] ml-1">Billing Email</label>
                  <div className="relative">
                    <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="email" 
                      required
                      placeholder="email@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-black border border-white/20 rounded-2xl px-14 py-5 focus:outline-none focus:border-emerald-500 transition-all text-white placeholder:text-gray-600 font-medium"
                    />
                  </div>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-5 bg-red-500/5 border border-red-500/10 rounded-2xl text-red-400 text-xs font-bold text-center uppercase tracking-widest"
                  >
                    {error}
                  </motion.div>
                )}

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white hover:bg-emerald-500 text-black hover:text-white font-bold py-6 rounded-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 group shadow-xl shadow-white/5 hover:shadow-emerald-500/20"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Search className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      <span className="tracking-widest">TRACK RESEARCH ORDER</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-8 md:p-16 shadow-2xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16 pb-16 border-b border-white/5">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Order Reference</p>
                    <p className="text-3xl font-bold tracking-tighter">#{order.id}</p>
                  </div>
                  <div className="space-y-2 md:text-right">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Current Status</p>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-3 md:justify-end">
                        <div className={`w-2 h-2 rounded-full animate-pulse ${
                          order.status === 'completed' ? 'bg-emerald-500' : 
                          order.status === 'pending' ? 'bg-amber-500' : 
                          'bg-blue-500'
                        }`} />
                        <span className={`text-xl font-bold uppercase tracking-tighter ${
                          order.status === 'completed' ? 'text-emerald-500' : 
                          order.status === 'pending' ? 'text-amber-500' : 
                          'text-blue-500'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      {order.status === 'pending' && (
                        <p className="text-[10px] text-amber-500/60 font-medium uppercase tracking-widest">Awaiting Lab Processing</p>
                      )}
                      {order.status === 'shipped' && (
                        <p className="text-[10px] text-blue-500/60 font-medium uppercase tracking-widest">In Transit to Destination</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                  <div className="space-y-8">
                    <h3 className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.3em]">Research Inventory</h3>
                    <div className="space-y-6">
                      {order.items.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between items-center group">
                          <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-black border border-white/10 rounded-2xl flex items-center justify-center text-xs font-bold text-emerald-500 group-hover:border-emerald-500/30 transition-colors">
                              {item.quantity}x
                            </div>
                            <div>
                              <p className="font-bold text-base tracking-tight">{item.name}</p>
                              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">{item.category}</p>
                            </div>
                          </div>
                          <p className="font-bold text-base tracking-tight">${(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-8">
                    <h3 className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.3em]">Delivery Destination</h3>
                    <div className="bg-black/40 border border-white/5 rounded-3xl p-8 space-y-2">
                      <p className="text-white font-bold text-lg tracking-tight">{order.shippingInfo.firstName} {order.shippingInfo.lastName}</p>
                      <p className="text-gray-400 text-sm leading-relaxed">{order.shippingInfo.address}</p>
                      <p className="text-gray-400 text-sm leading-relaxed">{order.shippingInfo.city}, {order.shippingInfo.state} {order.shippingInfo.zip}</p>
                    </div>
                    
                    <div className="pt-8 border-t border-white/5 flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Investment</p>
                        <p className="text-3xl font-bold tracking-tighter">${order.total.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/5 px-4 py-2 rounded-full border border-emerald-500/10">
                        <ShieldCheck className="w-3 h-3" /> Verified
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setOrder(null)}
                className="w-full py-8 text-gray-500 hover:text-white transition-all text-[10px] font-bold uppercase tracking-[0.4em] hover:tracking-[0.6em]"
              >
                Track another research order
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
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

const AffiliateView = ({ onBack }: { onBack: () => void }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <section className="py-24 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
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
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <Gift className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-6">Become an Affiliate</h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            Join the Eclipse Research affiliate program and earn competitive commissions while helping the scientific community access high-purity research compounds.
          </p>
          <button className="px-8 py-4 bg-emerald-500 text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all active:scale-95 shadow-lg shadow-emerald-500/20">
            Apply for Affiliate Program
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {[
            { 
              title: "High Commissions", 
              desc: "Earn up to 15% commission on every successful referral purchase.",
              icon: <CreditCard className="w-6 h-6" />
            },
            { 
              title: "Real-time Tracking", 
              desc: "Monitor your performance and earnings through our dedicated dashboard.",
              icon: <Eye className="w-6 h-6" />
            },
            { 
              title: "Exclusive Support", 
              desc: "Get direct access to our team for marketing materials and research insights.",
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
                title: "Sign Up", 
                desc: "Create your affiliate account and get approved within 48 hours." 
              },
              { 
                step: "02", 
                title: "Share Your Link", 
                desc: "Use your unique referral link to promote Eclipse Research to your audience." 
              },
              { 
                step: "03", 
                title: "Earn Commission", 
                desc: "Get paid for every successful purchase made through your link." 
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

        {/* Commission Tiers */}
        <div className="mb-24">
          <h2 className="text-2xl font-bold text-gray-900 mb-12 text-center">Commission Tiers</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { tier: "Starter", referrals: "0–10 referrals", commission: "10% commission" },
              { tier: "Growth", referrals: "11–25 referrals", commission: "12% commission" },
              { tier: "Elite", referrals: "25+ referrals", commission: "15% commission" }
            ].map((tier, i) => (
              <div key={i} className="p-8 bg-gray-900 rounded-[2rem] border border-gray-800 text-center group hover:border-emerald-500/50 transition-colors">
                <h3 className="text-emerald-500 font-bold uppercase tracking-widest text-xs mb-4">{tier.tier}</h3>
                <div className="text-white text-3xl font-bold mb-2">{tier.commission}</div>
                <p className="text-gray-400 text-sm">{tier.referrals}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Perks & Rewards */}
        <div className="mb-24">
          <h2 className="text-2xl font-bold text-gray-900 mb-12 text-center">Perks & Rewards</h2>
          <div className="max-w-3xl mx-auto">
            <div className="relative p-12 bg-gray-900 rounded-[3rem] border-2 border-emerald-500/30 shadow-[0_0_50px_-12px_rgba(16,185,129,0.2)] text-center overflow-hidden group">
              {/* Subtle background glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/10 blur-[100px] -z-10 group-hover:bg-emerald-500/20 transition-colors duration-500" />
              
              <div className="flex justify-center mb-8">
                <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                  <Gift className="w-10 h-10" />
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-4">Milestone Reward</h3>
              <p className="text-gray-400 text-lg leading-relaxed max-w-xl mx-auto">
                Hit <span className="text-emerald-500 font-bold">10 referral sales</span> and we'll send you a free supply of your choice compound. Keep earning, keep receiving.
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
                q: "When do I get paid?", 
                a: "Commissions are paid out monthly, typically within the first 10 business days of the following month, once you meet the minimum payout threshold." 
              },
              { 
                q: "How long does the referral cookie last?", 
                a: "Our referral cookies last for 30 days. If a customer clicks your link and makes a purchase within 30 days, you get the commission." 
              },
              { 
                q: "Who is eligible to apply?", 
                a: "We welcome researchers, content creators, and industry professionals who share our commitment to quality and transparency in scientific research." 
              },
              { 
                q: "What marketing materials do you provide?", 
                a: "Affiliates get access to a library of high-quality product images, banners, and technical data sheets to help promote our compounds effectively." 
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
          <h2 className="text-3xl font-bold mb-6">Ready to start earning?</h2>
          <p className="text-gray-400 mb-10 max-w-xl mx-auto">
            Apply today to join our network of researchers and content creators. We review all applications within 48 business hours.
          </p>
          <button className="px-10 py-5 bg-emerald-500 text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all active:scale-95">
            Apply for Affiliate Program
          </button>
        </div>
      </motion.div>
    </section>
  );
};

const AccountView = ({ onNavigate, onEditOrder }: { onNavigate: (view: any) => void, onEditOrder: (order: any) => void }) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'orders' | 'details' | 'addresses' | 'rewards'>('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editData, setEditData] = useState({ firstName: '', lastName: '', phone: '' });
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({ street: '', city: '', state: '', zip: '' });
  const [isDeletingOrder, setIsDeletingOrder] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'orders'), where('userId', '==', user.uid));
    const unsubscribeOrders = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });

    const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
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
      await updateDoc(doc(db, 'users', user.uid), {
        ...editData,
        displayName: `${editData.firstName} ${editData.lastName}`
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
      const updatedAddresses = [...(profile.addresses || []), { ...newAddress, isDefault: (profile.addresses || []).length === 0 }];
      await updateDoc(doc(db, 'users', user.uid), {
        addresses: updatedAddresses
      });
      setIsAddingAddress(false);
      setNewAddress({ street: '', city: '', state: '', zip: '' });
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
    <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row gap-12">
        {/* Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 sticky top-32">
            <div className="flex items-center gap-4 mb-8">
              <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || user.email}&background=random`} alt="" className="w-12 h-12 rounded-full border border-gray-100" />
              <div>
                <h2 className="font-bold text-gray-900 leading-tight">{profile?.firstName || 'Researcher'}</h2>
                <p className="text-xs text-gray-400 truncate w-32">{user.email}</p>
              </div>
            </div>

            <nav className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-black text-white shadow-lg shadow-black/10' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
              <div className="pt-4 mt-4 border-t border-gray-50">
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
                    <p className="text-gray-500 font-medium">No orders found yet.</p>
                    <button onClick={() => onNavigate('shop')} className="mt-4 text-emerald-600 font-bold text-sm">Start Researching</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div key={order.id} className="bg-white rounded-3xl border border-gray-100 p-6 hover:shadow-md transition-all">
                        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
                          <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Order #{order.id.slice(-8).toUpperCase()}</p>
                            <p className="text-sm font-medium text-gray-500">{order.createdAt?.toDate().toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                              order.status === 'shipped' ? 'bg-emerald-50 text-emerald-600' : 
                              order.status === 'paid' ? 'bg-blue-50 text-blue-600' : 
                              'bg-amber-50 text-amber-600'
                            }`}>
                              {order.status}
                            </div>
                            {order.status === 'pending' && (
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => onEditOrder(order)}
                                  className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                  title="Edit Order"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => setIsDeletingOrder(order.id)}
                                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="Delete Order"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
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
                      <p className="text-gray-900 font-medium mb-1">{addr.street}</p>
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
                <div className="bg-black rounded-[2.5rem] p-12 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 blur-[100px] rounded-full -mr-32 -mt-32" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                      <Star className="w-6 h-6 text-emerald-400 fill-emerald-400" />
                      <span className="text-emerald-400 font-bold tracking-[0.3em] text-xs uppercase">Eclipse Rewards Program</span>
                    </div>
                    <h2 className="text-4xl font-bold mb-2">Research Points</h2>
                    <p className="text-gray-400 mb-8">Earn points on every purchase to unlock exclusive discounts.</p>
                    
                    <div className="flex items-end gap-4">
                      <span className="text-7xl font-bold tracking-tighter">{profile?.rewardPoints || 0}</span>
                      <span className="text-xl font-bold text-gray-500 mb-3 uppercase tracking-widest">Points Balance</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  <div className="bg-white rounded-3xl border border-gray-100 p-6 opacity-50 grayscale">
                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
                      <Gift className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">Exclusive Perks</h3>
                    <p className="text-sm text-gray-500 italic">Tiered rewards coming soon for high-volume labs.</p>
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
  const [activeTab, setActiveTab] = useState<'users' | 'orders' | 'coas'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [coaRequests, setCoaRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const usersQuery = collection(db, 'users');
    const ordersQuery = collection(db, 'orders');
    const coaQuery = collection(db, 'coa_requests');

    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeCoas = onSnapshot(coaQuery, (snapshot) => {
      setCoaRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeOrders();
      unsubscribeCoas();
    };
  }, []);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Failed to update order status.');
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

  if (loading) {
    return (
      <div className="pt-32 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-2">Admin Control Panel</h1>
          <p className="text-gray-500">Manage research accounts and track laboratory orders.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-2xl">
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
          >
            Users
          </button>
          <button 
            onClick={() => setActiveTab('orders')}
            className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'orders' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
          >
            Orders
          </button>
          <button 
            onClick={() => setActiveTab('coas')}
            className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'coas' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
          >
            COA Requests
          </button>
        </div>
      </div>

      {activeTab === 'users' ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
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
        </div>
      ) : activeTab === 'orders' ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Order ID</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Customer</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-emerald-600">{o.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="font-bold">{o.shippingInfo.firstName} {o.shippingInfo.lastName}</p>
                        <p className="text-gray-400 text-[10px]">{o.shippingInfo.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold">${o.total.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        o.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                        o.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={o.status}
                        onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                        className="text-[10px] font-bold uppercase tracking-widest bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="pending">Pending</option>
                        <option value="shipped">Shipped</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
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
        </div>
      )}
    </div>
  );
};

// --- Main App ---

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'bot', text: string}[]>([
    { role: 'bot', text: 'Hello! I am your Research Assistant. How can I help you with our compounds today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: userMsg,
        config: {
          systemInstruction: "You are a helpful assistant for a research peptide store. You provide information about peptides for laboratory research purposes only. You must always include a disclaimer that products are not for human consumption. Be professional, scientific, and concise."
        }
      });
      
      setMessages(prev => [...prev, { role: 'bot', text: response.text || "I'm sorry, I couldn't process that." }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', text: "Error connecting to research database." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="bg-white w-80 md:w-96 h-[500px] rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden mb-4"
          >
            <div className="bg-black p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                  <MessageSquare className="text-white w-4 h-4" />
                </div>
                <span className="text-white font-bold text-sm">Research Assistant</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    m.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-tl-none'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 rounded-tl-none">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-white">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask about research..."
                  className="flex-1 bg-gray-100 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                />
                <button 
                  onClick={handleSend}
                  className="bg-black text-white p-2 rounded-xl hover:bg-emerald-600 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-black text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
      >
        <MessageSquare className="w-6 h-6" />
      </button>
    </div>
  );
};

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        if (userDoc.exists()) {
          setIsAdmin(userDoc.data().role === 'admin');
        } else if (u.email === 'info@eclipseresearch.shop') {
          setIsAdmin(true);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
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

    const role = u.email === 'kyron.laskosky2@gmail.com' ? 'admin' : 'user';

    await setDoc(doc(db, 'users', u.uid), {
      email: u.email,
      firstName,
      lastName,
      phone: phone || null,
      displayName: `${firstName} ${lastName}`,
      role: role,
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

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

const Hero = ({ onShopNow, onViewCOAs }: { onShopNow: () => void, onViewCOAs: () => void }) => {
  return (
    <section className="relative h-screen flex items-center overflow-hidden bg-black">
      {/* Background Video Layer */}
      <div className="absolute inset-0 z-0">
        <video 
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

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="h-[1px] w-12 bg-emerald-500" />
            <span className="text-emerald-500 font-bold tracking-[0.3em] text-xs uppercase">Precision Synthesis</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-bold text-white tracking-tight mb-8 leading-[0.9]">
            Purity <br />
            <span className="text-emerald-500">Without</span> <br />
            Compromise
          </h1>
          <p className="text-gray-400 text-lg md:text-xl mb-12 max-w-lg leading-relaxed">
            Synthesizing high-purity research compounds for the global scientific community. 
            HPLC tested, discreetly shipped, and laboratory verified.
          </p>
          <div className="flex flex-wrap gap-6">
            <button 
              onClick={onShopNow}
              className="px-10 py-5 bg-white text-black font-bold rounded-2xl hover:bg-emerald-500 hover:text-white transition-all active:scale-95 flex items-center gap-3"
            >
              Explore Catalog <ChevronRight className="w-5 h-5" />
            </button>
            <button 
              onClick={onViewCOAs}
              className="px-10 py-5 border border-white/20 text-white font-bold rounded-2xl hover:bg-white/10 transition-all"
            >
              Request COA's
            </button>
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 text-white/30">
        <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Scroll to Discover</span>
        <div className="w-[1px] h-12 bg-gradient-to-b from-white/30 to-transparent" />
      </div>
    </section>
  );
};

// --- Constants ---

const products: Product[] = [
  { 
    id: '1', 
    name: "GLP-3 RT", 
    price: 86.99, 
    category: "Peptides", 
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969217/glp3-rt_gfcapz.png", 
    description: "A 39-amino acid triple agonist peptide targeting GIP, GLP-1, and glucagon receptors, studied for metabolic pathway regulation and receptor binding kinetics in preclinical research models. Premium Research Peptide.",
    dosage: "10MG",
    quantityImages: { 
      1: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971440/1glp3-rt_x0z399.png",
      2: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971951/2glp3-rt_saynur.png",
      3: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971669/3glp3-rt_jjrejb.png"
    }
  },
  { 
    id: '2', 
    name: "BPC-157", 
    price: 67.99, 
    category: "Peptides", 
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969218/bpc-157_vvwgot.png", 
    description: "Body Protective Compound-157 is a pentadecapeptide known for its potential regenerative properties in tendon, muscle, and gut research.",
    dosage: "10MG",
    quantityImages: { 
      1: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971445/1bpc-157_i2rout.png",
      2: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969687/2bpc-157_qtjw7b.png",
      3: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971672/3bpc-157_lxfd5j.png"
    }
  },
  { 
    id: '3', 
    name: "GHK-Cu", 
    price: 41.99, 
    category: "Peptides", 
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969217/ghk-cu_k0gxxe.png", 
    description: "A copper-binding tripeptide naturally occurring in human plasma with research applications in skin remodeling and anti-inflammatory studies.",
    dosage: "100MG",
    quantityImages: { 
      1: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971439/1ghk-cu_dv1gat.png",
      2: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969684/2ghk-cu_atd91e.png",
      3: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971670/3ghk-cu_gscj57.png"
    }
  },
  { 
    id: '4', 
    name: "MT-2", 
    price: 43.99, 
    category: "Peptides", 
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969217/mt-2_acqigl.png", 
    description: "Melanotan II is a synthetic analog of the alpha-melanocyte-stimulating hormone, researched for its effects on skin pigmentation.",
    dosage: "10MG",
    quantityImages: { 
      1: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971442/1mt-2_hfg0jk.png",
      2: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969684/2mt-2_noa9bx.png",
      3: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971674/3mt-2_qujg6y.png"
    }
  },
  { 
    id: '5', 
    name: "Wolverine 10mg (BPC157/TB500)", 
    price: 77.99, 
    category: "Peptides", 
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969217/wolverine_tl3buz.png", 
    description: "A research blend of BPC-157 and TB-500, designed for synergistic studies on tissue repair and recovery.",
    dosage: "10MG",
    quantityImages: { 
      1: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971442/1wolverine_mrof4h.png",
      2: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969687/2wolverine_locrq5.png",
      3: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971671/3wolverine_nwvaiq.png"
    }
  },
  { 
    id: '6', 
    name: "CJC 1295 no dac + Ipamorelin", 
    price: 84.99, 
    category: "Peptides", 
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969217/cjc-ipamorelin_atfs5x.png", 
    description: "A combination of a GHRH analog and a ghrelin mimetic, used in research to study growth hormone secretion patterns.",
    dosage: "10MG",
    quantityImages: { 
      1: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971442/1cjc-ipamorelin_fz6px6.png",
      2: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969691/2cjc-ipamorelin_qi18jo.png",
      3: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971671/3cjc-ipamorelin_nitxpm.png"
    }
  },
  { 
    id: '7', 
    name: "Bacteriostatic Water", 
    price: 14.99, 
    category: "Peptides", 
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969217/BacWater_vl81li.png", 
    description: "Sterile water containing 0.9% benzyl alcohol, used as a diluent for reconstituting research compounds.",
    dosage: "10ML",
    quantityImages: { 
      1: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971439/1BacWater_vml33g.png",
      2: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969683/2BacWater_cu9qeq.png",
      3: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971668/3BacWater_jdwp5p.png"
    }
  },
  { 
    id: '8', 
    name: "Tesamorelin", 
    price: 92.99, 
    category: "Peptides", 
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969217/tesamorelin_oydzju.png", 
    description: "A synthetic analog of growth hormone-releasing factor (GRF), researched for its effects on visceral adipose tissue.",
    dosage: "10MG",
    quantityImages: { 
      1: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971444/1tesamorelin_ehldd7.png",
      2: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969687/2tesamorelin_s9a2jn.png",
      3: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971675/3tesamorelin_wpphtb.png"
    }
  },
  { 
    id: '9', 
    name: "GLOW", 
    price: 112.99, 
    category: "Peptides", 
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969218/glow_jfpqo0.png", 
    description: "A specialized research blend designed for studies related to skin health, collagen production, and cellular vitality.",
    dosage: "70MG",
    quantityImages: { 
      1: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971444/1glow_detdjm.png",
      2: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969688/2glow_b4ssod.png",
      3: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971674/3glow_i30p3b.png"
    }
  },
  { 
    id: '10', 
    name: "NAD+", 
    price: 77.99, 
    category: "Peptides", 
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969217/nad_sxoz3j.png", 
    description: "Nicotinamide Adenine Dinucleotide is a critical coenzyme found in all living cells, researched for its role in energy metabolism and DNA repair.",
    dosage: "500MG",
    quantityImages: { 
      1: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971439/1nad_q367m5.png",
      2: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969683/2nad_y1kupy.png",
      3: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971669/3nad_o7dofh.png"
    }
  }
];
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
  if (variant === 'featured') {
    return (
      <div 
        className="group bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden hover:shadow-xl transition-all cursor-pointer"
        onClick={() => onSelect(product)}
      >
        <div className="aspect-[4/5] relative overflow-hidden bg-gray-50">
          <img 
            src={product.image} 
            alt={product.name} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
            referrerPolicy="no-referrer"
          />
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(product);
            }}
            className="absolute bottom-6 left-6 right-6 py-4 bg-black text-white font-bold rounded-2xl opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add to Cart
          </button>
        </div>
        <div className="p-8">
          <h3 className="font-bold text-lg text-gray-900 mb-1">{product.name}</h3>
          {product.dosage && (
            <p className="text-emerald-600 text-[10px] font-bold uppercase tracking-wider mb-4">{product.dosage}</p>
          )}
          <span className="text-emerald-600 font-bold text-xl">${product.price.toFixed(2)}</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex flex-col cursor-pointer"
      onClick={() => onSelect(product)}
    >
      <div className="aspect-[4/5] overflow-hidden bg-white rounded-2xl border border-gray-100 relative mb-4">
        <img 
          src={product.image} 
          alt={product.name} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-4 right-4">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(product);
            }}
            className="w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center text-black hover:bg-black hover:text-white transition-all active:scale-90"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex flex-col flex-1">
        <h3 className="font-bold text-gray-900 mb-1 group-hover:text-emerald-600 transition-colors">{product.name}</h3>
        <div className="flex items-center gap-2 mb-4">
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">99%+ Purity</p>
          {product.dosage && (
            <>
              <span className="w-1 h-1 bg-gray-300 rounded-full" />
              <p className="text-emerald-600 text-[10px] font-bold uppercase tracking-wider">{product.dosage}</p>
            </>
          )}
        </div>
        <div className="mt-auto space-y-4">
          <p className="text-xl font-bold text-black">${product.price.toFixed(2)}</p>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(product);
            }}
            className="w-full py-3 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <ShoppingCart className="w-4 h-4" /> Add to Cart
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const FeaturedProducts: React.FC<{ 
  onAddToCart: (product: Product) => void, 
  onSelectProduct: (product: Product) => void 
}> = ({ onAddToCart, onSelectProduct }) => {
  const featured = products.filter(p => ['2', '3', '10'].includes(p.id));

  return (
    <section className="py-24 bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Featured Compounds</h2>
            <p className="text-gray-400">Our most requested high-purity research materials.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {featured.map((product) => (
            <ProductCard 
              key={product.id}
              product={product}
              onAddToCart={onAddToCart}
              onSelect={onSelectProduct}
              variant="featured"
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const ShopView: React.FC<{ 
  onAddToCart: (p: Product) => void, 
  onSelectProduct: (p: Product) => void 
}> = ({ 
  onAddToCart, 
  onSelectProduct 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState(300);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPrice = p.price <= maxPrice;
    return matchesSearch && matchesPrice;
  });

  return (
    <motion.div
      key="shop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Shop Header */}
      <section className="relative bg-black py-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1581093588401-fbb62a02f120?auto=format&fit=crop&q=80&w=2000" 
            className="w-full h-full object-cover opacity-30"
            alt="Shop Header"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black" />
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
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Sidebar Filter */}
          <aside className="w-full lg:w-64 flex-shrink-0">
            <div className="sticky top-32 space-y-8">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-6">Filter by Price</h3>
                <div className="space-y-4">
                  <input 
                    type="range" 
                    min="0" 
                    max="300" 
                    step="1"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">$0</span>
                    <span className="text-sm font-bold text-black">Up to ${maxPrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1">
            <div className="relative w-full mb-8">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-12 pr-4 text-sm text-black focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
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

const COARequestView = () => {
  const [email, setEmail] = useState('');
  const [product, setProduct] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await addDoc(collection(db, 'coa_requests'), {
        email,
        product,
        message,
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

const CheckoutView = ({ cart, onBack, onComplete, initialOrder, userProfile }: { cart: CartItem[], onBack: () => void, onComplete: (info: any) => void, initialOrder?: any, userProfile?: any }) => {
  const [step, setStep] = useState(1);
  const [shippingInfo, setShippingInfo] = useState(() => {
    if (initialOrder?.shippingInfo) return initialOrder.shippingInfo;
    
    // Find default address or first address
    const defaultAddress = userProfile?.addresses?.find((a: any) => a.isDefault) || userProfile?.addresses?.[0];
    
    return {
      email: userProfile?.email || '',
      firstName: userProfile?.firstName || '',
      lastName: userProfile?.lastName || '',
      address: defaultAddress?.street || '',
      city: defaultAddress?.city || '',
      state: defaultAddress?.state || '',
      zip: defaultAddress?.zip || '',
    };
  });
  const [shippingMethod, setShippingMethod] = useState(initialOrder?.shippingMethod || 'express');
  const [paymentMethod, setPaymentMethod] = useState(initialOrder?.paymentMethod || 'zelle');
  const [acknowledgements, setAcknowledgements] = useState({
    age: false,
    research: false,
    terms: false
  });

  const [isStateDropdownOpen, setIsStateDropdownOpen] = useState(false);
  const stateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userProfile && !initialOrder && !shippingInfo.email && !shippingInfo.firstName) {
      const defaultAddress = userProfile.addresses?.find((a: any) => a.isDefault) || userProfile.addresses?.[0];
      setShippingInfo({
        email: userProfile.email || '',
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        address: defaultAddress?.street || '',
        city: defaultAddress?.city || '',
        state: defaultAddress?.state || '',
        zip: defaultAddress?.zip || '',
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
  const shipping = subtotal >= 250 ? 0 : 14.50;
  
  // 5% discount for crypto
  const discount = paymentMethod === 'crypto' ? subtotal * 0.05 : 0;
  const total = subtotal + shipping - discount;

  const handlePlaceOrder = async () => {
    onComplete({
      shippingInfo,
      shippingMethod,
      paymentMethod,
      total
    });
  };

  const isStep1Valid = shippingInfo.email && shippingInfo.firstName && shippingInfo.lastName && shippingInfo.address && shippingInfo.city && shippingInfo.state && shippingInfo.zip;

  return (
    <div className="pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-gray-500 hover:text-black mb-8 transition-colors group"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> {initialOrder ? 'Back to Account' : 'Back to Shop'}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Shipping Information */}
          <section className={`bg-white rounded-[2.5rem] border transition-all duration-500 ${step === 1 ? 'border-emerald-200 shadow-xl shadow-emerald-500/5 p-8 md:p-12' : 'border-gray-100 p-6 opacity-60'}`}>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${step >= 1 ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>1</div>
                Shipping Information
              </h2>
              {step > 1 && (
                <button onClick={() => setStep(1)} className="text-sm font-bold text-emerald-600 hover:underline">Edit</button>
              )}
            </div>
            
            {step === 1 ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Email Address</label>
                  <input 
                    type="email" 
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-black transition-all"
                    value={shippingInfo.email}
                    onChange={e => setShippingInfo({...shippingInfo, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">First Name</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-black transition-all"
                    value={shippingInfo.firstName}
                    onChange={e => setShippingInfo({...shippingInfo, firstName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Last Name</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-black transition-all"
                    value={shippingInfo.lastName}
                    onChange={e => setShippingInfo({...shippingInfo, lastName: e.target.value})}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Address</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-black transition-all"
                    value={shippingInfo.address}
                    onChange={e => setShippingInfo({...shippingInfo, address: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">City</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-black transition-all"
                    value={shippingInfo.city}
                    onChange={e => setShippingInfo({...shippingInfo, city: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative" ref={stateRef}>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">State</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-black transition-all"
                      value={shippingInfo.state}
                      onFocus={() => setIsStateDropdownOpen(true)}
                      onChange={e => {
                        setShippingInfo({...shippingInfo, state: e.target.value});
                        setIsStateDropdownOpen(true);
                      }}
                    />
                    <AnimatePresence>
                      {isStateDropdownOpen && filteredStates.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-50 left-0 right-0 top-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-100"
                        >
                          {filteredStates.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => {
                                setShippingInfo({...shippingInfo, state: s});
                                setIsStateDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-none"
                            >
                              {s}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">ZIP</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-black transition-all"
                      value={shippingInfo.zip}
                      onChange={e => setShippingInfo({...shippingInfo, zip: e.target.value})}
                    />
                  </div>
                </div>
                <button 
                  disabled={!isStep1Valid}
                  onClick={() => setStep(2)}
                  className="md:col-span-2 mt-4 py-4 bg-black text-white font-bold rounded-2xl hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-black transition-all"
                >
                  Continue to Shipping
                </button>
              </motion.div>
            ) : (
              <div className="text-sm text-gray-600">
                <p>{shippingInfo.firstName} {shippingInfo.lastName}</p>
                <p>{shippingInfo.address}</p>
                <p>{shippingInfo.city}, {shippingInfo.state} {shippingInfo.zip}</p>
              </div>
            )}
          </section>

          {/* Step 2: Shipping Method */}
          <section className={`bg-white rounded-[2.5rem] border transition-all duration-500 ${step === 2 ? 'border-emerald-200 shadow-xl shadow-emerald-500/5 p-8 md:p-12' : 'border-gray-100 p-6 opacity-60'}`}>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${step >= 2 ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>2</div>
                Shipping Method
              </h2>
              {step > 2 && (
                <button onClick={() => setStep(2)} className="text-sm font-bold text-emerald-600 hover:underline">Edit</button>
              )}
            </div>

            {step === 2 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <label className={`flex items-center justify-between p-6 rounded-2xl border-2 transition-all cursor-pointer border-emerald-500 bg-emerald-50/30`}>
                  <div className="flex items-center gap-4">
                    <input 
                      type="radio" 
                      name="shipping" 
                      checked={true}
                      readOnly
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="font-bold text-gray-900">Express Shipping</p>
                      <p className="text-sm text-gray-500">2-4 business days</p>
                    </div>
                  </div>
                  <span className="font-bold text-gray-900">{shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}</span>
                </label>
                <button 
                  onClick={() => setStep(3)}
                  className="w-full mt-4 py-4 bg-black text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all"
                >
                  Continue to Payment
                </button>
              </motion.div>
            )}
            {step > 2 && (
              <p className="text-sm text-gray-600 font-medium capitalize">Express Shipping — {shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}</p>
            )}
          </section>

          {/* Step 3: Payment Method */}
          <section className={`bg-white rounded-[2.5rem] border transition-all duration-500 ${step === 3 ? 'border-emerald-200 shadow-xl shadow-emerald-500/5 p-8 md:p-12' : 'border-gray-100 p-6 opacity-60'}`}>
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${step >= 3 ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>3</div>
              Payment Method
            </h2>

            {step === 3 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                {/* Zelle */}
                <label className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer ${paymentMethod === 'zelle' ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-100 hover:border-gray-200'}`}>
                  <div className="flex items-center gap-6">
                    <input 
                      type="radio" 
                      name="payment" 
                      checked={paymentMethod === 'zelle'} 
                      onChange={() => setPaymentMethod('zelle')} 
                      className="w-5 h-5 text-emerald-600 flex-shrink-0 cursor-pointer" 
                    />
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                        <img src="https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971792/zelle_w6wa7a.png" alt="Zelle" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                      <span className="font-bold text-gray-900">Zelle</span>
                    </div>
                  </div>
                </label>

                {/* Venmo */}
                <label className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer ${paymentMethod === 'venmo' ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-100 hover:border-gray-200'}`}>
                  <div className="flex items-center gap-6">
                    <input 
                      type="radio" 
                      name="payment" 
                      checked={paymentMethod === 'venmo'} 
                      onChange={() => setPaymentMethod('venmo')} 
                      className="w-5 h-5 text-emerald-600 flex-shrink-0 cursor-pointer" 
                    />
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                        <img src="https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971791/venmo_ou9gtd.png" alt="Venmo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                      <span className="font-bold text-gray-900">Venmo</span>
                    </div>
                  </div>
                </label>

                {/* Crypto */}
                <label className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer ${paymentMethod === 'crypto' ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-100 hover:border-gray-200'}`}>
                  <div className="flex items-center gap-6">
                    <input 
                      type="radio" 
                      name="payment" 
                      checked={paymentMethod === 'crypto'} 
                      onChange={() => setPaymentMethod('crypto')} 
                      className="w-5 h-5 text-emerald-600 flex-shrink-0 cursor-pointer" 
                    />
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#f7931a] rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm p-2.5">
                        <img src="https://cdn.worldvectorlogo.com/logos/bitcoin-1.svg" alt="Crypto" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                      <div>
                        <span className="font-bold text-gray-900">Cryptocurrency</span>
                        <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase tracking-wider">5% OFF</span>
                      </div>
                    </div>
                  </div>
                </label>

                {/* Coming Soon: Credit Card / Apple Pay */}
                <div className="p-5 rounded-2xl border border-dashed border-gray-200 opacity-50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-4 h-4 rounded-full border border-gray-300" />
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center p-1">
                          <img src="https://cdn.worldvectorlogo.com/logos/visa.svg" alt="Visa" className="w-full grayscale" referrerPolicy="no-referrer" />
                        </div>
                        <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center p-1">
                          <img src="https://cdn.worldvectorlogo.com/logos/apple-pay.svg" alt="Apple Pay" className="w-full grayscale" referrerPolicy="no-referrer" />
                        </div>
                      </div>
                      <span className="font-bold text-gray-400">Credit Card / Apple Pay</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Coming Soon</span>
                </div>

                {/* Coming Soon: Cash App */}
                <div className="p-5 rounded-2xl border border-dashed border-gray-200 opacity-50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-4 h-4 rounded-full border border-gray-300" />
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center p-2">
                        <img src="https://cdn.worldvectorlogo.com/logos/cash-app.svg" alt="Cash App" className="w-full grayscale" referrerPolicy="no-referrer" />
                      </div>
                      <span className="font-bold text-gray-400">Cash App</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Coming Soon</span>
                </div>

                <div className="mt-8 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-gray-400 mt-0.5" />
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {paymentMethod === 'crypto' 
                        ? "You've selected Cryptocurrency. A 5% discount has been applied to your research materials. Instructions for payment will be sent to your email after order confirmation."
                        : `You've selected ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}. Payment instructions will be provided on the next screen and sent to your email.`}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </section>
        </div>

        <div className="lg:col-span-5">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 md:p-10 shadow-sm sticky top-32">
            <h2 className="text-xl font-bold mb-8">Order Summary</h2>
            
            <div className="space-y-6 mb-8 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-100">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <div className="w-20 h-20 bg-gray-50 rounded-2xl overflow-hidden flex-shrink-0 border border-gray-100">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-sm text-gray-900 mb-1">{item.name}</h3>
                    <p className="text-xs text-gray-500 mb-2">Qty: {item.quantity}</p>
                    <p className="text-emerald-600 font-bold">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4 pt-8 border-t border-gray-100">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span className="font-bold text-gray-900">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Shipping</span>
                <span className="font-bold text-emerald-600">
                  {shipping <= 0 ? 'FREE' : `$${shipping.toFixed(2)}`}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Crypto Discount (5%)</span>
                  <span className="font-bold">-${discount.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-4 border-t border-gray-100 flex justify-between items-end">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Amount</p>
                  <p className="text-3xl font-bold text-gray-900">${total.toFixed(2)}</p>
                </div>
              </div>

              <div className="pt-6 space-y-4">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      checked={acknowledgements.age}
                      onChange={(e) => setAcknowledgements({ ...acknowledgements, age: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                    />
                  </div>
                  <span className="text-[11px] text-gray-500 font-medium leading-tight group-hover:text-gray-700 transition-colors">
                    I am 21 years of age or older.
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      checked={acknowledgements.research}
                      onChange={(e) => setAcknowledgements({ ...acknowledgements, research: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                    />
                  </div>
                  <span className="text-[11px] text-gray-500 font-medium leading-tight group-hover:text-gray-700 transition-colors">
                    I understand that these products are for laboratory research use only and not for human or animal consumption.
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      checked={acknowledgements.terms}
                      onChange={(e) => setAcknowledgements({ ...acknowledgements, terms: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                    />
                  </div>
                  <span className="text-[11px] text-gray-500 font-medium leading-tight group-hover:text-gray-700 transition-colors">
                    I agree to the Terms and Conditions and Privacy Policy.
                  </span>
                </label>
              </div>
              
              <button 
                disabled={step < 3 || !acknowledgements.age || !acknowledgements.research || !acknowledgements.terms}
                onClick={handlePlaceOrder}
                className="w-full py-5 bg-black text-white font-bold rounded-2xl hover:bg-emerald-600 disabled:opacity-30 disabled:hover:bg-black transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-3 mt-8 group"
              >
                {initialOrder ? 'Complete Order' : 'Complete Purchase'} <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
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

const ProductDetailView = ({ product, onAddToCart, onBack, onSelectProduct }: { product: Product, onAddToCart: (product: Product, quantity: number) => void, onBack: () => void, onSelectProduct: (product: Product) => void }) => {
  const [quantity, setQuantity] = useState(1);
  
  const getDiscountedPrice = (qty: number) => {
    if (qty >= 3) return product.price * 0.85;
    if (qty >= 2) return product.price * 0.90;
    return product.price;
  };

  const currentPrice = getDiscountedPrice(quantity);
  const total = currentPrice * quantity;

  // Blank images for each quantity selection (to be added later)
  const quantityImages: Record<number, string> = {
    1: product.quantityImages?.[1] || "https://picsum.photos/seed/pack1/800/1000",
    2: product.quantityImages?.[2] || "https://picsum.photos/seed/pack2/800/1000",
    3: product.quantityImages?.[3] || "https://picsum.photos/seed/pack3/800/1000",
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-black mb-8 transition-colors group">
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Back to Shop
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* Product Image */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="aspect-[4/5] rounded-[2.5rem] overflow-hidden bg-white border border-gray-100 shadow-sm"
        >
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </motion.div>

        {/* Product Info */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col"
        >
          <div className="mb-8">
            <span className="text-emerald-500 font-bold tracking-[0.2em] text-xs uppercase mb-4 block">{product.category}</span>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">{product.name}</h1>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
              </div>
              <span className="text-sm text-gray-400 font-medium">Verified Research Compound</span>
            </div>
            <p className="text-gray-500 leading-relaxed text-lg mb-6">
              {product.description || "High-purity research compound synthesized for laboratory use. HPLC tested and verified for maximum precision in research applications."}
            </p>

            {product.dosage && (
              <div className="pt-6 border-t border-gray-100">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-2">Research Dosage</h4>
                <p className="text-2xl font-bold text-gray-900">{product.dosage}</p>
              </div>
            )}
          </div>

          <div className="bg-gray-50 rounded-3xl p-8 mb-8 border border-gray-100">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-6">Select Your Offer</h3>
            
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[1, 2, 3].map((num) => (
                <button 
                  key={num}
                  onClick={() => setQuantity(num)}
                  className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all ${quantity === num ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-transparent hover:border-gray-200'}`}
                >
                  <img src={quantityImages[num]} alt={`${num} Bottle`} className="w-full h-full object-cover" />
                  <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-3 text-left transition-opacity ${quantity === num ? 'opacity-100' : 'opacity-80'}`}>
                    <span className="text-white font-bold text-sm">{num} {num === 1 ? 'Bottle' : 'Bottles'}</span>
                    <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                      {num === 1 ? 'Standard' : num === 2 ? '10% OFF' : '15% OFF'}
                    </span>
                  </div>
                  {quantity === num && (
                    <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full">
                      <ShieldCheck className="w-3 h-3" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 bg-white rounded-2xl p-2 border border-gray-100 shadow-sm">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-400 hover:text-black"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-bold text-lg">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-400 hover:text-black"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Price Per Bottle</p>
                  <p className="text-xl font-bold text-black">${currentPrice.toFixed(2)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Amount</p>
                  <p className="text-3xl font-bold text-black">${total.toFixed(2)}</p>
                </div>
                <button 
                  onClick={() => onAddToCart(product, quantity)}
                  className="px-12 py-5 bg-black text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all active:scale-95 flex items-center gap-3 shadow-xl shadow-black/10"
                >
                  <ShoppingCart className="w-5 h-5" /> Add to Cart
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-gray-100 flex items-center gap-3">
              <Truck className="w-5 h-5 text-emerald-500" />
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Fast Shipping</span>
            </div>
            <div className="p-4 rounded-2xl border border-gray-100 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Lab Verified</span>
            </div>
          </div>
        </motion.div>
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
              .filter(p => p.id !== product.id)
              .map((rec) => (
              <motion.div 
                key={rec.id}
                whileHover={{ y: -5 }}
                className="min-w-[280px] snap-start group cursor-pointer"
                onClick={() => onSelectProduct(rec)}
              >
                <div className="aspect-square rounded-3xl overflow-hidden bg-gray-50 border border-gray-100 mb-6 relative">
                  <img src={rec.image} alt={rec.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
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

const AppContent = () => {
  const [view, setView] = useState<'home' | 'shop' | 'about' | 'track' | 'coas' | 'admin' | 'account' | 'checkout' | 'product' | 'terms' | 'shipping' | 'refund' | 'privacy' | 'calculator' | 'affiliate'>('home');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setUserProfile(doc.data());
      }
    });
    return () => unsubscribe();
  }, [user]);

  const addToCart = (product: Product, quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      const newQuantity = existing ? existing.quantity + quantity : quantity;
      
      // Calculate discounted price based on total quantity of this product
      let unitPrice = product.price;
      if (newQuantity >= 3) unitPrice = product.price * 0.85;
      else if (newQuantity >= 2) unitPrice = product.price * 0.90;

      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: newQuantity, price: unitPrice } : item);
      }
      return [...prev, { ...product, quantity: newQuantity, price: unitPrice }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        // Recalculate price based on new quantity
        const baseProduct = products.find(p => p.id === id);
        let unitPrice = baseProduct ? baseProduct.price : item.price;
        if (newQty >= 3) unitPrice = (baseProduct?.price || item.price) * 0.85;
        else if (newQty >= 2) unitPrice = (baseProduct?.price || item.price) * 0.90;
        
        return { ...item, quantity: newQty, price: unitPrice };
      }
      return item;
    }));
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

  return (
    <div className="min-h-screen bg-[#F9F9F9] font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <Navbar 
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} 
        onOpenCart={() => setIsCartOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onNavigate={setView}
        currentView={view}
      />
      
      <main className={(view !== 'home' && view !== 'shop') ? 'pt-24' : ''}>
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Hero onShopNow={() => setView('shop')} onViewCOAs={() => setView('coas')} />
              <FeaturedProducts 
                onAddToCart={addToCart} 
                onSelectProduct={(p) => {
                  setSelectedProduct(p);
                  setView('product');
                  window.scrollTo(0, 0);
                }} 
              />
              <ResearchDisclaimer />
            </motion.div>
          )}

          {view === 'about' && (
            <AboutUsView onBack={() => setView('home')} onShopNow={() => setView('shop')} />
          )}

          {view === 'track' && (
            <TrackOrderView onBack={() => setView('home')} />
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
                onAddToCart={addToCart} 
                onBack={() => setView('shop')} 
                onSelectProduct={(p) => {
                  setSelectedProduct(p);
                  window.scrollTo(0, 0);
                }}
              />
            </motion.div>
          )}

          {view === 'shop' && (
            <ShopView 
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
                  const { shippingInfo, shippingMethod, paymentMethod, total } = data;
                  try {
                    if (editingOrder) {
                      await updateDoc(doc(db, 'orders', editingOrder.id), {
                        items: cart,
                        total,
                        shippingInfo,
                        shippingMethod,
                        paymentMethod,
                        updatedAt: serverTimestamp()
                      });
                      alert('Order updated successfully!');
                      setEditingOrder(null);
                      setCart([]);
                      setView('account');
                    } else {
                      // Generate a readable Order ID: VR-YYYYMMDD-RANDOM
                      const date = new Date();
                      const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
                      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
                      const orderId = `VR-${dateStr}-${randomStr}`;

                      await setDoc(doc(db, 'orders', orderId), {
                        userId: user?.uid || null,
                        items: cart,
                        total,
                        status: 'pending',
                        shippingInfo,
                        shippingMethod,
                        paymentMethod,
                        createdAt: serverTimestamp()
                      });
                      alert(`Order placed successfully! Your Order ID is: ${orderId}`);
                      setCart([]);
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
        <section className="py-24 border-t border-gray-800 bg-gray-900">
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
                <li><button onClick={() => setView('affiliate')} className="hover:text-black transition-colors">Become an Affiliate</button></li>
                <li><button onClick={() => setView('track')} className="hover:text-black transition-colors">Track Order</button></li>
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
      />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onNavigate={setView} />
      <ChatBot />
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
