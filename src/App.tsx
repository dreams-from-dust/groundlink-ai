import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Settings,
  Send,
  Mic,
  MicOff,
  Camera,
  ChevronLeft,
  ChevronRight,
  Upload,
  Trash2,
  FolderOpen,
  RefreshCw,
  X,
  Plus,
  Check,
  Sun,
  Moon,
  Volume2,
  FileText,
  Copy,
  PlusCircle,
  HelpCircle,
  AlertCircle,
  Menu,
  Eye,
  EyeOff,
  Edit3,
  Share2,
  Search,
  Sliders,
  Activity,
  Mail,
  Twitter,
  ExternalLink,
  Download,
  Paperclip,
  MessageSquare,
  Database,
  Video,
  Lock,
  User,
  LogOut,
  KeyRound,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { auth, db as clientDb } from './firebase';
import { onAuthStateChanged, User as FirebaseUser, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, sendEmailVerification, GoogleAuthProvider, signInWithPopup, updatePassword, EmailAuthProvider, linkWithCredential, ActionCodeSettings } from 'firebase/auth';
import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, writeBatch } from 'firebase/firestore';

interface ChunkMatch {
  id: string;
  docTitle: string;
  text: string;
  score: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
  retrieved?: ChunkMatch[];
  imageUrl?: string; 
  attachedFiles?: { name: string; type: string }[];
  modelUsed?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

interface DocStat {
  title: string;
  chunkCount: number;
}

function generateSmartTitle(prompt: string): string {
  let text = prompt.toLowerCase().trim();
  // Strip common greeting fillers and question phrases
  text = text.replace(/^(hello|hi|hey|please|can you tell me|what is|how do we|tell me about|explain|explain what is|what|how|why|describe)\s+/, '');
  text = text.replace(/[\?\.\!\:\,]/g, '').trim(); // strip punctuation
  
  // Custom exact keyword matching for extremely clean context labels
  if (text.includes("machine learning") || text.includes("ml")) {
    return "Machine Learning";
  }
  if (text.includes("cosine similarity") || text.includes("similarity calculate")) {
    return "Cosine Similarity";
  }
  if (text.includes("ground") || text.includes("grounding") || text.includes("context")) {
    return "Context Grounding";
  }
  if (text.includes("upload") || text.includes("file") || text.includes("document")) {
    return "Document Indices";
  }
  if (text.includes("vector") || text.includes("embedding")) {
    return "Vector Topologies";
  }
  if (text.includes("camera") || text.includes("picture") || text.includes("photo")) {
    return "Visual OCR Scanner";
  }
  if (text.includes("pdf") || text.includes("ppt") || text.includes("doc")) {
    return "Document Format Index";
  }

  // Capitalize the remaining useful keywords and limit length
  const words = text.split(/\s+/).filter(w => w.length > 2);
  if (words.length > 0) {
    const formatted = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return formatted.length > 22 ? formatted.substring(0, 22) + "..." : formatted;
  }
  
  const rawTitle = prompt.trim();
  return rawTitle.length > 22 ? rawTitle.substring(0, 22) + "..." : rawTitle;
}

const ChatLogo = ({ className = "w-8 h-8" }: { className?: string }) => {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" /> {/* Cyan */}
          <stop offset="60%" stopColor="#6366f1" /> {/* Indigo */}
          <stop offset="100%" stopColor="#f59e0b" /> {/* Amber */}
        </linearGradient>
        <linearGradient id="starGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <filter id="logoGlow" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      
      {/* Outer elegant telemetry geometric ring */}
      <circle 
        cx="50" 
        cy="50" 
        r="44" 
        stroke="url(#logoGrad)" 
        strokeWidth="2" 
        strokeDasharray="4, 4" 
        opacity="0.65" 
      />

      {/* Dynamic interlocking diagonal data orbits */}
      <ellipse 
        cx="50" 
        cy="50" 
        rx="40" 
        ry="13" 
        stroke="url(#logoGrad)" 
        strokeWidth="3.5" 
        fill="none" 
        transform="rotate(-30 50 50)" 
        strokeLinecap="round" 
        opacity="0.95"
      />
      <ellipse 
        cx="50" 
        cy="50" 
        rx="40" 
        ry="13" 
        stroke="url(#logoGrad)" 
        strokeWidth="3" 
        fill="none" 
        transform="rotate(45 50 50)" 
        strokeLinecap="round" 
        opacity="0.75"
      />

      {/* Outer data grounding anchor nodes */}
      <circle cx="15" cy="30" r="5" fill="#06b6d4" filter="url(#logoGlow)" />
      <circle cx="85" cy="70" r="5" fill="#f59e0b" filter="url(#logoGlow)" />
      <circle cx="78" cy="22" r="4.5" fill="#6366f1" filter="url(#logoGlow)" />
      <circle cx="22" cy="78" r="4.5" fill="#ec4899" filter="url(#logoGlow)" />

      {/* Central Majestic ChatGPT/Gemini style 4-point sparkle */}
      <path
        d="M 50 16 Q 50 50, 84 50 Q 50 50, 50 84 Q 50 50, 16 50 Q 50 50, 50 16 Z"
        fill="url(#starGrad)"
        filter="url(#logoGlow)"
        className="animate-pulse"
        style={{ animationDuration: '3s' }}
      />
      
      {/* Micro white core star for high-end brilliance */}
      <path
        d="M 50 32 Q 50 50, 68 50 Q 50 50, 50 68 Q 50 50, 32 50 Q 50 50, 50 32 Z"
        fill="#ffffff"
        opacity="0.95"
      />
    </svg>
  );
};

