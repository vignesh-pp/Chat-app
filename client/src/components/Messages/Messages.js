import React from 'react';

import ScrollToBottom from 'react-scroll-to-bottom';

import Message from './Message/Message';

import './Messages.css';

const Messages = ({ messages, name, onStartEdit, onDelete, onReact }) => (
  <ScrollToBottom className="messages">
    {messages.map((message, i) => (
      <div key={message.id || i}>
        <Message 
          message={message} 
          name={name} 
          onStartEdit={onStartEdit} 
          onDelete={onDelete} 
          onReact={onReact}
        />
      </div>
    ))}
  </ScrollToBottom>
);

export default Messages;