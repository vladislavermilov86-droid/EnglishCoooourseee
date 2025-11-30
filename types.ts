// This avoids a frontend dependency on the backend ORM and resolves module resolution errors.
export enum UserRole {
  Student = 'student',
  Teacher = 'teacher',
}

// Base interface for Supabase tables
interface SupabaseRecord {
  id: string; // Typically UUID in our case
  created_at: string;
}

export interface Word extends SupabaseRecord {
  english: string;
  russian: string;
  transcription: string;
  image_url: string;
  round_id: string;
}

export interface Round extends SupabaseRecord {
  title: string;
  unit_id: string;
  words: Word[];
}

export interface Unit extends SupabaseRecord {
  title: string;
  description: string;
  icon: string;
  rounds: Round[];
  unlocked: boolean;
  unit_number: number;
}

export interface User {
  id: string; // This is the UUID from Supabase auth
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string;
  last_seen: string;
}

export interface ChatGroup extends SupabaseRecord {
  name: string;
  members: string[]; // array of user document ids
  avatar_url: string;
}

export interface MessageReadStatus {
    userId: string;
    readAt: string;
}

export interface ChatMessage extends SupabaseRecord {
  chat_group_id: string;
  sender_id: string;
  content: string;
  read_by: MessageReadStatus[];
}

export interface Answer {
    wordId: string;
    stage: 'spell' | 'choose_translation' | 'choose_picture';
    answer: string;
    isCorrect: boolean;
}

export interface AttemptHistory {
    attemptNumber: number;
    score: number;
    completedAt: string;
    answers: Answer[];
}

export interface RoundProgress extends SupabaseRecord {
    student_id: string;
    unit_id: string;
    round_id: string;
    completed: boolean;
    history: AttemptHistory[];
    attempts: number;
}


export interface StudentProgress {
    [studentId: string]: {
        unitsProgress: { [unitId: string]: UnitProgress };
    };
}

export interface UnitProgress {
    unitId: string;
    roundsProgress: { [roundId: string]: RoundProgress };
}


export interface TestQuestion {
    word: Word;
    type: 'spell' | 'choose_translation' | 'choose_picture';
    options?: string[];
}

export interface StudentTestAnswer {
    questionIndex: number;
    answer: string;
    isCorrect: boolean;
}

export interface StudentTestResult {
    studentId: string;
    answers: StudentTestAnswer[];
    score: number;
    completedAt: string;
    teacherGrade?: number;
    teacherComment?: string;
    passed?: boolean;
}

export interface UnitTest extends SupabaseRecord {
    unit_id: string;
    title: string;
    status: 'inactive' | 'waiting' | 'in_progress' | 'completed';
    joined_students: string[] | null;
    questions: TestQuestion[] | null;
    results: StudentTestResult[] | null;
    start_time?: string | null;
}

export interface ActivityItem {
    studentId: string;
    type: 'round' | 'test';
    title: string;
    score: number;
    timestamp: string;
}

export interface AppState {
  users: User[];
  units: Unit[];
  chatGroups: ChatGroup[];
  chatMessages: ChatMessage[];
  loggedInUser: User | null;
  studentProgress: StudentProgress;
  assignments: { [date: string]: string | null };
  unitTests: UnitTest[];
  unlockedUnits: string[];
  onlineUserIds: string[];
  isLoading: boolean;
  error: string | null;
  selectedLoginRole: UserRole | null;
}

// Action types for the reducer
export type Action =
  | { type: 'LOGIN'; payload: User | null }
  | { type: 'SET_LOGGED_OUT' }
  | { type: 'SET_LOGIN_ROLE'; payload: UserRole | null }
  | { type: 'SET_INITIAL_DATA'; payload: { units: Unit[]; users: User[]; chatGroups: ChatGroup[]; chatMessages: ChatMessage[]; studentProgress: RoundProgress[]; unitTests: UnitTest[] } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_AVATAR'; payload: { userId: string; newAvatarUrl: string } }
  | { type: 'UPSERT_MESSAGE'; payload: ChatMessage }
  | { type: 'DELETE_MESSAGE'; payload: { messageId: string } }
  | { type: 'UPSERT_ROUND_PROGRESS'; payload: RoundProgress }
  | { type: 'DELETE_ROUND_PROGRESS'; payload: { progressId: string; studentId: string; unitId: string; roundId: string; } }
  | { type: 'UPSERT_UNIT'; payload: Unit }
  | { type: 'DELETE_UNIT'; payload: { unitId: string } }
  | { type: 'EDIT_WORD'; payload: { unitId: string; roundId: string; wordId: string; updatedWord: Word } }
  | { type: 'UPSERT_UNIT_TEST'; payload: UnitTest }
  | { type: 'DELETE_TEST'; payload: { testId: string } }
  | { type: 'UNLOCK_UNIT'; payload: { unitId: string } }
  | { type: 'UPSERT_CHAT_GROUP'; payload: ChatGroup }
  | { type: 'DELETE_CHAT_GROUP'; payload: { chatGroupId: string } }
  | { type: 'LOCK_UNIT'; payload: { unitId: string } }
  | { type: 'RESET_STUDENT_UNIT_PROGRESS'; payload: { studentId: string; unitId: string } }
  | { type: 'SET_ONLINE_USERS'; payload: string[] }
  | { type: 'USER_JOINED'; payload: string }
  | { type: 'USER_LEFT'; payload: string }
  | { type: 'CLEAR_CHAT_HISTORY'; payload: { chatGroupId: string } }
  | { type: 'USER_STATUS_CHANGE'; payload: { userId: string; status: 'online' | 'offline'; lastSeen?: string } }
  | { type: 'MESSAGES_READ'; payload: { messageIds: string[]; userId: string; readAt: string } }
  | { type: 'UPSERT_USER_PROFILE'; payload: User };