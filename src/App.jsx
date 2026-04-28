import React, { useEffect, useState } from 'react'
import AuthGateway from './pages/AuthGateway'
import StudentDashboard from './pages/StudentDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import SubmitAssignment from './pages/SubmitAssignment'
import GradePanel from './pages/GradePanel'
import { apiRequest, uploadFile, toApiPath } from './config/api'



/*This is the main control file of the frontend. It checks whether the user is already logged in by calling the backend session API. Based on the response, it decides what to show:

login page if user is not logged in
teacher dashboard if role is teacher
student dashboard if role is student*/


const SESSION_STORAGE_KEY = 'user'
const defaultSession = {
  isLoggedIn: false,
  role: 'student',
  user: { fullName: '', userId: '', email: '', subject: '' }
}

const getStoredTokens = () => {
  try {
    const raw = window.localStorage.getItem('assignmate_tokens')
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    return null
  }
}

const getStoredSession = () => {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return defaultSession

    const tokens = getStoredTokens()
    if (!tokens?.accessToken || !tokens?.refreshToken) {
      return defaultSession
    }

    const parsed = JSON.parse(raw)
    if (!parsed?.isLoggedIn || !parsed?.user?.userId) {
      return defaultSession
    }

    return {
      isLoggedIn: true,
      role: String(parsed.role || 'student').toLowerCase(),
      user: {
        fullName: parsed.user.fullName || '',
        userId: parsed.user.userId || '',
        email: parsed.user.email || '',
        subject: parsed.user.subject || ''
      }
    }
  } catch (error) {
    console.error('Unable to restore session from storage:', error)
    return defaultSession
  }
}

