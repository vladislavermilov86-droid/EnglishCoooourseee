import React from 'react';
import { useApp } from '../../contexts/AppContext';
import { ChatGroup, UserRole } from '../../types';
import { ChatAltIcon, XIcon, PlusIcon } from '../icons/Icons';

interface ChatListProps {
    onSelectChat: (chatGroup: ChatGroup) => void;
    onClose: () => void;
    onCreateChat: () => void;
}

const ChatList: React.FC<ChatListProps> = ({ onSelectChat, onClose, onCreateChat }) => {
    const { state } = useApp();
    const { chatGroups, loggedInUser, chatMessages, users } = state;

    const isTeacher = loggedInUser?.role.toLowerCase() === UserRole.Teacher;

    // FIX: Use 'id' instead of '$id' for Supabase compatibility
    const userChatGroups = chatGroups.filter(group => group.members.includes(loggedInUser?.id || ''));

    const getLastMessage = (groupId: string) => {
        const lastMsg = chatMessages
            .filter(msg => msg.chat_group_id === groupId)
            .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
        
        if (!lastMsg) return { content: 'No messages yet', time: '' };

        const sender = users.find(u => u.id === lastMsg.sender_id);
        const time = lastMsg.created_at ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

        const senderName = sender?.id === loggedInUser?.id ? 'You' : sender?.name.split(' ')[0];

        return {
            content: `${senderName}: ${lastMsg.content}`,
            time: time
        };
    };

    return (
        <div className="flex flex-col h-full">
            <header className="p-4 border-b dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                <h2 className="text-xl font-bold">Conversations</h2>
                 <div className="flex items-center space-x-2">
                    {isTeacher && (
                        <button onClick={onCreateChat} aria-label="Create new chat" className="p-2 rounded-full text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                            <PlusIcon className="w-6 h-6" />
                        </button>
                    )}
                    <button onClick={onClose} aria-label="Close chat">
                        <XIcon className="w-6 h-6 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200" />
                    </button>
                </div>
            </header>
            <div className="flex-1 overflow-y-auto p-2">
                {userChatGroups.length > 0 ? (
                    userChatGroups.map(group => {
                        // FIX: Use 'id' instead of '$id'
                        const lastMessage = getLastMessage(group.id);
                        return (
                            <button 
                                key={group.id} 
                                onClick={() => onSelectChat(group)}
                                className="w-full text-left p-3 flex items-center space-x-4 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                            >
                                <img src={group.avatar_url} alt={group.name} className="w-14 h-14 rounded-full object-cover" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center">
                                        <p className="font-bold truncate">{group.name}</p>
                                        <p className="text-xs text-gray-500 flex-shrink-0 ml-2">{lastMessage.time}</p>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{lastMessage.content}</p>
                                </div>
                            </button>
                        );
                    })
                ) : (
                    <div className="flex flex-col h-full items-center justify-center text-center p-8 text-gray-500 dark:text-gray-400">
                        <ChatAltIcon className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                        <h3 className="font-semibold text-lg text-gray-700 dark:text-gray-300">No Conversations Yet</h3>
                        <p className="text-sm">Your chats with students and the teacher will appear here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatList;