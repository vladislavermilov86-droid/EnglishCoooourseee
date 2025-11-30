import React, { useState, useMemo } from 'react';
import Sidebar from '../shared/Sidebar';
import Header from '../shared/Header';
import StudentDashboard from './StudentDashboard';
import LessonsView from './LessonsView';
import MarksView from './MarksView';
import ChatMain from '../chat/ChatMain';
import ProfileModal from '../profile/ProfileModal';
import { HomeIcon, BookOpenIcon, ClipboardCheckIcon, ChatAltIcon } from '../icons/Icons';
import { useApp } from '../../contexts/AppContext';
import StudentTestRoom from './StudentTestRoom';
import { supabase } from '../../supabase';
import { UnitTest } from '../../types';

const StudentView: React.FC = () => {
    const { state } = useApp();
    const { loggedInUser, chatMessages, chatGroups } = state;
    const [activeView, setActiveView] = useState('Home');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [directToUnit, setDirectToUnit] = useState<string | null>(null);
    const [joiningTestId, setJoiningTestId] = useState<string | null>(null);
    const [isJoiningTest, setIsJoiningTest] = useState(false);

    const hasUnreadMessages = useMemo(() => {
        if (!loggedInUser) return false;
        
        const userGroupIds = chatGroups
            .filter(g => g.members.includes(loggedInUser.id))
            .map(g => g.id);

        return chatMessages.some(msg =>
            userGroupIds.includes(msg.chat_group_id) &&
            msg.sender_id !== loggedInUser.id &&
            !msg.read_by.some(receipt => receipt.userId === loggedInUser.id)
        );
    }, [chatMessages, loggedInUser, chatGroups]);

    const navItems = [
        { name: 'Home', icon: HomeIcon },
        { name: 'Lessons', icon: BookOpenIcon },
        { name: 'Marks', icon: ClipboardCheckIcon },
        { name: 'Chat', icon: ChatAltIcon, notification: hasUnreadMessages },
    ];

    const handleNav = (view: string) => {
        if (view === 'Chat') {
            setIsChatOpen(true);
        } else {
            setJoiningTestId(null);
            setDirectToUnit(null); // Reset direct navigation when changing views
            setActiveView(view);
            setIsChatOpen(false); // Close chat when navigating away
        }
    }
    
    const handleHomeworkClick = (unitId: string) => {
        setDirectToUnit(unitId);
        setActiveView('Lessons');
    };

    const handleJoinTest = async (testId: string) => {
        if (!loggedInUser || isJoiningTest) return;

        setIsJoiningTest(true);
        try {
            const { data: test, error } = await supabase.from('unit_tests').select('joined_students').eq('id', testId).single();
            if (error) throw error;
            
            const currentJoined: string[] = test.joined_students || [];
            
            if (!currentJoined.includes(loggedInUser.id)) {
                const newJoined = [...currentJoined, loggedInUser.id];
                const { error: updateError } = await supabase.from('unit_tests').update({ joined_students: newJoined }).eq('id', testId);
                if (updateError) throw updateError;
            }
            
            supabase.channel('app-broadcasts').send({
                type: 'broadcast',
                event: 'student_join',
                payload: { testId },
            });

            setJoiningTestId(testId);
        } catch (error) {
            console.error('Error joining test:', error);
            setIsJoiningTest(false);
        }
    };

    const renderContent = () => {
        if (joiningTestId) {
            return <StudentTestRoom testId={joiningTestId} onExit={() => setJoiningTestId(null)} />;
        }
        switch (activeView) {
            case 'Home':
                return <StudentDashboard onHomeworkClick={handleHomeworkClick} onJoinTest={handleJoinTest} isJoiningTest={isJoiningTest} />;
            case 'Lessons':
                return <LessonsView directToUnitId={directToUnit} resetDirectToUnit={() => setDirectToUnit(null)} />;
            case 'Marks':
                return <MarksView />;
            default:
                return <StudentDashboard onHomeworkClick={handleHomeworkClick} onJoinTest={handleJoinTest} isJoiningTest={isJoiningTest} />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
            <Sidebar navItems={navItems} activeView={activeView} setActiveView={handleNav} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
            <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
                <Header 
                    onChatClick={() => setIsChatOpen(true)} 
                    onProfileClick={() => setIsProfileModalOpen(true)}
                    onMenuClick={() => setIsSidebarOpen(true)}
                    activeViewName={activeView}
                    chatNotification={hasUnreadMessages}
                />
                <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                    {renderContent()}
                </main>
            </div>
            
            {/* Chat Overlay for mobile */}
            <div 
                className={`fixed inset-0 bg-black/30 z-40 lg:hidden transition-opacity ${isChatOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsChatOpen(false)}
            ></div>
            {/* Chat Panel */}
            <div className={`
                fixed top-0 right-0 h-full bg-white dark:bg-gray-800 z-50
                lg:static lg:z-auto lg:h-auto
                transition-transform lg:transition-width duration-300 ease-in-out 
                ${isChatOpen ? 'translate-x-0 w-full md:w-96' : 'translate-x-full lg:translate-x-0 lg:w-0'}
            `}>
               <div className="h-full w-full overflow-hidden">
                 <ChatMain onClose={() => setIsChatOpen(false)} />
               </div>
            </div>

            {isProfileModalOpen && <ProfileModal onClose={() => setIsProfileModalOpen(false)} />}
        </div>
    );
};

export default StudentView;
