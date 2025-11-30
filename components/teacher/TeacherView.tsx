import React, { useState, useMemo } from 'react';
import Sidebar from '../shared/Sidebar';
import Header from '../shared/Header';
import TeacherDashboard from './TeacherDashboard';
import ChatMain from '../chat/ChatMain';
import ProfileModal from '../profile/ProfileModal';
import MarksView from './MarksView';
import ContentManagementView from './ContentManagementView';
import TestsView from './TestsView';
import TestRoom from './TestRoom';
import StudentDetailsView from './StudentDetailsView';
import { HomeIcon, ClipboardCheckIcon, ChatAltIcon, BookmarkIcon, AcademicCapIcon } from '../icons/Icons';
import { UnitTest, User } from '../../types';
import TestReportView from './TestReportView';
import { useApp } from '../../contexts/AppContext';
import InitialSetup from './InitialSetup';

const TeacherView: React.FC = () => {
    const { state } = useApp();
    const { loggedInUser, chatMessages, chatGroups, units } = state;
    const [activeView, setActiveView] = useState('Dashboard');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [managingTestId, setManagingTestId] = useState<string | null>(null);
    const [viewingStudent, setViewingStudent] = useState<User | null>(null);
    const [viewingTestReportId, setViewingTestReportId] = useState<string | null>(null);

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
        { name: 'Dashboard', icon: HomeIcon },
        { name: 'Marks', icon: ClipboardCheckIcon },
        { name: 'Content', icon: BookmarkIcon },
        { name: 'Tests', icon: AcademicCapIcon },
        { name: 'Chat', icon: ChatAltIcon, notification: hasUnreadMessages },
    ];

    const resetSubViews = () => {
        setManagingTestId(null);
        setViewingStudent(null);
        setViewingTestReportId(null);
    }

    const handleNav = (view: string) => {
        if (view === 'Chat') {
            setIsChatOpen(true);
        } else {
            resetSubViews();
            setActiveView(view);
            setIsChatOpen(false); // Close chat when navigating away
        }
    };
    
    const handleSelectTest = (test: UnitTest) => {
        if (test.status === 'completed') {
            setViewingTestReportId(test.id);
        } else {
            setManagingTestId(test.id);
        }
        // When a test is selected, force the view to 'Tests' to highlight it in the sidebar
        setActiveView('Tests');
    };

    if (units.length < 10) {
        return <InitialSetup />;
    }

    const renderContent = () => {
        if (managingTestId) {
            return <TestRoom testId={managingTestId} onClose={resetSubViews} />;
        }
        if (viewingStudent) {
            return <StudentDetailsView student={viewingStudent} onBack={resetSubViews} />;
        }
        if (viewingTestReportId) {
            return <TestReportView testId={viewingTestReportId} onBack={resetSubViews} />;
        }

        switch (activeView) {
            case 'Dashboard':
                return <TeacherDashboard onViewDetails={setViewingStudent} />;
            case 'Marks':
                return <MarksView />;
            case 'Content':
                return <ContentManagementView />;
            case 'Tests':
                return <TestsView onSelectTest={handleSelectTest} />;
            default:
                return <TeacherDashboard onViewDetails={setViewingStudent} />;
        }
    };

    return (
         <div className="flex h-screen bg-white dark:bg-slate-900 overflow-hidden">
            <Sidebar navItems={navItems} activeView={activeView} setActiveView={handleNav} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
            <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
                <Header 
                    onChatClick={() => setIsChatOpen(true)} 
                    onProfileClick={() => setIsProfileModalOpen(true)} 
                    onMenuClick={() => setIsSidebarOpen(true)}
                    activeViewName={managingTestId ? 'Test Room' : activeView}
                    chatNotification={hasUnreadMessages}
                />
                <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-gray-50 dark:bg-gray-900">
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

export default TeacherView;