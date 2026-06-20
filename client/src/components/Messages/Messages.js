import React from 'react';

import ScrollToBottom from 'react-scroll-to-bottom';

import Message from './Message/Message';

import './Messages.css';

const Messages = ({ messages, name, onStartEdit, onDelete }) => (
  <ScrollToBottom className="messages">
    {messages.map((message, i) => (
      <div key={message.id || i}>
        <Message 
          message={message} 
          name={name} 
          onStartEdit={onStartEdit} 
          onDelete={onDelete} 
        />
      </div>
    ))}
  </ScrollToBottom>
);

export default Messages;