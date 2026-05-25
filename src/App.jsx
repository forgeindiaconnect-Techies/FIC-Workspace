import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// Cache bust 1
import SuperAdmin from './pages/SuperAdmin';
import AdminDashboard from './pages/AdminDashboard';
import MailApp from './features/mail/MailApp';
import ChatApp from './pages/ChatApp';
import MeetingApp from './pages/MeetingApp';
import DocsApp from './pages/DocsApp';
import ShowApp from './pages/ShowApp';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SheetsApp from './pages/SheetsApp';
import WorkspaceDashboard from './pages/WorkspaceDashboard';
import MeetingHome from './pages/MeetingHome';
import MeetingsTab from './pages/MeetingsTab';
import CalendarTab from './pages/CalendarTab';
import FilesTab from './pages/FilesTab';
import SettingsTab from './pages/SettingsTab';
import { MeetingAnalytics } from './pages/MeetingAnalytics';
import MeetingLanding from './pages/MeetingLanding';
import MeetingSummarizer from './pages/MeetingSummarizer';
import MailLanding from './pages/MailLanding';
import ChatLanding from './pages/ChatLanding';
import ChatAuth from './pages/ChatAuth';
import DeveloperDashboard from './pages/DeveloperDashboard';
import TesterDashboard from './pages/TesterDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import ModulePlaceholder from './pages/ModulePlaceholder';
import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/super-admin" element={<SuperAdmin />} />
          <Route path="/w/:workspaceId/admin/*" element={<AdminDashboard />} />
          <Route path="/w/:workspaceId/dashboard" element={<WorkspaceDashboard />} />
          <Route path="/w/:workspaceId/dashboard/dev" element={<DeveloperDashboard />} />
          <Route path="/w/:workspaceId/dashboard/test" element={<TesterDashboard />} />
          <Route path="/w/:workspaceId/dashboard/mgr" element={<ManagerDashboard />} />
          
          {/* Meeting App Routes */}
          <Route path="/meet/welcome" element={<MeetingLanding />} />
          <Route path="/w/:workspaceId/meet" element={<MeetingHome />} />
          <Route path="/w/:workspaceId/meet/room/:id" element={<MeetingApp />} />
          <Route path="/w/:workspaceId/meetings" element={<MeetingsTab />} />
          <Route path="/w/:workspaceId/meet/summarize/:meetingId" element={<MeetingSummarizer />} />
          <Route path="/mail/welcome" element={<MailLanding />} />
          <Route path="/chat/welcome" element={<ChatLanding />} />
          <Route path="/chat/login" element={<ChatAuth />} />
          <Route path="/chat/signup" element={<ChatAuth />} />
          <Route path="/w/:workspaceId/calendar" element={<CalendarTab />} />
          <Route path="/w/:workspaceId/analytics" element={<MeetingAnalytics />} />
          <Route path="/w/:workspaceId/files" element={<FilesTab />} />
          <Route path="/w/:workspaceId/members" element={<ModulePlaceholder name="Team Members" />} />
          <Route path="/w/:workspaceId/settings" element={<SettingsTab />} />
          
          {/* Other Workspace Apps */}
          <Route path="/w/:workspaceId/mail" element={<MailApp />} />
          <Route path="/w/:workspaceId/chat" element={<ChatApp />} />
          <Route path="/w/:workspaceId/docs" element={<DocsApp />} />
          <Route path="/w/:workspaceId/show" element={<ShowApp />} />
          <Route path="/w/:workspaceId/sheets" element={<SheetsApp />} />
          
          <Route path="/w/:workspaceId" element={<WorkspaceDashboard />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
