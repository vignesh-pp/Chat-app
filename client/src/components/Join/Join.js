import React, { useState } from 'react';

import './Join.css';

export default function SignIn({ history }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const userVal = username.trim().toLowerCase();
    const passVal = password.trim();

    if (isLogin) {
      if (!userVal || !passVal) {
        setError('Username and password are required');
        return;
      }

      // Fetch existing users
      const localUsers = JSON.parse(localStorage.getItem('aether_users') || '[]');
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
      const emailVal = email.trim().toLowerCase();
      if (!userVal || !emailVal || !passVal) {
        setError('Username, email, and password are required');
        return;
      }
      if (passVal.length < 4) {
        setError('Password must be at least 4 characters');
        return;
      }
      if (passVal !== confirmPassword.trim()) {
        setError('Passwords do not match');
        return;
      }

      const localUsers = JSON.parse(localStorage.getItem('aether_users') || '[]');
      const userExists = localUsers.some(u => u.username === userVal);
      if (userExists) {
        setError('Username is already taken');
        return;
      }

      if (!isVerifying) {
        setLoading(true);
        try {
          const res = await fetch('http://localhost:5000/api/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailVal })
          });
          const data = await res.json();
          if (data.error) {
            setError(data.error);
          } else {
            setIsVerifying(true);
            setPreviewUrl(data.previewUrl || '');
            setSuccess('Verification code sent to your email.');
          }
        } catch (err) {
          setError('Failed to contact authentication server.');
        } finally {
          setLoading(false);
        }
      } else {
        // OTP verification
        if (!otp.trim()) {
          setError('Verification code is required');
          return;
        }
        setLoading(true);
        try {
          const res = await fetch('http://localhost:5000/api/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailVal, otp: otp.trim() })
          });
          const data = await res.json();
          if (data.error) {
            setError(data.error);
          } else {
            // Save new user
            localUsers.push({ username: userVal, email: emailVal, password: passVal });
            localStorage.setItem('aether_users', JSON.stringify(localUsers));
            
            setSuccess('Registration successful! Please login.');
            setIsLogin(true);
            setUsername('');
            setEmail('');
            setPassword('');
            setConfirmPassword('');
            setOtp('');
            setIsVerifying(false);
            setPreviewUrl('');
          }
        } catch (err) {
          setError('Failed to contact authentication server.');
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const handleCancelVerification = () => {
    setIsVerifying(false);
    setOtp('');
    setPreviewUrl('');
    setError('');
    setSuccess('');
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
            onClick={() => { setIsLogin(true); setError(''); setSuccess(''); setIsVerifying(false); }}
          >
            Login
          </button>
          <button 
            type="button" 
            className={`authTab ${isLogin ? '' : 'active'}`} 
            onClick={() => { setIsLogin(false); setError(''); setSuccess(''); setIsVerifying(false); }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleAuth} className="authForm">
          {error && <div className="authError">{error}</div>}
          {success && <div className="authSuccess">{success}</div>}

          {isVerifying ? (
            <>
              <p className="verificationSubText">
                Enter the 6-digit verification code sent to <strong>{email}</strong>.
              </p>
              {previewUrl && (
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="previewMailLink">
                  <span role="img" aria-label="envelope">✉️</span> Open Ethereal Inbox Preview
                </a>
              )}
              <div className="inputGroup">
                <input 
                  placeholder="6-Digit OTP Code" 
                  className="joinInput otpInput" 
                  type="text" 
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)} 
                  maxLength={6}
                  required
                />
              </div>
              
              <button className="button" type="submit" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify & Sign Up'}
              </button>
              
              <button type="button" onClick={handleCancelVerification} className="button secondary">
                Back to Sign Up
              </button>
            </>
          ) : (
            <>
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

              {!isLogin && (
                <div className="inputGroup">
                  <input 
                    placeholder="Email Address" 
                    className="joinInput" 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)} 
                    required
                  />
                </div>
              )}
              
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

              <button className="button" type="submit" disabled={loading}>
                {loading ? 'Loading...' : (isLogin ? 'Log In' : 'Send Verification OTP')}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