export default function App() {
  const normalizeText = (value) => String(value || '').trim().toLowerCase()

  const normalizeFileLink = (value) => {
    if (!value) return ''
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) {
      return value
    }
    return ''
  }

  const mapAssignment = (item) => ({
    id: item.id,
    title: item.title,
    subject: item.subject,
    dueDate: item.dueDate,
    points: item.points,
    status: item.status || 'published',
    teacherId: item.teacherId,
    teacherName: item.teacherName,
    attachmentFileName: normalizeFileLink(item.attachmentFileName)
  })

  const formatSubmittedAt = (value) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
  }

  const mapSubmission = (item) => ({
    id: item.id,
    assignmentId: item.assignmentId,
    assignment: item.assignmentTitle,
    assignmentTitle: item.assignmentTitle,
    subject: item.subject,
    studentId: item.studentId,
    student: item.studentName,
    teacherId: item.teacherId,
    teacherName: item.teacherName,
    submitted: formatSubmittedAt(item.submittedAt),
    submittedAt: item.submittedAt,
    status: item.status,
    grade: item.grade ?? '-',
    feedback: item.feedback || '-',
    fileName: item.fileName || '-',
    submissionLink: normalizeFileLink(item.submissionLink)
  })

  const [session, setSession] = useState(getStoredSession)

  const [view, setView] = useState('dashboard')
  const [assignments, setAssignments] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [dataError, setDataError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionLoading, setActionLoading] = useState({
    publish: false,
    update: false,
    delete: false,
    submit: false,
    grade: false
  })
  const [loading, setLoading] = useState(true)

  const teacherVisibleAssignments = session.role === 'teacher'
    ? assignments.filter((item) => {
        const matchesTeacherId = item.teacherId && item.teacherId === session.user.userId
        const matchesSubject = normalizeText(item.subject) && normalizeText(item.subject) === normalizeText(session.user.subject)
        return matchesTeacherId || matchesSubject
      })
    : assignments

  const teacherVisibleSubmissions = session.role === 'teacher'
    ? submissions.filter((item) => {
        const matchesTeacherId = item.teacherId && item.teacherId === session.user.userId
        const matchesSubject = normalizeText(item.subject) && normalizeText(item.subject) === normalizeText(session.user.subject)
        return matchesTeacherId || matchesSubject
      })
    : submissions

  // ===============================
  // 📥 FETCH ASSIGNMENTS
  // ===============================
  useEffect(() => {
    if (!session.isLoggedIn) {
      setLoading(false)
      return
    }

    const loadInitialData = async () => {
      setDataError('')
      setLoading(true)

      const [assignmentsResponse, submissionsResponse] = await Promise.all([
        apiRequest.get('/assignments', undefined, 'Assignments fetched successfully.'),
        apiRequest.get('/submissions', undefined, 'Submissions fetched successfully.')
      ])

      if (!assignmentsResponse.success || !submissionsResponse.success) {
        const message = assignmentsResponse.message || submissionsResponse.message || 'Failed to load dashboard data.'
        setDataError(message)
        setAssignments([])
        setSubmissions([])
        setLoading(false)
        return
      }

      const assignmentList = Array.isArray(assignmentsResponse.data) ? assignmentsResponse.data : []
      const submissionList = Array.isArray(submissionsResponse.data) ? submissionsResponse.data : []

      setAssignments(assignmentList.map(mapAssignment))
      setSubmissions(submissionList.map(mapSubmission))
      setLoading(false)
    }

    loadInitialData()
  }, [session.isLoggedIn])

  // ===============================
  // 🔐 LOGIN (BACKEND CONNECTED)
  // ===============================
  const handleLogin = async (credentials) => {
    setAuthError('')
    setAuthLoading(true)

    const response = await apiRequest.post('/auth/login', credentials, undefined, 'Login successful.')

    if (!response.success) {
      setAuthError(response.message || 'Login failed')
      setAuthLoading(false)
      return { success: false, message: response.message || 'Login failed', data: null }
    }

    try {
      const data = response.data || {}
      // persist tokens returned by backend
      try {
        const tokens = { accessToken: data.accessToken, refreshToken: data.refreshToken }
        window.localStorage.setItem('assignmate_tokens', JSON.stringify(tokens))
      } catch (e) {
        // ignore
      }
      const normalizedRole = String(data.role || '').toLowerCase()
      const nextSession = {
        isLoggedIn: true,
        role: normalizedRole,
        user: {
          fullName: data.fullName,
          userId: data.userId,
          email: data.email,
          subject: data.subject
        }
      }
      setSession(nextSession)
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession))
      setView('dashboard')
      setAuthLoading(false)
      return { success: true, message: 'Login successful.', data: nextSession }

    } catch (err) {
      setAuthError(err.message || 'Login failed')
      console.error("Login error:", err)
      setAuthLoading(false)
      return { success: false, message: err.message || 'Login failed', data: null }
    }
  }

  // ===============================
  // 🚪 LOGOUT
  // ===============================
  const handleLogout = () => {
    setAuthError('')
    setActionError('')
    setSession(defaultSession)
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    try { window.localStorage.removeItem('assignmate_tokens') } catch (e) {}
    setView('dashboard')
  }

  const handleNavigate = (nextView) => {
    if (nextView) setView(nextView)
  }

  // ===============================
  // ➕ ADD ASSIGNMENT
  // ===============================
  const handlePublishAssignment = async (assignment) => {
    setActionError('')
    setActionLoading((prev) => ({ ...prev, publish: true }))
    try {
      let attachmentFileName = ''
      if (assignment.file) {
        const upload = await uploadFile(assignment.file)
        attachmentFileName = upload.fileUrl || ''
      }

      const payload = {
        title: assignment.title,
        dueDate: assignment.dueDate,
        subject: assignment.subject,
        points: Number(assignment.points || 100),
        teacherId: session.user.userId,
        attachmentFileName
      }

      const response = await apiRequest.post('/assignments', payload, undefined, 'Assignment published successfully.')
      if (!response.success) {
        setActionError(response.message)
        return { success: false, message: response.message, data: null }
      }

      setAssignments(prev => [mapAssignment(response.data), ...prev])
      return { success: true, message: response.message, data: response.data }

    } catch (err) {
      console.error("Error adding assignment:", err)
      setActionError(err.message || 'Unable to publish assignment.')
      return { success: false, message: err.message || 'Unable to publish assignment.', data: null }
    } finally {
      setActionLoading((prev) => ({ ...prev, publish: false }))
    }
  }

  // ===============================
  // ✏ UPDATE ASSIGNMENT
  // ===============================
  const handleUpdateAssignment = async (updatedAssignment) => {
    setActionError('')
    setActionLoading((prev) => ({ ...prev, update: true }))
    try {
      const payload = {
        title: updatedAssignment.title,
        dueDate: updatedAssignment.dueDate,
        subject: updatedAssignment.subject,
        points: Number(updatedAssignment.points || 100),
        teacherId: session.user.userId,
        attachmentFileName: updatedAssignment.attachmentFileName || ''
      }
      const response = await apiRequest.put(`/assignments/${updatedAssignment.id}`, payload, undefined, 'Assignment updated successfully.')
      if (!response.success) {
        setActionError(response.message)
        return { success: false, message: response.message, data: null }
      }

      setAssignments(prev =>
        prev.map(item => item.id === response.data.id ? mapAssignment(response.data) : item)
      )

      return { success: true, message: response.message, data: response.data }

    } catch (err) {
      console.error("Error updating assignment:", err)
      setActionError(err.message || 'Unable to update assignment.')
      return { success: false, message: err.message || 'Unable to update assignment.', data: null }
    } finally {
      setActionLoading((prev) => ({ ...prev, update: false }))
    }
  }

  // ===============================
  // ❌ DELETE ASSIGNMENT
  // ===============================
  const handleDeleteAssignment = async (assignmentId) => {
    setActionError('')
    setActionLoading((prev) => ({ ...prev, delete: true }))
    try {
      const response = await apiRequest.delete(`/assignments/${assignmentId}`, undefined, 'Assignment deleted successfully.')
      if (!response.success) {
        setActionError(response.message)
        return { success: false, message: response.message, data: null }
      }

      setAssignments(prev =>
        prev.filter(item => item.id !== assignmentId)
      )

      return { success: true, message: response.message, data: { id: assignmentId } }

    } catch (err) {
      console.error("Error deleting assignment:", err)
      setActionError(err.message || 'Unable to delete assignment.')
      return { success: false, message: err.message || 'Unable to delete assignment.', data: null }
    } finally {
      setActionLoading((prev) => ({ ...prev, delete: false }))
    }
  }

  // ===============================
  // 📤 SUBMIT ASSIGNMENT (BACKEND)
  // ===============================
  const handleStudentSubmit = async (id, file) => {
    if (!file) {
      return { success: false, message: 'Please select a file before uploading.', data: null }
    }

    setActionError('')
    setActionLoading((prev) => ({ ...prev, submit: true }))

    const newSubmission = {
      assignmentId: id,
      studentId: session.user.userId,
      student: session.user.fullName,
      fileName: file.name || '-',
      status: 'submitted'
    }

    try {
      const upload = await uploadFile(file)
      newSubmission.submissionLink = toApiPath(upload.fileUrl)

      const response = await apiRequest.post('/submissions', newSubmission, undefined, 'Assignment submitted successfully.')
      if (!response.success) {
        setActionError(response.message)
        return { success: false, message: response.message, data: null }
      }

      setSubmissions(prev => [mapSubmission(response.data), ...prev])
      return { success: true, message: response.message, data: response.data }

    } catch (err) {
      console.error("Error submitting assignment:", err)
      setActionError(err.message || 'Unable to submit assignment.')
      return { success: false, message: err.message || 'Unable to submit assignment.', data: null }
    } finally {
      setActionLoading((prev) => ({ ...prev, submit: false }))
    }
  }

  // ===============================
  // 🎓 GRADE SUBMISSION
  // ===============================
  const handleGradeSubmission = async (id, grade, feedback) => {
    setActionError('')
    setActionLoading((prev) => ({ ...prev, grade: true }))
    try {
      const response = await apiRequest.put(
        `/submissions/${id}`,
        { grade, feedback, status: 'graded' },
        undefined,
        'Submission graded successfully.'
      )

      if (!response.success) {
        setActionError(response.message)
        return { success: false, message: response.message, data: null }
      }

      setSubmissions(prev =>
        prev.map(item =>
          item.id === id ? mapSubmission(response.data) : item
        )
      )

      return { success: true, message: response.message, data: response.data }

    } catch (err) {
      console.error("Error grading submission:", err)
      setActionError(err.message || 'Unable to grade submission.')
      return { success: false, message: err.message || 'Unable to grade submission.', data: null }
    } finally {
      setActionLoading((prev) => ({ ...prev, grade: false }))
    }
  }

  // ===============================
  // ⏳ LOADING STATE
  // ===============================
  if (loading) {
    return <h2 style={{ textAlign: 'center' }}>Loading...</h2>
  }

  if (dataError) {
    return <h2 style={{ textAlign: 'center', color: '#b91c1c' }}>{dataError}</h2>
  }

  // ===============================
  // 🔐 LOGIN PAGE
  // ===============================
  if (!session.isLoggedIn) {
    return (
      <AuthGateway
        onLogin={handleLogin}
        loginError={authError}
        loginLoading={authLoading}
        onClearLoginError={() => setAuthError('')}
      />
    )
  }

  // ===============================
  // 👨‍🏫 TEACHER VIEW
  // ===============================
  if (session.role === 'teacher') {
    if (view === 'grade') {
      return (
        <GradePanel
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          submissions={teacherVisibleSubmissions}
          onGradeSubmission={handleGradeSubmission}
        />
      )
    }

    return (
      <TeacherDashboard
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onPublishAssignment={handlePublishAssignment}
        onUpdateAssignment={handleUpdateAssignment}
        onDeleteAssignment={handleDeleteAssignment}
        submissions={teacherVisibleSubmissions}
        onGradeSubmission={handleGradeSubmission}
        assignments={teacherVisibleAssignments}
        user={session.user}
        requestState={actionLoading}
        requestError={actionError}
      />
    )
  }

  // ===============================
  // 🎓 STUDENT VIEW
  // ===============================
  if (view === 'submit') {
    return (
      <SubmitAssignment
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        assignments={assignments}
        onSubmitAssignment={handleStudentSubmit}
      />
    )
  }

  return (
    <StudentDashboard
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      assignments={assignments}
      submissions={submissions}
      onSubmitAssignment={handleStudentSubmit}
      user={session.user}
      submitLoading={actionLoading.submit}
      requestError={actionError}
    />
  )
}