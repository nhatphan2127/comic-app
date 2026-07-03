import { useState } from 'react';
import { 
  Archive, ArrowLeftRight, Bell, Bookmark, 
  Clock3, 
  MessageSquare, 
  Rss, 
  Settings, 
  Upload, 
  User, 
  Users 
} from 'lucide-react';

interface Props {
  activeTab: string;
  setActiveTab: (tabId: string) => void;
}

interface SidebarItem {
  id: string;
  label: string;
  icon: string;
}

const sidebarItems: SidebarItem[] = [
  { id: 'edit-profile', label: 'Edit Profile', icon: 'user' },
  { id: 'following-groups', label: 'Following Groups', icon: 'users' },
  { id: 'following-titles', label: 'Following Titles', icon: 'bookmark' },
  { id: 'read-history', label: 'Read History', icon: 'clock' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
  { id: 'comments', label: 'Comments', icon: 'chat' },
  { id: 'chapter-uploads', label: 'Chapters Upload', icon: 'upload' },
  { id: 'comic-suggestions', label: 'Comic Suggestion', icon: 'upload' },
  { id: 'settings', label: 'Settings', icon: 'cog' },
];

function SidebarIcon({ type }: { type: string }) {
  const iconProps = { 
    width: 16, 
    height: 16, 
    strokeWidth: 1.8, 
    'aria-hidden': true 
  };

  switch (type) {
    case 'user':
      return <User {...iconProps} />;
    case 'users':
      return <Users {...iconProps} />;
    case 'bookmark':
      return <Bookmark {...iconProps} />;
    case 'clock':
      return <Clock3 {...iconProps} />;
    case 'archive':
      return <Archive {...iconProps} />;
    case 'rss':
      return <Rss {...iconProps} />;
    case 'bell':
      return <Bell {...iconProps} />;
    case 'chat':
      return <MessageSquare {...iconProps} />;
    case 'upload':
      return <Upload {...iconProps} />;
    case 'exchange':
      return <ArrowLeftRight {...iconProps} />;
    case 'cog':
      return <Settings {...iconProps} />;
    default:
      return null;
  }
}

export default function ProfileSidebar({ activeTab, setActiveTab }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  // Lấy thông tin tab đang được chọn để hiển thị trên nút Trigger Mobile
  const activeItem = sidebarItems.find(item => item.id === activeTab) || sidebarItems[0];

  return (
    <aside className={`umenu ${isOpen ? 'is-open' : ''}`}>
      {/* Nút Trigger hỗ trợ hiển thị menu dạng Dropdown trên Mobile */}
      <button 
        type="button" 
        className="umenu__trigger" 
        aria-haspopup="menu" 
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="umenu__icon">
          <SidebarIcon type={activeItem.icon} />
        </span>
        <span className="umenu__text">{activeItem.label}</span>
        <span className="umenu__trigger-caret" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6"></path>
          </svg>
        </span>
      </button>

      {/* Danh sách các nút điều hướng sidebar */}
      <ul className="umenu__list">
        {sidebarItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <li key={item.id}>
              <button 
                type="button" 
                className={`umenu__item ${isActive ? 'is-active' : ''}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpen(false); // Tự động đóng menu trên mobile khi click chọn tab
                }}
              >
                <span className="umenu__icon">
                  <SidebarIcon type={item.icon} />
                </span>
                <span className="umenu__text">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}