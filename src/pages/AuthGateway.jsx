import React, { useEffect, useState } from 'react'
import api from '../config/api'

const ACCOUNTS_STORAGE_KEY = 'assignmate_accounts'
const ACCOUNTS_RESET_FLAG_KEY = 'assignmate_accounts_reset_v1'

export default function AuthGateway({ onLogin, loginError = '', loginLoading = false, onClearLoginError }) {
  const [isRegistering, setIsRegistering] = useState(false)
  const [selectedRole, setSelectedRole] = useState('student')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [teacherSubject, setTeacherSubject] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [otpRequested, setOtpRequested] = useState(false)
  const [registerLoading, setRegisterLoading] = useState(false)
  const [authMessage, setAuthMessage] = useState({ type: '', text: '' })
  const [logoFailed, setLogoFailed] = useState(false)
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 980)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const alreadyReset = window.localStorage.getItem(ACCOUNTS_RESET_FLAG_KEY)
    if (!alreadyReset) {
      window.localStorage.removeItem(ACCOUNTS_STORAGE_KEY)
      window.localStorage.setItem(ACCOUNTS_RESET_FLAG_KEY, 'true')
    }
  }, [])

  const loginLabel = selectedRole === 'teacher' ? 'Teacher ID' : 'Student ID'
  const loginPlaceholder = selectedRole === 'teacher' ? 'Enter teacher ID' : 'Enter student ID'

  const resetOtpFlow = () => {
    setOtp('')
    setOtpRequested(false)
  }

  const markSignupDetailsChanged = () => {
    if (otpRequested) {
      resetOtpFlow()
      setAuthMessage({ type: 'success', text: 'Signup details changed. Request a fresh OTP to continue.' })
    }
  }

  const buildSignupPayload = () => ({
    fullName,
    userId: username,
    email,
    password,
    confirmPassword,
    role: selectedRole.toUpperCase(),
    subject: selectedRole === 'teacher' ? teacherSubject : null
  })

  const handleLoginSubmit = async (event) => {
    event.preventDefault()
    setAuthMessage({ type: '', text: '' })
    onClearLoginError?.()

    await onLogin({
      userId: username,
      password,
      role: selectedRole.toUpperCase()
    })
  }

  const handleRegisterSubmit = async (event) => {
    event.preventDefault()
    onClearLoginError?.()
    setAuthMessage({ type: '', text: '' })

    if (password !== confirmPassword) {
      setAuthMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }

    setRegisterLoading(true)

    try {
      if (!otpRequested) {
        await api.post('/auth/signup/request-otp', buildSignupPayload())
        setOtpRequested(true)
        setAuthMessage({
          type: 'success',
          text: 'OTP sent to your email. Enter it below to finish creating your account.'
        })
        return
      }

      if (!otp.trim()) {
        setAuthMessage({ type: 'error', text: 'Enter the OTP sent to your email.' })
        return
      }

      await api.post('/auth/signup', {
        email,
        otp
      })

      setAuthMessage({
        type: 'success',
        text: 'Account created successfully. Please login.'
      })
      setIsRegistering(false)
      setUsername('')
      setPassword('')
      setFullName('')
      setEmail('')
      setTeacherSubject('')
      setConfirmPassword('')
      resetOtpFlow()
    } catch (error) {
      console.error(error)
      setAuthMessage({ type: 'error', text: error.message || 'Signup failed' })
    } finally {
      setRegisterLoading(false)
    }
  }

  return (
    <section style={{ ...styles.page, ...(isNarrow ? styles.pageNarrow : {}) }}>
      <div style={styles.leftPanel}>
        {!logoFailed ? (
          <img
            src="/assignmate-logo.png"
            alt="AssignMate Logo"
            style={styles.leftLogo}
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <div style={styles.logoFallbackWrap}>
            <h1 style={styles.fallbackTitle}>AssignMate</h1>
            <p style={styles.fallbackSub}>Smart Assignment Platform</p>
          </div>
        )}
      </div>

      <div style={{ ...styles.rightPanel, ...(isNarrow ? styles.rightPanelNarrow : {}) }}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>{isRegistering ? 'Create Account' : 'Login'}</h2>
            <p style={styles.cardText}>
              {isRegistering ? 'Register for a new account' : 'Enter your credentials to continue'}
            </p>
          </div>

          {!isRegistering ? (
            <form style={styles.cardBody} onSubmit={handleLoginSubmit}>
              <label style={styles.label}>Login as</label>
              <div style={styles.roleGrid}>
                <button
                  type="button"
                  style={{
                    ...styles.roleButton,
                    ...(selectedRole === 'student' ? styles.roleButtonActive : {})
                  }}
                  onClick={() => {
                    setSelectedRole('student')
                    markSignupDetailsChanged()
                  }}
                >
                  Student
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.roleButton,
                    ...(selectedRole === 'teacher' ? styles.roleButtonActive : {})
                  }}
                  onClick={() => {
                    setSelectedRole('teacher')
                    markSignupDetailsChanged()
                  }}
                >
                  Teacher
                </button>
              </div>

              <label>User ID</label>
              <input
                style={styles.input}
                type="text"
                placeholder="Enter user ID (e.g. student01)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />

              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />

              <button
                style={{ ...styles.primaryButton, ...(loginLoading ? styles.primaryButtonDisabled : {}) }}
                type="submit"
                disabled={loginLoading}
              >
                {loginLoading ? 'Logging in...' : 'Log in'}
              </button>

              <div style={styles.divider} />
              <div style={styles.centerText}>
                <button
                  style={styles.linkButton}
                  type="button"
                  onClick={() => {
                    setIsRegistering(true)
                    resetOtpFlow()
                    setAuthMessage({ type: '', text: '' })
                    onClearLoginError?.()
                  }}
                >
                  Don't have an account? Create one
                </button>
              </div>
            </form>
          ) : (
            <form style={styles.cardBody} onSubmit={handleRegisterSubmit}>
              <label style={styles.label}>Register as</label>
              <div style={styles.roleGrid}>
                <button
                  type="button"
                  style={{
                    ...styles.roleButton,
                    ...(selectedRole === 'student' ? styles.roleButtonActive : {})
                  }}
                  onClick={() => setSelectedRole('student')}
                >
                  Student
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.roleButton,
                    ...(selectedRole === 'teacher' ? styles.roleButtonActive : {})
                  }}
                  onClick={() => setSelectedRole('teacher')}
                >
                  Teacher
                </button>
              </div>

              <>
                <label style={styles.label}>Full Name</label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(event) => {
                    setFullName(event.target.value)
                    markSignupDetailsChanged()
                  }}
                  required
                />

                <label style={styles.label}>Email</label>
                <input
                  style={styles.input}
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    markSignupDetailsChanged()
                  }}
                  required
                />
              </>

              {selectedRole === 'teacher' ? (
                <>
                  <label style={styles.label}>Subject / Course</label>
                  <input
                    style={styles.input}
                    type="text"
                    placeholder="Enter your subject (e.g. Fullstack)"
                    value={teacherSubject}
                    onChange={(event) => {
                      setTeacherSubject(event.target.value)
                      markSignupDetailsChanged()
                    }}
                    required
                  />
                </>
              ) : null}

              <label style={styles.label}>{loginLabel}</label>
              <input
                style={styles.input}
                type="text"
                placeholder={loginPlaceholder}
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value)
                  markSignupDetailsChanged()
                }}
                required
              />

              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  markSignupDetailsChanged()
                }}
                required
              />

              <label style={styles.label}>Confirm Password</label>
              <input
                style={styles.input}
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value)
                  markSignupDetailsChanged()
                }}
                required
              />

              {otpRequested ? (
                <>
                  <label style={styles.label}>Email OTP</label>
                  <input
                    style={styles.input}
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter the 6-digit OTP"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value)}
                    required
                  />
                </>
              ) : null}

              <button
                style={{ ...styles.primaryButton, ...(registerLoading ? styles.primaryButtonDisabled : {}) }}
                type="submit"
                disabled={registerLoading}
              >
                {registerLoading
                  ? (otpRequested ? 'Verifying OTP...' : 'Sending OTP...')
                  : (otpRequested ? 'Verify OTP & Register' : 'Send OTP')}
              </button>

              {otpRequested ? (
                <button
                  style={styles.secondaryButton}
                  type="button"
                  onClick={async () => {
                    setAuthMessage({ type: '', text: '' })
                    setRegisterLoading(true)
                    try {
                      await api.post('/auth/signup/request-otp', buildSignupPayload())
                      setAuthMessage({ type: 'success', text: 'A fresh OTP has been sent to your email.' })
                    } catch (error) {
                      setAuthMessage({ type: 'error', text: error.message || 'Failed to resend OTP' })
                    } finally {
                      setRegisterLoading(false)
                    }
                  }}
                  disabled={registerLoading}
                >
                  Resend OTP
                </button>
              ) : null}

              <div style={styles.centerText}>
                <button
                  style={styles.linkButton}
                  type="button"
                  onClick={() => {
                    setIsRegistering(false)
                    resetOtpFlow()
                    setAuthMessage({ type: '', text: '' })
                    onClearLoginError?.()
                  }}
                >
                  Already have an account? Login
                </button>
              </div>
            </form>
          )}

          {authMessage.text ? (
            <div style={authMessage.type === 'success' ? styles.successMessage : styles.errorMessage}>
              {authMessage.text}
            </div>
          ) : loginError ? (
            <div style={styles.errorMessage}>{loginError}</div>
          ) : null}
        </div>

        <div style={styles.footerWrap}>
          <button style={styles.cookieButton} type="button">
            Cookie preferences
          </button>
          <p style={styles.footerText}>© 2026 AssignMate Assignment System</p>
        </div>
      </div>
    </section>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    width: '100%',
    display: 'grid',
    gridTemplateColumns: '65% 35%',
    background: '#f8fbff'
  },
  pageNarrow: {
    gridTemplateColumns: '1fr'
  },
  leftPanel: {
    background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12
  },
  leftLogo: {
    width: 'min(92%, 980px)',
    maxHeight: '85vh',
    objectFit: 'contain',
    filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.2))'
  },
  logoFallbackWrap: {
    textAlign: 'center',
    color: '#fff'
  },
  fallbackTitle: {
    margin: 0,
    fontSize: 56,
    fontWeight: 800
  },
  fallbackSub: {
    margin: '8px 0 0',
    fontSize: 24
  },
  rightPanel: {
    background: '#f3f4f6',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '16px 10px',
    position: 'relative'
  },
  rightPanelNarrow: {
    padding: '18px 14px 24px'
  },
  card: {
    width: '100%',
    background: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid #dbeafe',
    boxShadow: '0 12px 22px rgba(15, 23, 42, 0.12)'
  },
  cardHeader: {
    padding: '16px 20px',
    background: 'linear-gradient(120deg, #1d4ed8, #2563eb)'
  },
  cardTitle: {
    margin: 0,
    color: '#fff',
    fontSize: 30
  },
  cardText: {
    margin: '4px 0 0',
    color: '#dbeafe',
    fontSize: 15
  },
  cardBody: {
    padding: 18
  },
  label: {
    display: 'block',
    margin: '10px 0 6px',
    color: '#334155',
    fontWeight: 600,
    fontSize: 16
  },
  roleGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10
  },
  roleButton: {
    border: '2px solid #cbd5e1',
    background: '#fff',
    borderRadius: 10,
    height: 48,
    color: '#334155',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer'
  },
  roleButtonActive: {
    borderColor: '#2563eb',
    background: '#eff6ff',
    color: '#1d4ed8'
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 15,
    outline: 'none',
    background: '#fff'
  },
  linkButton: {
    border: 'none',
    background: 'transparent',
    color: '#2563eb',
    cursor: 'pointer',
    fontSize: 14,
    padding: 0,
    fontWeight: 600
  },
  primaryButton: {
    width: '100%',
    marginTop: 12,
    border: 'none',
    borderRadius: 8,
    height: 46,
    background: 'linear-gradient(120deg, #1d4ed8, #2563eb)',
    color: '#fff',
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer'
  },
  primaryButtonDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed'
  },
  secondaryButton: {
    width: '100%',
    marginTop: 10,
    border: '1px solid #93c5fd',
    borderRadius: 8,
    height: 44,
    background: '#eff6ff',
    color: '#1d4ed8',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer'
  },
  divider: {
    marginTop: 12,
    borderTop: '1px solid #e2e8f0'
  },
  centerText: {
    marginTop: 10,
    textAlign: 'center'
  },
  successMessage: {
    margin: '8px 18px 14px',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #bbf7d0',
    background: '#f0fdf4',
    color: '#166534',
    fontSize: 14,
    fontWeight: 600
  },
  errorMessage: {
    margin: '8px 18px 14px',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#991b1b',
    fontSize: 14,
    fontWeight: 600
  },
  footerWrap: {
    textAlign: 'center',
    marginTop: 12
  },
  cookieButton: {
    border: 'none',
    background: 'transparent',
    color: '#475569',
    textDecoration: 'underline',
    cursor: 'pointer',
    fontSize: 13
  },
  footerText: {
    margin: '8px 0 0',
    color: '#64748b',
    fontSize: 12
  }
}
