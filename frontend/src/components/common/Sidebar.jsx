import { Link, useLocation } from 'react-router-dom';

export default function Sidebar() {
  const { pathname } = useLocation();
  const item = (to, label) => (
    <Link to={to} className={
      (pathname === to ? "bg-blue-50 text-blue-700 " : "hover:bg-blue-100 ") +
      "block px-4 py-2 rounded"
    }>{label}</Link>
  );
  return (
    <aside className="h-screen w-56 bg-white shadow flex flex-col">
      <div className="p-4 font-bold text-xl text-blue-800">CresceJá</div>
      <nav className="flex-1 px-2 space-y-1">
        {item("/inbox", "Inbox Omnichannel")}
      </nav>
    </aside>
  );
}
