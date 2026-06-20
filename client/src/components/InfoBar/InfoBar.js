import React from 'react';
import './InfoBar.css';

const InfoBar = ({ 
  room, 
  activeChat, 
  onStartCall,
  currentName,
  roomMembers = [],
  roomCreator = 'admin',
  isCreator = false,
  showMembersDropdown = false,
  onToggleMembers,
  onAddMember,
  onRemoveMember,
  availableToAddToGroup = []
}) => (
  <div className="infoBar">
    <div className="leftInnerContainer">
      <div className="roomBadge">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="roomHashIcon">
          <line x1="4" y1="9" x2="20" y2="9"></line>
          <line x1="4" y1="15" x2="20" y2="15"></line>
          <line x1="10" y1="3" x2="8" y2="21"></line>
          <line x1="16" y1="3" x2="14" y2="21"></line>
        </svg>
      </div>
      <div className="roomInfo">
        <h3>{room}</h3>
        <span className="onlineStatus">
          <span className="onlineDot"></span>
          Active
        </span>
      </div>
    </div>
    <div className="rightInnerContainer">
      {/* Call options (Show for DMs AND custom groups) */}
      {activeChat && (activeChat.type === 'dm' || (activeChat.type === 'group' && !['general', 'random', 'tech'].includes(activeChat.id))) && (
        <div className="callActionButtons">
          <button onClick={() => onStartCall('audio')} className="callBtn" title="Voice Call">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          </button>
          <button onClick={() => onStartCall('video')} className="callBtn" title="Video Call">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
          </button>
        </div>
      )}

      {/* Group Members controller (Custom groups only) */}
      {activeChat && activeChat.type === 'group' && !['general', 'random', 'tech'].includes(activeChat.id) && (
        <div className="groupMembersControl">
          <button onClick={onToggleMembers} className={`callBtn membersToggleBtn ${showMembersDropdown ? 'active' : ''}`} title="Group Members">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </button>
          
          {showMembersDropdown && (
            <div className="membersDropdown">
              <div className="membersDropdownHeader">Group Members</div>
              <div className="membersDropdownList">
                {roomMembers.map(member => (
                  <div key={member} className="memberDropdownItem">
                    <span className="memberDropdownName">
                      {member}
                      {member.toLowerCase() === roomCreator.toLowerCase() && <span className="creatorCrown" title="Group Creator"><span role="img" aria-label="crown">👑</span></span>}
                    </span>
                    {isCreator && member.toLowerCase() !== currentName.toLowerCase() && (
                      <button onClick={() => onRemoveMember(member)} className="removeMemberDropdownBtn" title="Remove Member">
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {isCreator && availableToAddToGroup.length > 0 && (
                <div className="addMemberDropdownSection">
                  <select 
                    onChange={(e) => { 
                      if(e.target.value) { 
                        onAddMember(e.target.value); 
                        e.target.value = ''; 
                      } 
                    }} 
                    className="addMemberSelect"
                  >
                    <option value="">+ Add Member...</option>
                    {availableToAddToGroup.map(u => (
                      <option key={u.name} value={u.name}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <a href="/" onClick={() => localStorage.removeItem('aether_session')} className="logoutButton" title="Logout">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="logoutIcon">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        <span className="logoutText">Logout</span>
      </a>
    </div>
  </div>
);

export default InfoBar;