import React, { createContext, useContext, useReducer, useEffect, ReactNode, useMemo } from 'react';
// FIX: Import the 'Word' type.
import { AppState, Action, User, Unit, ChatGroup, ChatMessage, RoundProgress, UnitTest, StudentProgress, UserRole, Word } from '../types';
import { supabase, areSupabaseKeysMissing } from '../supabase';

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | undefined>(undefined);

const initialState: AppState = {
  users: [],
  units: [],
  chatGroups: [],
  chatMessages: [],
  loggedInUser: null,
  studentProgress: {},
  assignments: {},
  unitTests: [],
  unlockedUnits: [],
  onlineUserIds: [],
  isLoading: true,
  error: null,
  selectedLoginRole: null,
};

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, loggedInUser: action.payload, isLoading: false, error: null };
    case 'SET_LOGGED_OUT':
      return { ...initialState, isLoading: false };
    case 'SET_LOGIN_ROLE':
      return { ...state, selectedLoginRole: action.payload };
    case 'SET_INITIAL_DATA': {
      const { units, studentProgress } = action.payload;
      const unlockedUnits = units.filter(u => u.unlocked).map(u => u.id);
      
      const structuredProgress: StudentProgress = {};
      studentProgress.forEach(progress => {
          const { student_id, unit_id, round_id } = progress;
          if (!structuredProgress[student_id]) {
              structuredProgress[student_id] = { unitsProgress: {} };
          }
          if (!structuredProgress[student_id].unitsProgress[unit_id]) {
              structuredProgress[student_id].unitsProgress[unit_id] = { unitId: unit_id, roundsProgress: {} };
          }
          structuredProgress[student_id].unitsProgress[unit_id].roundsProgress[round_id] = progress;
      });

      return {
        ...state,
        ...action.payload,
        studentProgress: structuredProgress,
        unlockedUnits,
        isLoading: false,
        error: null,
      };
    }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'UPDATE_AVATAR':
      return {
        ...state,
        users: state.users.map(user =>
          user.id === action.payload.userId
            ? { ...user, avatar_url: action.payload.newAvatarUrl }
            : user
        ),
      };
    case 'UPSERT_MESSAGE': {
      const existing = state.chatMessages.find(m => m.id === action.payload.id);
      if (existing) {
        return { ...state, chatMessages: state.chatMessages.map(m => m.id === action.payload.id ? action.payload : m) };
      }
      return { ...state, chatMessages: [...state.chatMessages, action.payload] };
    }
    case 'DELETE_MESSAGE':
        return {
            ...state,
            chatMessages: state.chatMessages.filter(msg => msg.id !== action.payload.messageId)
        };
    case 'UPSERT_ROUND_PROGRESS': {
        const progress = action.payload;
        const { student_id, unit_id, round_id } = progress;
        
        const newStudentProgress = JSON.parse(JSON.stringify(state.studentProgress));

        if (!newStudentProgress[student_id]) {
            newStudentProgress[student_id] = { unitsProgress: {} };
        }
        if (!newStudentProgress[student_id].unitsProgress[unit_id]) {
            newStudentProgress[student_id].unitsProgress[unit_id] = { unitId: unit_id, roundsProgress: {} };
        }
        
        newStudentProgress[student_id].unitsProgress[unit_id].roundsProgress[round_id] = progress;
        return { ...state, studentProgress: newStudentProgress };
    }
    case 'DELETE_ROUND_PROGRESS': {
         const { studentId, unitId, roundId } = action.payload;
         const newStudentProgress = JSON.parse(JSON.stringify(state.studentProgress));
         if (newStudentProgress[studentId]?.unitsProgress[unitId]?.roundsProgress[roundId]) {
            delete newStudentProgress[studentId].unitsProgress[unitId].roundsProgress[roundId];
         }
         return { ...state, studentProgress: newStudentProgress };
    }
     case 'RESET_STUDENT_UNIT_PROGRESS': {
        const { studentId, unitId } = action.payload;
        const newStudentProgress = JSON.parse(JSON.stringify(state.studentProgress));
        if (newStudentProgress[studentId]?.unitsProgress[unitId]) {
            newStudentProgress[studentId].unitsProgress[unitId].roundsProgress = {};
        }
        return { ...state, studentProgress: newStudentProgress };
    }
    case 'UPSERT_UNIT': {
        const updatedUnitPartial = action.payload;
        let isNew = true;

        const newUnits = state.units.map(unit => {
            if (unit.id === updatedUnitPartial.id) {
                isNew = false;
                return { ...unit, ...updatedUnitPartial };
            }
            return unit;
        });

        if (isNew) {
            newUnits.push(updatedUnitPartial as Unit);
        }

        const newUnlockedUnits = newUnits.filter(u => u.unlocked).map(u => u.id);

        return {
            ...state,
            units: newUnits,
            unlockedUnits: newUnlockedUnits,
        };
    }
    case 'DELETE_UNIT':
        return { ...state, units: state.units.filter(u => u.id !== action.payload.unitId) };
    case 'EDIT_WORD': {
        const { unitId, roundId, wordId, updatedWord } = action.payload;
        return {
            ...state,
            units: state.units.map(unit => {
                if (unit.id === unitId) {
                    return {
                        ...unit,
                        rounds: unit.rounds.map(round => {
                            if (round.id === roundId) {
                                return { ...round, words: round.words.map(word => word.id === wordId ? updatedWord : word) };
                            }
                            return round;
                        })
                    };
                }
                return unit;
            })
        };
    }
    case 'UPSERT_UNIT_TEST': {
        const newTest = action.payload;
        const tempTest = state.unitTests.find(t => t.unit_id === newTest.unit_id && t.id.startsWith('temp-'));
        if (tempTest && !newTest.id.startsWith('temp-')) {
          return {
            ...state,
            unitTests: [...state.unitTests.filter(t => t.id !== tempTest.id), newTest]
          };
        }
      
        const existing = state.unitTests.find(t => t.id === newTest.id);
        return {
          ...state,
          unitTests: existing
            ? state.unitTests.map(t => (t.id === newTest.id ? { ...t, ...newTest } : t))
            : [...state.unitTests, newTest],
        };
      }
    case 'DELETE_TEST':
        return { ...state, unitTests: state.unitTests.filter(t => t.id !== action.payload.testId) };
    case 'UNLOCK_UNIT':
        return { ...state, unlockedUnits: [...new Set([...state.unlockedUnits, action.payload.unitId])] };
    case 'LOCK_UNIT':
        return { ...state, unlockedUnits: state.unlockedUnits.filter(id => id !== action.payload.unitId) };
    case 'UPSERT_CHAT_GROUP': {
        const group = action.payload;
        const existing = state.chatGroups.find(g => g.id === group.id);
        return {
          ...state,
          chatGroups: existing ? state.chatGroups.map(g => g.id === group.id ? group : g) : [...state.chatGroups, group]
        };
    }
    case 'DELETE_CHAT_GROUP':
        return { ...state, chatGroups: state.chatGroups.filter(g => g.id !== action.payload.chatGroupId) };
    case 'CLEAR_CHAT_HISTORY':
        return { ...state, chatMessages: state.chatMessages.filter(m => m.chat_group_id !== action.payload.chatGroupId) };
    case 'UPSERT_USER_PROFILE': {
        const user = action.payload;
        const existingUser = state.users.find(u => u.id === user.id);
        const users = existingUser ? state.users.map(u => u.id === user.id ? user : u) : [...state.users, user];
        return {
          ...state,
          users,
        };
    }
    case 'SET_ONLINE_USERS':
      return { ...state, onlineUserIds: action.payload };
    case 'USER_JOINED':
        if (state.onlineUserIds.includes(action.payload)) return state;
        return { ...state, onlineUserIds: [...state.onlineUserIds, action.payload] };
    case 'USER_LEFT':
        return { ...state, onlineUserIds: state.onlineUserIds.filter(id => id !== action.payload) };
    case 'MESSAGES_READ': {
        const { messageIds, userId, readAt } = action.payload;
        return {
            ...state,
            chatMessages: state.chatMessages.map(msg => {
                if (messageIds.includes(msg.id) && !msg.read_by.some(r => r.userId === userId)) {
                    return { ...msg, read_by: [...msg.read_by, { userId, readAt }] };
                }
                return msg;
            })
        };
    }
    default:
      return state;
  }
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const isFetchingRef = React.useRef(false);

  useEffect(() => {
    if (areSupabaseKeysMissing) {
        dispatch({
            type: 'SET_ERROR',
            payload: 'Supabase configuration is missing. Please check your .env file.'
        });
        return;
    }

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'INITIAL_SESSION' && session) {
            if (isFetchingRef.current) return;
            isFetchingRef.current = true;
            
            try {
                const { data: userProfile, error: profileError } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                if (profileError || !userProfile) throw profileError || new Error('Profile not found.');
                
                dispatch({ type: 'LOGIN', payload: userProfile as User });
                await fetchInitialData();
            } catch (error: any) {
                console.error("Critical session error:", error);
                await supabase.auth.signOut();
                dispatch({ type: 'SET_ERROR', payload: `A session error occurred: ${error.message}. Please log in again.` });
            } finally {
                isFetchingRef.current = false;
            }
        } else if (event === 'SIGNED_IN') {
             window.location.reload();
        } else if (event === 'SIGNED_OUT') {
            dispatch({ type: 'SET_LOGGED_OUT' });
        }
    });

    const fetchInitialData = async () => {
        try {
            dispatch({ type: 'SET_LOADING', payload: true });
            const [
              usersRes, unitsRes, progressRes, testsRes, groupsRes, messagesRes
            ] = await Promise.all([
                supabase.from('profiles').select('*'),
                supabase.from('units').select('*, rounds(*, words(*))').order('unit_number', { ascending: true }),
                supabase.from('round_progress').select('*'),
                supabase.from('unit_tests').select('*'),
                supabase.from('chat_groups').select('*'),
                supabase.from('chat_messages').select('*'),
            ]);

            const errors = [usersRes.error, unitsRes.error, progressRes.error, testsRes.error, groupsRes.error, messagesRes.error].filter(Boolean);
            if (errors.length > 0) throw new Error(errors.map(e => e?.message).join(', '));
            
            dispatch({
                type: 'SET_INITIAL_DATA', payload: {
                    users: usersRes.data as User[] || [],
                    units: unitsRes.data as Unit[] || [],
                    chatGroups: groupsRes.data as ChatGroup[] || [],
                    chatMessages: messagesRes.data as ChatMessage[] || [],
                    studentProgress: progressRes.data as RoundProgress[] || [],
                    unitTests: testsRes.data as UnitTest[] || []
                }
            });
        } catch (error: any) {
            console.error('Failed to fetch initial data:', error);
            let errorMessage = 'Failed to load app data. Please check your connection.';
            if (error.message && (error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('JWT'))) {
                 errorMessage = `Supabase setup error: ${error.message}. Please check your setup and RLS policies.`;
            }
            dispatch({ type: 'SET_ERROR', payload: errorMessage });
        }
    };
    
    return () => {
        authSubscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!state.loggedInUser?.id || areSupabaseKeysMissing) {
      supabase.removeAllChannels();
      return;
    }

    const user = state.loggedInUser;

    const allDbChangesChannel = supabase.channel('all-db-changes', { config: { presence: { key: user.id } } });

    allDbChangesChannel
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          const { table, eventType, new: newRecord, old: oldRecord } = payload;
          switch (table) {
              case 'profiles':
                  dispatch({ type: 'UPSERT_USER_PROFILE', payload: newRecord as User });
                  break;
              case 'units':
                  if (eventType === 'DELETE') dispatch({ type: 'DELETE_UNIT', payload: { unitId: (oldRecord as any).id } });
                  else dispatch({ type: 'UPSERT_UNIT', payload: newRecord as Unit });
                  break;
              case 'round_progress':
                  if (eventType === 'DELETE') {
                      const old = oldRecord as RoundProgress;
                      dispatch({ type: 'DELETE_ROUND_PROGRESS', payload: { progressId: old.id, studentId: old.student_id, unitId: old.unit_id, roundId: old.round_id } });
                  } else dispatch({ type: 'UPSERT_ROUND_PROGRESS', payload: newRecord as RoundProgress });
                  break;
              case 'words':
                  if (eventType === 'UPDATE') {
                      const updatedWord = newRecord as Word;
                      let parentUnitId: string | null = null, parentRoundId: string | null = null;
                      state.units.forEach(unit => unit.rounds.forEach(round => {
                        if (round.words.some(w => w.id === updatedWord.id)) {
                           parentUnitId = unit.id; parentRoundId = round.id;
                        }
                      }));
                      if (parentUnitId && parentRoundId) dispatch({ type: 'EDIT_WORD', payload: { unitId: parentUnitId, roundId: parentRoundId, wordId: updatedWord.id, updatedWord } });
                  }
                  break;
              case 'unit_tests':
                  if (eventType === 'DELETE') dispatch({ type: 'DELETE_TEST', payload: { testId: (oldRecord as any).id } });
                  else dispatch({ type: 'UPSERT_UNIT_TEST', payload: newRecord as UnitTest });
                  break;
              case 'chat_groups':
                  if (eventType === 'DELETE') dispatch({ type: 'DELETE_CHAT_GROUP', payload: { chatGroupId: (oldRecord as any).id } });
                  else dispatch({ type: 'UPSERT_CHAT_GROUP', payload: newRecord as ChatGroup });
                  break;
              case 'chat_messages':
                  if (eventType === 'DELETE') dispatch({ type: 'DELETE_MESSAGE', payload: { messageId: (oldRecord as any).id } });
                  else dispatch({ type: 'UPSERT_MESSAGE', payload: newRecord as ChatMessage });
                  break;
          }
      })
      .on('presence', { event: 'sync' }, () => {
          const presenceState = allDbChangesChannel.presenceState() || {};
          // FIX: Cast presence state item to 'any' to access 'user_id' property, which is untyped here.
          const userIds: string[] = Object.keys(presenceState).map(key => (presenceState[key][0] as any).user_id);
          dispatch({ type: 'SET_ONLINE_USERS', payload: [...new Set(userIds)] });
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
          const userId = (newPresences[0] as any)?.user_id;
          if (userId) dispatch({ type: 'USER_JOINED', payload: userId });
      })
      // FIX: The supabase.rpc() method returns a builder, not a promise. It must be awaited, and its error property checked.
      .on('presence', { event: 'leave' }, async ({ leftPresences }) => {
          const leftUserId = (leftPresences[0] as any)?.user_id;
          if (leftUserId) {
              dispatch({ type: 'USER_LEFT', payload: leftUserId });
              const { error } = await supabase.rpc('update_user_last_seen', { user_id: leftUserId });
              if (error) {
                console.error('Failed to update user last seen:', error);
              }
          }
      });
      
    const broadcastChannel = supabase.channel('app-broadcasts');
    broadcastChannel
      .on('broadcast', { event: 'submission' }, async ({ payload }) => {
        if (user.role === 'teacher' && payload && payload.testId) {
          supabase.from('unit_tests').select('*').eq('id', payload.testId).single().then(({ data }) => data && dispatch({ type: 'UPSERT_UNIT_TEST', payload: data }));
        }
      })
      .on('broadcast', { event: 'student_join' }, async ({ payload }) => {
        if (user.role === 'teacher' && payload && payload.testId) {
          supabase.from('unit_tests').select('*').eq('id', payload.testId).single().then(({ data }) => data && dispatch({ type: 'UPSERT_UNIT_TEST', payload: data }));
        }
      })
      .on('broadcast', { event: 'test_activated' }, async ({ payload }) => {
        if (user.role === 'student' && payload && payload.testId) {
            supabase.from('unit_tests').select('*').eq('id', payload.testId).single().then(({ data }) => data && dispatch({ type: 'UPSERT_UNIT_TEST', payload: data }));
        }
      })
      .subscribe();

    const handleReconnect = () => {
        allDbChangesChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') await allDbChangesChannel.track({ user_id: user.id });
        });
        broadcastChannel.subscribe();
    };

    handleReconnect();
    
    window.addEventListener('online', handleReconnect);

    return () => {
      supabase.removeAllChannels();
      window.removeEventListener('online', handleReconnect);
    };
  }, [state.loggedInUser?.id]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }

  const liveLoggedInUser = useMemo(() => {
    if (!context.state.loggedInUser) return null;
    return context.state.users.find(u => u.id === context.state.loggedInUser!.id) || context.state.loggedInUser;
  }, [context.state.users, context.state.loggedInUser]);

  return { 
    ...context, 
    state: { ...context.state, loggedInUser: liveLoggedInUser } 
  };
};