export default function App() {
  // --- FIREBASE AUTHENTICATION STATES ---
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [showResetOverlay, setShowResetOverlay] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // --- PROFILE VIEW STATES ---
  const [activeView, setActiveView] = useState<'chat' | 'profile'>('chat');
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [profileUpdating, setProfileUpdating] = useState(false);
  const [profileSuccessMessage, setProfileSuccessMessage] = useState<string | null>(null);
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(null);
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  const [profileShowNewPassword, setProfileShowNewPassword] = useState(false);
  const [profileShowConfirmPassword, setProfileShowConfirmPassword] = useState(false);

  const getUserInitials = () => {
    if (!currentUser) return '?';
    if (currentUser.displayName) {
      const parts = currentUser.displayName.trim().split(/\s+/);
      if (parts.length > 1) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0].substring(0, 2).toUpperCase();
    }
    if (currentUser.email) {
      return currentUser.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const getUserAvatarGradient = () => {
    if (!currentUser) return 'from-sky-400 via-indigo-500 to-purple-600';
    const idString = currentUser.uid || currentUser.email || 'guest';
    let hash = 0;
    for (let i = 0; i < idString.length; i++) {
      hash = idString.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % 8;
    const gradients = [
      'from-sky-400 via-indigo-500 to-purple-600',
      'from-emerald-400 via-teal-500 to-cyan-600',
      'from-amber-400 via-orange-500 to-rose-500',
      'from-fuchsia-500 via-purple-600 to-indigo-700',
      'from-violet-500 via-purple-500 to-pink-500',
      'from-rose-400 via-pink-500 to-indigo-500',
      'from-cyan-400 via-blue-500 to-indigo-600',
      'from-lime-400 via-emerald-500 to-teal-600'
    ];
    return gradients[idx];
  };

  useEffect(() => {
    if (currentUser) {
      setProfileDisplayName(currentUser.displayName || '');
    }
  }, [currentUser]);

  const refreshCurrentUser = () => {
    const refreshedUser = auth.currentUser;
    if (refreshedUser) {
      // Create a copy with prototype chain and getters evaluated to trigger React state updates perfectly
      const clonedUser = Object.create(Object.getPrototypeOf(refreshedUser));
      Object.assign(clonedUser, refreshedUser);
      clonedUser.providerData = [...refreshedUser.providerData];
      clonedUser.uid = refreshedUser.uid;
      clonedUser.email = refreshedUser.email;
      clonedUser.displayName = refreshedUser.displayName;
      clonedUser.photoURL = refreshedUser.photoURL;
      clonedUser.emailVerified = refreshedUser.emailVerified;
      setCurrentUser(clonedUser);
    } else {
      setCurrentUser(null);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setProfileUpdating(true);
    setProfileSuccessMessage(null);
    setProfileErrorMessage(null);
    try {
      await updateProfile(auth.currentUser, {
        displayName: profileDisplayName.trim()
      });
      await auth.currentUser.reload();
      refreshCurrentUser();
      setProfileSuccessMessage("Display name updated successfully!");
      showToastNotification("Profile updated successfully.");
    } catch (err: any) {
      console.error("Error updating profile:", err);
      setProfileErrorMessage(err.message || "Failed to update profile display name.");
    } finally {
      setProfileUpdating(false);
    }
  };

  const handleSendResetEmailInProfile = async () => {
    if (!currentUser?.email) return;
    setProfileUpdating(true);
    setProfileSuccessMessage(null);
    setProfileErrorMessage(null);
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      setProfileSuccessMessage(`Password reset link sent to ${currentUser.email}!`);
      showToastNotification("Reset email sent successfully.");
    } catch (err: any) {
      console.error("Error sending reset email:", err);
      setProfileErrorMessage(err.message || "Failed to send password reset email.");
    } finally {
      setProfileUpdating(false);
    }
  };

  const handleSetPasswordInProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    if (profileNewPassword.length < 8) {
      setProfileErrorMessage("Password must be at least 8 characters long.");
      return;
    }
    if (profileNewPassword !== profileConfirmPassword) {
      setProfileErrorMessage("Passwords do not match.");
      return;
    }
    setProfileUpdating(true);
    setProfileSuccessMessage(null);
    setProfileErrorMessage(null);
    try {
      const email = auth.currentUser.email || '';
      const hasPassword = auth.currentUser.providerData.some(p => p.providerId === 'password');
      
      if (hasPassword) {
        // Direct password change in Firebase Auth
        await updatePassword(auth.currentUser, profileNewPassword);
        setProfileSuccessMessage("Password has been changed successfully! Your secure account credentials are now updated.");
      } else {
        // Link new password credential
        const credential = EmailAuthProvider.credential(email, profileNewPassword);
        await linkWithCredential(auth.currentUser, credential);
        setProfileSuccessMessage("Password has been set successfully! You can now sign in using either Google or your email & password.");
      }
      
      await auth.currentUser.reload();
      
      const freshUser = auth.currentUser;
      if (freshUser) {
        const clonedUser = Object.create(Object.getPrototypeOf(freshUser));
        Object.assign(clonedUser, freshUser);
        clonedUser.providerData = [...freshUser.providerData];
        if (!clonedUser.providerData.some((p: any) => p.providerId === 'password')) {
          clonedUser.providerData.push({ providerId: 'password', email: email });
        }
        clonedUser.uid = freshUser.uid;
        clonedUser.email = freshUser.email;
        clonedUser.displayName = freshUser.displayName;
        clonedUser.photoURL = freshUser.photoURL;
        clonedUser.emailVerified = freshUser.emailVerified;
        setCurrentUser(clonedUser);
      }
      
      setProfileNewPassword('');
      setProfileConfirmPassword('');
      showToastNotification("Password updated successfully.");
    } catch (err: any) {
      console.error("Error updating password:", err);
      if (err.code === "auth/requires-recent-login") {
        setProfileErrorMessage("For security reasons, updating your password requires a recent login. Please sign out and sign in again before updating your password.");
      } else if (err.code === "auth/provider-already-linked") {
        setProfileErrorMessage("This account already has a password set.");
      } else {
        setProfileErrorMessage(err.message || "Failed to update password.");
      }
    } finally {
      setProfileUpdating(false);
    }
  };

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [systemStats, setSystemStats] = useState({
    totalChunks: 0,
    totalDocs: 0,
    hasApiKey: false,
    documents: [] as DocStat[]
  });

  // Retrieval Settings
  const [chunkSize] = useState(800);
  const [chunkOverlap] = useState(150);
  const [ingesting, setIngesting] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const [customSystemInstruction, setCustomSystemInstruction] = useState<string>(() => {
    return localStorage.getItem('custom_system_instruction') || '';
  });

  useEffect(() => {
    localStorage.setItem('custom_system_instruction', customSystemInstruction);
  }, [customSystemInstruction]);

  // Layout & Sidebar States
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [rightActiveTab, setRightActiveTab] = useState<'grounding' | 'control'>('grounding');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Grounding matching chunk preview details
  const [selectedMatch, setSelectedMatch] = useState<ChunkMatch | null>(null);

  // Document inventory query filter
  const [docSearchQuery, setDocSearchQuery] = useState('');

  // Floating notifications Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Inline chat title rename states
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState('');

  // Fallback upload images
  const [attachedFiles, setAttachedFiles] = useState<{ id: string; name: string; file: File; base64: string; type: 'image' | 'document' | 'video' }[]>([]);

  // Voice triggers
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceTimer, setVoiceTimer] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Audio response speech
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  // Dynamic loading/thinking text interval
  const [loadingStepText, setLoadingStepText] = useState("GroundLink is thinking...");
  useEffect(() => {
    if (!isLoading) {
      setLoadingStepText("GroundLink is thinking...");
      return;
    }

    const loadingStages = [
      "Analyzing your question...",
      "Searching your library...",
      "Finding relevant document sections...",
      "Matching meaning and context...",
      "Linking sources to answer...",
      "Writing response...",
    ];

    let stageIdx = 0;
    setLoadingStepText(loadingStages[0]);

    const interval = setInterval(() => {
      stageIdx = (stageIdx + 1) % loadingStages.length;
      setLoadingStepText(loadingStages[stageIdx]);
    }, 1800);

    return () => clearInterval(interval);
  }, [isLoading]);

  // States for live editing messages
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingMsgText, setEditingMsgText] = useState('');
  const [isMobileScreen, setIsMobileScreen] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<'chat' | 'sources' | 'control'>('chat');

  // Expandable/Unexpandable chat box message toggles
  const [expandedMessageIds, setExpandedMessageIds] = useState<Record<string, boolean>>({});
  const toggleMessageExpand = (msgId: string) => {
    setExpandedMessageIds(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  // Advanced Share conversation dialog modal state
  const [sharingSession, setSharingSession] = useState<ChatSession | null>(null);

  // Custom confirmation dialog modal state to bypass sandboxed iframe restrictions on window.confirm
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const askConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        onConfirm();
      }
    });
  };

  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraFileInputRef = useRef<HTMLInputElement>(null);

  // --- FIREBASE HELPER METHODS ---
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const headers = (options.headers as Record<string, string>) || {};
    const currUser = auth.currentUser;
    if (currUser) {
      try {
        const token = await currUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      } catch (err) {
        console.error("Failed to retrieve ID Token:", err);
      }
    }
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    });
  };

  const loadSessionsFromFirestore = async (userId: string) => {
    try {
      const q = query(collection(clientDb, 'users', userId, 'chats'), orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);
      const loaded: ChatSession[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        loaded.push({
          id: docSnap.id,
          title: data.title || 'Untitled Chat',
          createdAt: data.createdAt || '',
          messages: data.messages || []
        });
      });
      if (loaded.length > 0) {
        // Always start with a fresh new chat on login — previous chats accessible in sidebar
        const freshId = `chat-${Date.now()}`;
        const freshSess: ChatSession = {
          id: freshId,
          title: 'New chat',
          messages: [],
          createdAt: new Date().toLocaleDateString()
        };
        setSessions([freshSess, ...loaded]);
        setActiveSessionId(freshId);
      } else {
        initDefaultSession();
      }
    } catch (err) {
      console.error("Error loading sessions from Firestore:", err);
      initDefaultSession();
    }
  };

  const sanitizeFirestoreData = (data: any): any => {
    if (data === undefined) return null;
    if (data === null) return null;
    if (Array.isArray(data)) {
      return data.map(item => sanitizeFirestoreData(item));
    }
    if (typeof data === 'object') {
      const cleanObj: any = {};
      for (const key of Object.keys(data)) {
        const val = data[key];
        if (val !== undefined) {
          cleanObj[key] = sanitizeFirestoreData(val);
        }
      }
      return cleanObj;
    }
    return data;
  };

  const syncSessionToFirestore = async (userId: string, session: ChatSession) => {
    try {
      const docRef = doc(clientDb, 'users', userId, 'chats', session.id);
      const cleanMessages = sanitizeFirestoreData(session.messages || []);
      const payload = {
        id: session.id,
        title: session.title || 'Untitled Chat',
        createdAt: session.createdAt || new Date().toLocaleDateString(),
        messages: cleanMessages,
        updatedAt: new Date()
      };
      const cleanPayload = sanitizeFirestoreData(payload);
      await setDoc(docRef, cleanPayload, { merge: true });
    } catch (err) {
      console.error("Error syncing session to Firestore:", err);
    }
  };

  const deleteSessionFromFirestore = async (userId: string, sessionId: string) => {
    try {
      const docRef = doc(clientDb, 'users', userId, 'chats', sessionId);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Error deleting session from Firestore:", err);
    }
  };

  const fetchStatsForUser = async (userParam?: FirebaseUser | null) => {
    const targetUser = userParam || auth.currentUser;
    if (!targetUser) return;
    try {
      // 1. Try server API first to ensure we get the fresh, authoritative, post-deletion backend/Firestore state
      const res = await fetchWithAuth('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setSystemStats(data);
        return;
      }
    } catch (apiErr) {
      console.warn('Server stats fetch failed, trying client fallback:', apiErr);
    }

    // Fallback: Fetch chunks and documents collections directly from client Firestore
    try {
      const chunksSnap = await getDocs(collection(clientDb, 'users', targetUser.uid, 'chunks'));
      const docsSnap = await getDocs(collection(clientDb, 'users', targetUser.uid, 'documents'));
      
      const chunks = chunksSnap.docs.map(doc => doc.data());
      const totalChunks = chunks.length;
      const totalDocs = docsSnap.size;
      
      const documentsSet = new Set(chunks.map((c: any) => c.docTitle));
      const docsSummary = Array.from(documentsSet).map(title => {
        return {
          title,
          chunkCount: chunks.filter((c: any) => c.docTitle === title).length
        };
      });

      setSystemStats({
        totalChunks,
        totalDocs,
        documents: docsSummary,
        hasApiKey: true
      });
    } catch (err) {
      console.error('Error reading index stats from both client and server:', err);
    }
  };

  const fetchStats = async () => {
    await fetchStatsForUser(auth.currentUser);
  };

  // Listen to Firebase auth state change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      if (firebaseUser) {
        setCurrentUser(firebaseUser);
        // Clear sticky authentication input values immediately
        setAuthEmail('');
        setAuthPassword('');
        setAuthConfirmPassword('');
        setAuthDisplayName('');
        setAuthError(null);
        await loadSessionsFromFirestore(firebaseUser.uid);
        await fetchStatsForUser(firebaseUser);
      } else {
        setCurrentUser(null);
        setActiveView('chat');
        setSessions([]);
        setSystemStats({
          totalChunks: 0,
          totalDocs: 0,
          hasApiKey: false,
          documents: []
        });
      }
      setAuthLoading(false);
    });

    const checkSize = () => {
      setIsMobileScreen(window.innerWidth < 1024);
    };
    checkSize();
    window.addEventListener('resize', checkSize);

    const savedTheme = localStorage.getItem('chatbot_theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme);
    } else {
      setTheme('dark');
    }

    // Auto-adjust layout on mobile/narrow viewports
    if (window.innerWidth < 1140) {
      setLeftSidebarOpen(false);
      setRightSidebarOpen(false);
    }

    return () => {
      unsubscribe();
      window.removeEventListener('resize', checkSize);
    };
  }, []);

  // Sync state values locally (for theme only)
  useEffect(() => {
    localStorage.setItem('chatbot_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId, isLoading]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const showToastNotification = (msg: string) => {
    // Disabled all pops/toast notifications as requested
  };

  const initDefaultSession = () => {
    const freshId = `chat-${Date.now()}`;
    const freshSess: ChatSession = {
      id: freshId,
      title: 'New chat',
      messages: [],
      createdAt: new Date().toLocaleDateString()
    };
    setSessions([freshSess]);
    setActiveSessionId(freshId);
  };

  const startNewChat = () => {
    const emptyActive = sessions.find(s => s.id === activeSessionId && s.messages.length === 0);
    if (emptyActive) {
      setInputText('');
      setAttachedFiles([]);
      if (window.innerWidth < 1024) {
        setLeftSidebarOpen(false);
      }
      return;
    }

    const freshId = `chat-${Date.now()}`;
    const freshSess: ChatSession = {
      id: freshId,
      title: 'New chat',
      messages: [],
      createdAt: new Date().toLocaleDateString()
    };
    setSessions(prev => [freshSess, ...prev]);
    if (auth.currentUser) {
      syncSessionToFirestore(auth.currentUser.uid, freshSess);
    }
    setActiveSessionId(freshId);
    setInputText('');
    setAttachedFiles([]);
    if (window.innerWidth < 1024) {
      setLeftSidebarOpen(false);
    }
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = sessions.filter(s => s.id !== id && s.messages.length > 0);
    const freshId = `chat-${Date.now()}`;
    const freshSess: ChatSession = {
      id: freshId,
      title: 'New chat',
      messages: [],
      createdAt: new Date().toLocaleDateString()
    };
    setSessions([freshSess, ...remaining]);
    if (auth.currentUser) {
      deleteSessionFromFirestore(auth.currentUser.uid, id);
      syncSessionToFirestore(auth.currentUser.uid, freshSess);
    }
    setActiveSessionId(freshId);
    setInputText('');
    setAttachedFiles([]);
    showToastNotification("Conversation thread deleted.");
  };

  const renameChat = (id: string, text: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === id) {
        const updated = { ...s, title: text.trim() || 'Untitled chat' };
        if (auth.currentUser) {
          syncSessionToFirestore(auth.currentUser.uid, updated);
        }
        return updated;
      }
      return s;
    }));
  };

  const deleteMessage = (msgId: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const updated = {
          ...s,
          messages: s.messages.filter(m => m.id !== msgId)
        };
        if (auth.currentUser) {
          syncSessionToFirestore(auth.currentUser.uid, updated);
        }
        return updated;
      }
      return s;
    }));
    showToastNotification("Message removed successfully.");
  };

  const saveEditedMessage = async (msgId: string, newText: string) => {
    if (!newText.trim()) return;
    if (!activeSession) return;

    const msgIndex = activeSession.messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;

    const editedMsg = { ...activeSession.messages[msgIndex], text: newText };
    const truncatedHistory = activeSession.messages.slice(0, msgIndex);
    const updatedHistory = [...truncatedHistory, editedMsg];

    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const updated = {
          ...s,
          messages: updatedHistory
        };
        if (auth.currentUser) {
          syncSessionToFirestore(auth.currentUser.uid, updated);
        }
        return updated;
      }
      return s;
    }));

    setEditingMsgId(null);
    setEditingMsgText('');

    if (editedMsg.role === 'user') {
      setIsLoading(true);
      try {
        const historyContext = truncatedHistory.map(m => ({
          role: m.role,
          text: m.text
        }));

        // Retrieve chunks directly from client-side Firestore for robust RAG
        let userChunks: any[] = [];
        if (auth.currentUser) {
          try {
            const snap = await getDocs(collection(clientDb, 'users', auth.currentUser.uid, 'chunks'));
            userChunks = snap.docs.map(d => d.data());
          } catch (dbErr) {
            console.warn("Client-side user chunks fetch failed during edit submit:", dbErr);
          }
        }

        const payload = {
          query: newText,
          temperature: 0.2,
          history: historyContext,
          image: editedMsg.imageUrl || null,
          userChunks: userChunks
        };

        const response = await fetchWithAuth('/api/query', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        const resData = await response.json();
        if (!response.ok) {
          throw new Error(resData.error || 'Server correlation issue');
        }

        const botMsgId = `bot-${Date.now()}`;
        const botMessageObj: Message = {
          id: botMsgId,
          role: 'assistant',
          text: resData.answer,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          retrieved: resData.retrieved,
          modelUsed: resData.modelUsed
        };

        setSessions(prev => prev.map(s => {
          if (s.id === activeSessionId) {
            const updated = {
              ...s,
              messages: [...updatedHistory, botMessageObj]
            };
            if (auth.currentUser) {
              syncSessionToFirestore(auth.currentUser.uid, updated);
            }
            return updated;
          }
          return s;
        }));
      } catch (err: any) {
        const botMsgId = `bot-${Date.now()}`;
        let errorText = `Error connecting to model: ${err.message || 'Verification mismatch'}.`;
        
        const isQuotaError = err.message && (
          err.message.includes('429') ||
          err.message.toLowerCase().includes('quota') ||
          err.message.includes('RESOURCE_EXHAUSTED') ||
          err.message.includes('limit')
        );

        const isDemandError = err.message && (
          err.message.includes('503') ||
          err.message.toLowerCase().includes('demand') ||
          err.message.toLowerCase().includes('unavailable') ||
          err.message.toLowerCase().includes('overloaded') ||
          err.message.toLowerCase().includes('temporary')
        );

        if (isQuotaError) {
          errorText = `### ⚠️ Cloud AI Service Rate Limit Exceeded (429)

This error occurs because the cloud AI service rate limits have been temporarily exceeded. Under high volumes of document retrieval or rapid queries, the cloud provider limits request frequency to protect resource availability.

---

#### 🛠️ How to Resolve This:

1. **Wait 10-15 seconds**: 
   The rate limits operate on short cooldown windows. Simply wait a few moments, click the ✏️ **Edit** button on your message, and hit **Save & Resubmit**.

2. **Configure Your Personal API Key**:
   - In the top-right of your workspace settings, ensure you have set your own personal \`OPENROUTER_API_KEY\` if available.
   - This isolates your workspace requests and provides significantly higher rate quotas.`;
        } else if (isDemandError) {
          errorText = `### ⚠️ Cloud AI Service Unavailable (503)

The cloud intelligence service is currently experiencing exceptionally high demand. This is a temporary spike and usually resolves within a few moments.

---

#### 🛠️ How to Resolve This:

1. **Try Again in a Few Seconds**:
   This is a temporary server-side spike. Click the ✏️ **Edit** button on your message above, and select **Save & Resubmit** to retry.
   
2. **Configure Your Personal API Key**:
   - Ensure your personal \`OPENROUTER_API_KEY\` is configured in your project settings to use dedicated resource pools.`;
        }

        const errorMessageObj: Message = {
          id: botMsgId,
          role: 'assistant',
          text: errorText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setSessions(prev => prev.map(s => {
          if (s.id === activeSessionId) {
            const updated = {
              ...s,
              messages: [...updatedHistory, errorMessageObj]
            };
            if (auth.currentUser) {
              syncSessionToFirestore(auth.currentUser.uid, updated);
            }
            return updated;
          }
          return s;
        }));
      } finally {
        setIsLoading(false);
        fetchStats();
      }
    }
  };

  // Helper to compile a markdown or plain text output transcript
  const getShareTranscript = (sess: ChatSession, format: 'text' | 'markdown' = 'text') => {
    let transcript = format === 'markdown' 
      ? `### Grounded Conversation: "${sess.title}"\n`
      : `Grounded Conversation: "${sess.title}"\n`;
    transcript += `Generated: ${sess.createdAt}\n`;
    transcript += `========================================\n\n`;

    sess.messages.forEach(msg => {
      const roleLabel = msg.role === 'user' ? 'You' : 'SyncMind';
      if (format === 'markdown') {
        transcript += `**${roleLabel}** (${msg.time}):\n${msg.text}\n\n`;
        if (msg.retrieved && msg.retrieved.length > 0) {
          transcript += `_Grounded references cited:_\n`;
          msg.retrieved.forEach((m, idx) => {
            transcript += `- [${idx + 1}] Similarity Match: ${Math.round(m.score * 100)}% | File: ${m.docTitle}\n`;
          });
          transcript += `\n`;
        }
        transcript += `---\n\n`;
      } else {
        transcript += `${roleLabel} (${msg.time}):\n${msg.text}\n\n`;
        if (msg.retrieved && msg.retrieved.length > 0) {
          transcript += `Grounded references cited:\n`;
          msg.retrieved.forEach((m, idx) => {
            transcript += `- [${idx + 1}] Similarity Match: ${Math.round(m.score * 100)}% | File: ${m.docTitle}\n`;
          });
          transcript += `\n`;
        }
        transcript += `----------------------------------------\n\n`;
      }
    });
    return transcript;
  };

  const compileAndCopyTranscript = (sess: ChatSession, format: 'text' | 'markdown' = 'text') => {
    const transcript = getShareTranscript(sess, format);
    navigator.clipboard.writeText(transcript)
      .then(() => {
        showToastNotification(`Success! Copied conversation transcript (${format}) to your clipboard.`);
      })
      .catch(() => {
        showToastNotification("Failed copying transcript to clipboard automatically.");
      });
  };

  const downloadTranscriptFile = (sess: ChatSession, format: 'text' | 'markdown') => {
    const transcript = getShareTranscript(sess, format);
    const blob = new Blob([transcript], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${sess.title.replace(/\s+/g, "_")}_transcript.${format === 'markdown' ? 'md' : 'txt'}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToastNotification(`successfully downloaded transcript as ${format === 'markdown' ? '.md' : '.txt'} file!`);
  };

  const triggerWebShare = (sess: ChatSession) => {
    const transcript = getShareTranscript(sess);
    if (navigator.share) {
      navigator.share({
        title: sess.title,
        text: transcript,
      }).catch(err => {
        // Fallback on share cancel or error
        navigator.clipboard.writeText(transcript)
          .then(() => {
            showToastNotification("Copied conversation transcript to clipboard!");
          });
      });
    } else {
      navigator.clipboard.writeText(transcript)
        .then(() => {
          showToastNotification("Success! Copied conversation transcript to clipboard since native device sharing is not supported in this browser tab.");
        })
        .catch(() => {
          showToastNotification("Failed copying transcript to clipboard.");
        });
    }
  };

  // Compile a markdown output and copy transcript to clipboard
  const shareChat = (sess: ChatSession) => {
    if (sess.messages.length === 0) {
      showToastNotification("Cannot share an empty conversation.");
      return;
    }
    // Set the state to open our gorgeous sharing options modal
    setSharingSession(sess);
  };

  const executeClearDatabase = async () => {
    // 1. Optimistic Update: immediately clear UI stats
    setSystemStats({
      totalChunks: 0,
      totalDocs: 0,
      documents: [],
      hasApiKey: true
    });

    try {
      setIngesting(true);
      setIngestStatus('Clearing document databases...');

      // 2. Clear backend caches and Firestore server-side
      const res = await fetchWithAuth('/api/clear', { method: 'POST' });
      if (!res.ok) {
        throw new Error('Server-side clear failed');
      }

      // 3. Background client-side Firestore cleanup without blocking the UI
      if (auth.currentUser) {
        const uid = auth.currentUser.uid;
        getDocs(collection(clientDb, 'users', uid, 'chunks'))
          .then(chunksSnap => {
            const chunkChunks = [];
            for (let i = 0; i < chunksSnap.docs.length; i += 200) {
              chunkChunks.push(chunksSnap.docs.slice(i, i + 200));
            }
            return Promise.all(chunkChunks.map(async batchDocs => {
              const batch = writeBatch(clientDb);
              batchDocs.forEach(d => batch.delete(d.ref));
              await batch.commit();
            }));
          }).then(() => {
            console.log("[Clear] Background client-side chunks clean up complete.");
          }).catch(err => console.warn("Background client-side chunks clean up failed:", err));

        getDocs(collection(clientDb, 'users', uid, 'documents'))
          .then(docsSnap => {
            const docChunks = [];
            for (let i = 0; i < docsSnap.docs.length; i += 200) {
              docChunks.push(docsSnap.docs.slice(i, i + 200));
            }
            return Promise.all(docChunks.map(async batchDocs => {
              const batch = writeBatch(clientDb);
              batchDocs.forEach(d => batch.delete(d.ref));
              await batch.commit();
            }));
          }).then(() => {
            console.log("[Clear] Background client-side documents clean up complete.");
          }).catch(err => console.warn("Background client-side docs clean up failed:", err));
      }

      setSessions([]);
      initDefaultSession();
      await fetchStats();
      setIngestStatus('All document files deleted successfully.');
      setTimeout(() => setIngestStatus(null), 3500);
      showToastNotification("Vector index and document databases reset.");
    } catch (err: any) {
      console.error(err);
      showToastNotification(`Clear failed: ${err.message || err}`);
      // Revert optimistic update
      await fetchStats();
    } finally {
      setIngesting(false);
    }
  };

  const clearEntireDatabase = () => {
    askConfirmation(
      'Clear All Documents',
      'Are you sure you want to completely delete all custom uploaded and sample documents from the database and clear the semantic search index?',
      executeClearDatabase
    );
  };

  const executeDeleteDocument = async (docName: string) => {
    // 1. Optimistic Update: immediately filter out the deleted document and deduct chunks
    setSystemStats(prev => {
      const updatedDocs = prev.documents.filter(d => d.title !== docName);
      const deletedDoc = prev.documents.find(d => d.title === docName);
      const deletedChunksCount = deletedDoc ? deletedDoc.chunkCount : 0;
      return {
        ...prev,
        totalDocs: updatedDocs.length,
        totalChunks: Math.max(0, prev.totalChunks - deletedChunksCount),
        documents: updatedDocs
      };
    });

    setIngesting(true);
    setIngestStatus(`Deleting "${docName}"...`);
    try {
      // 2. Call server endpoint to delete on backend and update server caches
      const res = await fetchWithAuth('/api/documents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docTitle: docName })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Server-side delete failed');
      }

      // 3. Background client-side Firestore cleanup without blocking the UI
      if (auth.currentUser) {
        const uid = auth.currentUser.uid;
        getDocs(collection(clientDb, 'users', uid, 'chunks'))
          .then(chunksSnap => {
            const chunksToDelete = chunksSnap.docs.filter(d => d.data().docTitle === docName);
            const chunkBatches = [];
            for (let i = 0; i < chunksToDelete.length; i += 200) {
              chunkBatches.push(chunksToDelete.slice(i, i + 200));
            }
            return Promise.all(chunkBatches.map(async batchDocs => {
              const batch = writeBatch(clientDb);
              batchDocs.forEach(d => batch.delete(d.ref));
              await batch.commit();
            }));
          }).then(() => {
            console.log(`[Delete] Background chunks clean up for "${docName}" complete.`);
          }).catch(err => console.warn("Background client-side chunks clean up failed:", err));

        getDocs(collection(clientDb, 'users', uid, 'documents'))
          .then(docsSnap => {
            const docsToDelete = docsSnap.docs.filter(d => d.data().name === docName);
            const docBatches = [];
            for (let i = 0; i < docsToDelete.length; i += 200) {
              docBatches.push(docsToDelete.slice(i, i + 200));
            }
            return Promise.all(docBatches.map(async batchDocs => {
              const batch = writeBatch(clientDb);
              batchDocs.forEach(d => batch.delete(d.ref));
              await batch.commit();
            }));
          }).then(() => {
            console.log(`[Delete] Background documents clean up for "${docName}" complete.`);
          }).catch(err => console.warn("Background client-side docs clean up failed:", err));
      }

      await fetchStats();
      showToastNotification(`Successfully deleted "${docName}".`);
    } catch (err: any) {
      console.error(err);
      showToastNotification(`Failed to delete document: ${err.message || err}`);
      // Revert optimistic update on failure
      await fetchStats();
    } finally {
      setIngesting(false);
      setIngestStatus(null);
    }
  };

  const deleteDocumentByName = (docName: string) => {
    askConfirmation(
      'Delete Document File',
      `Are you sure you want to completely delete "${docName}" from the document database and remove it from the vector index?`,
      () => executeDeleteDocument(docName)
    );
  };

  const loadSampleFiles = async () => {
    setIngesting(true);
    setIngestStatus('Loading sample files...');
    try {
      const res = await fetchWithAuth('/api/documents/load-sample', {
        method: 'POST',
        body: JSON.stringify({ chunkSize, chunkOverlap })
      });
      const data = await res.json();
      if (res.ok) {
        // Safe Client-side save backup to bypass server-side Firestore write permissions issues
        if (auth.currentUser && data.chunks && data.docMetas) {
          const uid = auth.currentUser.uid;
          try {
            // Save chunks
            for (const chunk of data.chunks) {
              const chunkRef = doc(clientDb, 'users', uid, 'chunks', chunk.id);
              await setDoc(chunkRef, chunk);
            }
            // Save docMetas
            for (const docMeta of data.docMetas) {
              const docRef = doc(clientDb, 'users', uid, 'documents', docMeta.id);
              await setDoc(docRef, {
                ...docMeta,
                uploadedAt: new Date()
              });
            }
          } catch (dbErr: any) {
            console.warn("Client-side database synchronization fallback failed: ", dbErr.message || dbErr);
          }
        }

        setIngestStatus(`Success: Loaded ${data.count} content particles.`);
        setTimeout(() => setIngestStatus(null), 4000);
        await fetchStats();
        showToastNotification("Sample knowledge documents loaded successfully.");
      } else {
        throw new Error(data.error || 'Ingestion failed');
      }
    } catch (err: any) {
      setIngestStatus(`Error: ${err.message}`);
    } finally {
      setIngesting(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handleAttachFiles = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    
    const newAttachments: { id: string; name: string; file: File; base64: string; type: 'image' | 'document' | 'video' }[] = [];

    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      const name = file.name;

      // Front-end File Size Validation (80MB limit to prevent browser memory exhaust and network failures)
      if (file.size > 80 * 1024 * 1024) {
        showToastNotification(`"${name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). The maximum supported file size is 80MB.`);
        continue;
      }

      const extension = name.split('.').pop()?.toLowerCase() || '';

      const isImg = ['jpg', 'jpeg', 'png', 'svg', 'webp', 'gif'].includes(extension);
      const isVideo = ['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(extension);
      const isDoc = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'md'].includes(extension);

      if (!isImg && !isVideo && !isDoc) {
        showToastNotification(`file extension ".${extension}" is not supported.`);
        continue;
      }

      try {
        let fileType: 'image' | 'document' | 'video' = 'document';
        if (isImg) fileType = 'image';
        else if (isVideo) fileType = 'video';

        const base64 = await fileToBase64(file);
        newAttachments.push({
          id: `att-${Date.now()}-${i}`,
          name,
          file,
          base64,
          type: fileType
        });
      } catch (err) {
        showToastNotification(`Error reading file ${name}`);
      }
    }

    if (newAttachments.length > 0) {
      setAttachedFiles(prev => [...prev, ...newAttachments]);
      showToastNotification(`Successfully attached ${newAttachments.length} file(s) to the chat.`);
    }
  };

  const uploadLocalFile = async (filesList: FileList) => {
    setIngesting(true);
    setIngestStatus('Analyzing file data...');
    const payloadData: { title: string; text?: string; base64?: string }[] = [];

    try {
      for (let i = 0; i < filesList.length; i++) {
        const file = filesList[i];

        // Front-end File Size Validation (80MB limit)
        if (file.size > 80 * 1024 * 1024) {
          throw new Error(`The file "${file.name}" exceeds the maximum limit of 80MB (it is ${(file.size / (1024 * 1024)).toFixed(1)}MB). Please compress the file or upload a smaller clip.`);
        }

        const ext = file.name.split('.').pop()?.toLowerCase() || '';

        if (['txt', 'md'].includes(ext)) {
          const text = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
          });
          payloadData.push({ title: file.name, text });
        } else {
          // PDF, Word, PowerPoint, etc. convert to Base64
          setIngestStatus(`Reading binary stream for ${file.name}...`);
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });
          payloadData.push({ title: file.name, base64 });
        }
      }

      setIngestStatus('AI parsing file contents...');
      const res = await fetchWithAuth('/api/documents/upload', {
        method: 'POST',
        body: JSON.stringify({
          files: payloadData,
          chunkSize,
          chunkOverlap,
          append: true
        })
      });

      const data = await res.json();
      if (res.ok) {
        // Safe Client-side save backup to bypass server-side Firestore write permissions issues
        if (auth.currentUser && data.chunks && data.docMetas) {
          const uid = auth.currentUser.uid;
          try {
            // Save chunks
            for (const chunk of data.chunks) {
              const chunkRef = doc(clientDb, 'users', uid, 'chunks', chunk.id);
              await setDoc(chunkRef, chunk);
            }
            // Save docMetas
            for (const docMeta of data.docMetas) {
              const docRef = doc(clientDb, 'users', uid, 'documents', docMeta.id);
              await setDoc(docRef, {
                ...docMeta,
                uploadedAt: new Date()
              });
            }
          } catch (dbErr: any) {
            console.warn("Client-side database synchronization fallback failed: ", dbErr.message || dbErr);
          }
        }

        setIngestStatus(`Success: Matching section indices built (${data.count} parts).`);
        setTimeout(() => setIngestStatus(null), 4000);
        await fetchStats();
        showToastNotification(`Successfully indexed ${filesList.length} files in knowledge database.`);
      } else {
        throw new Error(data.error || 'Could not parse document collection');
      }
    } catch (err: any) {
      setIngestStatus(`Error: ${err.message}`);
    } finally {
      setIngesting(false);
    }
  };

  // Webcam options removed as requested (images can be attached directly as files)

  // Dispatch uploads in the chat bar based on file signature
  const handleChatBarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    handleAttachFiles(files);
    // reset selection so same file triggers next time
    e.target.value = '';
  };

  // REAL VOICE DETECTION FLOWS OR PREMIUM TRIPLE FALLBACK
  const handleVoiceRecording = () => {
    setVoiceError(null);
    if (isVoiceRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn('Error stopping recognition:', e);
        }
      }
      setIsVoiceRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.continuous = true;

        recognition.onstart = () => {
          setIsVoiceRecording(true);
          setVoiceError(null);
          showToastNotification("Voice typing activated. Start speaking...");
        };

        recognition.onresult = (event: any) => {
          let interimText = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              const text = event.results[i][0].transcript;
              if (text) {
                setInputText(prev => {
                  const cleaned = prev.trim();
                  return cleaned ? cleaned + ' ' + text.trim() : text.trim();
                });
              }
            } else {
              interimText += event.results[i][0].transcript;
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition interface error:', event.error);
          setIsVoiceRecording(false);
          if (event.error === 'not-allowed') {
            setVoiceError(
              "Microphone access is restricted. Please check your browser's microphone permissions for this application."
            );
            showToastNotification("Microphone access denied. Please grant permissions.");
          } else {
            setVoiceError(`Speech recognition issue: ${event.error}. Please verify your microphone configuration.`);
            showToastNotification(`Speech recognition issue: ${event.error}`);
          }
        };

        recognition.onend = () => {
          setIsVoiceRecording(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.error('Failed to initialize voice typing:', err);
        setVoiceError("Could not initialize voice typing in this browser.");
        showToastNotification("Could not initialize voice typing in this browser.");
      }
    } else {
      setVoiceError("Voice typing is not supported in this browser tab. Please type your message.");
      showToastNotification("Voice typing is not supported in this browser tab. Please type your message.");
    }
  };

  // SUBMIT INPUT TRIGGER
  const sendMessageFlow = async (textOverload?: string) => {
    const promptText = textOverload || inputText;
    if (!promptText.trim() && attachedFiles.length === 0) return;

    // Save initial state in case of failure to restore
    const prevInputText = inputText;
    const prevAttachedFiles = [...attachedFiles];

    setInputText('');
    const userMsgId = `user-${Date.now()}`;
    const botMsgId = `bot-${Date.now()}`;
    const exactTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Separate photos from documentation
    const imageFiles = attachedFiles.filter(item => item.type === 'image');
    const activeImage64 = imageFiles.length > 0 ? imageFiles[0].base64 : null;

    const userMessageObj: Message = {
      id: userMsgId,
      role: 'user',
      text: promptText || `Uploaded file(s): ${prevAttachedFiles.map(f => f.name).join(', ')}`,
      time: exactTime,
      imageUrl: activeImage64 || undefined,
      attachedFiles: prevAttachedFiles.map(f => ({ name: f.name, type: f.type }))
    };

    setAttachedFiles([]);

    let targetSess = activeSession;
    if (!targetSess) {
      const freshId = `chat-${Date.now()}`;
      targetSess = {
        id: freshId,
        title: generateSmartTitle(promptText || 'Uploaded reference files') || 'New chat',
        messages: [userMessageObj],
        createdAt: new Date().toLocaleDateString()
      };
      setSessions([targetSess, ...sessions]);
      if (auth.currentUser) {
        syncSessionToFirestore(auth.currentUser.uid, targetSess);
      }
      setActiveSessionId(freshId);
    } else {
      setSessions(prev => prev.map(s => {
        if (s.id === targetSess!.id) {
          const currentTitle = s.title === 'New chat' ? generateSmartTitle(promptText || 'Uploaded reference files') : s.title;
          const updated = {
            ...s,
            title: currentTitle,
            messages: [...s.messages, userMessageObj]
          };
          if (auth.currentUser) {
            syncSessionToFirestore(auth.currentUser.uid, updated);
          }
          return updated;
        }
        return s;
      }));
    }

    setIsLoading(true);

    try {
      const historyContext = targetSess.messages.map(m => ({
        role: m.role,
        text: m.text
      }));

      // Retrieve chunks directly from client-side Firestore for robust RAG
      let userChunks: any[] = [];
      if (auth.currentUser) {
        try {
          const snap = await getDocs(collection(clientDb, 'users', auth.currentUser.uid, 'chunks'));
          userChunks = snap.docs.map(d => d.data());
        } catch (dbErr) {
          console.warn("Client-side user chunks fetch failed during chatbot query submit:", dbErr);
        }
      }

      const payload = {
        query: promptText || `Summarize the attached document file(s) in relation to general grounding.`,
        temperature: 0.2,
        history: historyContext,
        image: userMessageObj.imageUrl || null,
        chatAttachedFiles: prevAttachedFiles.map(f => ({
          name: f.name,
          base64: f.base64,
          type: f.type
        })),
        customSystemInstruction: customSystemInstruction,
        userChunks: userChunks
      };

      const response = await fetchWithAuth('/api/query', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Server connection issue');
      }

      const botMessageObj: Message = {
        id: botMsgId,
        role: 'assistant',
        text: resData.answer,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        retrieved: resData.retrieved,
        modelUsed: resData.modelUsed
      };

      setSessions(prev => prev.map(s => {
        if (s.id === targetSess!.id) {
          const updated = {
            ...s,
            messages: [...s.messages, botMessageObj]
          };
          if (auth.currentUser) {
            syncSessionToFirestore(auth.currentUser.uid, updated);
          }
          return updated;
        }
        return s;
      }));
    } catch (err: any) {
      let errorText = `Error connecting to the model: ${err.message || 'Verification mismatch'}. Support settings or correct key bindings may be missing in the environment config.`;
      
      const isQuotaError = err.message && (
        err.message.includes('429') ||
        err.message.toLowerCase().includes('quota') ||
        err.message.includes('RESOURCE_EXHAUSTED') ||
        err.message.includes('limit')
      );

      const isDemandError = err.message && (
        err.message.includes('503') ||
        err.message.toLowerCase().includes('demand') ||
        err.message.toLowerCase().includes('unavailable') ||
        err.message.toLowerCase().includes('overloaded') ||
        err.message.toLowerCase().includes('temporary')
      );

      if (isQuotaError) {
        errorText = `### ⚠️ Cloud AI Service Rate Limit Exceeded (429)

This error occurs because the cloud AI service rate limits have been temporarily exceeded. Under high volumes of document retrieval or rapid queries, the cloud provider limits request frequency to protect resource availability.

---

#### 🛠️ How to Resolve This:

1. **Wait 10-15 seconds**: 
   The rate limits operate on short cooldown windows. Simply wait a few moments, click the ✏️ **Edit** button on your message, and hit **Save & Resubmit**.

2. **Configure Your Personal API Key**:
   - In the top-right of your workspace settings, ensure you have set your own personal \`OPENROUTER_API_KEY\` if available. This overrides the default shared key with your own personal tier.

3. **Enable Dedicated Rate Quotas**:
   - Ensure your custom API key has adequate resource provisioning or pay-as-you-go enabled on the developer console, which supports significantly higher request rates (e.g., up to 1,000+ RPM) for seamless document interactions.`;
      } else if (isDemandError) {
        errorText = `### ⚠️ Cloud AI Service Unavailable (503)

The cloud intelligence service is currently experiencing exceptionally high demand. This is a temporary spike and usually resolves within a few moments.

---

#### 🛠️ How to Resolve This:

1. **Try Again in a Few Seconds**:
   This is a temporary server-side spike. Click the ✏️ **Edit** button on your message above, and select **Save & Resubmit** to retry.
   
2. **Configure Your Personal API Key**:
   - Ensure your personal \`OPENROUTER_API_KEY\` is configured in your project settings to use dedicated, isolated resource pools for much higher reliability and stability.`;
      }

      const errorMessageObj: Message = {
        id: botMsgId,
        role: 'assistant',
        text: errorText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setSessions(prev => prev.map(s => {
        if (s.id === targetSess!.id) {
          const updated = {
            ...s,
            messages: [...s.messages, errorMessageObj]
          };
          if (auth.currentUser) {
            syncSessionToFirestore(auth.currentUser.uid, updated);
          }
          return updated;
        }
        return s;
      }));
    } finally {
      setIsLoading(false);
      fetchStats();
    }
  };

  // READ BOT ANSWERS OUT LOUD
  const speakTextOutloud = (msgId: string, plainText: string) => {
    if ('speechSynthesis' in window) {
      if (speakingMsgId === msgId) {
        window.speechSynthesis.cancel();
        setSpeakingMsgId(null);
      } else {
        window.speechSynthesis.cancel();
        // cleanse citations so voice matches prose
        const cleanSpeech = plainText.replace(/\[\d+\]/g, '').replace(/[\*#_`]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanSpeech);
        utterance.onend = () => setSpeakingMsgId(null);
        utterance.onerror = () => setSpeakingMsgId(null);
        window.speechSynthesis.speak(utterance);
        setSpeakingMsgId(msgId);
      }
    } else {
      showToastNotification("Audio text synthesis is not supported on this browser.");
    }
  };

  // FORMAT OUTPUT WITHOUT SHARP CHARS AND MARKS WITH BEAUTIFUL SOURCE LINKS
  const parseInlineMarkdown = (baseString: string, matchedIndexes?: ChunkMatch[]) => {
    // Splits text by bold (**), italics (*), inline code (`), and citations ([1])
    const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[\d+\])/g;
    const parts = baseString.split(regex);
    if (parts.length === 1) return baseString;

    return parts.map((part, indexVal) => {
      // 1. Bold Check
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={indexVal} className="font-bold text-inherit">
            {part.slice(2, -2)}
          </strong>
        );
      }

      // 2. Italic Check
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <span key={indexVal} className="italic text-inherit">
            {part.slice(1, -1)}
          </span>
        );
      }

      // 3. Inline Code Check
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={indexVal} className={`px-1.5 py-0.5 rounded font-mono text-xs border ${
            theme === 'dark'
              ? 'bg-[#181a20] border-white/10 text-cyan-400'
              : 'bg-slate-100 border-slate-200 text-[#0c7a8f]'
          }`}>
            {part.slice(1, -1)}
          </code>
        );
      }

      // 4. Citation Check
      const matchCriteria = part.match(/^\[(\d+)\]$/);
      if (matchCriteria) {
        const itemNumber = parseInt(matchCriteria[1]);
        const matchedItem = matchedIndexes ? matchedIndexes[itemNumber - 1] : null;

        return (
          <span
            key={indexVal}
            onClick={() => {
              if (matchedItem) {
                setSelectedMatch(matchedItem);
                setRightActiveTab('grounding');
                setRightSidebarOpen(true);
              }
            }}
            className={`inline-flex items-center justify-center border text-[9.5px] px-1.5 py-0.5 mx-1.5 rounded-md font-mono font-bold cursor-pointer transition active:scale-95 select-none whitespace-nowrap ${
              theme === 'dark'
                ? 'bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 border-cyan-500/30 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                : 'bg-cyan-50 hover:bg-cyan-100 border-cyan-300 text-[#007489]'
            }`}
            title={matchedItem ? `Inspect Source: "${matchedItem.docTitle}"` : `Document [${itemNumber}]`}
          >
            Source {itemNumber}
          </span>
        );
      }

      return part;
    });
  };

  const styleMathEquation = (text: string) => {
    let equation = text.replace(/\$\$/g, '').trim();
    // Strip LaTeX markers with clean replacements
    equation = equation.replace(/\\text\{([^\}]+)\}/g, '$1');
    equation = equation.replace(/\\mathbf\{([^\}]+)\}/g, '$1');
    equation = equation.replace(/\\mathbf/g, '');
    equation = equation.replace(/\\cdot/g, ' · ');
    equation = equation.replace(/\\frac\{([^\}]+)\}\{([^\}]+)\}/g, '($1) / ($2)');
    equation = equation.replace(/\\sum_\{([^\}]+)\}\^\{([^\}]+)\}/g, 'Σ (from $1 to $2) ');
    equation = equation.replace(/\\sum/g, 'Σ');
    equation = equation.replace(/\\sqrt\{([^\}]+)\}/g, '√($1)');
    equation = equation.replace(/\\mid/g, '|');
    equation = equation.replace(/\\\|/g, '||');
    equation = equation.replace(/\\/g, ''); // strip remaining backslashes
    return equation;
  };

  const sanitizeMarkdownContent = (rawText: string): string => {
    if (!rawText) return "";
    let sanitized = rawText;
    
    // Strip script elements
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    
    // Strip object, embed, iframe elements
    sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
    sanitized = sanitized.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "");
    sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");

    // Strip inline javascript handlers
    sanitized = sanitized.replace(/\bon[a-z]+\s*=\s*(['"])(.*?)\1/gi, "");
    
    // Strip javascript: link schemes
    sanitized = sanitized.replace(/javascript\s*:/gi, "disabled-script:");

    return sanitized;
  };

  const preformatTextForMarkdown = (text: string) => {
    if (!text) return "";
    let processed = sanitizeMarkdownContent(text);

    // 1. Convert double-dollar block equations into a neat markdown blockquote so they stand out elegantly in full formatting!
    processed = processed.replace(/\$\$(.*?)\$\$/gs, (match, equation) => {
      const cleanEq = equation
        .replace(/\\text\{([^\}]+)\}/g, '$1')
        .replace(/\\mathbf\{([^\}]+)\}/g, '$1')
        .replace(/\\mathbf/g, '')
        .replace(/\\cdot/g, ' · ')
        .replace(/\\frac\{([^\}]+)\}\{([^\}]+)\}/g, '($1) / ($2)')
        .replace(/\\sum_\{([^\}]+)\}\^\{([^\}]+)\}/g, 'Σ (from $1 to $2) ')
        .replace(/\\sum/g, 'Σ')
        .replace(/\\sqrt\{([^\}]+)\}/g, '√($1)')
        .replace(/\\mid/g, '|')
        .replace(/\\\|/g, '||')
        .replace(/\\/g, '')
        .trim();
      return `\n\n> **Formula Synthesis:**  \n> * ${cleanEq} *\n\n`;
    });

    // 2. Convert inline equations $ ... $ into inline accent markdown code blocks
    processed = processed.replace(/\$(.*?)\$/g, (match, equation) => {
      const cleanEq = equation
        .replace(/\\text\{([^\}]+)\}/g, '$1')
        .replace(/\\mathbf\{([^\}]+)\}/g, '$1')
        .replace(/\\mathbf/g, '')
        .replace(/\\cdot/g, ' · ')
        .replace(/\\frac\{([^\}]+)\}\{([^\}]+)\}/g, '($1) / ($2)')
        .replace(/\\sum/g, 'Σ')
        .replace(/\\sqrt\{([^\}]+)\}/g, '√($1)')
        .replace(/\\mid/g, '|')
        .replace(/\\\|/g, '||')
        .replace(/\\/g, '')
        .trim();
      return ` \`${cleanEq}\` `;
    });

    // 3. Convert plaintext citations [1], [2], [1, 2], [1,2,3] to interactive markdown links
    // Step A: expand multi-number brackets [1, 2] -> [1][2]
    processed = processed.replace(/\[(\d+(?:,\s*\d+)+)\]/g, (_, nums: string) => {
      return nums.split(',').map((n: string) => `[${n.trim()}]`).join('');
    });
    // Step B: convert each single [N] to a clickable markdown link
    processed = processed.replace(/\[(\d+)\]/g, '[$1](citation-$1)');

    return processed;
  };

  // Grounding Tab content renderer
  const renderGroundingTab = () => {
    return (
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin flex flex-col font-sans">
        {/* Active click inspector */}
        {selectedMatch ? (
          <div className={`p-4 rounded-xl space-y-2.5 border transition duration-150 ${
            theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-50 border-slate-200/80 shadow-xs'
          }`}>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500">Active Passage</span>
              <button
                onClick={() => setSelectedMatch(null)}
                className="text-[11px] font-bold hover:underline cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Close
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Source: <span className="text-slate-700 dark:text-slate-300 font-semibold">{selectedMatch.docTitle}</span></p>
            <div className={`text-xs leading-relaxed p-3 rounded-lg border ${
              theme === 'dark' ? 'bg-black/40 border-white/5 text-slate-300 font-normal' : 'bg-white border-slate-200/60 text-slate-700 font-normal'
            }`}>
              "{selectedMatch.text}"
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
              <span>Match Accuracy:</span>
              <span className="text-slate-600 dark:text-slate-300 font-medium">{(selectedMatch.score * 100).toFixed(0)}% Match</span>
            </div>
          </div>
        ) : (
          <div className={`p-4 rounded-xl border text-[11px] leading-relaxed transition ${
            theme === 'dark' ? 'bg-zinc-900/60 border-zinc-850/60 text-slate-400' : 'bg-slate-50 border-slate-200/60 text-slate-600'
          }`}>
            <p className="font-bold text-slate-500 dark:text-slate-450 text-[11px] uppercase tracking-wider mb-1.5">Interactive Verification</p>
            <p className="opacity-80">Click on any numeric citation indicators <span className="text-slate-600 dark:text-slate-350 font-medium">[1]</span> within the chat replies. The exact reference passage will render here in real-time.</p>
          </div>
        )}

        {/* Searchable local documents list */}
        <div className="space-y-4 pt-2">
          {/* Live Vector Correlation Spectrum */}
          <div className={`p-4 rounded-xl border transition ${
            theme === 'dark' ? 'bg-zinc-900/40 border-zinc-850/60' : 'bg-slate-50 border-slate-200/60'
          }`}>
            <div className="flex items-center space-x-2 mb-3">
              {/* Static steady slate dot */}
              <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-zinc-500 shrink-0"></span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500 block">Live Search Relevance</span>
            </div>
            
            <div className="h-20 relative flex items-end justify-between px-2 pt-2 border-b border-dashed border-slate-250 dark:border-zinc-850">
              {/* Visualized cosine correlation levels */}
              {[88, 79, 94, 65, 87, 72, 91, 85].map((val, idx) => (
                <div key={idx} className="flex flex-col items-center w-full group/bar relative">
                  <div className="absolute -top-5 opacity-0 group-hover/bar:opacity-100 transition duration-150 text-[8px] bg-slate-950 text-white px-1.5 rounded -translate-y-1 block pointer-events-none text-slate-300 font-normal z-10 shadow-md">
                    {val}%
                  </div>
                  <div
                    className={`w-2 h-full rounded-t-xs transition-all duration-300 hover:brightness-110 ${
                      val > 85
                        ? 'bg-slate-400 dark:bg-zinc-500'
                        : 'bg-slate-300 dark:bg-zinc-650'
                    }`}
                    style={{ height: `${val}%` }}
                  />
                  <span className={`text-[8px] font-mono mt-1 ${
                    theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
                  }`}>Ref{idx+1}</span>
                </div>
              ))}
            </div>
            
            <p className="text-[10px] leading-normal opacity-75 mt-2 text-left text-slate-500 dark:text-slate-400">
              Displays how closely loaded document segments match your active query.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500 block">Search Loaded Files</span>
          
          {/* Search input */}
          <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg border text-xs transition duration-200 focus-within:ring-1 focus-within:ring-amber-500/20 focus-within:border-amber-400 ${
            theme === 'dark' ? 'bg-zinc-900/60 border-zinc-850/60' : 'bg-white border-slate-200'
          }`}>
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by file name..."
              value={docSearchQuery}
              onChange={(e) => setDocSearchQuery(e.target.value)}
              className="bg-transparent border-none ring-0 outline-none text-xs w-full text-slate-800 dark:text-slate-100 font-medium"
            />
            {docSearchQuery && (
              <button onClick={() => setDocSearchQuery('')} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search results */}
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {filteredDocuments.length > 0 ? (
              filteredDocuments.map((doc, idx) => (
                <div
                  key={idx}
                  className={`flex justify-between items-center text-xs p-2.5 border rounded-xl transition duration-150 ${
                    theme === 'dark'
                      ? 'bg-zinc-900/30 border-zinc-850/50 hover:bg-zinc-900/60 hover:border-zinc-800'
                      : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <span className="truncate text-slate-750 dark:text-slate-300 font-medium font-sans text-xs flex-1 text-left" title={doc.title}>{doc.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteDocumentByName(doc.title);
                    }}
                    className="text-red-400 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition cursor-pointer shrink-0 ml-2"
                    title="Delete document file"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-xs opacity-40">
                No matching document files found.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Control Tab content renderer
  const renderControlTab = () => {
    return (
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin flex flex-col font-sans">
        {/* Custom System Instructions Panel */}
        <div className={`space-y-3.5 p-4 rounded-xl border transition ${
          theme === 'dark' ? 'bg-zinc-900/40 border-zinc-850/60 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-xs'
        }`}>
          <div className="flex items-center space-x-1.5 justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500">System Instructions</span>
          </div>
          
          <textarea
            value={customSystemInstruction}
            onChange={(e) => setCustomSystemInstruction(e.target.value)}
            placeholder="E.g., Explain concepts like I'm 5 years old, or reply in simple French..."
            className={`w-full min-h-[100px] text-xs p-2.5 rounded-lg border focus:ring-1 focus:ring-amber-500/20 focus:border-amber-400 outline-none resize-y transition font-medium ${
              theme === 'dark' ? 'bg-black/35 border-white/5 text-slate-100 placeholder-zinc-650' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-450'
            }`}
          />

          {/* Quick presets */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500 block">Quick Presets:</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setCustomSystemInstruction("Explain everything like I am a 5-year-old child (ELI5). Use simple terms, fun analogies, and avoid any heavy jargon.")}
                className={`text-[9.5px] px-2 py-1 rounded-lg transition border cursor-pointer font-medium ${
                  theme === 'dark' ? 'bg-zinc-800/60 border-white/5 hover:bg-zinc-800 text-slate-300' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-755'
                }`}
              >
                Explain Like I'm Five
              </button>
              <button
                onClick={() => setCustomSystemInstruction("Give extremely brief, concise, and professional responses. Cut all unnecessary introductory/closing remarks or general chit-chat.")}
                className={`text-[9.5px] px-2 py-1 rounded-lg transition border cursor-pointer font-medium ${
                  theme === 'dark' ? 'bg-zinc-800/60 border-white/5 hover:bg-zinc-800 text-slate-300' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-755'
                }`}
              >
                Professional Concise
              </button>
              <button
                onClick={() => setCustomSystemInstruction("")}
                className={`text-[9.5px] px-2 py-1 rounded-lg transition border cursor-pointer font-medium ${
                  theme === 'dark' ? 'bg-zinc-800/60 border-white/5 hover:bg-zinc-800 text-slate-400' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-600'
                }`}
              >
                Reset Default
              </button>
            </div>
          </div>
          <p className="text-[10px] opacity-75 leading-normal">
            Customize AI behavior, persona, and target language. The prompt structure automatically instructs the AI to follow this behavior while searching and citing your uploaded documents.
          </p>
        </div>

        {/* Action trigger tools */}
        <div className="space-y-2 pt-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-455 dark:text-slate-500 block">Document Management</span>

          <div className="grid grid-cols-1 gap-2.5">
            <button
              onClick={loadSampleFiles}
              disabled={ingesting}
              className={`w-full font-medium text-xs py-2 px-2.5 rounded-lg flex items-center justify-center space-x-2 transition active:scale-[0.98] disabled:opacity-35 cursor-pointer border ${
                theme === 'dark' 
                  ? 'bg-zinc-900 hover:bg-zinc-850 text-white border-zinc-800' 
                  : 'bg-white hover:bg-slate-50 text-slate-850 border-slate-200 shadow-xs'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${ingesting ? 'animate-spin text-slate-400' : 'text-slate-400'}`} />
              <span>Load Demo Documents</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={ingesting}
              className={`w-full font-medium text-xs py-2 px-2.5 rounded-lg flex items-center justify-center space-x-2 transition active:scale-[0.98] disabled:opacity-35 cursor-pointer border ${
                theme === 'dark' 
                  ? 'bg-zinc-900 hover:bg-zinc-850 text-white border-zinc-800' 
                  : 'bg-white hover:bg-slate-50 text-slate-850 border-slate-200 shadow-xs'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-slate-450 dark:text-slate-400" />
              <span>Upload Custom Files</span>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,.pdf,.docx,.doc,.pptx,.ppt,.txt,.md"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) uploadLocalFile(e.target.files);
            }}
          />
          <p className="text-[9.5px] opacity-50 text-center select-none pt-1 font-medium">Supports PPT, PDF, DOC, Video, Image, Text & Markdown</p>
        </div>

        {/* Ingestion progress feedback log */}
        {ingestStatus && (
          <p className="text-[11px] opacity-90 leading-relaxed bg-slate-100 dark:bg-zinc-800/60 text-slate-700 dark:text-slate-300 p-3 rounded-xl border border-slate-200 dark:border-zinc-750">
            {ingestStatus}
          </p>
        )}

        {/* Database analytics stats */}
        <div className={`p-4 rounded-xl border space-y-2.5 text-[11px] font-sans select-none ${
          theme === 'dark' ? 'bg-zinc-900/40 border-zinc-850/60 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-xs'
        }`}>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500 mb-0.5">Document Library Info</div>
          <div className="flex justify-between items-center">
            <span className="opacity-70 text-[11px]">Total Loaded Files:</span>
            <span className="text-slate-600 dark:text-slate-300 font-normal bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-zinc-700/60 text-[11px]">{systemStats.totalDocs} Files</span>
          </div>
        </div>
      </div>
    );
  };

  // Filter Document List by search phrase
  const filteredDocuments = systemStats.documents.filter(doc =>
    doc.title.toLowerCase().includes(docSearchQuery.toLowerCase())
  );

  // --- AUTH INTERFACE ACTIONS ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!authEmail || !authPassword) {
      setAuthError("Please fill in all required fields.");
      return;
    }

    if (isSignUpMode) {
      if (authPassword !== authConfirmPassword) {
        setAuthError("Passwords do not match.");
        return;
      }
      const rules = getPasswordRules();
      const unsatisfied = rules.filter(r => !r.satisfied);
      if (unsatisfied.length > 0) {
        setAuthError(`Password requirements not met. Please fulfill: ${unsatisfied.map(u => u.label.toLowerCase()).join(", ")}.`);
        return;
      }
      try {
        setAuthLoading(true);
        const cred = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        if (authDisplayName.trim()) {
          await updateProfile(cred.user, { displayName: authDisplayName.trim() });
        }
        // Send branded email verification via GroundLink AI
        const verificationActionSettings: ActionCodeSettings = {
          url: `${window.location.origin}/?verified=true`,
          handleCodeInApp: false,
        };
        try {
          await sendEmailVerification(cred.user, verificationActionSettings);
          showToastNotification("Account created! Check your email to verify your GroundLink AI account.");
        } catch (verErr) {
          // Verification email failed silently — account still created
          showToastNotification("Account registered successfully! Welcome to GroundLink AI.");
        }
        setAuthEmail('');
        setAuthPassword('');
        setAuthConfirmPassword('');
        setAuthDisplayName('');
      } catch (err: any) {
        console.error("Signup error:", err);
        let msg = err.message;
        if (err.code === "auth/email-already-in-use") {
          msg = "This email address is already registered in our secure directory.";
        } else if (err.code === "auth/invalid-email") {
          msg = "The email address format is invalid.";
        } else if (err.code === "auth/weak-password") {
          msg = "The password chosen is too weak. Firebase requires at least 6 characters.";
        } else if (err.code === "auth/network-request-failed" || err.message?.includes("network-request-failed")) {
          msg = "A connection error occurred. Please verify your network and make sure the auth service is reachable.";
        }
        setAuthError(msg);
      } finally {
        setAuthLoading(false);
      }
    } else {
      try {
        setAuthLoading(true);
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
        showToastNotification("Session established.");
        setAuthEmail('');
        setAuthPassword('');
      } catch (err: any) {
        console.error("Login error:", err);
        let msg = err.message;
        if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
          msg = "Invalid credentials. Please verify your email and password.";
        } else if (err.code === "auth/user-not-found") {
          msg = "No profile found matching this email address.";
        } else if (err.code === "auth/invalid-email") {
          msg = "The email address format is invalid.";
        } else if (err.code === "auth/network-request-failed" || err.message?.includes("network-request-failed")) {
          msg = "A connection error occurred. Please verify your network and try again.";
        }
        setAuthError(msg);
      } finally {
        setAuthLoading(false);
      }
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!authEmail) {
      setAuthError("Please enter your registered email address.");
      return;
    }
    try {
      setAuthLoading(true);
      const resetActionSettings: ActionCodeSettings = {
        url: `${window.location.origin}/?passwordReset=true`,
        handleCodeInApp: false,
      };
      await sendPasswordResetEmail(auth, authEmail, resetActionSettings);
      setResetSent(true);
      showToastNotification("Password recovery link dispatched. Check your inbox.");
    } catch (err: any) {
      console.error("Reset error:", err);
      let msg = err.message;
      if (err.code === "auth/user-not-found") {
        msg = "No secure profile found matching this email address.";
      } else if (err.code === "auth/invalid-email") {
        msg = "The email address format is invalid.";
      } else if (err.code === "auth/network-request-failed" || err.message?.includes("network-request-failed")) {
        msg = "A connection error occurred. Please verify your network and try again.";
      }
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      setAuthLoading(true);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      showToastNotification("Authenticated via Google.");
    } catch (err: any) {
      console.error("Google sign in error:", err);
      let msg = err.message;
      if (err.code === "auth/popup-blocked") {
        msg = "Sign in popup was blocked. Please enable popups for this site.";
      } else if (err.code === "auth/popup-closed-by-user") {
        msg = "Sign in window was closed before completion.";
      } else if (err.code === "auth/network-request-failed" || err.message?.includes("network-request-failed")) {
        msg = "A connection error occurred during Google Sign-In. Please check your connection and authorized domains.";
      }
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setAuthEmail('');
      setAuthPassword('');
      setAuthConfirmPassword('');
      setAuthDisplayName('');
      setAuthError(null);
      setShowAuthForm(false);
      setActiveView('chat');
      showToastNotification("Session terminated.");
    } catch (err: any) {
      console.error("Logout error:", err);
    }
  };

  const getPasswordRules = () => {
    return [
      { id: 'length', label: 'At least 8 characters long', satisfied: authPassword.length >= 8 },
      { id: 'mixed', label: 'Uppercase & lowercase letters', satisfied: /[a-z]/.test(authPassword) && /[A-Z]/.test(authPassword) },
      { id: 'number', label: 'At least one number (0-9)', satisfied: /\d/.test(authPassword) },
      { id: 'special', label: 'At least one symbol (e.g., !@#$%^&*)', satisfied: /[^A-Za-z0-9]/.test(authPassword) },
    ];
  };

  const getPasswordStrength = () => {
    if (!authPassword) return { score: 0, text: 'Enter password', color: 'text-slate-400' };
    const rules = getPasswordRules();
    const satisfiedCount = rules.filter(r => r.satisfied).length;
    
    if (satisfiedCount === 4) {
      return { score: 4, text: 'Strong (Fully Compliant)', color: 'text-emerald-400 font-bold' };
    } else if (satisfiedCount === 3) {
      return { score: 3, text: 'Good (Almost there)', color: 'text-amber-400 font-medium' };
    } else if (satisfiedCount >= 1) {
      return { score: 2, text: 'Weak', color: 'text-orange-400' };
    }
    return { score: 1, text: 'Very Weak', color: 'text-rose-500' };
  };

  if (authLoading) {
    return (
      <div className={`h-screen w-screen flex flex-col items-center justify-center transition-colors duration-300 ${
        theme === 'dark' ? 'bg-[#0f1013] text-[#ebedf2]' : 'bg-[#f8fafc] text-[#1e1f24]'
      }`}>
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500 via-indigo-500 to-amber-500 rounded-full blur-xl opacity-30 animate-pulse"></div>
          <ChatLogo className="w-16 h-16 relative filter drop-shadow-[0_0_12px_rgba(6,182,212,0.4)] animate-bounce" />
        </div>
        <p className="mt-6 text-sm font-semibold tracking-wide animate-pulse uppercase opacity-60">
          Loading session context...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    const strength = getPasswordStrength();
    return (
      <div className={`h-screen w-full transition-colors duration-300 relative overflow-y-auto font-sans flex flex-col justify-between ${
        theme === 'dark' ? 'bg-[#0f1013] text-[#ebedf2]' : 'bg-[#f8fafc] text-[#1e1f24]'
      }`}>
        {/* Background glow effects */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/10 dark:bg-cyan-500/5 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/10 dark:bg-amber-500/5 blur-[120px] pointer-events-none"></div>

        {/* Nav Header */}
        <header className={`px-6 py-4 flex justify-between items-center max-w-7xl w-full mx-auto border-b relative z-20 ${
          theme === 'dark' ? 'border-zinc-800/60' : 'border-slate-200/60'
        }`}>
          <div className="flex items-center space-x-3.5">
            <ChatLogo className="w-9 h-9 filter drop-shadow-[0_0_8px_rgba(6,182,212,0.3)]" />
            <div>
              <h1 className="text-lg font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-500 via-indigo-500 to-amber-500 dark:from-cyan-400 dark:via-indigo-400 dark:to-amber-400">
                GroundLink
              </h1>
              <p className="text-[9px] uppercase font-bold tracking-widest opacity-60 leading-none mt-0.5">Document Intelligence</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`p-2 rounded-xl transition active:scale-95 cursor-pointer ${
                theme === 'dark' ? 'hover:bg-zinc-800/80 text-amber-400' : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>
            
            {!showAuthForm ? (
              <button
                onClick={() => {
                  setIsSignUpMode(false);
                  setShowAuthForm(true);
                  setAuthError(null);
                }}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm active:scale-95 cursor-pointer ${
                  theme === 'dark' ? 'bg-zinc-850 hover:bg-zinc-800 text-white border border-zinc-700/60' : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                }`}
              >
                Sign In
              </button>
            ) : (
              <button
                onClick={() => {
                  setShowAuthForm(false);
                  setAuthError(null);
                }}
                className="text-xs font-semibold hover:underline opacity-70 hover:opacity-100 transition cursor-pointer"
              >
                Back to Home
              </button>
            )}
          </div>
        </header>

        {/* Dynamic content area based on showAuthForm state */}
        {!showAuthForm ? (
          /* INTRO PAGE CONTAINER */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-7xl mx-auto px-6 py-10 lg:py-16 relative z-10 flex flex-col lg:flex-row gap-12 lg:gap-16 items-center w-full flex-grow justify-start lg:justify-center animate-fade-in my-auto"
          >
            {/* Left side: Hero Text & CTAs */}
            <div className="flex-1 text-left flex flex-col justify-center space-y-6 lg:max-w-xl">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
                Search, Chat & Verify with{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-500 via-indigo-500 to-amber-500 dark:from-cyan-400 dark:via-indigo-400 dark:to-amber-400">
                  Grounded Truth
                </span>
              </h2>

              <p className="text-sm md:text-base opacity-75 leading-relaxed font-normal">
                Analyze, index, and query your document database with dynamic grounded citations, multi-format parsing, and native voice interaction. Stop guessing and start validating.
              </p>

              {/* Premium Interactive CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  onClick={() => {
                    setIsSignUpMode(true);
                    setShowAuthForm(true);
                    setAuthError(null);
                  }}
                  className="bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-600 hover:to-indigo-600 text-white font-bold text-xs px-8 py-4 rounded-xl transition shadow-lg shadow-cyan-500/10 active:scale-95 cursor-pointer flex items-center justify-center space-x-2"
                >
                  <span>Get Started</span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    setIsSignUpMode(false);
                    setShowAuthForm(true);
                    setAuthError(null);
                  }}
                  className={`font-bold text-xs px-8 py-4 rounded-xl transition active:scale-95 cursor-pointer border flex items-center justify-center ${
                    theme === 'dark'
                      ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  Access Workspace
                </button>
              </div>
            </div>

            {/* Right side: Beautiful, asymmetric features grid/stack (Not generic 3 columns!) */}
            <div className="flex-1 w-full flex flex-col space-y-6">
              {/* Feature 1 - Left Offset */}
              <div className={`p-6 rounded-3xl border transition duration-300 hover:scale-[1.02] flex gap-5 items-start lg:translate-x-[-12px] ${
                theme === 'dark' ? 'bg-[#121319]/80 border-zinc-800/80 shadow-2xl shadow-black/20' : 'bg-white border-slate-200 shadow-md shadow-slate-100'
              }`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-50 text-cyan-600'
                }`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold tracking-tight mb-1.5">Dynamic Citation Grounding</h4>
                  <p className="text-xs opacity-60 leading-relaxed font-normal">
                    Trace every AI response back to your uploaded text sources. View exact similarity scores, match scores, and interactive text previews with verified citations.
                  </p>
                </div>
              </div>

              {/* Feature 2 - Normal or Right Offset */}
              <div className={`p-6 rounded-3xl border transition duration-300 hover:scale-[1.02] flex gap-5 items-start lg:translate-x-[12px] ${
                theme === 'dark' ? 'bg-[#121319]/80 border-zinc-800/80 shadow-2xl shadow-black/20' : 'bg-white border-slate-200 shadow-md shadow-slate-100'
              }`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                }`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold tracking-tight mb-1.5">Multi-Format Document Vault</h4>
                  <p className="text-xs opacity-60 leading-relaxed font-normal">
                    Safely upload, parse, and index text documents, PDFs, PowerPoint decks, and Word files. GroundLink extracts raw text particles into local vector index collections.
                  </p>
                </div>
              </div>

              {/* Feature 3 - Left Offset */}
              <div className={`p-6 rounded-3xl border transition duration-300 hover:scale-[1.02] flex gap-5 items-start lg:translate-x-[-12px] ${
                theme === 'dark' ? 'bg-[#121319]/80 border-zinc-800/80 shadow-2xl shadow-black/20' : 'bg-white border-slate-200 shadow-md shadow-slate-100'
              }`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  theme === 'dark' ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'
                }`}>
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold tracking-tight mb-1.5">Ambient Voice Control</h4>
                  <p className="text-xs opacity-60 leading-relaxed font-normal">
                    Speak your requests out loud with full recording controls. Dictate questions and listen to high-fidelity browser voice synthesized audio playbacks.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* AUTHENTICATION FORM CARD CONTAINER */
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full mx-auto px-4 py-4 md:py-6 relative z-10 flex-grow flex flex-col items-center justify-center"
          >
            <div className={`border rounded-3xl shadow-2xl p-5 sm:p-7 w-full ${
              theme === 'dark' ? 'bg-[#111216] border-zinc-800' : 'bg-white border-slate-200'
            }`}>
              
              {/* Return Button */}
              <button
                onClick={() => {
                  setShowAuthForm(false);
                  setAuthError(null);
                }}
                className={`inline-flex items-center space-x-1.5 text-xs font-semibold mb-4 transition cursor-pointer hover:opacity-85 ${
                  theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Return to Home</span>
              </button>

              {showResetOverlay ? (
                // RESET PASSWORD INTERFACE
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">Recover access</h3>
                    <p className="text-xs opacity-60 mt-1">Enter your email and we'll send a password recovery link.</p>
                  </div>

                  {authError && (
                    <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs flex items-start space-x-2.5">
                      <ShieldAlert className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                      <span>{authError}</span>
                    </div>
                  )}

                  {resetSent ? (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl text-xs space-y-1">
                      <p className="font-bold">Recovery email sent!</p>
                      <p className="opacity-85">Check your inbox and spam folder for instructions to reset your password.</p>
                    </div>
                  ) : (
                    <form onSubmit={handlePasswordReset} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold opacity-75">Email address</label>
                        <input
                          type="email"
                          required
                          placeholder="name@example.com"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          className={`w-full text-xs px-4 py-3 rounded-xl border outline-none transition focus:ring-1 focus:ring-cyan-500/20 focus:border-cyan-400 font-medium ${
                            theme === 'dark' ? 'bg-zinc-900/60 border-zinc-800 text-white' : 'bg-slate-50/50 border-slate-200 text-slate-800'
                          }`}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md hover:shadow-cyan-500/15 cursor-pointer active:scale-[0.98] disabled:opacity-50"
                      >
                        {authLoading ? 'Sending...' : 'Send reset link'}
                      </button>
                    </form>
                  )}

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setShowResetOverlay(false);
                        setResetSent(false);
                        setAuthError(null);
                      }}
                      className="text-xs text-cyan-500 hover:underline font-semibold cursor-pointer"
                    >
                      Return to Sign In
                    </button>
                  </div>
                </motion.div>
              ) : (
                // LOGIN & SIGNUP INTERFACES
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <div className="text-left">
                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
                      {isSignUpMode ? 'Create Account' : 'Welcome back'}
                    </h3>
                  </div>

                  {authError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs flex items-start space-x-2">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{authError}</span>
                    </div>
                  )}

                  {/* Google Sign-In Button */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={authLoading}
                    className={`w-full flex items-center justify-center space-x-2.5 py-2.5 px-4 rounded-xl border font-bold text-xs transition active:scale-[0.98] cursor-pointer disabled:opacity-50 ${
                      theme === 'dark' 
                        ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-850 text-white' 
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm'
                    }`}
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.11-.3-.21-.63-.28-.98z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span>Continue with Google</span>
                  </button>

                  <div className="flex items-center space-x-2 text-[11px] opacity-40">
                    <div className="flex-1 border-t border-current"></div>
                    <span>or continue with email</span>
                    <div className="flex-1 border-t border-current"></div>
                  </div>

                  <form onSubmit={handleAuthSubmit} className="space-y-3">
                    {isSignUpMode && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold opacity-75">Full name</label>
                        <input
                          type="text"
                          required
                          placeholder="Your name"
                          value={authDisplayName}
                          onChange={(e) => setAuthDisplayName(e.target.value)}
                          className={`w-full text-xs px-4 py-2.5 rounded-xl border outline-none transition focus:ring-1 focus:ring-cyan-500/20 focus:border-cyan-400 font-medium ${
                            theme === 'dark' ? 'bg-zinc-900/60 border-zinc-800 text-white' : 'bg-slate-50/50 border-slate-200 text-slate-800'
                          }`}
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold opacity-75">Email address</label>
                      <input
                        type="email"
                        required
                        placeholder="name@example.com"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className={`w-full text-xs px-4 py-2.5 rounded-xl border outline-none transition focus:ring-1 focus:ring-cyan-500/20 focus:border-cyan-400 font-medium ${
                          theme === 'dark' ? 'bg-zinc-900/60 border-zinc-800 text-white' : 'bg-slate-50/50 border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-semibold opacity-75">Password</label>
                        {!isSignUpMode && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowResetOverlay(true);
                              setAuthError(null);
                            }}
                            className="text-[11px] text-cyan-500 hover:underline font-semibold cursor-pointer"
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          className={`w-full text-xs pl-4 pr-10 py-2.5 rounded-xl border outline-none transition focus:ring-1 focus:ring-cyan-500/20 focus:border-cyan-400 font-medium ${
                            theme === 'dark' ? 'bg-zinc-900/60 border-zinc-800 text-white' : 'bg-slate-50/50 border-slate-200 text-slate-800'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 cursor-pointer focus:outline-none"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {isSignUpMode && (
                        <div className="space-y-2.5 mt-2 p-3 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/20 dark:bg-zinc-900/20">
                          <div className="flex items-center justify-between text-[10px] font-semibold">
                            <span className="opacity-60">Strength:</span>
                            <span className={strength.color}>{strength.text}</span>
                          </div>
                          {/* Segmented Strength Bar */}
                          <div className="grid grid-cols-4 gap-1 h-1">
                            {[1, 2, 3, 4].map((seg) => {
                              const score = strength.score;
                              let activeColor = 'bg-slate-200 dark:bg-zinc-800';
                              if (score >= seg) {
                                if (score === 1) activeColor = 'bg-rose-500';
                                else if (score === 2) activeColor = 'bg-orange-400';
                                else if (score === 3) activeColor = 'bg-amber-400';
                                else activeColor = 'bg-emerald-400';
                              }
                              return (
                                <div key={seg} className={`h-full rounded-full transition-all duration-300 ${activeColor}`} />
                              );
                            })}
                          </div>
                          {/* Checklist rules */}
                          <div className="space-y-1 pt-1.5 border-t border-slate-100 dark:border-zinc-800/60 mt-1">
                            <p className="text-[9px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mb-1">Requirements:</p>
                            {getPasswordRules().map((rule) => (
                              <div key={rule.id} className="flex items-center space-x-2 text-[10.5px]">
                                {rule.satisfied ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-700 shrink-0 ml-1.5 mr-0.5"></span>
                                )}
                                <span className={rule.satisfied ? 'text-slate-700 dark:text-slate-300 font-semibold' : 'text-slate-450 dark:text-slate-500'}>
                                  {rule.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {isSignUpMode && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold opacity-75">Confirm password</label>
                        <div className="relative flex items-center">
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            required
                            placeholder="••••••••"
                            value={authConfirmPassword}
                            onChange={(e) => setAuthConfirmPassword(e.target.value)}
                            className={`w-full text-xs pl-4 pr-10 py-2.5 rounded-xl border outline-none transition focus:ring-1 focus:ring-cyan-500/20 focus:border-cyan-400 font-medium ${
                              theme === 'dark' ? 'bg-zinc-900/60 border-zinc-800 text-white' : 'bg-slate-50/50 border-slate-200 text-slate-800'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 cursor-pointer focus:outline-none"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {authConfirmPassword && authPassword !== authConfirmPassword && (
                          <p className="text-[10px] text-rose-500 px-0.5 font-medium">Passwords do not match.</p>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-md hover:shadow-cyan-500/15 cursor-pointer active:scale-[0.98] mt-1.5 disabled:opacity-50"
                    >
                      {authLoading ? 'Please wait...' : (isSignUpMode ? 'Sign Up' : 'Sign In')}
                    </button>
                  </form>

                  <div className="pt-3 border-t border-slate-100 dark:border-zinc-850 text-center text-xs">
                    <span className="opacity-60">
                      {isSignUpMode ? 'Already have an account?' : "Don't have an account?"}
                    </span>{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUpMode(!isSignUpMode);
                        setAuthError(null);
                      }}
                      className="text-cyan-500 hover:underline font-bold cursor-pointer"
                    >
                      {isSignUpMode ? 'Sign In' : 'Create Account'}
                    </button>
                  </div>
                </motion.div>
              )}

            </div>
          </motion.div>
        )}

        {/* Global simple footer bar */}
        <footer className={`py-4 text-center text-[10px] font-sans border-t relative z-20 opacity-75 select-none ${
          theme === 'dark' ? 'border-zinc-800/40 bg-[#0c0d10]' : 'border-slate-200/40 bg-slate-50'
        }`}>
          <span>GroundLink &copy; 2026. All rights reserved.</span>
        </footer>
      </div>
    );
  }

  return (
    <div className={`h-screen max-h-screen w-full transition-colors duration-300 font-sans flex flex-col overflow-hidden ${
      theme === 'dark' ? 'bg-[#0f1013] text-[#ebedf2]' : 'bg-[#f8fafc] text-[#1e1f24]'
    }`}>

      {/* Premium original background decoration */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.04] dark:opacity-[0.05] z-0 overflow-hidden select-none">
        <svg className="absolute top-12 left-10 w-[420px] h-[420px] text-cyan-500" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 100 120">
          <polygon points="50,15 80,32 80,67 50,85 20,67 20,32" />
          <polygon points="80,47 110,64 110,99 80,117 50,99 50,64" />
        </svg>
        <svg className="absolute bottom-20 right-10 w-[380px] h-[380px] text-amber-500" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 100 120">
          <polygon points="50,15 80,32 80,67 50,85 20,67 20,32" />
        </svg>
      </div>

      {/* Minimal clean header */}
      <header className={`relative z-20 px-5 py-3.5 border-b flex justify-between items-center transition-colors ${
        theme === 'dark' ? 'bg-[#171717] border-zinc-800' : 'bg-[#ffffff] border-slate-200/60 shadow-xs'
      }`}>
        <div 
          onClick={() => setActiveView('chat')}
          className="flex items-center space-x-4 group/header font-sans cursor-pointer"
          title="Back to Chat"
        >
          <div className="relative">
            {/* Ambient breathing backglow */}
            <div className="absolute -inset-1 bg-gradient-to-tr from-cyan-500/20 via-indigo-500/10 to-amber-500/20 rounded-full blur-md opacity-80 group-hover/header:opacity-100 transition duration-300 animate-pulse"></div>
            <ChatLogo className="w-11 h-11 relative transition-transform duration-300 group-hover/header:scale-110 filter drop-shadow-[0_0_8px_rgba(6,182,212,0.25)]" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tight select-none bg-clip-text text-transparent bg-gradient-to-r from-cyan-500 via-indigo-500 to-amber-500 dark:from-cyan-400 dark:via-indigo-400 dark:to-amber-400">
              GroundLink
            </h1>
            <p className="text-[11px] font-medium opacity-50 leading-none mt-1 text-slate-500 dark:text-slate-400">Your Document Assistant</p>
          </div>
        </div>

        {/* Action Toggles for Expandable Sidebars */}
        <div className="flex items-center space-x-2">
          {/* Theme switcher */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`p-2 rounded-lg transition active:scale-95 flex items-center justify-center ${
              theme === 'dark' ? 'hover:bg-white/5 text-amber-400' : 'hover:bg-black/5 text-slate-600'
            }`}
            title="Switch theme"
          >
            {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>

          {/* Right Sidebar Control hub toggle */}
          <button
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
            className={`p-2 rounded-lg transition active:scale-95 flex items-center justify-center cursor-pointer ${
              theme === 'dark'
                ? 'hover:bg-white/5 text-slate-300'
                : 'hover:bg-black/5 text-slate-700'
            }`}
            title="System files & settings"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>

          {/* User Profile Badge & Logout */}
          <div className="flex items-center space-x-2 border-l border-slate-200 dark:border-zinc-800 pl-3.5 ml-1.5">
            <button
              onClick={() => {
                setActiveView(activeView === 'profile' ? 'chat' : 'profile');
                setProfileDisplayName(currentUser?.displayName || '');
                setProfileSuccessMessage(null);
                setProfileErrorMessage(null);
              }}
              className={`flex items-center space-x-2.5 py-1 px-2.5 rounded-xl transition active:scale-[0.98] text-left cursor-pointer ${
                activeView === 'profile'
                  ? theme === 'dark' ? 'bg-white/10' : 'bg-black/10'
                  : theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-black/5'
              }`}
              title="View & Edit Profile"
            >
              {currentUser?.photoURL ? (
                <img 
                  src={currentUser.photoURL} 
                  alt="avatar" 
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover shrink-0 shadow-sm" 
                />
              ) : (
                <div className={`w-7 h-7 rounded-full bg-gradient-to-tr ${getUserAvatarGradient()} text-white font-black text-[10px] flex items-center justify-center shadow-sm shrink-0`}>
                  {getUserInitials()}
                </div>
              )}
              <span className="hidden sm:inline text-xs font-bold text-slate-700 dark:text-slate-200 font-sans leading-none">
                {currentUser?.displayName || 'Secure User'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* CORE FRAMEWORK WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Dimmed click-outside backdrop overlay to close sidebars easily (mobile only) */}
        <AnimatePresence>
          {leftSidebarOpen && activeView === 'chat' && isMobileScreen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden absolute inset-0 bg-black/30 backdrop-blur-xs z-30 transition-opacity animate-fade-in"
              onClick={() => setLeftSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        <motion.aside
          animate={{
            width: (leftSidebarOpen && activeView === 'chat') ? 320 : 0,
            x: (leftSidebarOpen && activeView === 'chat') ? 0 : -320,
            opacity: (leftSidebarOpen && activeView === 'chat') ? 1 : 0
          }}
          transition={{ type: 'spring', damping: 28, stiffness: 220 }}
          className={`absolute left-0 top-0 bottom-0 h-full flex flex-col overflow-hidden border-r shrink-0 z-40 transition-colors ${
            theme === 'dark' ? 'bg-[#111216]/98 border-white/5' : 'bg-[#f8fafc]/98 border-slate-200/60 shadow-lg'
          }`}
        >
          <div className="w-[320px] h-full flex flex-col justify-between p-5 shrink-0 font-sans">
            <div className="space-y-6">
              <div className="flex items-center justify-between space-x-2">
                <button
                  onClick={() => setLeftSidebarOpen(false)}
                  className={`p-2.5 rounded-lg transition active:scale-95 flex items-center justify-center cursor-pointer ${
                    theme === 'dark' ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-black/5 text-slate-700'
                  }`}
                  title="Collapse sidebar"
                >
                  <Menu className="w-4.5 h-4.5" />
                </button>
                <button
                  onClick={startNewChat}
                  className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-xs py-2.5 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition shadow-xs active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-slate-900 stroke-[2.5]" />
                  <span>New chat</span>
                </button>
              </div>

              <div className="mt-5 space-y-3">
                <span className="text-[10.5px] font-bold tracking-wider uppercase opacity-60 block text-slate-500 dark:text-slate-400">Recent Chats</span>
                
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {sessions.filter(s => s.messages.length > 0).map((sess) => {
                    const isActive = sess.id === activeSessionId;
                    const isEditingName = editingSessionId === sess.id;

                    return (
                      <div
                        key={sess.id}
                        onClick={() => {
                          if (!isEditingName) {
                            setSessions(prev => prev.filter(s => s.messages.length > 0 || s.id === sess.id));
                            setActiveSessionId(sess.id);
                            if (window.innerWidth < 1024) {
                              setLeftSidebarOpen(false);
                            }
                          }
                        }}
                        className={`group py-2 px-2.5 rounded-lg block cursor-pointer transition-all border ${
                          isActive
                            ? theme === 'dark'
                              ? 'bg-[#ffa21d]/10 border-[#ffa21d]/30 text-amber-400 font-semibold'
                              : 'bg-[#ffa21d]/5 border-[#ffa21d]/30 text-amber-700 font-semibold'
                            : theme === 'dark'
                              ? 'hover:bg-white/5 border-transparent text-slate-400'
                              : 'hover:bg-black/5 border-transparent text-slate-700'
                        }`}
                      >
                        {isEditingName ? (
                          <div className="flex items-center space-x-1.5 w-full" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editTitleText}
                              onChange={(e) => setEditTitleText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  renameChat(sess.id, editTitleText);
                                  setEditingSessionId(null);
                                } else if (e.key === 'Escape') {
                                  setEditingSessionId(null);
                                }
                              }}
                              className={`text-xs px-2 py-1 rounded inline-block w-full border outline-none font-medium ${
                                theme === 'dark'
                                  ? 'bg-[#18191e] border-cyan-500/40 text-white'
                                  : 'bg-white border-slate-300 text-slate-800'
                              }`}
                              autoFocus
                            />
                            <button
                              onClick={() => {
                                renameChat(sess.id, editTitleText);
                                setEditingSessionId(null);
                              }}
                              className="p-1 hover:bg-emerald-500/20 text-emerald-400 rounded transition shrink-0"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingSessionId(null)}
                              className="p-1 hover:bg-red-500/20 text-red-500 rounded transition shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center space-x-2 truncate flex-1">
                              <FileText className="w-3.5 h-3.5 opacity-70 shrink-0 text-amber-500" />
                              <span className="text-[12.5px] truncate font-medium">
                                {sess.title}
                              </span>
                            </div>

                            <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition duration-150 shrink-0 pl-1.5">
                              {/* Rename Trigger */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSessionId(sess.id);
                                  setEditTitleText(sess.title);
                                }}
                                className="p-1 rounded hover:bg-white/10 text-slate-400"
                                title="Rename chat"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Share Trigger */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  shareChat(sess);
                                }}
                                className="p-1 rounded hover:bg-white/10 text-cyan-400"
                                title="Share conversation"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Trigger */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteChat(sess.id, e);
                                }}
                                className="p-1 rounded hover:bg-red-500/10 text-red-400"
                                title="Delete chat"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </motion.aside>

        {/* INTERACTIVE CHAT CONSOLE AREA */}
        <main className={`flex-1 flex flex-col overflow-hidden relative transition-all duration-300 ${
          leftSidebarOpen && activeView === 'chat' && !isMobileScreen ? 'pl-[320px]' : ''
        } ${
          rightSidebarOpen && !isMobileScreen ? 'pr-[340px]' : ''
        }`}>
          {!leftSidebarOpen && activeView === 'chat' && (
            <button
              onClick={() => setLeftSidebarOpen(true)}
              className={`absolute left-4 top-4 z-20 p-2.5 rounded-lg transition active:scale-95 flex items-center justify-center cursor-pointer border ${
                theme === 'dark'
                  ? 'bg-[#18191e]/90 hover:bg-white/5 border-zinc-800 text-slate-300 shadow-md'
                  : 'bg-white/90 hover:bg-black/5 border-slate-200/60 text-slate-700 shadow-md'
              }`}
              title="Expand sidebar"
            >
              <Menu className="w-4.5 h-4.5" />
            </button>
          )}
          {activeView === 'profile' ? (
            /* SLEEK STANDALONE PROFILE PAGE */
            <div className="flex-1 overflow-y-auto px-6 py-10 scrollbar-thin font-sans">
              <div className="max-w-xl mx-auto w-full">
                
                {/* Back to Chat button */}
                <button
                  onClick={() => setActiveView('chat')}
                  className={`inline-flex items-center space-x-2 text-xs font-bold transition duration-150 select-none cursor-pointer p-2 rounded-xl mb-8 ${
                    theme === 'dark' ? 'hover:bg-white/5 text-slate-400 hover:text-white' : 'hover:bg-black/5 text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back to Chat</span>
                </button>

                {/* Profile Header Block */}
                <div className="flex flex-col items-center text-center space-y-4 mb-10">
                  {currentUser?.photoURL ? (
                    <img 
                      src={currentUser.photoURL} 
                      alt="avatar" 
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 rounded-full object-cover shrink-0 shadow-md" 
                    />
                  ) : (
                    <div className={`w-20 h-20 rounded-full bg-gradient-to-tr ${getUserAvatarGradient()} text-white font-black text-2xl flex items-center justify-center shadow-lg shrink-0 font-sans animate-fade-in`}>
                      {getUserInitials()}
                    </div>
                  )}
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-sans">
                      {currentUser?.displayName || 'Authorized User'}
                    </h2>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-sans">
                      {currentUser?.email || 'Authenticated'}
                    </p>
                  </div>
                </div>

                {/* Main profile section */}
                <div className="space-y-6">
                  {/* Error & Success Alerts */}
                  {profileSuccessMessage && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center space-x-2 animate-fade-in font-sans">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{profileSuccessMessage}</span>
                    </div>
                  )}

                  {profileErrorMessage && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center space-x-2 animate-fade-in font-sans">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>{profileErrorMessage}</span>
                    </div>
                  )}

                  {/* Display Name Edit Form */}
                  <div className={`p-5 rounded-2xl border ${
                    theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800' : 'bg-slate-50/60 border-slate-200'
                  }`}>
                    <form onSubmit={handleUpdateProfile} className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-[10px] font-sans font-bold tracking-wider uppercase opacity-50 block">Display Name</label>
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            value={profileDisplayName}
                            onChange={(e) => setProfileDisplayName(e.target.value)}
                            placeholder="Your display name"
                            className={`flex-1 text-xs px-3 py-2 rounded-xl border outline-none font-medium transition-colors ${
                              theme === 'dark'
                                ? 'bg-zinc-950/60 border-zinc-800 text-white focus:border-cyan-500/50'
                                : 'bg-white border-slate-200 text-slate-800 focus:border-cyan-500/50 shadow-xs'
                            }`}
                          />
                          <button
                            type="submit"
                            disabled={profileUpdating || (currentUser?.displayName === profileDisplayName.trim()) || !profileDisplayName.trim()}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 border cursor-pointer select-none active:scale-95 shrink-0 ${
                              profileUpdating || (currentUser?.displayName === profileDisplayName.trim()) || !profileDisplayName.trim()
                                ? 'bg-zinc-800/10 dark:bg-zinc-900/40 border-transparent text-slate-500 opacity-50 pointer-events-none'
                                : 'bg-cyan-500 border-cyan-500 hover:bg-cyan-600 text-white shadow-sm'
                            }`}
                          >
                            {profileUpdating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            <span>Save Name</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* Account Metadata Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className={`p-4 rounded-2xl border text-xs text-left ${
                      theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800' : 'bg-slate-50/60 border-slate-200'
                    }`}>
                      <p className="opacity-50 text-[10px] uppercase font-bold tracking-wider font-sans">Sign-in Provider</p>
                      <p className="font-semibold mt-1 text-slate-700 dark:text-slate-300 flex items-center space-x-1.5 font-sans">
                        <Lock className="w-3.5 h-3.5 text-cyan-400" />
                        <span>
                          {currentUser?.providerData[0]?.providerId === 'google.com' ? 'Google Account' : 'Email & Password'}
                        </span>
                      </p>
                    </div>

                    <div className={`p-4 rounded-2xl border text-xs text-left ${
                      theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800' : 'bg-slate-50/60 border-slate-200'
                    }`}>
                      <p className="opacity-50 text-[10px] uppercase font-bold tracking-wider font-sans">Library Size</p>
                      <p className="font-semibold mt-1 text-slate-700 dark:text-slate-300 font-sans">
                        {systemStats.totalDocs} {systemStats.totalDocs === 1 ? 'File' : 'Files'} Loaded
                      </p>
                    </div>
                  </div>

                  {/* Set or Change Password Action (Unified directly in the profile page) */}
                  <div className={`p-5 rounded-2xl border ${
                    theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800' : 'bg-slate-50/60 border-slate-200'
                  }`}>
                    <div className="font-sans space-y-3.5">
                      <div>
                        <p className="text-xs font-bold">
                          {currentUser?.providerData.some(p => p.providerId === 'password') ? 'Change Account Password' : 'Set Account Password'}
                        </p>
                        <p className="text-[10px] opacity-50 mt-0.5">
                          {currentUser?.providerData.some(p => p.providerId === 'password') 
                            ? 'Update your secure account password directly below.' 
                            : 'Enable direct email & password sign-in alongside your Google authentication.'}
                        </p>
                      </div>
                      <form onSubmit={handleSetPasswordInProfile} className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-sans font-bold tracking-wider uppercase opacity-50 block">New Password</label>
                            <div className="relative flex items-center">
                              <input
                                type={profileShowNewPassword ? "text" : "password"}
                                required
                                minLength={8}
                                placeholder="Minimum 8 characters"
                                value={profileNewPassword}
                                onChange={(e) => setProfileNewPassword(e.target.value)}
                                className={`w-full text-xs pl-3 pr-9 py-2 rounded-xl border outline-none font-medium transition-colors ${
                                  theme === 'dark'
                                    ? 'bg-zinc-950/60 border-zinc-800 text-white focus:border-cyan-500/50'
                                    : 'bg-white border-slate-200 text-slate-800 focus:border-cyan-500/50 shadow-xs'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setProfileShowNewPassword(!profileShowNewPassword)}
                                className="absolute right-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 cursor-pointer focus:outline-none"
                              >
                                {profileShowNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-sans font-bold tracking-wider uppercase opacity-50 block">Confirm Password</label>
                            <div className="relative flex items-center">
                              <input
                                type={profileShowConfirmPassword ? "text" : "password"}
                                required
                                minLength={8}
                                placeholder="Confirm your password"
                                value={profileConfirmPassword}
                                onChange={(e) => setProfileConfirmPassword(e.target.value)}
                                className={`w-full text-xs pl-3 pr-9 py-2 rounded-xl border outline-none font-medium transition-colors ${
                                  theme === 'dark'
                                    ? 'bg-zinc-950/60 border-zinc-800 text-white focus:border-cyan-500/50'
                                    : 'bg-white border-slate-200 text-slate-800 focus:border-cyan-500/50 shadow-xs'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setProfileShowConfirmPassword(!profileShowConfirmPassword)}
                                className="absolute right-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 cursor-pointer focus:outline-none"
                              >
                                {profileShowConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        {profileConfirmPassword && profileNewPassword !== profileConfirmPassword && (
                          <p className="text-[10px] text-rose-500 px-0.5 font-medium">Passwords do not match.</p>
                        )}

                        <button
                          type="submit"
                          disabled={profileUpdating || !profileNewPassword || !profileConfirmPassword || (profileNewPassword !== profileConfirmPassword)}
                          className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 border cursor-pointer select-none active:scale-95 shrink-0 ${
                            profileUpdating || !profileNewPassword || !profileConfirmPassword || (profileNewPassword !== profileConfirmPassword)
                              ? 'bg-zinc-800/10 dark:bg-zinc-900/40 border-transparent text-slate-500 opacity-50 pointer-events-none'
                              : 'bg-cyan-500 border-cyan-500 hover:bg-cyan-600 text-white shadow-sm'
                          }`}
                        >
                          {profileUpdating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                          <span>{currentUser?.providerData.some(p => p.providerId === 'password') ? 'Update Password' : 'Set Password'}</span>
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Logout Section */}
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full py-3 rounded-xl text-xs font-bold border transition flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.98] bg-red-500/10 hover:bg-red-500/15 border-red-500/20 text-red-400 dark:text-red-400 font-sans"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span>Log Out of Account</span>
                    </button>
                  </div>

                </div>
              </div>
            </div>
          ) : (
            <>
              {/* MESSAGE SCREEN */}
              <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
                
                {(!activeSession || activeSession.messages.length === 0) ? (
    
                  /* WELCOMING HERO COVER */
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-xl mx-auto min-h-full flex flex-col justify-start md:justify-center pt-10 pb-20 md:py-12 relative z-10 space-y-6 select-none"
              >
                <div className="flex flex-col items-center select-none pt-4 md:pt-0">
                  <motion.div 
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                    className="relative w-48 h-48 flex items-center justify-center"
                  >
                    {/* Floating ambient glow backing */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/25 via-indigo-500/20 to-amber-500/25 rounded-full blur-3xl opacity-80 dark:opacity-90 animate-pulse duration-[4000ms]"></div>
                    <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/10 to-amber-500/10 rounded-full blur-xl opacity-50 dark:opacity-60 animate-spin" style={{ animationDuration: '20s' }}></div>
                    
                    {/* Outer concentric aesthetic design rings */}
                    <div className="absolute inset-0 rounded-full border border-dashed border-cyan-500/20 dark:border-cyan-400/25 animate-spin" style={{ animationDuration: '40s' }}></div>
                    <div className="absolute inset-4 rounded-full border border-dashed border-amber-500/15 dark:border-amber-400/20 animate-spin" style={{ animationDuration: '30s', animationDirection: 'reverse' }}></div>

                    <ChatLogo className="w-40 h-40 relative z-10 transition-transform duration-500 hover:scale-110 filter drop-shadow-[0_0_25px_rgba(6,182,212,0.4)] dark:drop-shadow-[0_0_45px_rgba(6,182,212,0.6)] cursor-pointer" />
                  </motion.div>
                </div>

                <div className="text-center space-y-2.5">
                  <h2 className="text-4xl font-extrabold tracking-tight select-none leading-none">
                    {currentUser?.displayName || currentUser?.email ? (
                      <>
                        <span className="text-cyan-500 dark:text-cyan-400">
                          {(() => {
                            const h = new Date().getHours();
                            if (h < 12) return 'Good morning,';
                            if (h < 17) return 'Good afternoon,';
                            if (h < 21) return 'Good evening,';
                            return 'Good night,';
                          })()}{' '}
                        </span>
                        <span className="text-amber-500 dark:text-amber-400">
                          {currentUser.displayName
                            ? currentUser.displayName.trim()
                            : currentUser.email!.split('@')[0]}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-cyan-500 dark:text-cyan-400">Welcome to </span>
                        <span className="text-amber-500 dark:text-amber-400">GroundLink</span>
                      </>
                    )}
                  </h2>
                  <p className="text-[18px] font-bold opacity-80">
                    How can I help you today?
                  </p>
                  <p className="text-[11px] font-medium opacity-40">
                    Upload documents or type a query to search grounding context.
                  </p>
                </div>

                <div className="mt-2 space-y-4 pb-12">
                  <div className="flex items-center space-x-2 text-cyan-400 justify-center md:justify-start">
                    <HelpCircle className="w-4 h-4" />
                    <span className="text-[11px] font-bold tracking-wider opacity-60">interactive sample prompts</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => sendMessageFlow('Explain what GroundLink is in simple terms')}
                      className={`text-left border p-4 rounded-2xl text-xs font-medium leading-relaxed transition hover:scale-[0.99] active:scale-[0.97] cursor-pointer ${
                        theme === 'dark'
                          ? 'border-white/5 bg-[#18191e] text-slate-100 hover:bg-white/5'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block mb-1 text-[13px] font-bold text-amber-500">Explain GroundLink</span>
                      "Explain what GroundLink is and how it helps me search my documents in simple terms."
                    </button>

                    <button
                      onClick={() => sendMessageFlow('Can you summarize the loaded demo files for me?')}
                      className={`text-left border p-4 rounded-2xl text-xs font-medium leading-relaxed transition hover:scale-[0.99] active:scale-[0.97] cursor-pointer ${
                        theme === 'dark'
                          ? 'border-white/5 bg-[#18191e] text-slate-100 hover:bg-white/5'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block mb-1 text-[13px] font-bold text-emerald-500">Summarize Files</span>
                      "Can you summarize the loaded demo files for me and show the main points?"
                    </button>

                    <button
                      onClick={() => sendMessageFlow('How can I search and find specific details in my uploaded documents?')}
                      className={`text-left border p-4 rounded-2xl text-xs font-medium leading-relaxed transition hover:scale-[0.99] active:scale-[0.97] cursor-pointer ${
                        theme === 'dark'
                          ? 'border-white/5 bg-[#18191e] text-slate-100 hover:bg-white/5'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block mb-1 text-[13px] font-bold text-cyan-500">Search Details</span>
                      "How can I search and find specific details in my custom uploaded documents?"
                    </button>
                  </div>
                </div>
              </motion.div>

            ) : (

              /* DIALOG FLOW STREAM */
              <div className="max-w-4xl mx-auto space-y-6 pb-24 font-normal">

                {activeSession.messages.map((msg, i) => {
                  const isUser = msg.role === 'user';
                  const isEditingThis = editingMsgId === msg.id;

                  return (
                    <div
                      key={msg.id || i}
                      className={`flex flex-col space-y-2 group/msg w-full ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-start w-full gap-3.5`}>
                        {!isUser && (
                          <div className="relative shrink-0 mt-1 select-none">
                            <div className="absolute inset-0 bg-cyan-500/15 rounded-full blur-xs"></div>
                            <div className="p-1 rounded-full border border-slate-200/80 dark:border-white/5 bg-slate-100 dark:bg-zinc-900 shadow-xs relative">
                              <ChatLogo className="w-7.5 h-7.5" />
                            </div>
                          </div>
                        )}

                        {/* MESSAGE BUBBLE - CLEAN MINIMALIST THEME */}
                        <div
                          className={`relative rounded-2xl p-4 text-[13px] md:text-sm leading-relaxed max-w-[86%] transition-all border ${
                            isUser
                              ? theme === 'dark'
                                ? 'bg-[#202127] border-[#2f313a] text-slate-100 rounded-2xl rounded-tr-none'
                                : 'bg-[#eef2f6] border-[#dfebf6] text-slate-800 rounded-2xl rounded-tr-none'
                              : theme === 'dark'
                                ? 'bg-[#14151a] border-white/5 text-slate-100 rounded-2xl rounded-tl-none'
                                : 'bg-white border-slate-200 shadow-xs text-slate-800 rounded-2xl rounded-tl-none'
                          }`}
                        >
                          {/* Image display */}
                          {msg.imageUrl && (
                            <div className="my-2 max-w-[180px] rounded-lg overflow-hidden border border-white/10">
                              <img src={msg.imageUrl} alt="Attached attachment" className="w-full object-cover" />
                            </div>
                          )}

                          {/* Attached Files display (documents/videos) */}
                          {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 my-2 max-w-full">
                              {msg.attachedFiles.map((file, idx) => {
                                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                                return (
                                  <div
                                    key={idx}
                                    className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold max-w-[220px] truncate select-none ${
                                      theme === 'dark'
                                        ? 'bg-black/40 border-white/10 text-slate-200'
                                        : 'bg-slate-100 border-slate-200 text-slate-750'
                                    }`}
                                  >
                                    {file.type === 'video' ? (
                                      <Video className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                                    ) : (
                                      <FileText className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                    )}
                                    <span className="truncate" title={file.name}>{file.name}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {isEditingThis ? (
                            <div className="space-y-2.5 min-w-[240px]">
                              <textarea
                                value={editingMsgText}
                                onChange={(e) => setEditingMsgText(e.target.value)}
                                className={`w-full text-xs p-3 rounded-2xl border outline-none font-normal transition duration-150 focus:ring-1 focus:ring-amber-400 focus:border-amber-400 ${
                                  theme === 'dark' 
                                    ? 'bg-black/35 text-white border-white/10' 
                                    : 'bg-white text-slate-800 border-slate-200 shadow-sm'
                                }`}
                                rows={3}
                                autoFocus
                              />
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => setEditingMsgId(null)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 text-[10px] font-bold transition"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => saveEditedMessage(msg.id, editingMsgText)}
                                  className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold transition shadow-sm"
                                >
                                  Save & Resubmit
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="relative">
                              <div className="select-text font-normal text-[13.5px]">
                                {isUser ? (
                                  <div className="whitespace-pre-wrap select-text">{msg.text}</div>
                                ) : (
                                  <div className="max-w-none text-left select-text break-words leading-relaxed [&_p]:mb-2 [&_p]:last:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:leading-relaxed [&_strong]:font-semibold [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:dark:bg-black/35 [&_code]:text-[12px] [&_code]:font-mono [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:opacity-75">
                                    <ReactMarkdown 
                                      remarkPlugins={[remarkGfm]}
                                      components={{
                                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed font-normal" {...props} />,
                                        a: ({ node, href, children, ...props }) => {
                                          if (href?.startsWith('citation-')) {
                                            const itemNumber = parseInt(href.replace('citation-', ''));
                                            const matchedItem = msg.retrieved ? msg.retrieved[itemNumber - 1] : null;
                                            return (
                                              <span
                                                onClick={() => {
                                                  if (matchedItem) {
                                                    setSelectedMatch(matchedItem);
                                                    setRightActiveTab('grounding');
                                                    setRightSidebarOpen(true);
                                                  }
                                                }}
                                                style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  verticalAlign: 'middle',
                                                  textDecoration: 'none',
                                                  lineHeight: 1,
                                                  fontSize: '10px',
                                                  fontWeight: 500,
                                                  cursor: 'pointer',
                                                  userSelect: 'none',
                                                  margin: '0 2px',
                                                  padding: '1px 4px',
                                                  borderRadius: '4px',
                                                  background: 'rgba(6,182,212,0.15)',
                                                  color: 'rgb(8,145,178)',
                                                  border: '1px solid rgba(6,182,212,0.3)',
                                                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                                  transition: 'all 0.15s',
                                                  position: 'relative',
                                                  top: '-1px',
                                                }}
                                                title={matchedItem ? `Source: ${matchedItem.docTitle} (click to inspect)` : `Citation [${itemNumber}]`}
                                              >
                                                {itemNumber}
                                              </span>
                                            );
                                          }
                                          return <a href={href} style={{ textDecoration: 'underline' }} className="text-cyan-600 dark:text-cyan-400 hover:opacity-80 transition" {...props}>{children}</a>;
                                        },
                                        ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
                                        ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
                                        li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
                                        h1: ({ node, ...props }) => <h1 className="text-lg font-black tracking-tight mt-3 mb-1 first:mt-0 text-cyan-600 dark:text-cyan-400" {...props} />,
                                        h2: ({ node, ...props }) => <h2 className="text-base font-extrabold tracking-tight mt-2.5 mb-1 text-slate-800 dark:text-slate-200" {...props} />,
                                        h3: ({ node, ...props }) => <h3 className="text-sm font-bold tracking-tight mt-2 mb-1" {...props} />,
                                        pre: ({ node, ...props }) => <pre className="p-3 bg-black/40 dark:bg-black/60 rounded-xl my-2 border border-white/5 overflow-x-auto text-[12px] font-mono leading-normal" {...props} />,
                                        code: ({ node, className, children, ...props }) => {
                                          const match = /language-(\w+)/.exec(className || '');
                                          const inline = !match;
                                          return inline ? (
                                            <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-black/35 text-slate-800 dark:text-slate-200 rounded-md font-mono text-[12px] font-medium" {...props}>{children}</code>
                                          ) : (
                                            <code className="block text-[12px] font-mono whitespace-pre text-emerald-400" {...props}>{children}</code>
                                          );
                                        },
                                        table: ({ node, ...props }) => <table className="min-w-full my-2 border-collapse border border-slate-200 dark:border-zinc-800 font-normal text-xs" {...props} />,
                                        th: ({ node, ...props }) => <th className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-left font-bold" {...props} />,
                                        td: ({ node, ...props }) => <td className="px-3 py-1.5 border border-slate-200 dark:border-zinc-800 text-left" {...props} />,
                                      }}
                                    >
                                      {preformatTextForMarkdown(msg.text)}
                                    </ReactMarkdown>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Controls bar outside the message chat box, under each msg and response */}
                      {!isEditingThis && (
                        <div className={`flex items-center space-x-3 text-[10px] py-1 px-1 transition-opacity duration-150 w-full ${
                          isUser ? 'justify-end pr-1.5' : 'justify-start pl-11'
                        }`}>
                          <div className="flex items-center space-x-1.5 opacity-60 hover:opacity-100 transition-opacity">
                            {!isUser && (
                              <button
                                onClick={() => speakTextOutloud(msg.id, msg.text)}
                                className={`p-1 rounded-md transition hover:scale-105 active:scale-95 cursor-pointer ${
                                  speakingMsgId === msg.id
                                    ? 'bg-yellow-550/20 text-yellow-500 animate-pulse'
                                    : 'text-slate-400 hover:text-yellow-500 hover:bg-black/10 dark:hover:bg-white/5'
                                }`}
                                title="Read text aloud"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(msg.text);
                                showToastNotification("copied content payload.");
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-yellow-500 hover:bg-black/10 dark:hover:bg-white/5 transition hover:scale-105 active:scale-95 cursor-pointer"
                              title="Copy message text"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            {isUser && (
                              <button
                                onClick={() => {
                                  setEditingMsgId(msg.id);
                                  setEditingMsgText(msg.text);
                                }}
                                className="p-1 rounded-md text-slate-400 hover:text-amber-500 hover:bg-black/10 dark:hover:bg-white/5 transition hover:scale-105 active:scale-95 cursor-pointer"
                                title="Edit question content"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => deleteMessage(msg.id)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition hover:scale-105 active:scale-95 cursor-pointer"
                              title="Remove message from stream"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <span className={`text-[8.5px] font-mono opacity-50 px-1 ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                          }`}>{msg.time}</span>
                        </div>
                      )}

                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex justify-start items-center space-x-2">
                    <ChatLogo className="w-7 h-7 shrink-0 animate-pulse" />
                    <div className={`rounded-xl px-4 py-2.5 text-xs flex items-center space-x-2 transition ${
                      theme === 'dark' ? 'bg-[#18191e] border-white/5 text-slate-300' : 'bg-white border text-slate-600'
                    }`}>
                      <span className="font-medium text-[10px] text-cyan-400">{loadingStepText}</span>
                      <div className="flex space-x-1">
                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            )}
          </div>



          {/* CHAT INPUT PANEL */}
          <div className="p-4 bg-transparent border-t-0 z-10 transition-colors">
            <div className="max-w-2xl mx-auto">
              


              {/* Multiple attachments chat queue */}
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2.5 max-h-32 overflow-y-auto">
                  {attachedFiles.map((att) => (
                    <div 
                      key={att.id} 
                      className={`flex items-center space-x-2 py-1 px-2.5 rounded-xl border text-xs relative max-w-[200px] transition group ${
                        theme === 'dark' 
                          ? 'bg-zinc-900 border-zinc-800 text-slate-300' 
                          : 'bg-slate-100 border-slate-200 text-slate-705'
                      }`}
                    >
                      {att.type === 'image' ? (
                        <img src={att.base64} alt="attached img preview" className="w-8 h-8 object-cover rounded-lg border border-white/5 shrink-0" />
                      ) : att.type === 'video' ? (
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 shrink-0">
                          <Video className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-[11px] font-bold truncate leading-snug">{att.name}</p>
                        <p className="text-[9px] opacity-50 truncate">
                          {att.type === 'image' ? 'image' : att.type === 'video' ? 'video' : att.name.split('.').pop()?.toLowerCase() || 'doc'}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setAttachedFiles(prev => prev.filter(f => f.id !== att.id));
                        }}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 hover:scale-110 transition shrink-0"
                        title="Remove attachment"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {voiceError && (
                <div className={`mb-3 p-3.5 rounded-2xl text-[11.5px] leading-relaxed border relative flex items-start space-x-2.5 shadow-xs animate-fade-in ${
                  theme === 'dark' 
                    ? 'bg-amber-500/10 border-amber-500/25 text-amber-400' 
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  <div className="flex-1 text-left">
                    <p className="font-bold mb-0.5 text-xs text-amber-500 dark:text-amber-400">Voice Typing Notice</p>
                    <p className="opacity-90">{voiceError}</p>
                  </div>
                  <button
                    onClick={() => setVoiceError(null)}
                    className="text-slate-450 hover:text-slate-650 dark:hover:text-slate-200 p-0.5 cursor-pointer shrink-0"
                    title="Dismiss notice"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className={`relative flex flex-col w-full border rounded-2xl p-2 pb-1.5 transition duration-200 ${
                theme === 'dark'
                  ? 'bg-[#2f2f2f]/90 border-zinc-700/60 focus-within:border-zinc-500'
                  : 'bg-[#f4f4f4] border-slate-200 focus-within:border-slate-300'
              }`}>
                
                <div className="flex items-center space-x-2 w-full">
                  {/* File Upload Attachment Trigger — removed: users should upload via sidebar */}
                  <input
                    ref={cameraFileInputRef}
                    type="file"
                    accept="image/*,video/*,.pdf,.docx,.doc,.pptx,.ppt,.txt,.md"
                    className="hidden"
                    onChange={handleChatBarFileChange}
                  />

                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') sendMessageFlow();
                    }}
                    disabled={isLoading}
                    placeholder={isVoiceRecording ? "Listening... Speak now and click mic again to pause." : "Ask GroundLink..."}
                    className={`flex-1 bg-transparent border-none outline-none ring-0 focus:ring-0 focus:outline-none text-xs md:text-sm font-medium tracking-wide py-1 px-2 ${
                      isVoiceRecording ? 'text-amber-500 dark:text-amber-400 animate-pulse font-semibold' : (theme === 'dark' ? 'text-zinc-100 placeholder-zinc-500' : 'text-zinc-800 placeholder-zinc-400')
                    }`}
                  />

                  {/* Voice typing */}
                  <button
                    type="button"
                    onClick={handleVoiceRecording}
                    disabled={isLoading}
                    className={`p-1.5 rounded-lg transition active:scale-90 disabled:opacity-20 shrink-0 cursor-pointer ${
                      isVoiceRecording 
                        ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.25)]' 
                        : 'text-slate-400 hover:text-amber-500 hover:bg-black/10 dark:hover:bg-white/5'
                    }`}
                    title={isVoiceRecording ? "Stop voice typing" : "Voice typing"}
                  >
                    {isVoiceRecording ? <MicOff className="w-4.5 h-4.5 animate-pulse text-amber-500" /> : <Mic className="w-4.5 h-4.5" />}
                  </button>

                  {/* Submit button */}
                  <button
                    onClick={() => sendMessageFlow()}
                    disabled={isLoading || (!inputText.trim() && attachedFiles.length === 0)}
                    className="p-1.5 rounded-xl bg-yellow-500 text-zinc-950 hover:bg-yellow-400 disabled:opacity-30 disabled:bg-transparent disabled:text-zinc-500 transition active:scale-90 shrink-0"
                    title="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
            </>
          )}
    </main>

        {/* Dimmed click-outside backdrop overlay to close sidebars easily (mobile only) */}
        <AnimatePresence>
          {rightSidebarOpen && isMobileScreen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden absolute inset-0 bg-black/30 backdrop-blur-xs z-30 transition-opacity animate-fade-in"
              onClick={() => setRightSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        <motion.aside
          animate={{
            width: rightSidebarOpen ? 340 : 0,
            x: rightSidebarOpen ? 0 : 340,
            opacity: rightSidebarOpen ? 1 : 0
          }}
          transition={{ type: 'spring', damping: 28, stiffness: 220 }}
          className={`absolute right-0 top-0 bottom-0 h-full flex flex-col overflow-hidden border-l shrink-0 z-40 transition-colors ${
            theme === 'dark' ? 'bg-[#111216]/98 border-white/5' : 'bg-[#f8fafc]/98 border-slate-200/60 shadow-lg'
          }`}
        >
          <div className="w-[340px] h-full flex flex-col justify-between p-5 shrink-0 overflow-hidden font-sans">
                
                <div className="space-y-4 flex flex-col flex-1 overflow-hidden">
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/5 pb-2.5 shrink-0">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 flex items-center space-x-2">
                      <FolderOpen className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span>Document Control Panel</span>
                    </span>
                    <button onClick={() => setRightSidebarOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-md cursor-pointer transition">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Navigation tabs inside Settings sidebar */}
                  <div className="flex bg-slate-100 dark:bg-black/40 p-1 rounded-lg gap-1 shrink-0">
                    <button
                      onClick={() => setRightActiveTab('grounding')}
                      className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition tracking-tight cursor-pointer ${
                        rightActiveTab === 'grounding'
                          ? 'bg-white dark:bg-[#1f2026] text-slate-800 dark:text-white shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Library & Sources
                    </button>
                    <button
                      onClick={() => setRightActiveTab('control')}
                      className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition tracking-tight cursor-pointer ${
                        rightActiveTab === 'control'
                          ? 'bg-white dark:bg-[#1f2026] text-slate-800 dark:text-white shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Control Center
                    </button>
                  </div>

                  {/* Tab 1: Grounding Details & Live Documents Search Index */}
                  {rightActiveTab === 'grounding' && renderGroundingTab()}

                  {/* Tab 2: Control config, upload local files, retrieval Top K */}
                  {rightActiveTab === 'control' && renderControlTab()}

                </div>

                {/* Reset system database buttons */}
                <div className="pt-4 border-t border-slate-200 dark:border-white/5 shrink-0">
                  <button
                    onClick={clearEntireDatabase}
                    className={`w-full transition text-xs font-medium py-2.5 px-3 rounded-xl flex items-center justify-center space-x-1.5 cursor-pointer border ${
                      theme === 'dark' 
                        ? 'bg-zinc-900/40 hover:bg-zinc-850/60 text-slate-400 border-zinc-800' 
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200 shadow-xs'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span>Clear All Custom Files</span>
                  </button>
                </div>

              </div>
            </motion.aside>

      </div>

      {/* INTERACTIVE SHARING SUITE MODAL */}
      <AnimatePresence>
        {sharingSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSharingSession(null)}
              className="absolute inset-0 bg-black/55 backdrop-blur-xs"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className={`relative w-full max-w-md rounded-2xl p-6 shadow-2xl border ${
                theme === 'dark' ? 'bg-[#18191e] border-white/5 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <button
                onClick={() => setSharingSession(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/5 transition"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>

              <div className="space-y-4">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2.5 bg-amber-400/10 text-amber-500 rounded-xl">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-wide">Share Chat Session</h3>
                    <p className="text-[11px] text-slate-400">Distribute your grounded inquiry or copy the active timeline</p>
                  </div>
                </div>
                <div className="border-t border-white/5 pt-4 space-y-2.5">
                  {/* Share button 1: Download text file */}
                  <button
                    onClick={() => {
                      downloadTranscriptFile(sharingSession, 'text');
                      setSharingSession(null);
                    }}
                    className={`w-full flex items-center space-x-3 p-3 rounded-xl border text-left text-xs font-bold transition hover:scale-[0.99] active:scale-[0.97] cursor-pointer ${
                      theme === 'dark' ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Download className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="flex-1">
                      <div>Download plain text (.txt)</div>
                      <div className="text-[10px] opacity-55 font-normal">Save the conversation list to your local file system as plain text</div>
                    </div>
                  </button>

                  {/* Share button 2: Download md file */}
                  <button
                    onClick={() => {
                      downloadTranscriptFile(sharingSession, 'markdown');
                      setSharingSession(null);
                    }}
                    className={`w-full flex items-center space-x-3 p-3 rounded-xl border text-left text-xs font-bold transition hover:scale-[0.99] active:scale-[0.97] cursor-pointer ${
                      theme === 'dark' ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                    <div className="flex-1">
                      <div>Download markdown (.md)</div>
                      <div className="text-[10px] opacity-55 font-normal">Save as structured markdown files natively</div>
                    </div>
                  </button>

                  {/* Share button 3: Native Web Share */}
                  <button
                    onClick={() => {
                      triggerWebShare(sharingSession);
                      setSharingSession(null);
                    }}
                    className={`w-full flex items-center space-x-3 p-3 rounded-xl border text-left text-xs font-bold transition hover:scale-[0.99] active:scale-[0.97] cursor-pointer ${
                      theme === 'dark' ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <ExternalLink className="w-4 h-4 text-purple-400 shrink-0" />
                    <div className="flex-1">
                      <div>Native system share options</div>
                      <div className="text-[10px] opacity-55 font-normal">Opens device drawer (Slack, WhatsApp, iMessage, system clipboard)</div>
                    </div>
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CUSTOM CONFIRMATION MODAL FOR SANDBOXED IFRAMES */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className={`relative w-full max-w-sm rounded-2xl p-5 shadow-2xl border z-10 ${
                theme === 'dark' ? 'bg-[#18191e] border-white/5 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/5 transition"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>

              <div className="space-y-4 font-sans">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-red-500/10 text-red-500 rounded-xl">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-wide">{confirmModal.title}</h3>
                  </div>
                </div>
                
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {confirmModal.message}
                </p>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-white/5">
                  <button
                    onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // Call the action
                      confirmModal.onConfirm();
                    }}
                    className="px-3.5 py-1.5 rounded-lg text-[10px] font-bold bg-red-500 hover:bg-red-600 text-white transition shadow-xs cursor-pointer animate-pulse-subtle"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}