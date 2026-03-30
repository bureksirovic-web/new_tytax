export type Language = 'en' | 'hr';
export type UnitSystem = 'metric' | 'imperial';
export type Gender = 'male' | 'female' | 'other';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface EquipmentProfile {
  id: string;
  profileId: string;
  name: string;
  // TYTAX stations
  hasSmithMachine: boolean;
  hasUpperPulley: boolean;
  hasLowerPulley: boolean;
  hasLegExtension: boolean;
  hasLegCurl: boolean;
  // Cable attachments
  attachments: string[];
  // Bodyweight
  hasPullUpBar: boolean;
  hasDipStation: boolean;
  hasRings: boolean;
  hasParallettes: boolean;
  // Kettlebell weights available (kg)
  kettlebellWeights: number[];
  // Plates
  plateWeights: number[];
  barWeightKg: number;        // Smith bar weight
}

export interface FamilyMember {
  id: string;
  profileId: string;
  name: string;
  bodyweightKg?: number;
  gender?: Gender;
  experienceLevel?: ExperienceLevel;
  createdAt: string;
}

export interface UserProfile {
  id: string;                 // local UUID or Supabase auth.uid
  displayName: string;
  language: Language;
  unitSystem: UnitSystem;
  theme: 'tactical' | 'oled';
  bodyweightKg?: number;
  gender?: Gender;
  experienceLevel?: ExperienceLevel;
  activeFamilyMemberId?: string;
  activeEquipmentProfileId?: string;
  warmupStrategy: 'standard' | 'heavy' | 'pyramid';
  autoBackup: boolean;
  barWeightKg: number;
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
}
