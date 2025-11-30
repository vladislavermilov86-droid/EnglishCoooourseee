import React, { useState } from 'react';
import { ChatMessage as MessageType, User, ChatGroup, UserRole } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { DotsHorizontalIcon, PencilIcon, TrashIcon, CheckIcon, CheckDoubleIcon } from '../icons/Icons';

interface ChatMessageProps {
    message: MessageType;
    sender?: User;
    isOwnMessage: boolean;
    isFirstInGroup: boolean;
    isLastInGroup: boolean;
    onEdit: (message: MessageType) => void;
    onDelete: (messageId: string) => void;
    onViewReadInfo: () => void;
    chatGroup: ChatGroup;
}

const ReadReceipts: React.FC<{message: MessageType; chatGroup: ChatGroup}> = ({ message, chatGroup }) => {
    // -1 to exclude the sender
    const totalReceivers = chatGroup.members.length - 1;
    // -1 to exclude the sender's own "read" status
    // FIX: Use 'read_by' instead of 'readBy'
    const readByReceivers = message.read_by.length - 1;

    let status: 'sent' | 'delivered' | 'read' = 'sent';

    if (readByReceivers >= totalReceivers && totalReceivers > 0) {
        status = 'read';
    } else if (readByReceivers > 0) {
        status = 'delivered';
    }

    if (status === 'read') {
        return <CheckDoubleIcon className="w-4 h-4 text-blue-400" />;
    }
    if (status === 'delivered') {
        return <CheckDoubleIcon className="w-4 h-4 text-gray-400" />;
    }
    return <CheckIcon className="w-4 h-4 text-gray-400" />;
};


const ChatMessage: React.FC<ChatMessageProps> = ({ message, sender, isOwnMessage, isFirstInGroup, isLastInGroup, onEdit, onDelete, onViewReadInfo, chatGroup }) => {
    const { state } = useApp();
    const { loggedInUser } = state;
    const [showOptions, setShowOptions] = useState(false);
    const time = message.created_at ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    const isTeacher = loggedInUser?.role.toLowerCase() === UserRole.Teacher;
    const canEdit = isOwnMessage;
    const canDelete = isOwnMessage || isTeacher;
    const showOptionsButton = canDelete;

    let bubbleClasses = isOwnMessage ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-700';

    if (isOwnMessage) {
        if (isFirstInGroup && isLastInGroup) bubbleClasses += ' rounded-xl';
        else if (isFirstInGroup) bubbleClasses += ' rounded-t-xl rounded-l-xl';
        else if (isLastInGroup) bubbleClasses += ' rounded-b-xl rounded-l-xl';
        else bubbleClasses += ' rounded-l-xl';
    } else {
        if (isFirstInGroup && isLastInGroup) bubbleClasses += ' rounded-xl';
        else if (isFirstInGroup) bubbleClasses += ' rounded-t-xl rounded-r-xl';
        else if (isLastInGroup) bubbleClasses += ' rounded-b-xl rounded-r-xl';
        else bubbleClasses += ' rounded-r-xl';
    }

    return (
        <div className={`flex items-end gap-2 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} ${isFirstInGroup ? 'mt-3' : 'mt-0.5'}`}>
            <div className="w-8 flex-shrink-0 self-end">
                 {(!isOwnMessage && isLastInGroup) && (
                     <img src={sender?.avatar_url} alt={sender?.name} className="w-8 h-8 rounded-full object-cover" />
                 )}
            </div>

            <div className={`max-w-md ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                {(!isOwnMessage && isFirstInGroup) && <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 ml-3">{sender?.name}</p>}
                
                <div className="group flex items-center gap-2">
                    {isOwnMessage && showOptionsButton && (
                        <div className="relative">
                            <button onClick={() => setShowOptions(!showOptions)} className="opacity-0 group-hover:opacity-100 transition p-1">
                                <DotsHorizontalIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                            </button>
                            {showOptions && (
                                <div onMouseLeave={() => setShowOptions(false)} className="absolute bottom-6 right-0 bg-white dark:bg-gray-700 rounded-lg shadow-lg border dark:border-gray-600 p-1 z-10 w-28">
                                    {canEdit && (
                                        <button onClick={() => { onEdit(message); setShowOptions(false); }} className="w-full text-left flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-600">
                                            <PencilIcon className="w-4 h-4" /> Edit
                                        </button>
                                    )}
                                    <button onClick={() => { onDelete(message.id); setShowOptions(false); }} className="w-full text-left flex items-center gap-2 px-2 py-1 text-sm rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50">
                                        <TrashIcon className="w-4 h-4" /> Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    
                    <button onClick={isOwnMessage ? onViewReadInfo : undefined} disabled={!isOwnMessage} className="text-left">
                        <div className={`px-3 pt-2 pb-1 ${bubbleClasses}`}>
                            <p className="whitespace-pre-wrap break-words">{message.content}</p>
                            <div className="flex justify-end items-center space-x-1 mt-1 opacity-70">
                                <span className="text-xs" style={{fontSize: '0.7rem'}}>{time}</span>
                                {isOwnMessage && <ReadReceipts message={message} chatGroup={chatGroup} />}
                            </div>
                        </div>
                    </button>

                    {!isOwnMessage && showOptionsButton && (
                        <div className="relative">
                            <button onClick={() => setShowOptions(!showOptions)} className="opacity-0 group-hover:opacity-100 transition p-1">
                                <DotsHorizontalIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                            </button>
                            {showOptions && (
                                <div onMouseLeave={() => setShowOptions(false)} className="absolute bottom-6 left-0 bg-white dark:bg-gray-700 rounded-lg shadow-lg border dark:border-gray-600 p-1 z-10 w-28">
                                    <button onClick={() => { onDelete(message.id); setShowOptions(false); }} className="w-full text-left flex items-center gap-2 px-2 py-1 text-sm rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50">
                                        <TrashIcon className="w-4 h-4" /> Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {!isOwnMessage && !showOptionsButton && (
                         <div className="w-8 opacity-0 group-hover:opacity-100">&nbsp;</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatMessage;
