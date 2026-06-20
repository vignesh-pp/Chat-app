import React, { useState } from 'react';

import './Join.css';

export default function SignIn({ history }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAuth = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const userVal = username.trim().toLowerCase();
    const passVal = password.trim();

    if (!userVal || !passVal) {
      setError('Username and password are required');
      return;
    }

    // Fetch existing users
    const localUsers = JSON.parse(localStorage.getItem('aether_users') || '[]');

    if (isLogin) {
      // Login flow
      const matchedUser = localUsers.find(u => u.username === userVal && u.password === passVal);
      if (!matchedUser) {
        setError('Invalid username or password');
        return;
      }
      // Successful Login: Set session and redirect
      localStorage.setItem('aether_session', username.trim());
      history.push(`/chat?name=${username.trim()}`);
    } else {
      // Signup flow
      if (passVal.length < 4) {
        setError('Password must be at least 4 characters');
        return;
      }
      if (passVal !== confirmPassword.trim()) {
        setError('Passwords do not match');
        return;
      }
      const userExists = localUsers.some(u => u.username === userVal);
      if (userExists) {
        setError('Username is already taken');
        return;
      }
      // Save new user
      localUsers.push({ username: userVal, password: passVal });
      localStorage.setItem('aether_users', JSON.stringify(localUsers));
      
      setSuccess('Registration successful! Please login.');
      setIsLogin(true);
      setPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <div className="joinOuterContainer">
      <div className="joinBackgroundGlow"></div>
      <div className="joinInnerContainer">
        <div className="logoContainer">
          <span className="logoEmoji" role="img" aria-label="chat bubble">💬</span>
          <h1 className="logoText">AetherChat</h1>
        </div>
        <p className="subtitle">Realtime glassmorphic workspace messaging</p>

        {/* Auth Mode Tabs */}
        <div className="authTabs">
          <button 
            type="button" 
            className={`authTab ${isLogin ? 'active' : ''}`} 
            onClick={() => { setIsLogin(true); setError(''); setSuccess(''); }}
          >
            Login
          </button>
          <button 
            type="button" 
            className={`authTab ${isLogin ? '' : 'active'}`} 
            onClick={() => { setIsLogin(false); setError(''); setSuccess(''); }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleAuth} className="authForm">
          {error && <div className="authError">{error}</div>}
          {success && <div className="authSuccess">{success}</div>}

          <div className="inputGroup">
            <input 
              placeholder="Username" 
              className="joinInput" 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)} 
              required
            />
          </div>
          
          <div className="inputGroup">
            <input 
              placeholder="Password" 
              className="joinInput" 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)} 
              required
            />
          </div>

          {!isLogin && (
            <div className="inputGroup">
              <input 
                placeholder="Confirm Password" 
                className="joinInput" 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} 
                required
              />
            </div>
          )}

          <button className="button" type="submit">
            {isLogin ? 'Log In' : 'Sign Up'}
          </button>
        </form>
      </div>
    </div>
  );
}
