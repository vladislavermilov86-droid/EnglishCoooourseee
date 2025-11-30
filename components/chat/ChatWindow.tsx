import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatGroup, ChatMessage as MessageType, UserRole } from '../../types';
import { useApp } from '../../contexts/AppContext';
import ChatMessage from './ChatMessage';
import ChatInfo from './ChatInfo';
import ReadInfoModal from './ReadInfoModal';
import { ChevronLeftIcon, PaperAirplaneIcon, InformationCircleIcon, XIcon } from '../icons/Icons';
// FIX: Consolidate Appwrite imports into a single statement from the local module.
import { supabase } from '../../supabase';

const formatDateSeparator = (dateString: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null; // Invalid date check

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

// FIX: Define missing ChatWindowProps interface
interface ChatWindowProps {
    chatGroup: ChatGroup;
    onBack: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ chatGroup, onBack }) => {
    const { state, dispatch } = useApp();
    const { loggedInUser, chatMessages, users } = state;
    const [newMessage, setNewMessage] = useState('');
    const [editingMessage, setEditingMessage] = useState<MessageType | null>(null);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [readingInfoOf, setReadingInfoOf] = useState<MessageType | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    const messages = chatMessages.filter(msg => msg.chat_group_id === chatGroup.id)
        .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    useEffect(scrollToBottom, [messages.length]);

    useEffect(() => {
        if (!loggedInUser || !messagesContainerRef.current) return;

        const markMessagesAsRead = async (messageIds: string[]) => {
            const readAt = new Date().toISOString();
            
            // FIX: Use 'id' and 'read_by' for Supabase compatibility
            const unreadMessages = messages.filter(msg => 
                messageIds.includes(msg.id) &&
                !msg.read_by.some(r => r.userId === loggedInUser.id)
            );

            if (unreadMessages.length === 0) return;

            // FIX: Dispatch a valid action type. This is handled in types.ts and AppContext.tsx
            dispatch({ type: 'MESSAGES_READ', payload: { messageIds, userId: loggedInUser.id, readAt } });

            for (const msg of unreadMessages) {
                try {
                    // FIX: Use 'read_by' property and Supabase client
                    const newReadBy = [...msg.read_by, { userId: loggedInUser.id, readAt }];
                    await supabase.from('chat_messages').update({
                        read_by: newReadBy
                    }).eq('id', msg.id);
                } catch (error) {
                    console.error("Failed to mark message as read:", msg.id, error);
                }
            }
        };

        const observer = new IntersectionObserver(
            (entries) => {
                const messagesToMarkAsRead = entries
                    .filter(entry => entry.isIntersecting)
                    .map(entry => (entry.target as HTMLElement).dataset.messageId)
                    .filter((id): id is string => !!id);

                if (messagesToMarkAsRead.length > 0) {
                    markMessagesAsRead(messagesToMarkAsRead);
                }
            },
            { root: messagesContainerRef.current, threshold: 0.8 }
        );

        const unreadMessages = messagesContainerRef.current.querySelectorAll('.message-unread');
        unreadMessages.forEach(msgEl => observer.observe(msgEl));

        return () => observer.disconnect();
    }, [messages, loggedInUser, chatGroup.id, dispatch]);
    
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${scrollHeight}px`;
        }
    }, [newMessage]);


    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const content = newMessage.trim();
        if (!content || !loggedInUser) return;

        if (editingMessage) {
            try {
                // FIX: Use Supabase client to update message
                await supabase.from('chat_messages').update({
                    content: content
                }).eq('id', editingMessage.id);
                setEditingMessage(null);
                setNewMessage('');
            } catch (error) {
                console.error("Failed to edit message:", error);
                alert("Failed to edit message.");
            }
        } else {
            setNewMessage('');
            try {
                // FIX: Use Supabase client and correct payload structure
                const newMessagePayload = {
                    chat_group_id: chatGroup.id,
                    sender_id: loggedInUser.id,
                    content: content,
                    read_by: [{ userId: loggedInUser.id, readAt: new Date().toISOString() }],
                };

                await supabase.from('chat_messages').insert(newMessagePayload);
            } catch (error) {
                console.error("Failed to send message:", error);
                setNewMessage(content); // Restore message on failure
                alert("Failed to send message. Please check your RLS policies.");
            }
        }
    };

    const handleEditRequest = (message: MessageType) => {
        setEditingMessage(message);
        setNewMessage(message.content);
        textareaRef.current?.focus();
    };

    const handleDeleteRequest = async (messageId: string) => {
        if (window.confirm('Are you sure you want to delete this message? This will delete it for everyone.')) {
            try {
                // FIX: Use Supabase client to delete message
                await supabase.from('chat_messages').delete().eq('id', messageId);
            } catch (error) {
                console.error("Failed to delete message:", error);
                alert("Failed to delete message.");
            }
        }
    };
    
    return (
        <div className="flex h-full relative overflow-hidden">
            <div className={`flex flex-col flex-1 w-full transition-all duration-300 ease-in-out ${isInfoOpen ? 'hidden lg:flex' : 'flex'}`}>
                <header className="p-3 border-b dark:border-gray-700 flex items-center justify-between space-x-4 flex-shrink-0">
                    <div className="flex items-center space-x-2">
                        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                            <ChevronLeftIcon className="w-6 h-6" />
                        </button>
                        <div className="flex items-center space-x-3 text-left">
                            <img src={chatGroup.avatar_url} alt={chatGroup.name} className="w-10 h-10 rounded-full object-cover" />
                            <div>
                                <p className="font-bold leading-tight">{chatGroup.name}</p>
                                <p className="text-xs text-gray-500">{chatGroup.members.length} participants</p>
                            </div>
                        </div>
                    </div>
                     <button onClick={() => setIsInfoOpen(true)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <InformationCircleIcon className="w-6 h-6" />
                    </button>
                </header>

                <div ref={messagesContainerRef} className="flex-1 p-4 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                    {(() => {
                        let lastDate: string | null = null;
                        return messages.map((msg, index) => {
                            const sender = users.find(u => u.id === msg.sender_id);
                            const prevMsg = messages[index - 1];
                            const nextMsg = messages[index + 1];
                            const isOwnMessage = msg.sender_id === loggedInUser?.id;
                            
                            const isFirstInGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id || (new Date(msg.created_at || 0).getTime() - new Date(prevMsg.created_at || 0).getTime()) > 300000;
                            const isLastInGroup = !nextMsg || nextMsg.sender_id !== msg.sender_id || (new Date(nextMsg.created_at || 0).getTime() - new Date(msg.created_at || 0).getTime()) > 300000;

                            const isUnread = loggedInUser && !isOwnMessage && !msg.read_by.some(r => r.userId === loggedInUser.id);
                            
                            const separatorText = formatDateSeparator(msg.created_at);
                            const currentMessageDate = new Date(msg.created_at || 0).toDateString();
                            const showDateSeparator = currentMessageDate !== lastDate;
                            if (showDateSeparator) {
                                lastDate = currentMessageDate;
                            }


                            return (
                                <React.Fragment key={msg.id}>
                                    {showDateSeparator && separatorText && (
                                        <div className="text-center my-4">
                                            <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold px-3 py-1 rounded-full">
                                                {separatorText}
                                            </span>
                                        </div>
                                    )}
                                    <div 
                                        data-message-id={msg.id}
                                        className={isUnread ? 'message-unread' : ''}
                                    >
                                        <ChatMessage
                                            message={msg}
                                            sender={sender}
                                            isOwnMessage={isOwnMessage}
                                            isFirstInGroup={isFirstInGroup}
                                            isLastInGroup={isLastInGroup}
                                            onEdit={handleEditRequest}
                                            onDelete={handleDeleteRequest}
                                            onViewReadInfo={() => setReadingInfoOf(msg)}
                                            chatGroup={chatGroup}
                                        />
                                    </div>
                                </React.Fragment>
                            );
                        });
                    })()}
                    <div ref={messagesEndRef} />
                </div>

                <footer className="p-3 border-t dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                    {editingMessage && (
                        <div className="flex justify-between items-center bg-gray-100 dark:bg-gray-700 p-2 rounded-t-lg text-sm">
                            <div>
                                <p className="font-bold text-blue-500">Editing Message</p>
                                <p className="text-gray-500 line-clamp-1">{editingMessage.content}</p>
                            </div>
                            <button onClick={() => { setEditingMessage(null); setNewMessage(''); }}>
                                <XIcon className="w-5 h-5"/>
                            </button>
                        </div>
                    )}
                    <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
                        <textarea
                            ref={textareaRef}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    handleSendMessage(e);
                                }
                            }}
                            placeholder="Type a message..."
                            className="flex-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-40"
                            rows={1}
                        />
                        <button type="submit" className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:bg-blue-300 transition-colors" disabled={!newMessage.trim()}>
                            <PaperAirplaneIcon className="w-6 h-6" />
                        </button>
                    </form>
                </footer>
            </div>
            {/* Info Panel */}
            <div className={`flex-1 w-full transition-all duration-300 ease-in-out ${isInfoOpen ? 'block' : 'hidden'}`}>
                <ChatInfo chatGroup={chatGroup} onClose={() => setIsInfoOpen(false)} />
            </div>

            {readingInfoOf && <ReadInfoModal message={readingInfoOf} chatGroup={chatGroup} onClose={() => setReadingInfoOf(null)} />}
        </div>
    );
};

export default ChatWindow;