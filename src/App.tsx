import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Menu, 
  X, 
  ChevronRight, 
  ChevronLeft,
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
  Star
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
  updateProfile
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

  const isDarkPage = currentView === 'home' || currentView === 'shop';
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
              src={showSolidNav ? "/blacklogo.png" : "/logo.png"} 
              alt="Eclipse Research" 
              className="h-14 w-auto" 
            />
          </div>
          <span className={`text-xl font-bold tracking-tight ${showSolidNav ? 'text-black' : 'text-white'}`}>ECLIPSE RESEARCH</span>
        </button>

        <div className="hidden md:flex items-center gap-8">
          <button onClick={() => onNavigate('shop')} className={`text-sm font-medium hover:opacity-70 transition-opacity ${showSolidNav ? 'text-black' : 'text-white'}`}>Shop All</button>
          <button onClick={() => onNavigate('coas')} className={`text-sm font-medium hover:opacity-70 transition-opacity ${showSolidNav ? 'text-black' : 'text-white'}`}>COA's</button>
          {isAdmin && (
            <button onClick={() => onNavigate('admin')} className={`text-sm font-bold text-emerald-500 hover:opacity-70 transition-opacity`}>Admin Panel</button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button className={`${showSolidNav ? 'text-black' : 'text-white'}`}>
            <Search className="w-5 h-5" />
          </button>
          
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
              <button onClick={() => { onNavigate('coas'); setIsMobileMenuOpen(false); }} className="text-2xl font-bold text-black border-b border-gray-100 pb-4 text-left">COA's</button>
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
    id: 'bw-1',
    name: "Bacteriostatic Water (30ml)",
    price: 14.99,
    category: "Supplies",
    image: "/bac-water.png"
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

const AuthModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { login, register, user } = useAuth();
  const [isSuccess, setIsSuccess] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

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
      if (mode === 'login') {
        await login(email, password);
      } else {
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
                  <img src="/blacklogo.png" alt="Eclipse Research" className="h-20 w-auto" />
                </div>
                <h2 className="text-3xl font-bold mb-2 tracking-tight text-center">
                  {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="text-gray-500 mb-8 text-center text-sm">
                  {mode === 'login' 
                    ? 'Sign in to manage your research compounds.' 
                    : 'Join our research community today.'}
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
                    <input 
                      required
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'register' ? 'Min. 6 characters' : ''}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none"
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      {error}
                    </div>
                  )}

                  <button 
                    disabled={isLoading}
                    type="submit"
                    className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === 'login' ? 'Sign In' : 'Create Account')}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button 
                    onClick={() => {
                      setMode(mode === 'login' ? 'register' : 'login');
                      setError(null);
                    }}
                    className="text-xs font-bold text-gray-400 hover:text-black transition-colors"
                  >
                    {mode === 'login' ? "Don't have an account? Register" : "Already have an account? Login"}
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
    try {
      await deleteDoc(doc(db, 'orders', orderId));
      setIsDeletingOrder(null);
    } catch (error) {
      console.error(error);
      alert('Error deleting order');
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
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Cancel Order?</h3>
                <p className="text-gray-500 mb-8 font-medium">This action cannot be undone. Are you sure you want to delete this order?</p>
                
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => handleDeleteOrder(isDeletingOrder)}
                    className="w-full py-4 bg-red-500 text-white font-bold rounded-2xl hover:bg-red-600 transition-all"
                  >
                    Yes, Cancel Order
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
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = collection(db, 'users');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="pt-32 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-2">User Management</h1>
        <p className="text-gray-500">View and manage all registered research accounts.</p>
      </div>

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
                      <span className="font-bold text-sm">{u.displayName}</span>
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
        } else if (u.email === 'kyron.laskosky2@gmail.com') {
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
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1532187863486-abf9d397191a?auto=format&fit=crop&q=80&w=2000" 
          className="w-full h-full object-cover opacity-40"
          alt="Laboratory"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent" />
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
              View Lab Results
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
    image: "/glp3-rt.png", 
    description: "A 39-amino acid triple agonist peptide targeting GIP, GLP-1, and glucagon receptors, studied for metabolic pathway regulation and receptor binding kinetics in preclinical research models. Premium Research Peptide.",
    dosage: "10MG",
    quantityImages: { 2: "/2glp3-rt.png" }
  },
  { 
    id: '2', 
    name: "BPC-157", 
    price: 67.99, 
    category: "Peptides", 
    image: "/bpc-157.png", 
    description: "Body Protective Compound-157 is a pentadecapeptide known for its potential regenerative properties in tendon, muscle, and gut research.",
    dosage: "10MG",
    quantityImages: { 2: "/2bpc-157.png" }
  },
  { 
    id: '3', 
    name: "GHK-Cu", 
    price: 41.99, 
    category: "Peptides", 
    image: "/ghk-cu.png", 
    description: "A copper-binding tripeptide naturally occurring in human plasma with research applications in skin remodeling and anti-inflammatory studies.",
    dosage: "100MG",
    quantityImages: { 2: "/2ghk-cu.png" }
  },
  { 
    id: '4', 
    name: "MT-2", 
    price: 43.99, 
    category: "Peptides", 
    image: "/mt-2.png", 
    description: "Melanotan II is a synthetic analog of the alpha-melanocyte-stimulating hormone, researched for its effects on skin pigmentation.",
    dosage: "10MG",
    quantityImages: { 2: "/2mt-2.png" }
  },
  { 
    id: '5', 
    name: "Wolverine 10mg (BPC157/TB500)", 
    price: 77.99, 
    category: "Peptides", 
    image: "/wolverine.png", 
    description: "A research blend of BPC-157 and TB-500, designed for synergistic studies on tissue repair and recovery.",
    dosage: "10MG",
    quantityImages: { 2: "/2wolverine.png" }
  },
  { 
    id: '6', 
    name: "CJC 1295 no dac + Ipamorelin", 
    price: 84.99, 
    category: "Peptides", 
    image: "/cjc-ipamorelin.png", 
    description: "A combination of a GHRH analog and a ghrelin mimetic, used in research to study growth hormone secretion patterns.",
    dosage: "10MG",
    quantityImages: { 2: "/2cjc-ipamorelin.png" }
  },
  { 
    id: '7', 
    name: "Bacteriostatic Water", 
    price: 14.99, 
    category: "Peptides", 
    image: "/bac-water.png", 
    description: "Sterile water containing 0.9% benzyl alcohol, used as a diluent for reconstituting research compounds.",
    dosage: "10ML",
    quantityImages: { 2: "/2BacWater.png" }
  },
  { 
    id: '8', 
    name: "Tesamorelin", 
    price: 92.99, 
    category: "Peptides", 
    image: "/tesamorelin.png", 
    description: "A synthetic analog of growth hormone-releasing factor (GRF), researched for its effects on visceral adipose tissue.",
    dosage: "10MG",
    quantityImages: { 2: "/2tesamorelin.png" }
  },
  { 
    id: '9', 
    name: "GLOW", 
    price: 112.99, 
    category: "Peptides", 
    image: "/glow.png", 
    description: "A specialized research blend designed for studies related to skin health, collagen production, and cellular vitality.",
    dosage: "70MG",
    quantityImages: { 2: "/2glow.png" }
  },
  { 
    id: '10', 
    name: "NAD+", 
    price: 77.99, 
    category: "Peptides", 
    image: "/nad.png", 
    description: "Nicotinamide Adenine Dinucleotide is a critical coenzyme found in all living cells, researched for its role in energy metabolism and DNA repair.",
    dosage: "500MG",
    quantityImages: { 2: "/2nad.png" }
  }
];

