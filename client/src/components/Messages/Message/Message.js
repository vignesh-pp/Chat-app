import React from 'react';
import ReactEmoji from 'react-emoji';
import './Message.css';

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

const Message = ({ message: { id, text, user, isImage, time, isEdited, isDeleted }, name, onStartEdit, onDelete }) => {
  let isSentByCurrentUser = false;
  const trimmedName = name.trim().toLowerCase();
  const messageUser = user ? user.trim().toLowerCase() : '';

  if (messageUser === trimmedName) {
    isSentByCurrentUser = true;
  }

  // System / Admin Notification
  if (messageUser === 'admin') {
    return (
      <div className="systemMessageContainer">
        <div className="systemMessageCard">
          <span className="systemMessageText">{ReactEmoji.emojify(text)}</span>
          {time && <span className="systemMessageTime">{time}</span>}
        </div>
      </div>
    );
  }

  const initials = user ? user.slice(0, 2).toUpperCase() : '??';
  const avatarBg = getAvatarColor(messageUser);

  if (isDeleted) {
    return (
      isSentByCurrentUser ? (
        <div className="messageContainer justifyEnd">
          <div className="messageContentWrapper alignEnd">
            <span className="messageSenderName">You</span>
            <div className="messageBox backgroundLight deletedBubble">
              <p className="messageText deletedText"><span role="img" aria-label="prohibited">🚫</span> This message was deleted</p>
            </div>
            <span className="messageTime">{time || 'Just now'}</span>
          </div>
        </div>
      ) : (
        <div className="messageContainer justifyStart">
          <div className="avatarCircle messageAvatar" style={{ backgroundColor: avatarBg }}>
            {initials}
          </div>
          <div className="messageContentWrapper alignStart">
            <span className="messageSenderName">{user}</span>
            <div className="messageBox backgroundLight deletedBubble">
              <p className="messageText deletedText"><span role="img" aria-label="prohibited">🚫</span> This message was deleted</p>
            </div>
            <span className="messageTime">{time || 'Just now'}</span>
          </div>
        </div>
      )
    );
  }

  return (
    isSentByCurrentUser ? (
      <div className="messageContainer justifyEnd bubbleHoverContainer">
        <div className="messageContentWrapper alignEnd">
          <span className="messageSenderName">You</span>
          
          <div className="bubbleActionsWrapper">
            {/* Edit / Delete menu option buttons */}
            <div className="bubbleActionMenu">
              {!isImage && (
                <button 
                  onClick={() => onStartEdit({ id, text })} 
                  className="messageActionBtn edit" 
                  title="Edit message"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
              )}
              <button 
                onClick={() => onDelete(id)} 
                className="messageActionBtn delete" 
                title="Delete message"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            </div>

            <div className="messageBox backgroundBlue">
              {isImage ? (
                <img className="messageImage" src={text} alt="Shared" />
              ) : (
                <p className="messageText colorWhite">{ReactEmoji.emojify(text)}</p>
              )}
            </div>
          </div>
          
          <span className="messageTime">
            {time || 'Just now'} {isEdited && <span className="editedTag">• Edited</span>}
          </span>
        </div>
      </div>
    ) : (
      <div className="messageContainer justifyStart">
        <div className="avatarCircle messageAvatar" style={{ backgroundColor: avatarBg }}>
          {initials}
        </div>
        <div className="messageContentWrapper alignStart">
          <span className="messageSenderName">{user}</span>
          <div className="messageBox backgroundLight">
            {isImage ? (
              <img className="messageImage" src={text} alt="Shared" />
            ) : (
              <p className="messageText colorWhite">{ReactEmoji.emojify(text)}</p>
            )}
          </div>
          <span className="messageTime">
            {time || 'Just now'} {isEdited && <span className="editedTag">• Edited</span>}
          </span>
        </div>
      </div>
    )
  );
};

export default Message;