import Sidebar from '../components/common/Sidebar';
import Inbox from '../components/inbox/Inbox.jsx';

export default function InboxPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 bg-gray-50">
        <Inbox />
      </main>
    </div>
  );
}
