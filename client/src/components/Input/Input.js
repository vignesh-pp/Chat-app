import React, { useRef } from 'react';
import './Input.css';

const Input = ({ setMessage, sendMessage, message, onTyping, onSendFile }) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const isImage = file.type.startsWith('image/');
        onSendFile(reader.result, isImage, file.name, file.type);
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
          onChange={handleFileChange}
        />

        {/* Attachment button */}
        <button 
          type="button" 
          className="attachButton" 
          onClick={triggerFileInput}
          title="Attach a file or image"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
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