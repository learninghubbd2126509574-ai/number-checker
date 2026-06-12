import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Lock, 
  Search, 
  LogOut, 
  Settings, 
  Plus, 
  Trash2, 
  Edit, 
  AlertTriangle, 
  CheckCircle2, 
  Save, 
  AlertCircle, 
  X, 
  Key, 
  Check, 
  Trash,
  ChevronRight,
  UserCheck,
  Database,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  collection, 
  deleteDoc, 
  serverTimestamp
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  signInAnonymously, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { db, auth, googleProvider, OperationType, handleFirestoreError } from './firebase';
import { PhoneRecord, AdminSettings, RecordStatus, RecordCategory, RegistrationCountRecord } from './types';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // Navigation tabs (between Public Search and Admin Panel)
  const [activeNavTab, setActiveNavTab] = useState<'search' | 'admin'>('search');
  
  // App-level dynamic system settings (live from Firestore)
  const [settings, setSettings] = useState<AdminSettings>({
    pin: '4012',
    allowedEmails: [],
    helpVideoUrl: ''
  });

  // Loader states
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auth & Admin state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isPinAdmin, setIsPinAdmin] = useState<boolean>(() => {
    return localStorage.getItem('unity_pin_auth_active') === 'true';
  });

  // Check if a Google Authenticated user is inside settings.allowedEmails
  const isGoogleAllowed = currentUser && settings.allowedEmails.some(
    email => email.toLowerCase() === currentUser.email?.toLowerCase()
  );
  
  const isAdminActive = Boolean(isGoogleAllowed) || isPinAdmin;

  // Admin Dashboard settings drawer state
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  
  // Admin form sub-tab: 'form' (add/edit), 'data' (record list) or 'counts' (registration counters)
  const [adminActiveSubTab, setAdminActiveSubTab] = useState<'form' | 'data' | 'counts'>('form');

  // Custom Registration Counts states
  const [registrationCounts, setRegistrationCounts] = useState<RegistrationCountRecord[]>([]);
  const [searchedCount, setSearchedCount] = useState<number | null>(null);
  const [isSavingCount, setIsSavingCount] = useState(false);
  const [editingCountId, setEditingCountId] = useState<string | null>(null);
  const [editingCountVal, setEditingCountVal] = useState<number>(0);
  const [deleteCountTargetId, setDeleteCountTargetId] = useState<string | null>(null);
  const [adminCountSearchQuery, setAdminCountSearchQuery] = useState('');

  // Input states for Admin login
  const [enteredPin, setEnteredPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showPinHint, setShowPinHint] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  // Custom delete record dialog state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Check if inside iframe
  const [isIframe, setIsIframe] = useState(false);
  useEffect(() => {
    setIsIframe(window.self !== window.top);
  }, []);

  // Live Records in Admin Panel
  const [records, setRecords] = useState<PhoneRecord[]>([]);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');

  // Settings modification input states
  const [newSettingsPin, setNewSettingsPin] = useState('');
  const [newSettingsEmail, setNewSettingsEmail] = useState('');
  const [newSettingsVideoUrl, setNewSettingsVideoUrl] = useState('');

  // Live Public Search states
  const [searchPhone, setSearchPhone] = useState('');
  const [searchResult, setSearchResult] = useState<{
    searched: boolean;
    found: boolean;
    record?: PhoneRecord;
    searchedNo?: string;
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSavedInCurrentSearch, setHasSavedInCurrentSearch] = useState(false);
  const [searchFeedbackText, setSearchFeedbackText] = useState('');

  // Record Entry Form Input states
  const [formPhone, setFormPhone] = useState('');
  const [formStatus, setFormStatus] = useState<RecordStatus>('flagged');
  const [formCategory, setFormCategory] = useState<RecordCategory>('Fake Lead');
  const [formNote, setFormNote] = useState('');
  
  // Checking if currently editing an existing record (contains number id if true)
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  // Toast message states
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Helper: Normalize Bangladeshi phone number formats beautifully
  const normalizePhone = (num: string): string => {
    let cleaned = num.replace(/[^0-9]/g, ''); // keep only digits
    if (cleaned.startsWith('880')) {
      cleaned = cleaned.slice(2); // trim off prefix '88'
    } else if (cleaned.startsWith('88')) {
       cleaned = cleaned.slice(2);
    }
    // Ensure it always yields full digits in local context
    return cleaned;
  };

  // Helper: Translate/format category names elegantly for Bengali & English
  const formatCategoryLabel = (category: string): string => {
    switch (category) {
      case 'Fake Leader':
      case 'Fake Lead':
        return 'Fake Lead / ভুয়া লিড';
      case 'Attacker':
        return 'Attacker / আক্রমণকারী';
      case 'Bad Behavior':
        return 'Bad Behavior / খারাপ আচরণ';
      case 'Deleted Member':
        return 'Deleted Member / ডিলিটকৃত মেম্বার';
      case 'Other':
        return 'Other / অন্যান্য সমস্যা';
      case 'None':
        return 'None / কোনো সমস্যা নেই';
      default:
        return category || 'None';
    }
  };

  // 1. Listen for Auth changes in background
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsInitializing(false);
    });
    return unsubscribe;
  }, []);

  // 2. Setup Live settings subscriber & bootstrap default config if absent
  useEffect(() => {
    const settingsRef = doc(db, 'settings', 'admin');
    
    const unsubscribe = onSnapshot(settingsRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSettings({
          pin: data.pin || '4012',
          allowedEmails: data.allowedEmails || [],
          helpVideoUrl: data.helpVideoUrl || ''
        });
        setIsSettingsLoading(false);
      } else {
        // Bootstrap Default settings document on first start
        try {
          const defaultSettings: AdminSettings = {
            pin: '4012',
            allowedEmails: [],
            helpVideoUrl: ''
          };
          await setDoc(settingsRef, defaultSettings);
          setSettings(defaultSettings);
          setIsSettingsLoading(false);
        } catch (error) {
          console.error("Initialization Failed when writing settings: ", error);
          setIsSettingsLoading(false);
        }
      }
    }, (error) => {
      setIsSettingsLoading(false);
      handleFirestoreError(error, OperationType.GET, 'settings/admin');
    });

    return unsubscribe;
  }, []);

  // 3. Auto-login anonymously if PIN admin is active in localStorage but Firebase session is missing/expired
  useEffect(() => {
    if (isInitializing) return;
    if (isPinAdmin && !currentUser) {
      signInAnonymously(auth).catch((err) => {
        console.error("Auto anonymous sign-in failed during restoration:", err);
      });
    }
  }, [isInitializing, isPinAdmin, currentUser]);

  // 4. Setup Live Records list on Firestore if admin logged in and Firebase auth is ready
  useEffect(() => {
    if (isInitializing) return;
    if (!isAdminActive) return;
    if (!currentUser) return;

    const recordsCol = collection(db, 'records');
    const unsubscribe = onSnapshot(recordsCol, (snapshot) => {
      const list: PhoneRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          number: data.number,
          status: data.status,
          category: data.category || 'None',
          note: data.note,
          updatedAt: data.updatedAt,
          createdBy: data.createdBy || '',
          createdByEmail: data.createdByEmail || ''
        });
      });
      // Sort recently updated first
      list.sort((a, b) => {
        const aTime = a.updatedAt?.seconds || 0;
        const bTime = b.updatedAt?.seconds || 0;
        return bTime - aTime;
      });
      setRecords(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'records');
    });

    return unsubscribe;
  }, [isInitializing, isAdminActive, currentUser]);

  // 5. Setup Live Registration Counts list on Firestore if admin logged in and Firebase auth is ready
  useEffect(() => {
    if (isInitializing) return;
    if (!isAdminActive) return;
    if (!currentUser) return;

    const countsCol = collection(db, 'registration_counts');
    const unsubscribe = onSnapshot(countsCol, (snapshot) => {
      const list: RegistrationCountRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          number: data.number,
          count: data.count || 0,
          updatedAt: data.updatedAt
        });
      });
      // Sort by updatedAt or count descending
      list.sort((a, b) => {
        const aTime = a.updatedAt?.seconds || 0;
        const bTime = b.updatedAt?.seconds || 0;
        return bTime - aTime;
      });
      setRegistrationCounts(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'registration_counts');
    });

    return unsubscribe;
  }, [isInitializing, isAdminActive, currentUser]);

  // Auth Action: Google Login
  const handleGoogleLogin = async () => {
    try {
      setLoginError('');
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email || '';
      
      // Let's verify whether this logged-in account is listed
      const authIsAllowed = settings.allowedEmails.some(
        item => item.toLowerCase() === email.toLowerCase()
      );

      if (authIsAllowed) {
        showToast('এডমিন গুগোল লগইন সফল হয়েছে!', 'success');
      } else {
        showToast('অননুমোদিত ইমেইল! এডমিন মোডে প্রবেশের অনুমতি নেই।', 'error');
        // Instantly sign out to preserve safety
        await signOut(auth);
      }
    } catch (error: any) {
      console.error("Google Authenticate Call error: ", error);
      let errMsg = 'গুগোল যাচাইকরণ ব্যাহত হয়েছে।';
      if (error && (error.code === 'auth/popup-closed-by-user' || error.message?.includes('popup-closed-by-user'))) {
        errMsg = 'গুগল লগইন পপআপ বন্ধ করা হয়েছে! অনুগ্রহ করে ব্রাউজারের পপ-আপ অনুমতি (Allow Popups) দিন অথবা অ্যাপটি নতুন ট্যাবে ওপেন করে পুনরায় চেষ্টা করুন। বিকল্প হিসেবে নিচের ৪ ডিজিট পিন পাসওয়ার্ড (ডিফল্ট: 4012) দিয়ে লগইন করুন।';
      } else if (error && (error.code === 'auth/popup-blocked' || error.message?.includes('popup-blocked'))) {
        errMsg = 'ব্রাউজার পপ-আপ উইন্ডো ব্লক করেছে! অনুগ্রহ করে ব্রাউজারের পপ-আপ অনুমতি (Allow Popups) দিন অথবা উপরের "নতুন ট্যাবে অ্যাপ খুলুন" লিঙ্কে ক্লিক করে চেষ্টা করুন।';
      } else if (error && error.message) {
        errMsg = `গুগল লগইন ত্রুটি: ${error.message}`;
      }
      setLoginError(errMsg);
    }
  };

  // Auth Action: Check PIN Code Login
  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!enteredPin) {
      setLoginError('অনুগ্রহ করে ৪ সংখ্যার পাসওয়ার্ডটি টাইপ করুন।');
      return;
    }

    if (enteredPin === settings.pin) {
      try {
        // Authenticate anonymously so firestore security rules authorize operations
        await signInAnonymously(auth);
        setIsPinAdmin(true);
        localStorage.setItem('unity_pin_auth_active', 'true');
        showToast('পিন পাসওয়ার্ড লগইন সফল হয়েছে!', 'success');
        setEnteredPin('');
      } catch (err) {
        console.error("Anonymous authentication error: ", err);
        setLoginError('সার্ভার কানেকশন সমস্যা, পুনরায় চেষ্টা করুন।');
      }
    } else {
      setLoginError('ভুল পাসওয়ার্ড! অনুগ্রহ করে সঠিক পাসওয়ার্ড দিন।');
    }
  };

  // Auth Action: Log Out
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsPinAdmin(false);
      localStorage.removeItem('unity_pin_auth_active');
      showToast('লগআউট সফল হয়েছে!', 'success');
    } catch (error) {
      console.error("Logout process aborted: ", error);
    }
  };

  // Manage Settings: Change Password PIN
  const handleUpdatePin = async () => {
    if (!newSettingsPin || newSettingsPin.length < 4 || newSettingsPin.length > 10) {
      showToast('পাসওয়ার্ড অবশ্যই ৪ থেকে ১০ সংখ্যার হতে হবে!', 'error');
      return;
    }
    try {
      const settingsRef = doc(db, 'settings', 'admin');
      await updateDoc(settingsRef, { pin: newSettingsPin });
      showToast(`পাসওয়ার্ড সফলভাবে আপডেট হয়েছে! নতুন পিন: ${newSettingsPin}`, 'success');
      setNewSettingsPin('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/admin');
      showToast('পাসওয়ার্ড আপডেট করতে ব্যর্থ হয়েছে।', 'error');
    }
  };

  // Manage Settings: Add Admin Authorized Email
  const handleAddEmail = async () => {
    if (!newSettingsEmail || !newSettingsEmail.includes('@')) {
      showToast('একটি সঠিক জিমেইল এড্রেস প্রদান করুন!', 'error');
      return;
    }
    const cleanMail = newSettingsEmail.trim().toLowerCase();
    if (settings.allowedEmails.includes(cleanMail)) {
      showToast('এই জিমেইলটি ইতিমধ্যেই অনুমোদিত তালিকায় আছে।', 'error');
      return;
    }
    try {
      const settingsRef = doc(db, 'settings', 'admin');
      const updatedList = [...settings.allowedEmails, cleanMail];
      await updateDoc(settingsRef, { allowedEmails: updatedList });
      showToast('অনুমোদিত জিমেইল যুক্ত করা হয়েছে!', 'success');
      setNewSettingsEmail('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/admin');
      showToast('জিমেইল তালিকা হালনাগাদ করতে ব্যর্থ হয়েছে।', 'error');
    }
  };

  // Manage Settings: Delete Admin Authorized Email (Bootstrap mails cannot be deleted)
  const handleDeleteEmail = async (emailToDelete: string) => {
    const lowerEmail = emailToDelete.toLowerCase();
    try {
      const settingsRef = doc(db, 'settings', 'admin');
      const updatedList = settings.allowedEmails.filter(email => email.toLowerCase() !== lowerEmail);
      await updateDoc(settingsRef, { allowedEmails: updatedList });
      showToast('অনুমোদিত জিমেইল মুছে ফেলা হয়েছে।', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/admin');
      showToast('তালিকা হালনাগাদ ব্যর্থ হয়েছে।', 'error');
    }
  };

  // Manage Settings: Update Help Video URL
  const handleUpdateVideoUrl = async () => {
    try {
      const settingsRef = doc(db, 'settings', 'admin');
      await updateDoc(settingsRef, { helpVideoUrl: newSettingsVideoUrl.trim() });
      showToast('হেল্প ভিডিও লিংক সফলভাবে আপডেট হয়েছে!', 'success');
      setNewSettingsVideoUrl('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/admin');
      showToast('লিংক আপডেট ব্যর্থ হয়েছে।', 'error');
    }
  };

  // Public Search Action: Match Phone Registration
  const handlePublicSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPhone) {
      setSearchFeedbackText('একটি সচল ফোন নম্বর উল্লেখ করুন।');
      return;
    }
    setSearchFeedbackText('');
    setIsSearching(true);
    setHasSavedInCurrentSearch(false);

    const rawNo = searchPhone.trim();
    const normalizedNo = normalizePhone(rawNo);

    if (normalizedNo.length < 5) {
      setSearchFeedbackText('একটি সঠিক দৈর্ঘ্যপূর্ণ ফোন নম্বর লিখুন।');
      setIsSearching(false);
      return;
    }

    try {
      const recordDocRef = doc(db, 'records', normalizedNo);
      const docSnap = await getDoc(recordDocRef);

      // Fetch registration count!
      const countDocRef = doc(db, 'registration_counts', normalizedNo);
      const countDocSnap = await getDoc(countDocRef);
      if (countDocSnap.exists()) {
        setSearchedCount(countDocSnap.data().count || 0);
      } else {
        setSearchedCount(0);
      }

      if (docSnap.exists()) {
        const data = docSnap.data();
        const foundRecord: PhoneRecord = {
          id: docSnap.id,
          number: data.number,
          status: data.status,
          category: data.category || 'None',
          note: data.note,
          updatedAt: data.updatedAt,
          createdBy: data.createdBy,
          createdByEmail: data.createdByEmail
        };
        
        setSearchResult({
          searched: true,
          found: true,
          record: foundRecord,
          searchedNo: rawNo
        });
      } else {
        setSearchResult({
          searched: true,
          found: false,
          searchedNo: rawNo
        });
      }
    } catch (error) {
      console.error("Public single record fetch failed: ", error);
      // Fallback local storage lookup if Firestore lookup fails offline
      const localFallback = localStorage.getItem('unity_records_backup');
      if (localFallback) {
        try {
          const parsed = JSON.parse(localFallback) as PhoneRecord[];
          const recordFound = parsed.find(rec => normalizePhone(rec.number) === normalizedNo);
          if (recordFound) {
            setSearchResult({
              searched: true,
              found: true,
              record: recordFound,
              searchedNo: rawNo
            });
            setIsSearching(false);
            return;
          }
        } catch (re) {}
      }
      showToast('সার্ভার থেকে নম্বর তথ্য লোড করা যায়নি।', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchPhone('');
    setSearchResult(null);
    setSearchFeedbackText('');
    setSearchedCount(null);
    setHasSavedInCurrentSearch(false);
  };

  // Admin CRUD Action: Save / Edit Telephone Record
  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPhone) {
      showToast('নম্বর টাইপ করা বাধ্যতামূলক!', 'error');
      return;
    }
    if (!formNote) {
      showToast('একটি সচিত্র কারণ বা মন্তব্য যোগ করুন!', 'error');
      return;
    }

    const normalizedNo = normalizePhone(formPhone.trim());
    if (normalizedNo.length < 5) {
      showToast('অনুগ্রহ করে সঠিক নম্বরের সংখ্যা টাইপ করুন!', 'error');
      return;
    }

    const finalRecordPayload = {
      number: formPhone.trim(),
      status: formStatus,
      category: formStatus === 'flagged' ? formCategory : 'None',
      note: formNote.trim(),
      createdBy: currentUser?.uid || 'anonymous_admin',
      createdByEmail: currentUser?.email || 'Pin Authenticated Admin',
      updatedAt: serverTimestamp()
    };

    try {
      const recordDocRef = doc(db, 'records', normalizedNo);
      await setDoc(recordDocRef, finalRecordPayload);
      
      // Update local storage backup
      const updatedList = records.filter(r => normalizePhone(r.number) !== normalizedNo);
      const newBackupRecord: PhoneRecord = {
        id: normalizedNo,
        number: finalRecordPayload.number,
        status: finalRecordPayload.status as any,
        category: finalRecordPayload.category as any,
        note: finalRecordPayload.note,
        updatedAt: new Date().toISOString(),
        createdBy: finalRecordPayload.createdBy,
        createdByEmail: finalRecordPayload.createdByEmail
      };
      localStorage.setItem('unity_records_backup', JSON.stringify([newBackupRecord, ...updatedList]));

      showToast(
        editingRecordId 
          ? 'নম্বর রেকর্ডটি সফলভাবে হালনাগাদ করা হয়েছে!' 
          : 'নতুন নম্বর ডাটাবেজে সফলভাবে সংযুক্ত হয়েছে!', 
        'success'
      );

      // Reset form controls
      setFormPhone('');
      setFormNote('');
      setFormStatus('flagged');
      setFormCategory('Fake Lead');
      setEditingRecordId(null);
      // Switch view subtab back to records checklist
      setAdminActiveSubTab('data');

    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `records/${normalizedNo}`);
      showToast('নম্বর সেভ করা সম্ভব হয়নি, অনুমতিপত্র পরীক্ষা করুন।', 'error');
    }
  };

  // Admin CRUD Action: Delete Record
  const handleDeleteRecord = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteDoc(doc(db, 'records', deleteTargetId));
      showToast('নম্বর রেকর্ডটি সফলভাবে ডিলিট করা হয়েছে!', 'success');
      
      // Update local storage backup
      const updatedList = records.filter(r => r.id !== deleteTargetId);
      localStorage.setItem('unity_records_backup', JSON.stringify(updatedList));

      setDeleteTargetId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `records/${deleteTargetId}`);
      showToast('ডিলিট করা সম্ভব হয়নি।', 'error');
      setDeleteTargetId(null);
    }
  };

  // Public Action: Save / Increment Registration Count (সেভ / রেজিস্টার করুন)
  const handleSaveRegistrationCount = async (numToSave: string) => {
    const normalizedNo = normalizePhone(numToSave);
    if (!normalizedNo || normalizedNo.length < 5) return;

    setIsSavingCount(true);
    try {
      const countDocRef = doc(db, 'registration_counts', normalizedNo);
      const countDocSnap = await getDoc(countDocRef);
      const currentCount = countDocSnap.exists() ? (countDocSnap.data().count || 0) : 0;
      const newCount = currentCount + 1;

      await setDoc(countDocRef, {
        number: numToSave,
        count: newCount,
        updatedAt: serverTimestamp()
      });

      setSearchedCount(newCount);
      setHasSavedInCurrentSearch(true);
      showToast('নম্বরটি সফলভাবে রেজিস্ট্রেশন/সেভ করা হয়েছে!', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `registration_counts/${normalizedNo}`);
      showToast('সেভ করা সম্ভব হয়নি, পুনরায় চেষ্টা করুন।', 'error');
    } finally {
      setIsSavingCount(false);
    }
  };

  // Admin Action: Update Registration Count Value
  const handleUpdateRegistrationCount = async () => {
    if (!editingCountId) return;
    try {
      const countDocRef = doc(db, 'registration_counts', editingCountId);
      await updateDoc(countDocRef, {
        count: editingCountVal,
        updatedAt: serverTimestamp()
      });
      showToast('কাউন্টার সংখ্যা সফলভাবে আপডেট করা হয়েছে!', 'success');
      setEditingCountId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `registration_counts/${editingCountId}`);
      showToast('কাউন্ট আপডেট করতে ব্যর্থ হয়েছে।', 'error');
    }
  };

  // Admin Action: Delete Registration Count Document
  const handleDeleteRegistrationCount = async () => {
    if (!deleteCountTargetId) return;
    try {
      await deleteDoc(doc(db, 'registration_counts', deleteCountTargetId));
      showToast('কাউন্ট রেকর্ডটি সফলভাবে ডিলেট করা হয়েছে!', 'success');
      setDeleteCountTargetId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `registration_counts/${deleteCountTargetId}`);
      showToast('ডিলেট করা সম্ভব হয়নি।', 'error');
      setDeleteCountTargetId(null);
    }
  };

  // Trigger form population to edit an existing record
  const triggerEditRecord = (item: PhoneRecord) => {
    setFormPhone(item.number);
    setFormStatus(item.status);
    setFormCategory(item.category || 'None');
    setFormNote(item.note || '');
    setEditingRecordId(item.id);
    setAdminActiveSubTab('form');
  };

  // Derive filtered records according to live text queries in the admin search bar
  const filteredRecords = records.filter((item) => {
    const query = adminSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      item.number.toLowerCase().includes(query) ||
      (item.note && item.note.toLowerCase().includes(query)) ||
      (item.category && item.category.toLowerCase().includes(query))
    );
  });

  // Derive filtered count list according to text queries in admin counters tab
  const filteredCounts = registrationCounts.filter((item) => {
    const query = adminCountSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      item.number.toLowerCase().includes(query) ||
      (item.id && item.id.toLowerCase().includes(query))
    );
  });

  return (
    <div className="w-full min-h-screen bg-[#f0f2f5] flex items-center justify-center pointer-events-auto select-none md:p-4">
      {/* Main centered mobile responsive web layout card wrapper */}
      <div id="main_app_layout" className="w-full max-w-[430px] h-screen md:h-[840px] bg-[#f8fafc] md:border md:border-slate-200 md:rounded-[24px] md:shadow-[0_20px_50px_rgba(15,23,42,0.15)] overflow-hidden flex flex-col relative">

        {/* HEADER */}
        <div className="header shrink-0">
          <div className="header-logo">
            <div className="logo-icon select-none text-white">🛡</div>
            <span className="logo-text font-sans">UNITY EARNING</span>
          </div>
          <h1 className="font-sans">Unity Earning E-learning Platform</h1>
          <div className="subtitle font-sans font-medium">NUMBER CHECKING SYSTEM</div>
          <div className="bn-subtitle font-sans font-medium">নম্বর যাচাইকরণ পদ্ধতি</div>
          
          {/* Help Button */}
          <div className="absolute right-4 top-[132px] md:top-[148px] z-10 transition-all">
            <button
              onClick={() => {
                if (settings.helpVideoUrl) {
                  window.open(settings.helpVideoUrl, '_blank');
                } else {
                  showToast('হেল্প ভিডিও এখনো যুক্ত করা হয়নি।', 'error');
                }
              }}
              className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black px-3 py-1.8 rounded-full shadow-help-glow animate-soft-pulse border border-rose-400 transition-all active:scale-95"
            >
              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              সাহায্য (Help)
            </button>
          </div>
        </div>

        {/* Dynamic header option when logged in as admin to keep logout visible */}
        {!isOnline && (
          <div className="bg-amber-100 border-b border-amber-200 px-4 py-1.5 flex justify-center items-center z-20 shrink-0">
            <span className="text-[10px] text-amber-800 font-bold font-sans flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> ইন্টারনেট সংযোগ বিচ্ছিন্ন / Offline Mode
            </span>
          </div>
        )}
        {activeNavTab === 'admin' && isAdminActive && (
          <div className="bg-[#0a0f1d] border-b border-slate-800/80 px-4 py-2 flex justify-between items-center z-10 shrink-0">
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-[#10b981] animate-pulse' : 'bg-slate-400'}`}></span>
              <span className={`text-[11px] font-extrabold font-sans truncate ${isOnline ? 'text-[#10b981]' : 'text-slate-400'}`}>
                {isOnline ? 'এডমিন মোড সচল (Live Sync)' : 'অফলাইন মোড (Offline Mode)'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="bg-[#ef4444] hover:bg-rose-600 active:scale-[0.98] text-white text-[10.5px] font-black px-3 py-1 rounded-lg shrink-0 flex items-center gap-1 transition-all shadow-sm cursor-pointer outline-none border border-rose-500/10"
            >
              <LogOut className="w-3 h-3 text-[#fca5a5] shrink-0" /> লগআউট
            </button>
          </div>
        )}

        {/* Phone Scrolling Content View Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar bg-slate-50 relative">
          {activeNavTab === 'search' ? (
            
            // 👤 USER SEARCH SIDE VIEW WITH NEW LAYOUT STYLES
            <div className="p-3.5 space-y-4">
              
              {/* Search Card */}
              <div className="search-card select-none">
                <div className="card-title font-sans">
                  <div className="icon">?</div>
                  নম্বর চেক করুন / Check Registration
                </div>
                <div className="card-desc font-sans">
                  রেজিস্ট্রেশন করার পূর্বে নম্বরটি দিয়ে চেক করুন যে ডাটাবেজে কোনো সমস্যা রেকর্ড করা আছে কি না।
                </div>

                <form onSubmit={handlePublicSearch} className="space-y-3">
                  <div className="input-wrap">
                    <input
                      type="tel"
                      className="phone-input font-sans font-bold"
                      placeholder="ফোন নম্বরটি লিখুন... (যেমন: 017XXXXXXXX)"
                      maxLength={15}
                      value={searchPhone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setSearchPhone(val);
                        if (val === '') {
                          setSearchResult(null);
                          setSearchFeedbackText('');
                        }
                      }}
                    />
                    {searchPhone && (
                      <button
                        type="button"
                        className="clear-btn text-slate-400 hover:text-slate-600 outline-none"
                        onClick={handleClearSearch}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {searchFeedbackText && (
                    <p className="text-[11.5px] text-rose-500 font-semibold flex items-center gap-1 pb-1">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" /> {searchFeedbackText}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isSearching}
                    className="search-btn font-sans"
                  >
                    {isSearching ? (
                      <span className="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-1"></span>
                    ) : (
                      <>
                        <span>🔍</span>
                        <span>অনুসন্ধান করুন (Search Now)</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Result Area */}
              <div className="result-area">
                {!searchResult ? (
                  <div className="empty-state select-none">
                    <div className="empty-icon text-[32px] mb-2">🔍</div>
                    <p className="font-sans font-bold text-slate-700">কোনো নম্বর টাইপ করে অনুসন্ধান বাটনে ক্লিক করুন</p>
                    <small className="font-mono text-slate-500">Type a phone number and click search to verify</small>
                  </div>
                ) : (
                  <div>
                    <div className="result-header font-sans">
                      <span>
                        অনুসন্ধানকৃত নম্বর: <span className="text-slate-900 font-bold select-all font-mono">{searchResult.searchedNo}</span>
                      </span>
                    </div>

                    {searchResult.found && searchResult.record?.status === 'flagged' ? (
                      <div className="result-danger">
                        <div className="result-danger-header">
                          <div className="shield-red text-white flex items-center justify-center font-bold font-sans">⚠️</div>
                          <div>
                            <div className="title font-sans font-bold text-rose-700">সমস্যা পাওয়া গেছে!</div>
                            <div className="subtitle font-bold text-rose-500 font-mono tracking-wider">ISSUE RECORDED</div>
                          </div>
                        </div>
                        <div className="result-danger-body">
                          <div className="bg-rose-600 text-white p-3 rounded-xl mb-3 text-center animate-pulse border-2 border-rose-400 shadow-lg">
                            <p className="text-[13px] font-black font-sans leading-tight">
                              ⚠️ সতর্কবার্তা: এই নম্বর রেজিস্ট্রেশন করলে আপনাদের আইডি ব্লক হতে পারে!
                            </p>
                          </div>
                          <div className="result-danger-msg border border-red-200 shadow-sm rounded-lg p-3 space-y-1.5">
                            <p className="font-sans font-bold text-red-800">
                              ❌ এই নম্বরটি সিস্টেমে সমস্যাযুক্ত হিসেবে চিহ্নিত আছে। এই নম্বর ব্যবহার করে কোনো অবস্থাতেই রেজিস্ট্রেশন করবেন না।
                            </p>
                            <p className="text-[11.5px] text-slate-500 font-bold mt-1 tracking-wider">
                              ধরণ: <span className="bg-rose-100 text-[#e11d48] shrink-0 font-bold px-1.5 py-0.5 rounded text-[10px]">{formatCategoryLabel(searchResult.record.category)}</span>
                            </p>
                            <div className="mt-2 p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">সমস্যার বিবরণ / Note:</p>
                              <p className="text-red-700 font-sans font-black text-sm leading-normal">
                                "{searchResult.record.note}"
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="search-another font-sans" onClick={handleClearSearch}>
                          নতুন করে খুঁজুন / Search Another →
                        </div>
                      </div>
                    ) : (
                      <div className="result-clean">
                        <div className="result-clean-header">
                          <div className="shield text-white flex items-center justify-center font-bold">🛡</div>
                          <div>
                            <div className="title font-sans font-bold text-emerald-800">কোনো সমস্যা নেই</div>
                            <div className="subtitle font-bold text-emerald-600 font-mono tracking-wider">NO ISSUES RECORDED</div>
                          </div>
                        </div>
                        <div className="result-clean-body">
                          <div className="result-msg shadow-sm">
                            <p className="text-emerald-800 font-bold font-sans">
                              ✅ কোনো সমস্যা পাওয়া যায়নি। রেজিস্ট্রেশন করা যেতে পারে। অর্থাৎ প্রয়োজনে এই নম্বরের লাস্ট ডিজিট পরিবর্তন করে রেজিস্ট্রেশন সম্পন্ন করতে পারেন।
                            </p>
                            {searchResult.found && searchResult.record?.note && (
                              <p className="text-[11.5px] text-emerald-700 bg-emerald-50/50 p-2.5 border border-emerald-100/50 rounded-lg italic mt-2.5 font-sans font-medium leading-normal">
                                "{searchResult.record.note}"
                              </p>
                            )}
                            <small className="text-xs text-emerald-600 block mt-1">This number is clean. You can also modify the last digit if needed.</small>
                          </div>
                          <div className="result-safe-note">
                            এই ফোন নম্বরটি পূর্বে কোনো অননুমোদিত কাজের সাথে যুক্ত ছিল না। এটি নিরাপদ।
                          </div>
                        </div>
                        <div className="search-another font-sans" onClick={handleClearSearch}>
                          নতুন করে খুঁজুন / Search Another →
                        </div>
                      </div>
                    )}

                    {/* Re-registration count section */}
                    {!(searchResult.found && searchResult.record?.status === 'flagged') ? (
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-3.5 mt-3 text-left">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                          <span className="text-lg">🔁</span>
                          <div>
                            <h4 className="text-[12.5px] font-bold text-slate-800 leading-tight">রি-রেজিস্ট্রেশন কাউন্টার (Re-Registration Counter)</h4>
                            <p className="text-[10px] text-slate-400 font-medium">নম্বরটি পূর্বে কতবার রেজিস্টার করা হয়েছে দেখুন ও এন্ট্রি করুন</p>
                          </div>
                        </div>

                        <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between gap-3 font-sans">
                          <span className="text-xs font-bold text-slate-650">রেজিস্ট্রেশন সংখ্যা:</span>
                          {searchedCount !== null ? (
                            <span className={`text-xs font-extrabold px-3 py-1 rounded-full border shadow-inner ${
                              searchedCount > 0 
                                ? 'bg-amber-100 border-amber-200 text-amber-800'
                                : 'bg-slate-100 border-slate-200 text-slate-650'
                            }`}>
                              {searchedCount} বার
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 animate-pulse">লোড হচ্ছে...</span>
                          )}
                        </div>

                        {searchedCount !== null && (
                          <div className="text-[11px] text-slate-500 font-medium leading-relaxed font-sans pb-1 shrink-0">
                            {searchedCount === 0 ? (
                              <span>💡 এই নম্বরটি পূর্বে কখনো সেভ বা রেজিস্টার করা হয়নি। নতুন এন্ট্রি করতে নিচের বাটনে সেভ করুন।</span>
                            ) : (
                              <span className="text-amber-600 font-bold">⚠️ মনোযোগ দিন: নম্বরটি ইতিপূর্বে {searchedCount} বার সেভ/রেজিস্টার করা হয়েছে!</span>
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleSaveRegistrationCount(searchResult.searchedNo || searchPhone)}
                          disabled={isSavingCount || hasSavedInCurrentSearch}
                          className="w-full bg-[#10b981] hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-xs py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer outline-none active:scale-[0.98]"
                        >
                          {isSavingCount ? (
                            <span className="inline-block animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full"></span>
                          ) : hasSavedInCurrentSearch ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                              <span>ইতিমধ্যেই সেভ করা হয়েছে (Already Saved)</span>
                            </>
                          ) : (
                            <>
                              <Save className="w-3.5 h-3.5 text-white/90" />
                              <span>নম্বরটি সেভ করুন (Save & Register)</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 p-4 bg-rose-50 border-2 border-dashed border-rose-200 rounded-2xl text-center">
                        <p className="text-rose-500 text-xs font-bold font-sans">
                          🛑 এই নম্বরটি ব্লক করা হয়েছে, তাই রেজিস্ট্রেশন করার অপশনটি বন্ধ রাখা হয়েছে।
                        </p>
                      </div>
                    )}

                  </div>
                )}
              </div>

              {/* STATUS DETAILS CARD STYLE MATCHING THE HTML */}
              <div className="status-card">
                <div className="status-card-title font-sans">⚠️ রঙের অর্থ ও নির্দেশিকা / STATUS DETAILS</div>

                <div className="status-item red-item">
                  <div className="status-item-header">
                    <div className="dot dot-red"></div>
                    <div className="status-item-title font-sans">লাল সতর্কতা (সমস্যা আছে / Red Warning)</div>
                  </div>
                  <div className="status-item-desc text-justify font-sans">
                    নম্বরটি সিস্টেমে সন্দেহজনক অথবা প্রতারণামূলক কার্যক্রমের কারণে নিষিদ্ধ করা হয়েছে। এই নম্বর ব্যবহার করে <u className="decoration-[#ef4444] decoration-2"><strong>কোনো অবস্থাতেই রেজিস্ট্রেশন করতে দেবেন না।</strong></u>
                  </div>
                </div>

                <div className="status-item green-item">
                  <div className="status-item-header">
                    <div className="dot dot-green"></div>
                    <div className="status-item-title font-sans">সবুজ সংকেত (সমস্যা নেই / No Problem)</div>
                  </div>
                  <div className="status-item-desc text-justify font-sans">
                    এই নম্বরটির বিষয়ে কোনো নেতিবাচক অভিযোগ পাওয়া যায়নি। এটি সম্পূর্ণ নিরাপদ এবং <u className="decoration-emerald-500 decoration-2"><strong>সরাসরি রেজিস্ট্রেশন করা যাবে।</strong></u> অর্থাৎ প্রয়োজনে নম্বরের লাস্ট ডিজিট পরিবর্তন করে পুনরায় সার্চ করে নিশ্চিত হয়ে রেজিস্ট্রেশন করতে পারেন।
                  </div>
                </div>

                <div className="status-item orange-item">
                  <div className="status-item-header">
                    <div className="dot dot-orange"></div>
                    <div className="status-item-title font-sans">পুনরায় রেজিস্ট্রেশন করার নিয়ম (Pre-Registration Check)</div>
                  </div>
                  <div className="status-item-desc text-justify font-sans">
                    পূর্বে রেজিস্ট্রেশন করা বা নতুন যেকোনো নম্বর পুনরায় সিস্টেমে রেজিস্ট্রেশন বা অ্যাক্টিভেট করার পূর্বে <u className="decoration-amber-500 decoration-2"><strong>অবশ্যই এই সিস্টেমে সার্চ করে নম্বরটি ক্লিয়ার কিনা যাচাই করে নিতে হবে।</strong></u> এটি একটি বাধ্যতামূলক নিয়ম।
                  </div>
                </div>

                <div className="status-item dark-red-item">
                  <div className="status-item-header">
                    <div className="dot dot-red"></div>
                    <div className="status-item-title font-sans">কঠোর সতর্কতা (Account Ban Warning)</div>
                  </div>
                  <div className="status-item-desc text-justify font-sans">
                    সিস্টেমে <strong>সতর্কতা থাকা অবস্থায়</strong> যদি কোনো নম্বর আপনারা রেজিস্ট্রেশন বা অ্যাক্টিভেট করেন, তবে আপনাদের <u className="decoration-[#ef4444] decoration-2"><strong>স্টুডেন্ট আইডি চিরতরে ব্লক (Block) করা হবে।</strong></u> অতএব, নিয়ম মেনে যাচাই করে সততার সাথে কাজ করুন এবং সতর্ক থাকুন!
                  </div>
                </div>
              </div>

            </div>
          ) : (
            
            // 🔐 ADMIN DASHBOARD CORE AREA
            <div className="p-4 space-y-4">
              
              {!isAdminActive ? (
                
                // 🛑 UNAUTHENTICATED LOGIN SHIELD PAGE IN NEW HTML STYLE
                <div className="admin-panel mt-2 select-none">
                  <div className="admin-lock-icon">🔒</div>
                  <div className="admin-title font-sans">এডমিন প্যানেল প্রবেশদ্বার</div>
                  <div className="admin-subtitle font-mono">ADMIN CREDENTIAL SHIELD</div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="google-btn"
                  >
                    <div className="google-icon">G</div>
                    জিমেইল দিয়ে লগইন (Gmail Login)
                  </button>

                  <div className="or-divider font-bold">অথবা / OR</div>

                  <form onSubmit={handlePinLogin} className="space-y-3">
                    <div className="text-left">
                      <div className="pin-label">এডমিন সিক্রেট পিন / Pin Password:</div>
                      <div className="relative">
                        <input
                          type={showPin ? 'text' : 'password'}
                          className="pin-input tracking-widest font-bold pr-12 text-center"
                          maxLength={10}
                          placeholder="এডমিন সিক্রেট পিন টাইপ করুন..."
                          autoComplete="off"
                          value={enteredPin}
                          onChange={(e) => {
                            setEnteredPin(e.target.value);
                            setLoginError('');
                          }}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer p-1 rounded-md"
                          onClick={() => setShowPin(!showPin)}
                          title={showPin ? 'লুকান' : 'দেখুন'}
                        >
                          {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {loginError && (
                      <div className="error-msg font-sans text-center text-[12px] leading-snug">
                        {loginError}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="login-btn font-sans"
                    >
                      🔑 পাসওয়ার্ড দিয়ে লগইন করুন
                    </button>
                  </form>
                </div>
              ) : (
                
                // 🔐 ADMIN CONTROLLING PANEL ACTIVATED!
                <div className="space-y-4">
                  
                  {/* Settings Control Block (Drawn as a beautifully styled dark badge bar matching screenshot) */}
                  <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl overflow-hidden shadow-md">
                    <div className="px-4 py-3.5 flex justify-between items-center">
                      <span className="text-xs font-black text-white flex items-center gap-2 font-sans select-none">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse"></span>
                        🟢 এডমিন পিন মোড
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
                          className={`text-[10.5px] font-black px-3 py-1.75 rounded-lg flex items-center gap-1 transition-all border shrink-0 outline-none cursor-pointer ${
                            showSettingsDrawer 
                              ? 'bg-slate-800 text-amber-400 border-slate-700 shadow-inner' 
                              : 'bg-slate-900 text-slate-350 border-slate-800 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <Settings className="w-3.5 h-3.5 text-slate-400 shrink-0" /> প্যানেল সেটিংস
                        </button>
                        
                        <button
                          onClick={handleLogout}
                          className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all flex items-center justify-center shrink-0 cursor-pointer outline-none"
                          title="লগআউট করুন"
                        >
                          <LogOut className="w-3.5 h-3.5 text-slate-450" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Drawer Options */}
                    <AnimatePresence>
                      {showSettingsDrawer && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden bg-[#fafbfc]"
                        >
                          <div className="p-4 space-y-4 border-b border-slate-100 text-left">
                            
                            {/* Drawer Section 1: Change security pin */}
                            <div className="space-y-2 border-b border-slate-100 pb-3.5">
                              <h4 className="text-[10.5px] uppercase font-black text-slate-500 tracking-wider flex items-center gap-1">
                                <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" /> সিক্রেট পিন পরিবর্তন / CHANGE PASSWORD
                              </h4>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  className="flex-1 bg-white border border-slate-250 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-amber-500 font-sans text-center tracking-widest font-bold"
                                  placeholder="নতুন পাসওয়ার্ড লিখুন..."
                                  value={newSettingsPin}
                                  onChange={(e) => setNewSettingsPin(e.target.value.replace(/[^0-9]/g, ''))}
                                />
                                <button
                                  onClick={handleUpdatePin}
                                  className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black px-4 py-2.5 rounded-xl transition-all shadow-sm select-none outline-none"
                                >
                                  আপডেট
                                </button>
                              </div>
                            </div>

                            {/* Drawer Section 2: Manage allowed administrators emails */}
                            <div className="space-y-2">
                              <h4 className="text-[10.5px] uppercase font-black text-slate-500 tracking-wider flex items-center gap-1">
                                ✉ Approved Admin List (জিমেইল তালিকা)
                              </h4>
                              
                              <div className="flex gap-2">
                                <input
                                  type="email"
                                  className="flex-1 bg-white border border-slate-250 rounded-xl px-3 py-2.5 text-xs text-slate-850 outline-none focus:border-emerald-500 font-sans"
                                  placeholder="এডমিনের জিমেইল লিখুন... (e.g. user@gmail.com)"
                                  value={newSettingsEmail}
                                  onChange={(e) => setNewSettingsEmail(e.target.value)}
                                />
                                <button
                                  onClick={handleAddEmail}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black px-4 py-2.5 rounded-xl transition-all shrink-0 shadow-sm select-none outline-none"
                                >
                                  যুক্ত করুন
                                </button>
                              </div>

                              {/* Authorized List Box */}
                              <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden max-h-32 overflow-y-auto mt-2 shadow-inner">
                                {settings.allowedEmails
                                  .filter(emailItem => {
                                    const lower = emailItem.toLowerCase();
                                    return lower !== 'learninghubbd2126509574@gmail.com' && lower !== 'unityearning13@gmail.com';
                                  })
                                  .map((emailItem) => {
                                    return (
                                      <div key={emailItem} className="flex justify-between items-center px-3 py-2.25 border-b border-slate-100 text-[10px] last:border-0 hover:bg-white transition-all">
                                        <span className="text-slate-700 font-mono font-bold truncate shrink-1 pr-2">
                                          {emailItem}
                                        </span>
                                        <button
                                          onClick={() => handleDeleteEmail(emailItem)}
                                          className="text-rose-500 hover:text-rose-600 font-bold flex items-center gap-0.5 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200 shrink-0 hover:scale-[1.02] transition-all outline-none"
                                        >
                                          মুছুন
                                        </button>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>

                            {/* Drawer Section 3: Manage help video link */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                              <h4 className="text-[10.5px] uppercase font-black text-slate-500 tracking-wider flex items-center gap-1">
                                🎬 Help Video Link (ইউটিউব ভিডিও)
                              </h4>
                              
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  className="flex-1 bg-white border border-slate-250 rounded-xl px-3 py-2.5 text-xs text-slate-850 outline-none focus:border-rose-500 font-sans"
                                  placeholder="ভিডিও লিংকটি পেস্ট করুন..."
                                  value={newSettingsVideoUrl}
                                  onChange={(e) => setNewSettingsVideoUrl(e.target.value)}
                                />
                                <button
                                  onClick={handleUpdateVideoUrl}
                                  className="bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black px-4 py-2.5 rounded-xl transition-all shrink-0 shadow-sm select-none outline-none"
                                >
                                  আপডেট
                                </button>
                              </div>
                              {settings.helpVideoUrl && (
                                <p className="text-[9px] text-slate-400 font-medium truncate italic px-1">
                                  বর্তমান: {settings.helpVideoUrl}
                                </p>
                              )}
                            </div>

                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Sub Task Admin Views (Toggle subtabs) */}
                  <div className="flex bg-slate-200/50 p-1 rounded-xl border border-slate-200/60 transition-all font-sans">
                    <button
                      onClick={() => setAdminActiveSubTab('form')}
                      className={`flex-1 py-3 rounded-lg font-black text-[11px] transition-all flex items-center justify-center gap-1 outline-none cursor-pointer ${
                        adminActiveSubTab === 'form'
                          ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                          : 'text-slate-500 hover:text-slate-800 bg-transparent'
                      }`}
                    >
                      <Plus className="w-3 h-3 shrink-0 text-slate-500" /> নম্বর এন্ট্রি
                    </button>
                    <button
                      onClick={() => setAdminActiveSubTab('data')}
                      className={`flex-1 py-3 rounded-lg font-black text-[11px] transition-all flex items-center justify-center gap-1 outline-none cursor-pointer ${
                        adminActiveSubTab === 'data'
                          ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                          : 'text-slate-500 hover:text-slate-800 bg-transparent'
                      }`}
                    >
                      <Database className="w-3 h-3 shrink-0 text-slate-500" /> ডাটা তালিকা ({records.length})
                    </button>
                    <button
                      onClick={() => setAdminActiveSubTab('counts')}
                      className={`flex-1 py-3 rounded-lg font-black text-[11px] transition-all flex items-center justify-center gap-1 outline-none cursor-pointer ${
                        adminActiveSubTab === 'counts'
                          ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                          : 'text-slate-500 hover:text-slate-800 bg-transparent'
                      }`}
                    >
                      <RefreshCw className="w-3 h-3 shrink-0 text-slate-500" /> কাউন্টারস ({registrationCounts.length})
                    </button>
                  </div>

                  {/* View 1: Record modification form */}
                  {adminActiveSubTab === 'form' && (
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                      <h4 className="text-xs font-black text-slate-800 pb-2 border-b border-slate-100">
                        {editingRecordId ? 'নম্বর রেকর্ড সম্পদনা করুন / Update Record' : 'নতুন ফোন নম্বর ডাটাবেজে যুক্ত করুন / Update Record'}
                      </h4>

                      <form onSubmit={handleSaveRecord} className="space-y-4">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1 leading-tight">
                            ফোন নম্বর (Phone Number):
                          </label>
                          <input
                            type="text"
                            required
                            className="w-full bg-[#f8fafc] text-slate-800 placeholder-slate-400 text-xs py-3 px-4 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:bg-white transition-all font-sans font-medium"
                            placeholder="e.g. 01712345678"
                            value={formPhone}
                            onChange={(e) => setFormPhone(e.target.value)}
                          />
                        </div>

                        {/* Set Status Selection Buttons */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1.5 leading-tight">
                            স্ট্যাটাস নির্বাচন করুন (Set Status):
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setFormStatus('flagged');
                                if (formCategory === 'None') {
                                  setFormCategory('Fake Lead');
                                }
                              }}
                              className={`py-3 px-4 rounded-xl text-xs font-black transition-all border cursor-pointer flex items-center justify-center gap-1.5 outline-none ${
                                formStatus === 'flagged'
                                  ? 'bg-rose-50 border-rose-400 text-[#e11d48]'
                                  : 'bg-[#f8fafc] border-slate-200 text-slate-400 hover:border-slate-350 hover:bg-slate-50'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]"></span>
                              সমস্যা আছে (Problem)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFormStatus('clear');
                                setFormCategory('None');
                              }}
                              className={`py-3 px-4 rounded-xl text-xs font-black transition-all border cursor-pointer flex items-center justify-center gap-1.5 outline-none ${
                                formStatus === 'clear'
                                  ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                                  : 'bg-[#f8fafc] border-slate-200 text-slate-400 hover:border-slate-350 hover:bg-slate-50'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
                              সমস্যা নেই (No Issue)
                            </button>
                          </div>
                        </div>

                        {/* Category selection (only show if status is flagged) */}
                        {formStatus === 'flagged' && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1 leading-tight">
                              অভিযোগের ধরণ / Warning Category:
                            </label>
                            <select
                              value={formCategory}
                              onChange={(e) => setFormCategory(e.target.value as RecordCategory)}
                              className="w-full bg-[#f8fafc] text-slate-800 text-xs py-3 px-4 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:bg-white transition-all select-none cursor-pointer"
                            >
                              <option value="Fake Lead">Fake Lead / ভুয়া লিড</option>
                              <option value="Attacker">Attacker / আক্রমণকারী</option>
                              <option value="Bad Behavior">Bad Behavior / খারাপ আচরণ</option>
                              <option value="Deleted Member">Deleted Member / ডিলিটকৃত মেম্বার</option>
                              <option value="Other">Other / অন্যান্য সমস্যা</option>
                            </select>
                          </div>
                        )}

                        {/* Details note description area */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1 leading-tight">
                            মন্তব্য/নোট (Admin Comment/Note):
                          </label>
                          <textarea
                            required
                            rows={3}
                            className="w-full bg-[#f8fafc] text-slate-800 placeholder-slate-400 text-xs py-3.5 px-4 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:bg-white transition-all resize-none"
                            placeholder="নম্বরটি সম্পর্কে বিস্তারিত লিখুন... (যেমন: বিকাশ পেমেন্ট জালিয়াতি, বা বিশ্বস্ত ক্লায়েন্ট)"
                            value={formNote}
                            onChange={(e) => setFormNote(e.target.value)}
                          />
                        </div>

                        {/* Submit Actions */}
                        <div className="flex gap-2.5 pt-1">
                          {editingRecordId && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRecordId(null);
                                setFormPhone('');
                                setFormStatus('flagged');
                                setFormCategory('Fake Lead');
                                setFormNote('');
                              }}
                              className="flex-1 bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200 font-extrabold text-xs py-3.5 px-4 rounded-xl transition-all cursor-pointer outline-none"
                            >
                              বাতিল করুন / Cancel
                            </button>
                          )}
                          <button
                            type="submit"
                            className="flex-1 bg-[#0a0f1d] hover:bg-slate-900 text-white font-bold text-xs py-3.5 px-4 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 outline-none"
                          >
                            <Save className="w-3.5 h-3.5 text-slate-205 shrink-0" />
                            {editingRecordId ? 'আপডেট করুন / Update Entry' : 'কনফার্ম করুন / Save Entry'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* View 2: Records list checklist visual */}
                  {adminActiveSubTab === 'data' && (
                    <div className="space-y-3">
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-3 text-left">
                        
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <h4 className="text-xs font-bold text-slate-800">সংরক্ষিত নম্বরের রেকর্ডসমূহ</h4>
                          <span className="bg-[#f8fafc] border border-slate-200 text-[10.5px] text-slate-600 font-bold px-2.5 py-0.5 rounded-full shrink-0 font-sans shadow-inner">
                            মোট: {records.length} টি
                          </span>
                        </div>

                        {/* Admin inside Search bar */}
                        <div className="relative">
                          <input
                            type="text"
                            className="w-full bg-[#f8fafc] text-slate-800 placeholder-slate-400 text-xs py-3 pl-9 pr-4 rounded-xl border border-slate-250 outline-none focus:border-blue-500 focus:bg-white transition-all font-sans font-medium"
                            placeholder="ফোন নম্বর বা মন্তব্য টাইপ করুন..."
                            value={adminSearchQuery}
                            onChange={(e) => setAdminSearchQuery(e.target.value)}
                          />
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        </div>

                        {/* Real-time Records List card elements */}
                        <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 no-scrollbar pt-1">
                          {filteredRecords.length === 0 ? (
                            <div className="text-center py-8 text-slate-450 text-[11.5px] border-2 border-dashed border-slate-200 rounded-xl font-medium">
                              কোনো ডাটা পাওয়া যায়নি।
                            </div>
                          ) : (
                            filteredRecords.map((item) => {
                              const isProblem = item.status === 'flagged';
                              // Date Conversion
                              let dateStr = '12/6/2026 01:02 AM';
                              if (item.updatedAt) {
                                try {
                                  const d = item.updatedAt.toDate ? item.updatedAt.toDate() : new Date(item.updatedAt);
                                  dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                } catch (e) {}
                              }
                              
                              return (
                                <div 
                                  key={item.id} 
                                  className={`p-3.5 rounded-xl border transition-all text-left relative overflow-hidden flex justify-between items-start ${
                                    isProblem 
                                      ? 'bg-rose-50/40 border-rose-150 hover:bg-rose-50/75 hover:border-rose-300 shadow-sm' 
                                      : 'bg-emerald-50/40 border-emerald-150 hover:bg-emerald-50/75 hover:border-emerald-300 shadow-sm'
                                  }`}
                                >
                                  <div className="space-y-1 flex-1 pr-3 truncate-ellipsis text-left">
                                    <div className="flex items-center gap-1.5 select-all">
                                      <span className="font-sans font-extrabold text-xs text-slate-800 tracking-wider">
                                        {item.number}
                                      </span>
                                      
                                      {isProblem ? (
                                        <span className="bg-rose-100 text-rose-700 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase">
                                          সমস্যা ({formatCategoryLabel(item.category)})
                                        </span>
                                      ) : (
                                        <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase">
                                          ক্লিয়ার
                                        </span>
                                      )}
                                    </div>
                                    
                                    <p className="text-[11.5px] text-slate-650 leading-tight block select-text font-sans font-medium text-left">
                                      {item.note}
                                    </p>
                                    
                                    <span className="text-[8.5px] text-slate-400 block font-mono">
                                      আপডেট: {dateStr}
                                    </span>
                                  </div>

                                  <div className="flex gap-1.5 shrink-0 pt-0.5">
                                    <button
                                      onClick={() => triggerEditRecord(item)}
                                      className="w-7 h-7 rounded-lg bg-orange-100 border border-orange-200 text-orange-600 hover:bg-orange-200 flex items-center justify-center transition-all shrink-0 cursor-pointer outline-none"
                                      title="সম্পাদনা করুন"
                                    >
                                      <Edit className="w-3.5 h-3.5 text-orange-600" />
                                    </button>
                                    <button
                                      onClick={() => setDeleteTargetId(item.id)}
                                      className="w-7 h-7 rounded-lg bg-rose-100 border border-rose-200 text-[#e11d48] hover:bg-rose-200 flex items-center justify-center transition-all shrink-0 cursor-pointer outline-none"
                                      title="ডিলিট করুন"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-[#e11d48]" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                      </div>
                    </div>
                  )}

                  {/* View 3: Registration Counters list management */}
                  {adminActiveSubTab === 'counts' && (
                    <div className="space-y-3">
                      
                      {/* Edit Count Value Card (Shown only when editingCountId is active) */}
                      {editingCountId && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm space-y-3 text-left">
                          <div className="flex justify-between items-center pb-2 border-b border-amber-100">
                            <h4 className="text-xs font-black text-amber-900 flex items-center gap-1 font-sans">
                              ✏️ কাউন্টার এডিট করুন (Edit Counter)
                            </h4>
                            <button
                              onClick={() => setEditingCountId(null)}
                              className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded hover:bg-amber-200 transition-all font-sans font-bold cursor-pointer"
                            >
                              বাতিল করুন
                            </button>
                          </div>
                          
                          <div className="space-y-2">
                            <p className="text-[10.5px] text-slate-500 font-bold">
                              নম্বর: <span className="text-slate-800 font-mono select-all font-black">{editingCountId}</span>
                            </p>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                required
                                min="0"
                                className="flex-1 bg-white text-slate-800 text-xs py-2.5 px-3.5 rounded-xl border border-slate-200 outline-none focus:border-amber-500 font-sans font-extrabold text-center"
                                placeholder="সঠিক কাউন্টার সংখ্যা লিখুন..."
                                value={editingCountVal}
                                onChange={(e) => setEditingCountVal(Math.max(0, parseInt(e.target.value) || 0))}
                              />
                              <button
                                onClick={handleUpdateRegistrationCount}
                                className="bg-[#0a0f1d] hover:bg-[#1e1e2d] text-white text-[11px] font-black px-4 py-2.5 rounded-xl transition-all shadow-md cursor-pointer shrink-0 outline-none"
                              >
                                কাউন্ট আপডেট
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-3 text-left">
                        
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <h4 className="text-xs font-bold text-slate-800">রি-রেজিস্ট্রেশন কাউন্টারসমূহ</h4>
                          <span className="bg-[#f8fafc] border border-slate-200 text-[10.5px] text-slate-600 font-bold px-2.5 py-0.5 rounded-full shrink-0 font-sans shadow-inner">
                            মোট: {registrationCounts.length} টি
                          </span>
                        </div>

                        {/* Admin inside Search bar for counts */}
                        <div className="relative">
                          <input
                            type="text"
                            className="w-full bg-[#f8fafc] text-slate-800 placeholder-slate-400 text-xs py-3 pl-9 pr-4 rounded-xl border border-slate-250 outline-none focus:border-blue-500 focus:bg-white transition-all font-sans font-medium"
                            placeholder="কাউন্টার নম্বর টাইপ করে খুঁজুন..."
                            value={adminCountSearchQuery}
                            onChange={(e) => setAdminCountSearchQuery(e.target.value)}
                          />
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        </div>

                        {/* Real-time Counts List card elements */}
                        <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 no-scrollbar pt-1 font-sans">
                          {filteredCounts.length === 0 ? (
                            <div className="text-center py-8 text-slate-450 text-[11.5px] border-2 border-dashed border-slate-200 rounded-xl font-medium">
                              কোনো কাউন্ট ডাটা পাওয়া যায়নি।
                            </div>
                          ) : (
                            filteredCounts.map((item) => {
                              // Date Conversion
                              let dateStr = '12/6/2026 01:02 AM';
                              if (item.updatedAt) {
                                try {
                                  const d = item.updatedAt.toDate ? item.updatedAt.toDate() : new Date(item.updatedAt);
                                  dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                } catch (e) {}
                              }
                              
                              return (
                                <div 
                                  key={item.id} 
                                  className="p-3.5 rounded-xl border border-slate-150 bg-slate-50/60 hover:bg-slate-50 hover:border-blue-200 transition-all text-left flex justify-between items-center shadow-sm"
                                >
                                  <div className="space-y-1 flex-1 pr-3 truncate text-left">
                                    <div className="flex items-center gap-2">
                                      <span className="font-extrabold text-xs text-slate-800 tracking-wider">
                                        {item.number}
                                      </span>
                                      <span className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full shadow-inner">
                                        {item.count} বার রেজিস্টারকৃত
                                      </span>
                                    </div>
                                    <span className="text-[8.5px] text-slate-400 block font-mono leading-none">
                                      সর্বশেষ হালনাগাদ: {dateStr}
                                    </span>
                                  </div>

                                  <div className="flex gap-1.5 shrink-0">
                                    <button
                                      onClick={() => {
                                        setEditingCountId(item.id);
                                        setEditingCountVal(item.count);
                                      }}
                                      className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-150 text-indigo-600 hover:bg-indigo-150 flex items-center justify-center transition-all shrink-0 cursor-pointer outline-none"
                                      title="সংখ্যা পরিবর্তন করুন"
                                    >
                                      <Edit className="w-3.5 h-3.5 text-indigo-650" />
                                    </button>
                                    <button
                                      onClick={() => setDeleteCountTargetId(item.id)}
                                      className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-150 text-rose-600 hover:bg-rose-150 flex items-center justify-center transition-all shrink-0 cursor-pointer outline-none"
                                      title="ডিলিট করুন"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          )}
        </div>

        {/* Beautiful Bottom Simulated System Dock Navigation Bars */}
        <div className="h-16 bg-white border-t border-slate-200/80 shrink-0 grid grid-cols-2 text-center text-slate-450 relative z-30 select-none">
          <button
            onClick={() => {
              setActiveNavTab('search');
              handleClearSearch();
            }}
            className={`flex flex-col items-center justify-center gap-1 transition-all outline-none cursor-pointer relative z-40 ${
              activeNavTab === 'search' 
                ? 'text-[#10b981] font-bold' 
                : 'text-slate-450 hover:text-slate-700'
            }`}
          >
            <Search className={`w-5 h-5 shrink-0 ${activeNavTab === 'search' ? 'text-[#10b981]' : 'text-slate-400'}`} />
            <span className="text-[10px] font-black leading-none uppercase tracking-wide">সার্চ (Search)</span>
          </button>

          <button
            onClick={() => setActiveNavTab('admin')}
            className={`flex flex-col items-center justify-center gap-1 transition-all outline-none cursor-pointer relative z-40 ${
              activeNavTab === 'admin' 
                ? 'text-[#10b981] font-bold' 
                : 'text-slate-450 hover:text-slate-700'
            }`}
          >
            <Lock className={`w-5 h-5 shrink-0 ${activeNavTab === 'admin' ? 'text-[#10b981]' : 'text-slate-400'}`} />
            <span className="text-[10px] font-black leading-none uppercase tracking-wide">এডমিন (Admin)</span>
          </button>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-[1px] bg-slate-200 pointer-events-none"></div>
        </div>

        {/* Custom Confirmation Dialog for Record Deletion */}
        <AnimatePresence>
          {deleteTargetId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-5 z-50 select-none cursor-default"
            >
              <motion.div
                initial={{ scale: 0.9, y: 15, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 15, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="bg-white w-full max-w-[340px] rounded-2xl shadow-[0_24px_50px_rgba(0,0,0,0.22)] border border-slate-100 overflow-hidden"
              >
                {/* Visual Icon Alert Header */}
                <div className="bg-rose-50 p-6 flex flex-col items-center justify-center border-b border-rose-100">
                  <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-500 mb-3 animate-bounce">
                    <Trash2 className="w-6 h-6 text-rose-600" />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-800 font-sans tracking-wide">নম্বর রেকর্ড ডিলিট করুন</h3>
                </div>

                {/* Body Content Description */}
                <div className="p-5 text-center">
                  <p className="text-xs text-slate-500 leading-relaxed font-sans mb-1">
                    আপনি কি নিশ্চিত যে এই রেকর্ডটি ডিলিট করতে চান?
                  </p>
                  <p className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg inline-block border border-slate-200 select-all mt-2">
                    {deleteTargetId}
                  </p>
                  <p className="text-[10px] text-rose-500 font-bold font-sans mt-2">
                    ⚠️ সতর্কীকরণ: এই পরিবর্তনটি স্থায়ী এবং এটি পুনরুদ্ধার করা যাবে না।
                  </p>
                </div>

                {/* Dialog Bottom Navigation Button Controls */}
                <div className="bg-slate-50 px-4 py-3.5 flex gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setDeleteTargetId(null)}
                    className="flex-1 py-2.5 px-3 bg-white border border-slate-250 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl outline-none transition-all cursor-pointer"
                  >
                    না, ফেরত যান
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteRecord}
                    className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl outline-none shadow-md shadow-rose-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    হ্যাঁ, নিশ্চিত ডিলিট
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom Confirmation Dialog for Counter Record Deletion */}
        <AnimatePresence>
          {deleteCountTargetId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-5 z-50 select-none cursor-default"
            >
              <motion.div
                initial={{ scale: 0.9, y: 15, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 15, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="bg-white w-full max-w-[340px] rounded-2xl shadow-[0_24px_50px_rgba(0,0,0,0.22)] border border-slate-100 overflow-hidden"
              >
                {/* Visual Icon Alert Header */}
                <div className="bg-rose-50 p-6 flex flex-col items-center justify-center border-b border-rose-100">
                  <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-500 mb-3 animate-bounce">
                    <Trash2 className="w-6 h-6 text-rose-605" />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-800 font-sans tracking-wide">কাউন্টার ডাটা মুছুন</h3>
                </div>

                {/* Body Content Description */}
                <div className="p-5 text-center">
                  <p className="text-xs text-slate-500 leading-relaxed font-sans mb-1">
                    আপনি কি নিশ্চিত যে এই নম্বরের রেজিস্ট্রেশন কাউন্টারটি ডাটাবেজ থেকে মুছে ফেলতে চান?
                  </p>
                  <p className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg inline-block border border-slate-200 select-all mt-2">
                    {deleteCountTargetId}
                  </p>
                  <p className="text-[10px] text-rose-500 font-bold font-sans mt-2">
                    ⚠️ সতর্কীকরণ: এটি ডিলিট করলে এর পূর্ববর্তী সকল সেভ/রেজিস্ট্রেশন সংখ্যা শূন্য (0) হয়ে যাবে।
                  </p>
                </div>

                {/* Dialog Bottom Navigation Button Controls */}
                <div className="bg-slate-50 px-4 py-3.5 flex gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setDeleteCountTargetId(null)}
                    className="flex-1 py-2.5 px-3 bg-white border border-slate-250 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl outline-none transition-all cursor-pointer"
                  >
                    না, ফেরত যান
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteRegistrationCount}
                    className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl outline-none shadow-md shadow-rose-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    হ্যাঁ, নিশ্চিত ডিলিট
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

    </div>
  );
}