const FeaturedProducts = ({ onAddToCart, onSelectProduct }: { onAddToCart: (product: Product) => void, onSelectProduct: (product: Product) => void }) => {
  const featured = products.filter(p => ['2', '3', '10'].includes(p.id));

  return (
    <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Featured Compounds</h2>
          <p className="text-gray-500">Our most requested high-purity research materials.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {featured.map((product) => (
          <div 
            key={product.id} 
            className="group bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden hover:shadow-xl transition-all cursor-pointer"
            onClick={() => onSelectProduct(product as Product)}
          >
            <div className="aspect-[4/5] relative overflow-hidden bg-gray-50">
              <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCart(product as Product);
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
        ))}
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

const COAView = () => {
  const coas = [
    { name: "BPC-157 (5mg)", date: "Jan 2026", purity: "99.4%", image: "/bpc-157.png" },
    { name: "GLP-3 RT", date: "Feb 2026", purity: "99.2%", image: "/glp3-rt.png" },
    { name: "CJC-1295 + Ipamorelin", date: "Dec 2025", purity: "99.1%", image: "/cjc-ipamorelin.png" },
    { name: "GHK-Cu (50mg)", date: "Jan 2026", purity: "99.8%", image: "/ghk-cu.png" },
    { name: "NAD+", date: "Mar 2026", purity: "99.5%", image: "/nad.png" },
    { name: "Melanotan II", date: "Feb 2026", purity: "99.3%", image: "/mt-2.png" },
    { name: "Wolverine 10mg", date: "Mar 2026", purity: "99.6%", image: "/wolverine.png" },
    { name: "GLOW", date: "Mar 2026", purity: "99.7%", image: "/glow.png" },
    { name: "Tesamorelin (2mg)", date: "Feb 2026", purity: "99.2%", image: "/tesamorelin.png" },
    { name: "Bacteriostatic Water", date: "Jan 2026", purity: "99.4%", image: "/bac-water.png" },
  ];

  return (
    <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-16 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 mb-6">Certificates of Analysis</h1>
        <p className="text-gray-500 max-w-2xl mx-auto text-lg">
          We prioritize transparency. Every batch of our research compounds undergoes rigorous third-party HPLC testing to ensure maximum purity and reliability.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {coas.map((coa, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="group bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all"
          >
            <div className="aspect-[3/4] relative overflow-hidden">
              <img src={coa.image} alt={coa.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80" />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

const CheckoutView = ({ cart, onBack, onComplete, initialOrder }: { cart: CartItem[], onBack: () => void, onComplete: (info: any) => void, initialOrder?: any }) => {
  const [step, setStep] = useState(1);
  const [shippingInfo, setShippingInfo] = useState(initialOrder?.shippingInfo || {
    email: '',
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    zip: '',
  });
  const [shippingMethod, setShippingMethod] = useState(initialOrder?.shippingMethod || 'standard');
  const [paymentMethod, setPaymentMethod] = useState(initialOrder?.paymentMethod || 'zelle');

  const [isStateDropdownOpen, setIsStateDropdownOpen] = useState(false);
  const stateRef = useRef<HTMLDivElement>(null);

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
  const shipping = subtotal >= 150 ? 0 : (shippingMethod === 'express' ? 35 : 15);
  
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
                <label className={`flex items-center justify-between p-6 rounded-2xl border-2 transition-all cursor-pointer ${shippingMethod === 'standard' ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-100 hover:border-gray-200'}`}>
                  <div className="flex items-center gap-4">
                    <input 
                      type="radio" 
                      name="shipping" 
                      checked={shippingMethod === 'standard'}
                      onChange={() => setShippingMethod('standard')}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="font-bold text-gray-900">Standard Shipping</p>
                      <p className="text-sm text-gray-500">3-5 business days</p>
                    </div>
                  </div>
                  <span className="font-bold text-gray-900">{subtotal >= 150 ? 'FREE' : '$15.00'}</span>
                </label>
                <label className={`flex items-center justify-between p-6 rounded-2xl border-2 transition-all cursor-pointer ${shippingMethod === 'express' ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-100 hover:border-gray-200'}`}>
                  <div className="flex items-center gap-4">
                    <input 
                      type="radio" 
                      name="shipping" 
                      checked={shippingMethod === 'express'}
                      onChange={() => setShippingMethod('express')}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="font-bold text-gray-900">Express Shipping</p>
                      <p className="text-sm text-gray-500">1-2 business days</p>
                    </div>
                  </div>
                  <span className="font-bold text-gray-900">$35.00</span>
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
              <p className="text-sm text-gray-600 font-medium capitalize">{shippingMethod} Shipping — {shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}</p>
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
                      <div className="w-12 h-12 bg-[#6d1ed4] rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                        <img src="https://www.zellepay.com/themes/custom/zelle_theme/logo.svg" alt="Zelle" className="w-7 invert brightness-0" referrerPolicy="no-referrer" />
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
                      <div className="w-12 h-12 bg-[#3d95ce] rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm p-2.5">
                        <img src="https://cdn.worldvectorlogo.com/logos/venmo-2.svg" alt="Venmo" className="w-full h-full object-contain invert brightness-0" referrerPolicy="no-referrer" />
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
                  {shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}
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
              
              <button 
                disabled={step < 3}
                onClick={handlePlaceOrder}
                className="w-full py-5 bg-black text-white font-bold rounded-2xl hover:bg-emerald-600 disabled:opacity-30 disabled:hover:bg-black transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-3 mt-8 group"
              >
                {initialOrder ? 'Update Order' : 'Complete Purchase'} <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <p className="text-[10px] text-gray-400 text-center mt-6 leading-relaxed">
                By completing your purchase, you agree to our Terms of Service and Privacy Policy. 
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
    1: product.quantityImages?.[1] || product.image,
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
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
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
                  className={`relative aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all ${quantity === num ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-transparent hover:border-gray-200'}`}
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
                  <img src={rec.image} alt={rec.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
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

const AppContent = () => {
  const [view, setView] = useState<'home' | 'shop' | 'coas' | 'admin' | 'account' | 'checkout' | 'product'>('home');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState(300);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const { user, isAdmin } = useAuth();

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPrice = p.price <= maxPrice;
    return matchesSearch && matchesPrice;
  });

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

          {view === 'coas' && (
            <motion.div
              key="coas"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <COAView />
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
                    <div className="relative w-full max-w-md">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input 
                        type="text" 
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all backdrop-blur-sm"
                      />
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map((product) => (
                          <motion.div 
                            key={product.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="group flex flex-col cursor-pointer"
                            onClick={() => {
                              setSelectedProduct(product);
                              setView('product');
                              window.scrollTo(0, 0);
                            }}
                          >
                            <div className="aspect-[4/5] overflow-hidden bg-white rounded-2xl border border-gray-100 relative mb-4">
                              <img 
                                src={product.image} 
                                alt={product.name} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                              />
                              <div className="absolute top-4 right-4">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addToCart(product);
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
                                    addToCart(product);
                                  }}
                                  className="w-full py-3 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                  <ShoppingCart className="w-4 h-4" /> Add to Cart
                                </button>
                              </div>
                            </div>
                          </motion.div>
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
                      await addDoc(collection(db, 'orders'), {
                        userId: user?.uid,
                        items: cart,
                        total,
                        status: 'pending',
                        shippingInfo,
                        shippingMethod,
                        paymentMethod,
                        createdAt: serverTimestamp()
                      });
                      alert('Order placed successfully! (Research Simulation)');
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
        <section className="py-24 border-t border-gray-100 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
              {[
                { title: "HPLC Tested", desc: "Independent third-party analysis for every batch." },
                { title: "Secure Synthesis", desc: "State-of-the-art laboratory environment." },
                { title: "Global Shipping", desc: "Discreet and temperature-controlled logistics." }
              ].map((feature, i) => (
                <div key={i} className="flex flex-col">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">{feature.title}</h3>
                  <p className="text-gray-900 font-medium leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <img src="/blacklogo.png" alt="Eclipse Research" className="h-10 w-auto" />
                <span className="text-lg font-bold tracking-tight">ECLIPSE RESEARCH</span>
              </div>
              <p className="text-gray-500 text-sm max-w-sm leading-relaxed mb-6">
                Providing high-purity research compounds to the global scientific community. 
                Our mission is to accelerate discovery through quality and transparency.
              </p>
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-gray-100 rounded-full"></div>
                <div className="w-8 h-8 bg-gray-100 rounded-full"></div>
                <div className="w-8 h-8 bg-gray-100 rounded-full"></div>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-6 uppercase text-xs tracking-widest text-gray-400">Quick Links</h4>
              <ul className="space-y-4 text-sm text-gray-600 font-medium">
                <li><button onClick={() => setView('shop')} className="hover:text-black">Shop All</button></li>
                <li><button onClick={() => setView('coas')} className="hover:text-black">COA's</button></li>
                <li><a href="#" className="hover:text-black">Shipping Policy</a></li>
                <li><a href="#" className="hover:text-black">Terms of Service</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-6 uppercase text-xs tracking-widest text-gray-400">Support</h4>
              <ul className="space-y-4 text-sm text-gray-600 font-medium">
                <li><a href="#" className="hover:text-black">FAQ</a></li>
                <li><a href="#" className="hover:text-black">Contact Us</a></li>
                <li><a href="#" className="hover:text-black">Lab Results</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-xs text-gray-400">© 2026 Eclipse Research. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <ShieldCheck className="w-4 h-4" /> Secure Checkout
              </div>
              <div className="flex gap-2">
                <div className="w-10 h-6 bg-gray-50 border border-gray-100 rounded"></div>
                <div className="w-10 h-6 bg-gray-50 border border-gray-100 rounded"></div>
                <div className="w-10 h-6 bg-gray-50 border border-gray-100 rounded"></div>
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
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <ChatBot />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
