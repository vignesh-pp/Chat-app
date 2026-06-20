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

const Message = ({ message: { id, text, user, isImage, isFile, fileName, fileType, time, isEdited, isDeleted, reactions }, name, onStartEdit, onDelete, onReact }) => {
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

  const renderMessageContent = () => {
    if (isImage) {
      return <img className="messageImage" src={text} alt="Shared" />;
    } else if (isFile) {
      return (
        <div className="fileMessageContainer">
          <div className="fileMessageIcon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <div className="fileMessageInfo">
            <span className="fileMessageName" title={fileName}>{fileName || 'Attachment'}</span>
            <span className="fileMeta">{fileType || 'Unknown file'}</span>
          </div>
          <a href={text} download={fileName || 'attachment'} className="fileDownloadLink" title="Download file">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </a>
        </div>
      );
    } else {
      return <p className="messageText">{ReactEmoji.emojify(text)}</p>;
    }
  };

  const renderReactionsList = () => {
    if (!reactions || reactions.length === 0) return null;

    const grouped = {};
    reactions.forEach(r => {
      if (!grouped[r.emoji]) {
        grouped[r.emoji] = [];
      }
      grouped[r.emoji].push(r.username);
    });

    return (
      <div className={`reactionsListContainer ${isSentByCurrentUser ? 'alignEnd' : 'alignStart'}`}>
        {Object.keys(grouped).map(emoji => {
          const usersReacted = grouped[emoji];
          const hasMyReaction = usersReacted.includes(trimmedName);
          const tooltipText = usersReacted.join(', ');
          
          return (
            <div 
              key={emoji} 
              className={`reactionChip ${hasMyReaction ? 'myReaction' : ''}`}
              title={`Reacted by: ${tooltipText}`}
              onClick={() => onReact(id, emoji)}
            >
              <span className="reactionEmoji">{emoji}</span>
              <span className="reactionCount">{usersReacted.length}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    isSentByCurrentUser ? (
      <div className="messageContainer justifyEnd bubbleHoverContainer">
        <div className="messageContentWrapper alignEnd">
          <span className="messageSenderName">You</span>
          
          <div className="bubbleActionsWrapper">
            {/* Edit / Delete / React menu option buttons */}
            <div className="bubbleActionMenu">
              <div className="reactionPickerWrapper">
                <button className="messageActionBtn react" title="React to message">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                    <line x1="9" y1="9" x2="9.01" y2="9"></line>
                    <line x1="15" y1="9" x2="15.01" y2="9"></line>
                  </svg>
                </button>
                <div className="emojiPickerTooltip">
                  {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                    <button 
                      key={emoji} 
                      onClick={() => onReact(id, emoji)} 
                      className="pickerEmojiBtn"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              {!isImage && !isFile && (
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
              {renderMessageContent()}
            </div>
          </div>

          {renderReactionsList()}
          
          <span className="messageTime">
            {time || 'Just now'} {isEdited && <span className="editedTag">• Edited</span>}
          </span>
        </div>
      </div>
    ) : (
      <div className="messageContainer justifyStart bubbleHoverContainer">
        <div className="avatarCircle messageAvatar" style={{ backgroundColor: avatarBg }}>
          {initials}
        </div>
        <div className="messageContentWrapper alignStart">
          <span className="messageSenderName">{user}</span>
          
          <div className="bubbleActionsWrapper">
            <div className="messageBox backgroundLight">
              {renderMessageContent()}
            </div>

            <div className="bubbleActionMenu leftSide">
              <div className="reactionPickerWrapper">
                <button className="messageActionBtn react" title="React to message">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                    <line x1="9" y1="9" x2="9.01" y2="9"></line>
                    <line x1="15" y1="9" x2="15.01" y2="9"></line>
                  </svg>
                </button>
                <div className="emojiPickerTooltip">
                  {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                    <button 
                      key={emoji} 
                      onClick={() => onReact(id, emoji)} 
                      className="pickerEmojiBtn"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {renderReactionsList()}

          <span className="messageTime">
            {time || 'Just now'} {isEdited && <span className="editedTag">• Edited</span>}
          </span>
        </div>
      </div>
    )
  );
};

export default Message;