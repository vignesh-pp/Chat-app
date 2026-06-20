import React, { useRef } from 'react';
import './Input.css';

const Input = ({ setMessage, sendMessage, message, onTyping, onSendImage }) => {
  const fileInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onSendImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    if (onTyping) {
      onTyping();
    }
  };

  const insertEmoji = (emoji) => {
    setMessage(message + emoji);
  };

  const quickEmojis = ['😊', '😂', '👍', '❤️', '🔥', '😮', '🎉', '💡'];

  return (
    <div className="inputContainer">
      {/* Quick Emojis Bar */}
      <div className="quickEmojisContainer">
        {quickEmojis.map((emoji) => (
          <button 
            key={emoji} 
            type="button" 
            className="quickEmojiBtn" 
            onClick={() => insertEmoji(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>

      <form className="form">
        {/* Hidden file input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*" 
          onChange={handleImageChange}
        />

        {/* Attachment/Image button */}
        <button 
          type="button" 
          className="attachButton" 
          onClick={triggerFileInput}
          title="Share an image"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </button>

        <input
          className="input"
          type="text"
          placeholder="Type a message..."
          value={message}
          onChange={handleInputChange}
          onKeyPress={event => event.key === 'Enter' ? sendMessage(event) : null}
        />

        <button className="sendButton" onClick={e => sendMessage(e)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </div>
  );
};

export default Input;