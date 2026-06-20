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

  // WebRTC Calling States & Refs
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [callState, setCallState] = useState('idle'); // 'idle' | 'calling' | 'incoming' | 'connected'
  const [callType, setCallType] = useState('audio'); // 'audio' | 'video'
  const [callPartner, setCallPartner] = useState('');
  const [incomingSignal, setIncomingSignal] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const callPartnerRef = useRef('');
  useEffect(() => {
    callPartnerRef.current = callPartner;
  }, [callPartner]);

  const playOutgoingRing = (context) => {
    const osc1 = context.createOscillator();
    const osc2 = context.createOscillator();
    const gainNode = context.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(440, context.currentTime);
    osc2.frequency.setValueAtTime(480, context.currentTime);

    gainNode.gain.setValueAtTime(0, context.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.08, context.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.08, context.currentTime + 1.5);
    gainNode.gain.linearRampToValueAtTime(0, context.currentTime + 2.0);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(context.destination);

    osc1.start();
    osc2.start();
    osc1.stop(context.currentTime + 2.0);
    osc2.stop(context.currentTime + 2.0);
  };

  const playIncomingRing = (context) => {
    const notes = [261.63, 329.63, 392.00, 493.88]; // C4, E4, G4, B4
    notes.forEach((freq, idx) => {
      const osc = context.createOscillator();
      const gainNode = context.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, context.currentTime + idx * 0.15);

      gainNode.gain.setValueAtTime(0, context.currentTime + idx * 0.15);
      gainNode.gain.linearRampToValueAtTime(0.05, context.currentTime + idx * 0.15 + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + idx * 0.15 + 0.4);

      osc.connect(gainNode);
      gainNode.connect(context.destination);

      osc.start(context.currentTime + idx * 0.15);
      osc.stop(context.currentTime + idx * 0.15 + 0.45);
    });
  };

  useEffect(() => {
    let soundInterval;
    let ctx;
    
    if (callState === 'calling') {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        playOutgoingRing(ctx);
        soundInterval = setInterval(() => {
          if (ctx && ctx.state === 'suspended') ctx.resume();
          playOutgoingRing(ctx);
        }, 4000);
      } catch (e) {
        console.error('Failed to play calling sound', e);
      }
    } else if (callState === 'incoming') {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        playIncomingRing(ctx);
        soundInterval = setInterval(() => {
          if (ctx && ctx.state === 'suspended') ctx.resume();
          playIncomingRing(ctx);
        }, 1500);
      } catch (e) {
        console.error('Failed to play ringtone sound', e);
      }
    }

    return () => {
      if (soundInterval) clearInterval(soundInterval);
      if (ctx) {
        ctx.close();
      }
    };
  }, [callState]);

  useEffect(() => {
    let timer;
    if (callState === 'connected') {
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [callState]);

  const formatTime = (secs) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const resetCallState = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    remoteStreamRef.current = null;
    setCallState('idle');
    setCallPartner('');
    setIncomingSignal(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setCallDuration(0);
  };

  const getMediaStream = async (type) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('SECURE_CONTEXT_ERROR');
    }
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });
    } catch (err) {
      if (type === 'video' && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')) {
        console.warn('Webcam not found, falling back to audio only');
        alert('Webcam not detected. Starting voice call instead.');
        setCallType('audio');
        return await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });
      }
      throw err;
    }
  };

  const startCall = async (type) => {
    setCallType(type);
    setCallPartner(activeChat.id);
    setCallState('calling');
    setIsMuted(false);
    setIsCameraOff(false);

    try {
      const stream = await getMediaStream(type);
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('iceCandidate', { to: activeChat.id, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        remoteStreamRef.current = event.streams[0];
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('callUser', {
        userToCall: activeChat.id,
        signalData: offer,
        from: name,
        type: type === 'video' && stream.getVideoTracks().length > 0 ? 'video' : 'audio'
      });

      peerConnectionRef.current = pc;
    } catch (err) {
      console.error('Failed to get media devices:', err);
      if (err.message === 'SECURE_CONTEXT_ERROR') {
        alert('Microphone/Camera access requires a secure connection. Please use localhost or HTTPS.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Permission to access microphone/camera was denied. Please check your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        alert('No microphone or camera detected. Please check your device connections.');
      } else {
        alert(`Could not access microphone/camera: ${err.message || err.name}`);
      }
      endCall();
    }
  };

  const acceptCall = async () => {
    setCallState('connected');
    try {
      const stream = await getMediaStream(callType);
      localStreamRef.current = stream;

      setTimeout(() => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        if (remoteVideoRef.current && remoteStreamRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }
      }, 100);

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('iceCandidate', { to: callPartner, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        remoteStreamRef.current = event.streams[0];
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('answerCall', { to: callPartner, signal: answer });
      peerConnectionRef.current = pc;
    } catch (err) {
      console.error('Failed to accept call:', err);
      if (err.message === 'SECURE_CONTEXT_ERROR') {
        alert('Microphone/Camera access requires a secure connection. Please use localhost or HTTPS.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Permission to access microphone/camera was denied. Please check your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        alert('No microphone or camera detected. Please check your device connections.');
      } else {
        alert(`Could not access microphone/camera: ${err.message || err.name}`);
      }
      declineCall();
    }
  };

  const declineCall = () => {
    socket.emit('declineCall', { to: callPartner });
    resetCallState();
  };

  const endCall = () => {
    socket.emit('endCall', { to: callPartner });
    resetCallState();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  };

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
      // Switch back to general group chat if active room was deleted
      const currentActive = activeChatRef.current;
      if (currentActive && currentActive.type === 'group' && currentActive.id !== 'general' && !rooms.includes(currentActive.id)) {
        if (handleSelectChatRef.current) {
          handleSelectChatRef.current({ id: 'general', type: 'group' });
        }
      }
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

    socket.on('callUser', ({ signal, from, type }) => {
      setCallPartner(from);
      setCallType(type);
      setIncomingSignal(signal);
      setCallState('incoming');
    });

    socket.on('callAccepted', async ({ signal }) => {
      setCallState('connected');
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
      }
    });

    socket.on('callDeclined', () => {
      alert(`${callPartnerRef.current} declined the call.`);
      resetCallState();
    });

    socket.on('endCall', () => {
      resetCallState();
    });

    socket.on('iceCandidate', async ({ candidate }) => {
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding received ice candidate', e);
        }
      }
    });

    socket.on('chatDeleted', ({ room }) => {
      setMessagesByChat(prev => ({
        ...prev,
        [room]: []
      }));
    });

    socket.on('messageReacted', ({ messageId, reactions, room }) => {
      setMessagesByChat(prev => {
        const chatMessages = prev[room] || [];
        const updatedMessages = chatMessages.map(msg => 
          msg.id === messageId ? { ...msg, reactions } : msg
        );
        return { ...prev, [room]: updatedMessages };
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
      socket.off('callUser');
      socket.off('callAccepted');
      socket.off('callDeclined');
      socket.off('endCall');
      socket.off('iceCandidate');
      socket.off('chatDeleted');
      socket.off('messageReacted');
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

  const handleReactMessage = (messageId, emoji) => {
    socket.emit('reactMessage', {
      messageId,
      emoji,
      recipient: activeChat.type === 'dm' ? activeChat.id : null,
      type: activeChat.type,
      room: activeChat.type === 'group' ? activeChat.id : null
    }, () => {});
  };

  const handleDeleteChat = ({ id, type }) => {
    const roomKey = type === 'group' ? id : getPrivateRoomId(name, id);
    setMessagesByChat(prev => ({
      ...prev,
      [roomKey]: []
    }));
    socket.emit('deleteChat', { id, type }, (res) => {
      if (res && res.error) {
        alert(res.error);
      }
    });
  };

  const handleStartEdit = (msg) => {
    setEditingMessage(msg);
    setMessage(msg.text);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setMessage('');
  };

  const sendFile = (base64Data, isImage, fileName, fileType) => {
    const msgId = Date.now() + Math.random().toString(36).substr(2, 9);
    socket.emit('sendMessage', {
      id: msgId,
      text: base64Data,
      isImage: isImage,
      isFile: !isImage,
      fileName: !isImage ? fileName : null,
      fileType: !isImage ? fileType : null,
      recipient: activeChat.type === 'dm' ? activeChat.id : null,
      type: activeChat.type
    }, () => {});
  };

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

  const handleSelectChatRef = useRef(handleSelectChat);
  handleSelectChatRef.current = handleSelectChat;

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

  const interactedNames = Object.keys(messagesByChat)
    .filter(roomKey => roomKey.startsWith('private_'))
    .map(roomKey => {
      const parts = roomKey.replace('private_', '').split('_');
      const myNameLower = name.trim().toLowerCase();
      return parts[0] === myNameLower ? parts[1] : parts[0];
    });

  const onlineNames = (users || [])
    .filter(u => u.name.trim().toLowerCase() !== name.trim().toLowerCase())
    .map(u => u.name.trim().toLowerCase());

  const allContactNames = Array.from(new Set([...interactedNames, ...onlineNames]));

  const allDMContacts = allContactNames.map(uName => {
    const isOnline = onlineNames.includes(uName.toLowerCase());
    const roomKey = getPrivateRoomId(name, uName);
    
    // Check if the chat has active (non-deleted) messages
    const hasHistory = messagesByChat[roomKey] && messagesByChat[roomKey].some(m => !m.isDeleted);
    
    // Find the original casing from users list or messages
    let originalName = uName;
    const onlineUser = (users || []).find(u => u.name.toLowerCase() === uName.toLowerCase());
    if (onlineUser) {
      originalName = onlineUser.name;
    } else {
      const msgs = messagesByChat[roomKey] || [];
      const matchingMsg = msgs.find(m => m.user.toLowerCase() !== name.toLowerCase());
      if (matchingMsg) {
        originalName = matchingMsg.user;
      }
    }

    return {
      name: originalName,
      isOnline,
      hasHistory: !!hasHistory
    };
  });

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
          onDeleteChat={handleDeleteChat}
        />
        <div className="container">
          <InfoBar 
            room={activeChat.type === 'group' ? `#${activeChat.id}` : activeChat.id} 
            activeChat={activeChat}
            onStartCall={startCall}
          />
          
          <Messages 
            messages={currentMessages} 
            name={name} 
            onStartEdit={handleStartEdit}
            onDelete={handleDeleteMessage}
            onReact={handleReactMessage}
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
            onSendFile={sendFile}
          />
        </div>
      </div>

      {/* Incoming Call Dialog Overlay */}
      {callState === 'incoming' && (
        <div className="callOverlay">
          <div className="incomingCallBox">
            <div className="callerAvatar">
              {callPartner.slice(0, 2).toUpperCase()}
            </div>
            <h3>Incoming {callType === 'video' ? 'Video' : 'Voice'} Call</h3>
            <p>{callPartner} is calling you...</p>
            <div className="callActions">
              <button onClick={acceptCall} className="callAcceptBtn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                Accept
              </button>
              <button onClick={declineCall} className="callDeclineBtn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outgoing or Active Call Overlay */}
      {(callState === 'calling' || callState === 'connected') && (
        <div className="callOverlay">
          <div className={`activeCallBox ${callType}`}>
            {callType === 'video' ? (
              <div className="videoStreamsContainer">
                {/* Remote Video */}
                <video 
                  ref={remoteVideoRef} 
                  autoPlay 
                  playsInline 
                  className="remoteVideo"
                />
                
                {/* Local Video (picture-in-picture) */}
                {!isCameraOff && (
                  <video 
                    ref={localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="localVideo"
                  />
                )}
                
                <div className="videoOverlayControls">
                  <div className="callTitleInfo">
                    <h3>{callPartner}</h3>
                    <span>{callState === 'calling' ? 'Calling...' : formatTime(callDuration)}</span>
                  </div>
                  
                  <div className="callControlButtons">
                    <button onClick={toggleMute} className={`controlBtn ${isMuted ? 'active' : ''}`} title="Mute/Unmute">
                      {isMuted ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                      )}
                    </button>
                    
                    <button onClick={toggleCamera} className={`controlBtn ${isCameraOff ? 'active' : ''}`} title="Camera ON/OFF">
                      {isCameraOff ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                      )}
                    </button>
                    
                    <button onClick={endCall} className="controlBtn endCallBtn" title="End Call">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path></svg>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="audioCallContainer">
                <div className="audioCallerInfo">
                  <div className="callerAvatar pulsing">
                    {callPartner.slice(0, 2).toUpperCase()}
                  </div>
                  <h3>{callPartner}</h3>
                  <span className="callStatusText">
                    {callState === 'calling' ? 'Calling...' : `Voice Call - ${formatTime(callDuration)}`}
                  </span>
                </div>
                
                <div className="audioControls">
                  <button onClick={toggleMute} className={`controlBtn ${isMuted ? 'active' : ''}`} title="Mute/Unmute">
                    {isMuted ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                    )}
                  </button>
                  
                  <button onClick={endCall} className="controlBtn endCallBtn" title="End Call">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Chat;
