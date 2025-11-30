import React, { createContext, useContext, useReducer, useEffect, ReactNode, useRef } from 'react';
import { AppState, Action, User, Unit, ChatGroup, ChatMessage, RoundProgress, UnitTest, StudentProgress, UserRole, AttemptHistory, Word } from '../types';
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
        loggedInUser: state.loggedInUser?.id === action.payload.userId
          ? { ...state.loggedInUser, avatar_url: action.payload.newAvatarUrl }
          : state.loggedInUser,
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
                // Merge, ensuring a new object is created and nested data is preserved.
                return { ...unit, ...updatedUnitPartial };
            }
            return unit;
        });

        if (isNew) {
            // It's a new unit from another client, add it.
            // Note: Realtime inserts won't have nested relations.
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
    case 'UPSERT_USER_PROFILE':
        const user = action.payload;
        const existingUser = state.users.find(u => u.id === user.id);
        const users = existingUser ? state.users.map(u => u.id === user.id ? user : u) : [...state.users, user];
        return {
          ...state,
          users,
          loggedInUser: state.loggedInUser?.id === user.id ? user : state.loggedInUser,
        };
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

  useEffect(() => {
    if (areSupabaseKeysMissing) {
        dispatch({
            type: 'SET_ERROR',
            payload: 'Supabase configuration is missing. Please create a .env file based on .env.example with your project URL and Key. This is required for the app to connect to the database.'
        });
        return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });

    const fetchInitialData = async (user: User) => {
        try {
            const [
              usersRes, unitsRes, progressRes, testsRes, groupsRes
            ] = await Promise.all([
                supabase.from('profiles').select('*'),
                supabase.from('units').select('*, rounds(*, words(*))').order('unit_number', { ascending: true }),
                supabase.from('round_progress').select('*'),
                supabase.from('unit_tests').select('*'),
                supabase.from('chat_groups').select('*'),
            ]);

            const mainErrors = [usersRes.error, unitsRes.error, progressRes.error, testsRes.error, groupsRes.error].filter(Boolean);
            if (mainErrors.length > 0) {
              throw new Error(mainErrors.map(e => e?.message).filter(Boolean).join(', '));
            }

            let chatMessagesData: ChatMessage[] = [];
            try {
                const messagesRes = await supabase.from('chat_messages').select('*');
                if (messagesRes.error) {
                    if (messagesRes.error.message.includes('column') && messagesRes.error.message.includes('does not exist')) {
                         console.warn(`Could not fetch chat messages due to a schema error: ${messagesRes.error.message}. Chat functionality will be limited. Please run the setup scripts from the guide.`);
                    } else {
                        throw messagesRes.error;
                    }
                } else {
                    chatMessagesData = messagesRes.data as ChatMessage[] || [];
                }
            } catch (chatError: any) {
                console.error('Non-critical error fetching chat messages:', chatError);
            }
            
            dispatch({
                type: 'SET_INITIAL_DATA', payload: {
                    users: usersRes.data as User[] || [],
                    units: unitsRes.data as Unit[] || [],
                    chatGroups: groupsRes.data as ChatGroup[] || [],
                    chatMessages: chatMessagesData,
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
    
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session) {
        if (state.loggedInUser) {
            try {
                // Use RPC to update last_seen on logout
                await supabase.rpc('update_user_last_seen', { user_id: state.loggedInUser.id });
            } catch (e) {
                console.error("Failed to update last_seen on logout", e);
            }
        }
        dispatch({ type: 'SET_LOGGED_OUT' });
        return;
      }

      try {
          const { data: userProfiles, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id);

          if (profileError) {
              throw new Error(`Could not fetch user profile: ${profileError.message}`);
          }
          
          if (!userProfiles || userProfiles.length === 0) {
              throw new Error('User profile not found for the authenticated user.');
          }
          
          if (userProfiles.length > 1) {
              console.warn(`Duplicate profiles found for user ${session.user.id}. Using the first one.`);
          }

          const userProfile = userProfiles[0];

          dispatch({ type: 'LOGIN', payload: userProfile as User });
          await fetchInitialData(userProfile as User);

      } catch (error: any) {
          console.error("Critical session error:", error);
          await supabase.auth.signOut();
          dispatch({ type: 'SET_ERROR', payload: `A session error occurred: ${error.message}. Please log in again.` });
      }
    });
    
    return () => {
        authSubscription?.unsubscribe();
    };
  }, []);

  // Simplified and robust real-time connection management.
  useEffect(() => {
    if (!state.loggedInUser || areSupabaseKeysMissing) {
      supabase.removeAllChannels();
      return;
    }

    const user = state.loggedInUser;

    const allDbChangesChannel = supabase.channel('all-db-changes', {
      config: {
        presence: { key: user.id },
      },
    });

    allDbChangesChannel
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          const { table, eventType, new: newRecord, old: oldRecord } = payload;
          switch (table) {
              case 'profiles':
                  dispatch({ type: 'UPSERT_USER_PROFILE', payload: newRecord as User });
                  break;
              case 'units':
                  if (eventType === 'INSERT' || eventType === 'UPDATE') {
                      dispatch({ type: 'UPSERT_UNIT', payload: newRecord as Unit });
                  } else if (eventType === 'DELETE') {
                      dispatch({ type: 'DELETE_UNIT', payload: { unitId: (oldRecord as any).id } });
                  }
                  break;
              case 'round_progress':
                    if (eventType === 'INSERT' || eventType === 'UPDATE') {
                      dispatch({ type: 'UPSERT_ROUND_PROGRESS', payload: newRecord as RoundProgress });
                  } else if (eventType === 'DELETE') {
                      const old = oldRecord as RoundProgress;
                      dispatch({ type: 'DELETE_ROUND_PROGRESS', payload: { progressId: old.id, studentId: old.student_id, unitId: old.unit_id, roundId: old.round_id } });
                  }
                  break;
              case 'words':
                  if (eventType === 'UPDATE') {
                      const updatedWord = newRecord as Word;
                      let parentUnitId: string | null = null;
                      let parentRoundId: string | null = null;

                      // Find the unit and round this word belongs to from the state
                      for (const unit of state.units) {
                          for (const round of unit.rounds) {
                              if (round.words.some(w => w.id === updatedWord.id)) {
                                  parentUnitId = unit.id;
                                  parentRoundId = round.id;
                                  break;
                              }
                          }
                          if (parentUnitId) break;
                      }
                      
                      if (parentUnitId && parentRoundId) {
                           dispatch({
                              type: 'EDIT_WORD',
                              payload: {
                                  unitId: parentUnitId,
                                  roundId: parentRoundId,
                                  wordId: updatedWord.id,
                                  updatedWord
                              }
                          });
                      }
                  }
                  break;
              case 'unit_tests':
                  if (eventType === 'INSERT' || eventType === 'UPDATE') {
                      dispatch({ type: 'UPSERT_UNIT_TEST', payload: newRecord as UnitTest });
                  } else if (eventType === 'DELETE') {
                      dispatch({ type: 'DELETE_TEST', payload: { testId: (oldRecord as any).id } });
                  }
                  break;
              case 'chat_groups':
                    if (eventType === 'INSERT' || eventType === 'UPDATE') {
                      dispatch({ type: 'UPSERT_CHAT_GROUP', payload: newRecord as ChatGroup });
                    } else if (eventType === 'DELETE') {
                      dispatch({ type: 'DELETE_CHAT_GROUP', payload: { chatGroupId: (oldRecord as any).id } });
                    }
                  break;
              case 'chat_messages':
                  if (eventType === 'INSERT' || eventType === 'UPDATE') {
                      dispatch({ type: 'UPSERT_MESSAGE', payload: newRecord as ChatMessage });
                  } else if (eventType === 'DELETE') {
                      dispatch({ type: 'DELETE_MESSAGE', payload: { messageId: (oldRecord as any).id } });
                  }
                  break;
          }
      })
      .on('presence', { event: 'sync' }, () => {
          const presenceState = allDbChangesChannel.presenceState() || {};
          const userIds: string[] = [];
          for (const id in presenceState) {
              // @ts-ignore
              const presences = presenceState[id] as { user_id: string }[];
              presences.forEach(p => userIds.push(p.user_id));
          }
          dispatch({ type: 'SET_ONLINE_USERS', payload: [...new Set(userIds)] });
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
          // @ts-ignore
          const joinedUserId = newPresences[0]?.user_id;
          if (joinedUserId) dispatch({ type: 'USER_JOINED', payload: joinedUserId });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          // @ts-ignore
          const leftUserId = leftPresences[0]?.user_id;
          if (leftUserId) {
              dispatch({ type: 'USER_LEFT', payload: leftUserId });
              supabase.rpc('update_user_last_seen', { user_id: leftUserId }).then(({ error }) => {
                  if (error) console.error(`Failed to update last_seen for user ${leftUserId} via RPC`, error);
              });
          }
      });
      
    const testUpdatesChannel = supabase.channel('test-updates');
    testUpdatesChannel.on('broadcast', { event: 'submission' }, async ({ payload }) => {
      if (payload && payload.testId) {
        try {
          const { data, error } = await supabase.from('unit_tests').select('*').eq('id', payload.testId).single();
          if (error) throw error;
          if (data) {
            dispatch({ type: 'UPSERT_UNIT_TEST', payload: data as UnitTest });
          }
        } catch (e) {
          console.error('Failed to refetch test after submission broadcast', e);
        }
      }
    });

    // This handler attempts to re-subscribe to all channels.
    // It's safe to call multiple times, as the Supabase client handles idempotency.
    const handleReconnect = () => {
      allDbChangesChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await allDbChangesChannel.track({ user_id: user.id });
        }
      });
      testUpdatesChannel.subscribe();
    };

    // Initial subscription
    handleReconnect(); 

    // Add listeners to handle reconnection automatically after inactivity.
    const visibilityListener = () => {
        if (document.visibilityState === 'visible') {
            handleReconnect();
        }
    };
    document.addEventListener('visibilitychange', visibilityListener);
    window.addEventListener('online', handleReconnect);

    // Cleanup function.
    return () => {
      supabase.removeAllChannels();
      document.removeEventListener('visibilitychange', visibilityListener);
      window.removeEventListener('online', handleReconnect);
    };
  }, [state.loggedInUser, dispatch]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};