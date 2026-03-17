import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Menu, 
  X, 
  ChevronRight, 
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
  CheckCircle2
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
  serverTimestamp, 
  getDocs,
  doc,
  getDoc,
  setDoc,
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Components ---

const Navbar = ({ cartCount, onOpenCart, onOpenAuth, onNavigate }: { cartCount: number, onOpenCart: () => void, onOpenAuth: () => void, onNavigate: (view: 'home' | 'shop' | 'coas') => void }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <button 
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
            <FlaskConical className="text-white w-6 h-6" />
          </div>
          <span className={`text-xl font-bold tracking-tight ${isScrolled ? 'text-black' : 'text-white'}`}>RESEARCH PEPTIDES</span>
        </button>

        <div className="hidden md:flex items-center gap-8">
          <button onClick={() => onNavigate('shop')} className={`text-sm font-medium hover:opacity-70 transition-opacity ${isScrolled ? 'text-black' : 'text-white'}`}>Shop All</button>
          <button onClick={() => onNavigate('coas')} className={`text-sm font-medium hover:opacity-70 transition-opacity ${isScrolled ? 'text-black' : 'text-white'}`}>COA's</button>
        </div>

        <div className="flex items-center gap-4">
          <button className={`${isScrolled ? 'text-black' : 'text-white'}`}>
            <Search className="w-5 h-5" />
          </button>
          
          <button 
            onClick={onOpenCart}
            className={`${isScrolled ? 'text-black' : 'text-white'} relative p-2 hover:bg-black/5 rounded-full transition-colors`}
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
              <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-gray-200" />
              <button onClick={logout} className={`${isScrolled ? 'text-black' : 'text-white'} hover:opacity-70`}>
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={onOpenAuth}
              className={`${isScrolled ? 'text-black' : 'text-white'} p-2 hover:bg-black/5 rounded-full transition-colors`}
            >
              <UserIcon className="w-5 h-5" />
            </button>
          )}

          <button className="md:hidden" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className={`w-6 h-6 ${isScrolled ? 'text-black' : 'text-white'}`} />
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
    image: "https://placehold.co/800x1000/f3f4f6/9ca3af?text=Bacteriostatic+Water"
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
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-[101] shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" /> Your Cart
              </h2>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6" /></button>
            </div>

            <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  {total >= freeShippingThreshold ? '🎉 You unlocked free shipping!' : `Add $${remaining.toFixed(2)} more for free shipping`}
                </span>
                <span className="text-[10px] font-bold text-emerald-600">{Math.round(progress)}%</span>
              </div>
              <div className="w-full h-2 bg-emerald-200 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-emerald-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                  <ShoppingCart className="w-16 h-16 opacity-20" />
                  <p>Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <div className="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <h3 className="font-bold text-sm">{item.name}</h3>
                          <button onClick={() => onRemove(item.id)} className="text-gray-400 hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-emerald-600 font-bold text-sm mb-3">${item.price}</p>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => onUpdateQuantity(item.id, -1)}
                            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => onUpdateQuantity(item.id, 1)}
                            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {!isRecommendedInCart && (
                    <div className="mt-8 p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Recommended for your research</p>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-lg overflow-hidden border border-gray-100 flex-shrink-0">
                          <img src={recommendedProduct.image} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xs font-bold">{recommendedProduct.name}</h4>
                          <p className="text-xs text-emerald-600 font-bold">${recommendedProduct.price}</p>
                        </div>
                        <button 
                          onClick={() => onAddToCart(recommendedProduct)}
                          className="p-2 bg-black text-white rounded-lg hover:bg-emerald-600 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="p-6 border-t border-gray-100 bg-white space-y-4">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Promo Code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-black outline-none"
                  />
                  <button className="px-4 py-2 bg-gray-100 text-black font-bold text-xs rounded-xl hover:bg-gray-200 transition-colors">
                    Apply
                  </button>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-500 text-sm">Subtotal</span>
                    <span className="text-sm font-bold">${total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mb-6">
                    <span className="text-gray-500 text-sm">Shipping</span>
                    <span className="text-sm font-bold text-emerald-600">
                      {total >= freeShippingThreshold ? 'FREE' : '$15.00'}
                    </span>
                  </div>
                  <div className="flex justify-between mb-6 pt-4 border-t border-gray-100">
                    <span className="text-lg font-bold">Total</span>
                    <span className="text-xl font-bold">${(total + (total >= freeShippingThreshold ? 0 : 15)).toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={onCheckout}
                    className="w-full py-4 bg-black text-white font-bold rounded-2xl hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-black/10"
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
                <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-8">
                  <FlaskConical className="text-white w-8 h-8" />
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
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

    await setDoc(doc(db, 'users', u.uid), {
      email: u.email,
      firstName,
      lastName,
      phone: phone || null,
      displayName: `${firstName} ${lastName}`,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const Hero = ({ onShopNow }: { onShopNow: () => void }) => {
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
            Compromise.
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
            <button className="px-10 py-5 border border-white/20 text-white font-bold rounded-2xl hover:bg-white/10 transition-all">
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

const COAView = () => {
  const coas = [
    { name: "BPC-157 (5mg)", date: "Jan 2026", purity: "99.4%", image: "https://placehold.co/800x450/f3f4f6/9ca3af?text=COA+Report" },
    { name: "TB-500 (2mg)", date: "Feb 2026", purity: "99.2%", image: "https://placehold.co/800x450/f3f4f6/9ca3af?text=COA+Report" },
    { name: "CJC-1295 + Ipamorelin", date: "Dec 2025", purity: "99.1%", image: "https://placehold.co/800x450/f3f4f6/9ca3af?text=COA+Report" },
    { name: "GHK-Cu (50mg)", date: "Jan 2026", purity: "99.8%", image: "https://placehold.co/800x450/f3f4f6/9ca3af?text=COA+Report" },
    { name: "PT-141 (10mg)", date: "Mar 2026", purity: "99.5%", image: "https://placehold.co/800x450/f3f4f6/9ca3af?text=COA+Report" },
    { name: "Melanotan II", date: "Feb 2026", purity: "99.3%", image: "https://placehold.co/800x450/f3f4f6/9ca3af?text=COA+Report" },
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
            <div className="aspect-video relative overflow-hidden">
              <img src={coa.image} alt={coa.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80" />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="bg-white text-black px-6 py-2 rounded-full font-bold text-sm shadow-lg">View PDF Report</button>
              </div>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{coa.name}</h3>
                  <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mt-1">Batch: {coa.date}</p>
                </div>
                <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                  {coa.purity} Purity
                </div>
              </div>
              <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
                <span className="text-xs font-medium text-gray-400">HPLC / MS Analysis</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

const AppContent = () => {
  const [view, setView] = useState<'home' | 'shop' | 'coas'>('home');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState(300);
  const { user } = useAuth();

  const products: Product[] = [
    { id: '1', name: "BPC-157 (5mg)", price: 49.99, category: "Peptides", image: "https://placehold.co/800x1000/f3f4f6/9ca3af?text=Product+Image" },
    { id: '2', name: "TB-500 (2mg)", price: 54.99, category: "Peptides", image: "https://placehold.co/800x1000/f3f4f6/9ca3af?text=Product+Image" },
    { id: '3', name: "CJC-1295 + Ipamorelin", price: 89.99, category: "Blends", image: "https://placehold.co/800x1000/f3f4f6/9ca3af?text=Product+Image" },
    { id: '4', name: "GHK-Cu (50mg)", price: 39.99, category: "Liquid Research", image: "https://placehold.co/800x1000/f3f4f6/9ca3af?text=Product+Image" },
    { id: '5', name: "PT-141 (10mg)", price: 44.99, category: "Peptides", image: "https://placehold.co/800x1000/f3f4f6/9ca3af?text=Product+Image" },
    { id: '6', name: "Melanotan II", price: 34.99, category: "Peptides", image: "https://placehold.co/800x1000/f3f4f6/9ca3af?text=Product+Image" },
    { id: '7', name: "MK-677 (Liquid)", price: 69.99, category: "Liquid Research", image: "https://placehold.co/800x1000/f3f4f6/9ca3af?text=Product+Image" },
    { id: '8', name: "RAD-140 (Liquid)", price: 74.99, category: "Liquid Research", image: "https://placehold.co/800x1000/f3f4f6/9ca3af?text=Product+Image" },
    { id: '9', name: "Tesamorelin (2mg)", price: 64.99, category: "Peptides", image: "https://placehold.co/800x1000/f3f4f6/9ca3af?text=Product+Image" },
    { id: '10', name: "GW-501516 (Liquid)", price: 79.99, category: "Liquid Research", image: "https://placehold.co/800x1000/f3f4f6/9ca3af?text=Product+Image" },
    { id: 'bw-1', name: "Bacteriostatic Water (30ml)", price: 14.99, category: "Supplies", image: "https://placehold.co/800x1000/f3f4f6/9ca3af?text=Bacteriostatic+Water" }
  ];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPrice = p.price <= maxPrice;
    return matchesSearch && matchesPrice;
  });

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleCheckout = async () => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    
    try {
      await addDoc(collection(db, 'orders'), {
        userId: user.uid,
        items: cart,
        total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert('Order placed successfully! (Research Simulation)');
      setCart([]);
      setIsCartOpen(false);
    } catch (error) {
      console.error(error);
      alert('Error placing order.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F9F9] font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <Navbar 
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} 
        onOpenCart={() => setIsCartOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onNavigate={setView}
      />
      
      <main className={view !== 'home' ? 'pt-24' : ''}>
        {view === 'home' ? (
          <Hero onShopNow={() => setView('shop')} />
        ) : view === 'coas' ? (
          <COAView />
        ) : (
          <>
            {/* Shop Header */}
            <section className="bg-white border-b border-gray-100 py-16">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                  <div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-4">Shop All</h1>
                    <p className="text-gray-500 max-w-lg">
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
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all"
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
                          <span className="text-sm font-bold text-black">Up to ${maxPrice}</span>
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
                          className="group flex flex-col"
                        >
                          <div className="aspect-[4/5] overflow-hidden bg-white rounded-2xl border border-gray-100 relative mb-4">
                            <img 
                              src={product.image} 
                              alt={product.name} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                            />
                            <div className="absolute top-4 right-4">
                              <button 
                                onClick={() => addToCart(product)}
                                className="w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center text-black hover:bg-black hover:text-white transition-all active:scale-90"
                              >
                                <Plus className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-col flex-1">
                            <h3 className="font-bold text-gray-900 mb-1 group-hover:text-emerald-600 transition-colors">{product.name}</h3>
                            <p className="text-gray-500 text-xs mb-4">99%+ Purity Guaranteed</p>
                            <div className="mt-auto space-y-4">
                              <p className="text-xl font-bold text-black">${product.price.toFixed(2)}</p>
                              <button 
                                onClick={() => addToCart(product)}
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
          </>
        )}

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
                <div className="w-8 h-8 bg-black rounded flex items-center justify-center">
                  <FlaskConical className="text-white w-5 h-5" />
                </div>
                <span className="text-lg font-bold tracking-tight">RESEARCH PEPTIDES</span>
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
            <p className="text-xs text-gray-400">© 2026 Research Peptides. All rights reserved.</p>
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
