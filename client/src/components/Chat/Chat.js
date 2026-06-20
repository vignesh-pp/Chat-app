import React, { useState, useEffect, useRef } from "react";
import queryString from 'query-string';
import io from "socket.io-client";

import TextContainer from '../TextContainer/TextContainer';
import Messages from '../Messages/Messages';
import InfoBar from '../InfoBar/InfoBar';
import Input from '../Input/Input';

import './Chat.css';

const ENDPOINT = 'http://localhost:5000/';

let socket;

const getPrivateRoomId = (userA, userB) => {
  const sorted = [userA.trim().toLowerCase(), userB.trim().toLowerCase()].sort();
  return `private_${sorted[0]}_${sorted[1]}`;
};

const Chat = ({ location, history }) => {
  const [theme, setTheme] = useState(() => localStorage.getItem('aether-theme') || 'dark');
  const [name, setName] = useState(() => {
    const { name } = queryString.parse((location && location.search) || '');
    if (name) return name.trim();
    const sessionUser = localStorage.getItem('aether_session');
    return sessionUser ? sessionUser.trim() : '';
  });
  const [activeChat, setActiveChat] = useState({ id: 'general', type: 'group' });
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState(['general', 'random', 'tech']);
  const [message, setMessage] = useState('');
  const [messagesByChat, setMessagesByChat] = useState(() => {
    const { name } = queryString.parse((location && location.search) || '');
    const sessionUser = localStorage.getItem('aether_session');
    const activeName = name || sessionUser;
    if (activeName) {
      const stored = localStorage.getItem(`aether_messages_${activeName.trim().toLowerCase()}`);
      return stored ? JSON.parse(stored) : {};
    }
    return {};
  });

  useEffect(() => {
    if (name) {
      localStorage.setItem(`aether_messages_${name.trim().toLowerCase()}`, JSON.stringify(messagesByChat));
    }
  }, [messagesByChat, name]);
  const [typingStatus, setTypingStatus] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState(() => {
    const { name } = queryString.parse((location && location.search) || '');
    const sessionUser = localStorage.getItem('aether_session');
    const activeName = name || sessionUser;
    if (activeName) {
      const stored = localStorage.getItem(`aether_unread_${activeName.trim().toLowerCase()}`);
      return stored ? JSON.parse(stored) : {};
    }
    return {};
  });

  useEffect(() => {
    if (name) {
      localStorage.setItem(`aether_unread_${name.trim().toLowerCase()}`, JSON.stringify(unreadCounts));
    }
  }, [unreadCounts, name]);

  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const activeChatRef = useRef(activeChat);
  const nameRef = useRef(name);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  // Auth session validation
  useEffect(() => {
    const sessionUser = localStorage.getItem('aether_session');
    if (!sessionUser) {
      history.push('/');
    }
  }, [history]);

  useEffect(() => {
    const { name } = queryString.parse(location.search);
    if (!name) return;

    socket = io(ENDPOINT);
    setName(name);

    socket.emit('join', { name, room: 'general' }, (error) => {
      if(error) {
        alert(error);
      }
    });

    return () => {
      socket.disconnect();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [location.search]);
  
  useEffect(() => {
    socket.on('message', message => {
      const roomKey = message.room;
      if (roomKey) {
        setMessagesByChat(prev => ({
          ...prev,
          [roomKey]: [...(prev[roomKey] || []), message]
        }));

        // Increment unread counts if not active room
        const currentActiveChat = activeChatRef.current;
        const currentName = nameRef.current;
        const currentActiveRoomId = currentActiveChat.type === 'group'
          ? currentActiveChat.id
          : getPrivateRoomId(currentName, currentActiveChat.id);

        if (roomKey !== currentActiveRoomId) {
          setUnreadCounts(prev => ({
            ...prev,
            [roomKey]: (prev[roomKey] || 0) + 1
          }));
        }
      }
      setTypingStatus('');
    });

    socket.on('editMessage', ({ messageId, newText, room }) => {
      setMessagesByChat(prev => {
        const chatMessages = prev[room] || [];
        const updatedMessages = chatMessages.map(msg => 
          msg.id === messageId ? { ...msg, text: newText, isEdited: true } : msg
        );
        return { ...prev, [room]: updatedMessages };
      });
    });

    socket.on('deleteMessage', ({ messageId, room }) => {
      setMessagesByChat(prev => {
        const chatMessages = prev[room] || [];
        const updatedMessages = chatMessages.map(msg => 
          msg.id === messageId ? { ...msg, isDeleted: true, text: 'This message was deleted' } : msg
        );
        return { ...prev, [room]: updatedMessages };
      });
    });
    
    socket.on("allUsers", ({ users }) => {
      setUsers(users);
    });

    socket.on("allRooms", ({ rooms }) => {
      setRooms(rooms);
    });

    socket.on('typing', ({ user, room }) => {
      const currentActiveChat = activeChatRef.current;
      const currentName = nameRef.current;
      const targetRoomId = currentActiveChat.type === 'group' 
        ? currentActiveChat.id 
        : getPrivateRoomId(currentName, currentActiveChat.id);
      
      if (room === targetRoomId) {
        setTypingStatus(`${user} is typing...`);
      }
    });

    socket.on('stopTyping', ({ room }) => {
      const currentActiveChat = activeChatRef.current;
      const currentName = nameRef.current;
      const targetRoomId = currentActiveChat.type === 'group' 
        ? currentActiveChat.id 
        : getPrivateRoomId(currentName, currentActiveChat.id);
      
      if (room === targetRoomId) {
        setTypingStatus('');
      }
    });

    socket.on('initMessages', initMessages => {
      setUnreadCounts(prevUnread => {
        const updatedUnread = { ...prevUnread };
        setMessagesByChat(prevMsgs => {
          const updatedMsgs = { ...prevMsgs };
          
          Object.keys(initMessages).forEach(roomKey => {
            const serverMsgs = initMessages[roomKey] || [];
            const localMsgs = prevMsgs[roomKey] || [];
            
            if (serverMsgs.length > localMsgs.length) {
              const diffCount = serverMsgs.length - localMsgs.length;
              const currentActiveChat = activeChatRef.current;
              const currentName = nameRef.current;
              const currentActiveRoomId = currentActiveChat.type === 'group'
                ? currentActiveChat.id
                : getPrivateRoomId(currentName, currentActiveChat.id);

              if (roomKey !== currentActiveRoomId) {
                updatedUnread[roomKey] = (updatedUnread[roomKey] || 0) + diffCount;
              }
            }
            updatedMsgs[roomKey] = serverMsgs;
          });
          
          return updatedMsgs;
        });
        return updatedUnread;
      });
    });

    return () => {
      socket.off('message');
      socket.off('editMessage');
      socket.off('deleteMessage');
      socket.off('allUsers');
      socket.off('allRooms');
      socket.off('typing');
      socket.off('stopTyping');
      socket.off('initMessages');
    };
  }, []);

  const sendMessage = (event) => {
    event.preventDefault();

    if(message) {
      const msgId = Date.now() + Math.random().toString(36).substr(2, 9);
      socket.emit('sendMessage', {
        id: msgId,
        text: message,
        recipient: activeChat.type === 'dm' ? activeChat.id : null,
        type: activeChat.type
      }, () => setMessage(''));

      socket.emit('stopTyping', {
        recipient: activeChat.type === 'dm' ? activeChat.id : null,
        type: activeChat.type
      });
      isTypingRef.current = false;
    }
  }

  const handleSendOrEdit = (event) => {
    event.preventDefault();
    if (editingMessage) {
      socket.emit('editMessage', {
        messageId: editingMessage.id,
        newText: message,
        recipient: activeChat.type === 'dm' ? activeChat.id : null,
        type: activeChat.type,
        room: activeChat.type === 'group' ? activeChat.id : null
      }, () => {
        setEditingMessage(null);
        setMessage('');
      });
    } else {
      sendMessage(event);
    }
  };

  const handleDeleteMessage = (messageId) => {
    socket.emit('deleteMessage', {
      messageId,
      recipient: activeChat.type === 'dm' ? activeChat.id : null,
      type: activeChat.type,
      room: activeChat.type === 'group' ? activeChat.id : null
    }, () => {});
  };

  const handleStartEdit = (msg) => {
    setEditingMessage(msg);
    setMessage(msg.text);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setMessage('');
  };

  const sendImage = (base64Data) => {
    const msgId = Date.now() + Math.random().toString(36).substr(2, 9);
    socket.emit('sendMessage', {
      id: msgId,
      text: base64Data,
      isImage: true,
      recipient: activeChat.type === 'dm' ? activeChat.id : null,
      type: activeChat.type
    }, () => {});
  }

  const handleTyping = () => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing', {
        recipient: activeChat.type === 'dm' ? activeChat.id : null,
        type: activeChat.type
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping', {
        recipient: activeChat.type === 'dm' ? activeChat.id : null,
        type: activeChat.type
      });
      isTypingRef.current = false;
    }, 1500);
  };

  const handleSelectChat = (chat) => {
    setActiveChat(chat);
    setTypingStatus('');
    setEditingMessage(null);
    setMessage('');
    
    const newRoom = chat.type === 'group' 
      ? chat.id 
      : getPrivateRoomId(name, chat.id);
    
    // Clear unread count for this room
    setUnreadCounts(prev => ({
      ...prev,
      [newRoom]: 0
    }));

    socket.emit('switchRoom', { newRoom }, (error) => {
      if (error) alert(error);
    });
  };

  const handleCreateRoom = (roomName) => {
    socket.emit('createRoom', { roomName }, () => {
      handleSelectChat({ id: roomName, type: 'group' });
    });
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('aether-theme', newTheme);
  };

  const chattedUserNames = Object.keys(messagesByChat)
    .filter(roomKey => roomKey.startsWith('private_'))
    .map(roomKey => {
      const parts = roomKey.replace('private_', '').split('_');
      const myNameLower = name.trim().toLowerCase();
      return parts[0] === myNameLower ? parts[1] : parts[0];
    });

  const onlineDMUsers = (users || [])
    .filter(u => u.name.trim().toLowerCase() !== name.trim().toLowerCase())
    .map(u => ({ name: u.name, isOnline: true }));

  const chattedDMUsers = chattedUserNames
    .filter(chattedName => !onlineDMUsers.some(onlineUser => onlineUser.name.toLowerCase() === chattedName.toLowerCase()))
    .map(chattedName => ({ name: chattedName, isOnline: false }));

  const allDMContacts = [...onlineDMUsers, ...chattedDMUsers];

  const activeRoomId = activeChat.type === 'group' 
    ? activeChat.id 
    : getPrivateRoomId(name, activeChat.id);
  const currentMessages = messagesByChat[activeRoomId] || [];

  return (
    <div className={`outerContainer ${theme}-theme`}>
      <div className="chatWorkspace">
        <TextContainer 
          dmContacts={allDMContacts} 
          rooms={rooms}
          currentName={name} 
          activeChat={activeChat}
          onSelectChat={handleSelectChat}
          onCreateRoom={handleCreateRoom}
          theme={theme}
          toggleTheme={toggleTheme}
          unreadCounts={unreadCounts}
        />
        <div className="container">
          <InfoBar room={activeChat.type === 'group' ? `#${activeChat.id}` : activeChat.id} />
          
          <Messages 
            messages={currentMessages} 
            name={name} 
            onStartEdit={handleStartEdit}
            onDelete={handleDeleteMessage}
          />
          
          {typingStatus && (
            <div className="typingIndicator">
              <span className="typingDot"></span>
              <span className="typingDot"></span>
              <span className="typingDot"></span>
              <span className="typingText">{typingStatus}</span>
            </div>
          )}

          {editingMessage && (
            <div className="editingMessageBanner">
              <div className="editingDetails">
                <span className="editingLabel">Editing Message:</span>
                <span className="editingTextPreview">{editingMessage.text}</span>
              </div>
              <button onClick={handleCancelEdit} className="cancelEditBtn">Cancel</button>
            </div>
          )}

          <Input 
            message={message} 
            setMessage={setMessage} 
            sendMessage={handleSendOrEdit} 
            onTyping={handleTyping}
            onSendImage={sendImage}
          />
        </div>
      </div>
    </div>
  );
}

export default Chat;
