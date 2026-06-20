import React, { useState } from 'react';
import './TextContainer.css';

const getAvatarColor = (name) => {
  const colors = [
    '#6366f1', // Indigo
    '#3b82f6', // Blue
    '#ec4899', // Pink
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#8b5cf6', // Violet
    '#ef4444', // Red
    '#06b6d4', // Cyan
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const getPrivateRoomId = (userA, userB) => {
  const sorted = [userA.trim().toLowerCase(), userB.trim().toLowerCase()].sort();
  return `private_${sorted[0]}_${sorted[1]}`;
};

const TextContainer = ({ 
  dmContacts, 
  rooms, 
  currentName, 
  activeChat, 
  onSelectChat, 
  onCreateRoom, 
  theme, 
  toggleTheme,
  unreadCounts,
  onDeleteChat
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  const currentUserTrimmed = currentName ? currentName.trim().toLowerCase() : '';
  const myAvatarBg = getAvatarColor(currentUserTrimmed);
  const myInitials = currentName ? currentName.slice(0, 2).toUpperCase() : 'ME';

  const handleCreateRoomSubmit = (e) => {
    e.preventDefault();
    if (newRoomName.trim()) {
      onCreateRoom(newRoomName.trim());
      setNewRoomName('');
      setIsCreatingRoom(false);
    }
  };

  const handleDeleteClick = (e, id, type) => {
    e.stopPropagation();
    const confirmMsg = type === 'dm'
      ? `Are you sure you want to delete the entire chat history with ${id}?`
      : `Are you sure you want to clear all messages in #${id}?`;
    if (window.confirm(confirmMsg)) {
      onDeleteChat({ id, type });
    }
  };

  // Filter lists based on search
  const filteredRooms = (rooms || []).filter(room => 
    room.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = (dmContacts || []).filter(u => {
    const isActive = activeChat.type === 'dm' && activeChat.id.toLowerCase() === u.name.toLowerCase();
    if (searchTerm.trim() === '') {
      return u.hasHistory || isActive;
    } else {
      return u.name.toLowerCase().includes(searchTerm.toLowerCase());
    }
  });

  return (
    <div className="textContainer">
      {/* Sidebar Header Profile & Theme Toggle */}
      <div className="sidebarHeader">
        <div className="myProfile">
          <div className="avatarCircle" style={{ backgroundColor: myAvatarBg }}>
            {myInitials}
          </div>
          <div className="profileInfo">
            <span className="profileName">{currentName}</span>
            <span className="profileStatus">Online</span>
          </div>
        </div>
        
        <button className="themeToggleBtn" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? (
            // Sun Icon for Light mode
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          ) : (
            // Moon Icon for Dark mode
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          )}
        </button>
      </div>

      {/* Search Input */}
      <div className="searchContainer">
        <div className="searchWrapper">
          <svg className="searchIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            placeholder="Search rooms or people..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
            className="searchInput"
          />
        </div>
      </div>
      
      {/* Sidebar Navigation / Listings */}
      <div className="sidebarContent">
        {/* Groups Room Directory */}
        <div className="sidebarSection">
          <div className="sectionHeader">
            <h4 className="sectionTitle">Groups</h4>
            <button className="addRoomBtn" onClick={() => setIsCreatingRoom(!isCreatingRoom)} title="Create new group">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>

          {/* Inline Room Creator Form */}
          {isCreatingRoom && (
            <form onSubmit={handleCreateRoomSubmit} className="roomCreatorForm">
              <input 
                type="text" 
                placeholder="Group name..." 
                value={newRoomName} 
                onChange={(e) => setNewRoomName(e.target.value)} 
                className="roomCreatorInput"
                autoFocus
              />
              <button type="submit" className="roomCreatorBtn submit">✓</button>
              <button type="button" onClick={() => setIsCreatingRoom(false)} className="roomCreatorBtn cancel">✕</button>
            </form>
          )}

          <div className="itemsList">
            {filteredRooms.map((roomName) => {
              const isActive = activeChat.id === roomName && activeChat.type === 'group';
              const unreadCount = unreadCounts ? (unreadCounts[roomName] || 0) : 0;
              
              return (
                <div 
                  key={roomName} 
                  className={`sidebarItem ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectChat({ id: roomName, type: 'group' })}
                >
                  <div className="roomHashBadge">#</div>
                  <span className="itemName">{roomName}</span>
                  {unreadCount > 0 && <span className="unreadBadge">{unreadCount}</span>}
                  
                  <button 
                    onClick={(e) => handleDeleteClick(e, roomName, 'group')}
                    className="deleteChatBtn"
                    title="Clear group messages"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Direct Messages Directory */}
        <div className="sidebarSection mt-24">
          <div className="sectionHeader">
            <h4 className="sectionTitle">Direct Messages</h4>
          </div>

          <div className="itemsList">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => {
                const isActive = activeChat.id === user.name && activeChat.type === 'dm';
                const userInitials = user.name.slice(0, 2).toUpperCase();
                const userAvatarBg = getAvatarColor(user.name.trim().toLowerCase());
                const dmRoomId = getPrivateRoomId(currentName, user.name);
                const unreadCount = unreadCounts ? (unreadCounts[dmRoomId] || 0) : 0;
                
                return (
                  <div 
                    key={user.name} 
                    className={`sidebarItem ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectChat({ id: user.name, type: 'dm' })}
                  >
                    <div className="avatarCircle small" style={{ backgroundColor: userAvatarBg }}>
                      {userInitials}
                      <span className={user.isOnline ? "avatarOnlineStatus" : "avatarOfflineStatus"}></span>
                    </div>
                    <span className="itemName">{user.name}</span>
                    {unreadCount > 0 && <span className="unreadBadge">{unreadCount}</span>}

                    <button 
                      onClick={(e) => handleDeleteClick(e, user.name, 'dm')}
                      className="deleteChatBtn"
                      title="Delete chat history"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="noItemsText">No direct messages yet</div>
            )}
          </div>
        </div>
      </div>

      <div className="sidebarFooter">
        <div className="sidebarLogo">
          <span className="footerEmoji" role="img" aria-label="lightning bolt">⚡</span>
          <span>AetherChat Workspace</span>
        </div>
      </div>
    </div>
  );
};

export default TextContainer;