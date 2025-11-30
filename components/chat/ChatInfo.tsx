import React, { useState, useRef } from 'react';
import { ChatGroup, User, UserRole } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { XIcon, PencilIcon, CameraIcon, TrashIcon } from '../icons/Icons';
// FIX: Consolidate Appwrite imports into a single statement from the local module.
import { supabase } from '../../supabase';

interface ChatInfoProps {
    chatGroup: ChatGroup;
    onClose: () => void;
}

const formatLastSeen = (isoString: string | null | undefined, isOnline: boolean) => {
    if (isOnline) return 'Online';
    if (!isoString) return 'a long time ago';

    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'a long time ago';

    const now = new Date();
    const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
    
    if (diffSeconds < 5) return 'last seen just now';
    
    const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return `last seen today at ${date.toLocaleTimeString([], timeOptions)}`;
    }
    if (date.toDateString() === yesterday.toDateString()) {
        return `last seen yesterday at ${date.toLocaleTimeString([], timeOptions)}`;
    }

    return `last seen on ${date.toLocaleDateString()}`;
};


const ChatInfo: React.FC<ChatInfoProps> = ({ chatGroup: initialChatGroup, onClose }) => {
    const { state, dispatch } = useApp();
    const { users, loggedInUser, onlineUserIds } = state;
    // FIX: Use 'id' for Supabase compatibility
    const chatGroup = state.chatGroups.find(g => g.id === initialChatGroup.id) || initialChatGroup;
    
    const [isEditingName, setIsEditingName] = useState(false);
    const [groupName, setGroupName] = useState(chatGroup.name);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isTeacher = loggedInUser?.role.toLowerCase() === UserRole.Teacher;

    const handleNameUpdate = async () => {
        if (groupName.trim() && groupName !== chatGroup.name) {
            try {
                // FIX: Use Supabase client to update document
                await supabase.from('chat_groups').update({ name: groupName }).eq('id', chatGroup.id);
            } catch (error) {
                console.error("Failed to update group name:", error);
            }
        }
        setIsEditingName(false);
    };
    
    const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                // FIX: Use Supabase storage client
                if (chatGroup.avatar_url) {
                    try {
                        const url = new URL(chatGroup.avatar_url);
                        const pathParts = url.pathname.split('/');
                        const bucketNameIndex = pathParts.indexOf('avatars');
                        if (bucketNameIndex > -1) {
                            const oldFilePath = pathParts.slice(bucketNameIndex + 1).join('/');
                            await supabase.storage.from('avatars').remove([oldFilePath]);
                        }
                    } catch (e) {
                        console.warn("Could not delete old group avatar file", e);
                    }
                }
                const fileName = `${Date.now()}_${file.name}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
                await supabase.from('chat_groups').update({ avatar_url: publicUrl }).eq('id', chatGroup.id);
            } catch (error) {
                console.error("Failed to update group avatar:", error);
            }
        }
    };
    
    const handleClearHistory = async () => {
        if(window.confirm('Are you sure you want to delete all messages in this chat? This cannot be undone.')) {
            try {
                // FIX: Use Supabase client for batch delete
                await supabase.from('chat_messages').delete().eq('chat_group_id', chatGroup.id);
            } catch (error) {
                console.error("Failed to clear chat history:", error);
            }
        }
    };
    
    const handleDeleteGroup = async () => {
        if(window.confirm('Are you sure you want to delete this chat group? This will delete it for everyone.')) {
            try {
                // FIX: Use Supabase client. ON DELETE CASCADE will handle messages.
                await supabase.from('chat_groups').delete().eq('id', chatGroup.id);
                onClose(); // Close the panel after deletion
            } catch (error) {
                console.error("Failed to delete chat group:", error);
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-l dark:border-gray-700">
            <header className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold">Group Info</h2>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                    <XIcon className="w-6 h-6" />
                </button>
            </header>
            <div className="flex-1 overflow-y-auto p-4">
                <div className="text-center mb-6">
                    <div className="relative w-24 h-24 mx-auto mb-2">
                        <img src={chatGroup.avatar_url} alt={chatGroup.name} className="w-24 h-24 rounded-full object-cover" />
                        {isTeacher && (
                            <>
                                <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 transition shadow-md">
                                    <CameraIcon className="w-5 h-5" />
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
                            </>
                        )}
                    </div>
                    {isEditingName ? (
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            onBlur={handleNameUpdate}
                            onKeyDown={e => e.key === 'Enter' && handleNameUpdate()}
                            className="text-xl font-bold text-center bg-transparent border-b-2 dark:border-gray-600 focus:outline-none focus:border-blue-500 dark:text-gray-100"
                            autoFocus
                        />
                    ) : (
                        <div className="flex items-center justify-center space-x-2">
                            <h2 className="text-xl font-bold">{chatGroup.name}</h2>
                            {isTeacher && (
                                <button onClick={() => setIsEditingName(true)} className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                                    <PencilIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
                
                <h3 className="font-bold text-gray-600 dark:text-gray-400 text-sm tracking-wider uppercase mb-2">Participants ({chatGroup.members.length})</h3>
                <div className="space-y-2">
                    {users
                        // FIX: Use 'id' for Supabase compatibility
                        .filter(user => chatGroup.members.includes(user.id))
                        .map(member => {
                            const isOnline = onlineUserIds.includes(member.id);
                            return (
                                <div key={member.id} className="flex items-center space-x-3 p-2 rounded-lg">
                                    <img src={member.avatar_url} alt={member.name} className="w-10 h-10 rounded-full object-cover" />
                                    <div>
                                        <p className="font-semibold">{member.name}</p>
                                        <p className={`text-xs ${isOnline ? 'text-green-500' : 'text-gray-500'}`}>{formatLastSeen(member.last_seen, isOnline)}</p>
                                    </div>
                                </div>
                            );
                        })}
                </div>
                
                {isTeacher && (
                    <div className="mt-6 border-t dark:border-gray-700 pt-4 space-y-2">
                         <button onClick={handleClearHistory} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50">
                             <TrashIcon className="w-5 h-5" /> Clear Chat History
                         </button>
                         <button onClick={handleDeleteGroup} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50">
                            <TrashIcon className="w-5 h-5" /> Delete Group
                         </button>
                    </div>
                )}
            </div>
        </div>
    );
};
// FIX: Added default export to resolve "has no default export" error.
export default ChatInfo;