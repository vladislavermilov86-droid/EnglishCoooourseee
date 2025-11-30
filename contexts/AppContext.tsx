import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
import { AppState, Action, User, Unit, ChatGroup, ChatMessage, RoundProgress, UnitTest, StudentProgress, Word } from '../types';
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
      return { ...initialState, isLoading: false, selectedLoginRole: state.selectedLoginRole };
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
        units: action.payload.units.sort((a,b) => a.unit_number - b.unit_number),
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
        // loggedInUser is now stable and gets its live updates via the useApp hook
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
        const unit = action.payload;
        let isNew = true;
        const newUnits = state.units.map(u => {
            if (u.id === unit.id) {
                isNew = false;
                return { ...u, ...unit };
            }
            return u;
        });
        if (isNew) {
            newUnits.push(unit as Unit);
        }
        newUnits.sort((a,b) => a.unit_number - b.unit_number);
        const newUnlockedUnits = newUnits.filter(u => u.unlocked).map(u => u.id);
        return { ...state, units: newUnits, unlockedUnits: newUnlockedUnits };
    }
    case 'DELETE_UNIT':
        return { ...state, units: state.units.filter(u => u.id !== action.payload.unitId) };
    case 'EDIT_WORD': {
        const { unitId, roundId, wordId, updatedWord } = action.payload;
        return {
            ...state,
            units: state.units.map(unit => {
                if (unit.id !== unitId) return unit;
                return {
                    ...unit,
                    rounds: unit.rounds.map(round => {
                        if (round.id !== roundId) return round;
                        return {
                            ...round,
                            words: round.words.map(word => {
                                if (word.id !== wordId) return word;
                                return { ...word, ...updatedWord };
                            })
                        };
                    })
                };
            })
        };
    }
    case 'EDIT_WORD_BY_PAYLOAD': {
        const updatedWord = action.payload;
        return {
            ...state,
            units: state.units.map(unit => ({
                ...unit,
                rounds: unit.rounds.map(round => ({
                    ...round,
                    words: round.words.map(word => word.id === updatedWord.id ? { ...word, ...updatedWord } : word)
                }))
            }))
        };
    }
    case 'UPSERT_UNIT_TEST': {
        const newTest = action.payload;
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
        const users = existingUser
            ? state.users.map(u => u.id === user.id ? { ...u, ...user } : u)
            : [...state.users, user];
        return {
            ...state,
            users,
            // Do not update loggedInUser here to maintain a stable object reference, preventing subscription loops.
        };
    }
    case 'SET_ONLINE_USERS':
      return { ...state, onlineUserIds: action.payload };
    case 'USER_STATUS_CHANGE': {
        const { userId, status, lastSeen } = action.payload;
        const newUsers = state.users.map(u => (u.id === userId && lastSeen) ? { ...u, last_seen: lastSeen } : u);
        let newOnlineUsers = [...state.onlineUserIds];
        if (status === 'online' && !newOnlineUsers.includes(userId)) newOnlineUsers.push(userId);
        if (status === 'offline') newOnlineUsers = newOnlineUsers.filter(id => id !== userId);
        return { ...state, users: newUsers, onlineUserIds: newOnlineUsers };
    }
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

  const fetchInitialData = useCallback(async (user: User) => {
    try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const [unitsRes, usersRes, groupsRes, messagesRes, progressRes, testsRes] = await Promise.all([
            supabase.from('units').select('*, rounds(*, words(*))'),
            supabase.from('profiles').select('*'),
            supabase.from('chat_groups').select('*'),
            supabase.from('chat_messages').select('*'),
            supabase.from('round_progress').select('*'),
            supabase.from('unit_tests').select('*'),
        ]);

        const errors = [unitsRes.error, usersRes.error, groupsRes.error, messagesRes.error, progressRes.error, testsRes.error].filter(Boolean);
        if (errors.length > 0) throw new Error(errors.map(e => e?.message).join(', '));
        
        dispatch({
            type: 'SET_INITIAL_DATA', payload: {
                units: unitsRes.data as Unit[] || [],
                users: usersRes.data as User[] || [],
                chatGroups: groupsRes.data as ChatGroup[] || [],
                chatMessages: messagesRes.data as ChatMessage[] || [],
                studentProgress: progressRes.data as RoundProgress[] || [],
                unitTests: testsRes.data as UnitTest[] || [],
            }
        });
    } catch (error: any) {
        let message = "Failed to load app data. Check your connection and RLS policies.";
        if (error.message.includes("relation") && error.message.includes("does not exist")) {
            message = `Database table not found: ${error.message}. Please run the setup SQL script from the guide.`;
        }
        dispatch({ type: 'SET_ERROR', payload: message });
    }
  }, []);

  const setupRealtimeSubscriptions = useCallback((user: User) => {
    supabase.removeAllChannels();

    const allDbChanges = supabase.channel('all-db-changes');
    allDbChanges
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        const { table, eventType, new: newRecord, old: oldRecord } = payload;
        switch (table) {
            case 'profiles': dispatch({ type: 'UPSERT_USER_PROFILE', payload: newRecord as User }); break;
            case 'units':
                if (eventType === 'DELETE') dispatch({ type: 'DELETE_UNIT', payload: { unitId: (oldRecord as any).id } });
                else dispatch({ type: 'UPSERT_UNIT', payload: newRecord as Unit });
                break;
            case 'words': if (eventType === 'UPDATE') dispatch({ type: 'EDIT_WORD_BY_PAYLOAD', payload: newRecord as Word }); break;
            case 'round_progress':
                if (eventType === 'DELETE') {
                    const old = oldRecord as RoundProgress;
                    dispatch({ type: 'DELETE_ROUND_PROGRESS', payload: { progressId: old.id, studentId: old.student_id, unitId: old.unit_id, roundId: old.round_id } });
                } else {
                    dispatch({ type: 'UPSERT_ROUND_PROGRESS', payload: newRecord as RoundProgress });
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
      }).subscribe();
      
    const presenceChannel = supabase.channel('online-users', { config: { presence: { key: user.id } } });
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
          const userIds = Object.keys(presenceChannel.presenceState());
          dispatch({ type: 'SET_ONLINE_USERS', payload: userIds });
      })
      .on('presence', { event: 'join' }, ({ key }) => dispatch({ type: 'USER_STATUS_CHANGE', payload: { userId: key, status: 'online' } }))
      .on('presence', { event: 'leave' }, ({ key }) => {
          const lastSeen = new Date().toISOString();
          dispatch({ type: 'USER_STATUS_CHANGE', payload: { userId: key, status: 'offline', lastSeen } });
          supabase.from('profiles').update({ last_seen: lastSeen }).eq('id', key).then();
      })
      .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') await presenceChannel.track({ user_id: user.id, online_at: new Date().toISOString() });
      });

    const testUpdatesChannel = supabase.channel('test-updates');
    testUpdatesChannel
    .on('broadcast', { event: 'submission' }, ({ payload }) => {
        if (payload?.testId) {
            supabase.from('unit_tests').select('*').eq('id', payload.testId).single().then(({data}) => {
                if (data) dispatch({ type: 'UPSERT_UNIT_TEST', payload: data as UnitTest });
            });
        }
    })
    .on('broadcast', { event: 'student_join' }, ({ payload }) => {
        if (payload?.testId) {
            supabase.from('unit_tests').select('*').eq('id', payload.testId).single().then(({data}) => {
                if (data) dispatch({ type: 'UPSERT_UNIT_TEST', payload: data as UnitTest });
            });
        }
    })
    .on('broadcast', { event: 'test_activated' }, ({ payload }) => {
        if (payload?.testId) {
            supabase.from('unit_tests').select('*').eq('id', payload.testId).single().then(({data}) => {
                if (data) dispatch({ type: 'UPSERT_UNIT_TEST', payload: data as UnitTest });
            });
        }
    })
    .subscribe();

    return () => supabase.removeAllChannels();
  }, [dispatch]);

  // Main effect for auth and connection management
  useEffect(() => {
    if (areSupabaseKeysMissing) {
      dispatch({ type: 'SET_ERROR', payload: 'Supabase URL or Key is missing. Please check your setup guide.' });
      return;
    }

    let initialDataLoadedForSession = false;

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        // Only run the full login flow on SIGNED_IN or on the first load of a session (INITIAL_SESSION).
        // Ignore background token refreshes to prevent re-fetching all data.
        if (session?.user && !initialDataLoadedForSession) {
            initialDataLoadedForSession = true;
            
            const user = session.user;
            const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (error || !profile) {
                console.error("Auth listener error: Profile not found or error fetching. Signing out.", error);
                await supabase.auth.signOut();
                let errorMessage = `Your user profile could not be loaded. This can happen after a database reset. Please try logging in again. Error: ${error?.message}`;
                if (error?.message.includes('Database error querying schema')) {
                    const projectRef = import.meta.env.VITE_SUPABASE_URL?.split('.')[0]?.split('//')[1] || 'UNKNOWN';
                    errorMessage = `Login successful, but profile loading failed due to a database permission error.\n\n` +
                                   `**IMPORTANT:** This almost always happens when the setup SQL script is run in the **wrong Supabase project**.\n\n` +
                                   `Please go to your Supabase SQL Editor and confirm that your project's "Reference ID" is exactly: **${projectRef}**.\n\n` +
                                   `Then, run the full setup script again using the "Show Setup Guide" button.`;
                }
                dispatch({ type: 'SET_ERROR', payload: errorMessage });
            } else {
                dispatch({ type: 'LOGIN', payload: profile as User });
                await fetchInitialData(profile as User);
            }
        } else if (event === 'SIGNED_OUT') {
            dispatch({ type: 'SET_LOGGED_OUT' });
            initialDataLoadedForSession = false; // Reset for the next login
        }
    });

    return () => {
        authListener.subscription.unsubscribe();
    };
  }, [fetchInitialData]);
  
  // Effect to set up subscriptions only when a user logs in
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    if (state.loggedInUser) {
        cleanup = setupRealtimeSubscriptions(state.loggedInUser);
    }
    return () => {
        if (cleanup) cleanup();
    };
  }, [state.loggedInUser?.id, setupRealtimeSubscriptions]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }

    // Create a "live" version of the loggedInUser by finding the latest
    // version in the 'users' array, which is updated by realtime events.
    // This provides components with fresh data without destabilizing the main
    // loggedInUser object reference, which would cause subscription loops.
    const liveLoggedInUser = context.state.loggedInUser
        ? context.state.users.find(u => u.id === context.state.loggedInUser!.id) || context.state.loggedInUser
        : null;

    return {
        ...context,
        state: {
            ...context.state,
            loggedInUser: liveLoggedInUser,
        },
    };
};
