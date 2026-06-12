export type RecordStatus = 'clear' | 'flagged';

export type RecordCategory = 'Fake Leader' | 'Fake Lead' | 'Attacker' | 'Bad Behavior' | 'Deleted Member' | 'Other' | 'None';

export interface PhoneRecord {
  id: string; // Document ID (usually the phone number)
  number: string;
  status: RecordStatus;
  category: RecordCategory;
  note: string;
  updatedAt: any; // Firestore Timestamp
  createdBy: string;
  createdByEmail: string;
}

export interface AdminSettings {
  pin: string;
  allowedEmails: string[];
  helpVideoUrl?: string;
}

export interface RegistrationCountRecord {
  id: string; // Document ID (normalized phone number)
  number: string;
  count: number;
  updatedAt: any; // Firestore Timestamp or ISO string
}

