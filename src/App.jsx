import React, { useEffect, useState } from 'react'
import AuthGateway from './pages/AuthGateway'
import StudentDashboard from './pages/StudentDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import SubmitAssignment from './pages/SubmitAssignment'
import GradePanel from './pages/GradePanel'
import api, { uploadFile, toApiPath } from './config/api'

export default function App() {

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

  const [session, setSession] = useState({
    isLoggedIn: false,
    role: 'student',
    user: { fullName: '', userId: '', email: '', subject: '' }
  })

  const [view, setView] = useState('dashboard')
  const [assignments, setAssignments] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)

  // ===============================
  // 📥 FETCH ASSIGNMENTS
  // ===============================
  useEffect(() => {
    api.get('/assignments')
      .then(({ data }) => {
        setAssignments(data.map(mapAssignment))
        setLoading(false)
      })
      .catch(err => {
        console.error("Error fetching assignments:", err)
        setLoading(false)
      })
  }, [])

  // ===============================
  // 📥 FETCH SUBMISSIONS
  // ===============================
  useEffect(() => {
    api.get('/submissions')
      .then(({ data }) => setSubmissions(data.map(mapSubmission)))
      .catch(err => console.error("Error fetching submissions:", err))
  }, [])

  // ===============================
  // 🔐 LOGIN (BACKEND CONNECTED)
  // ===============================
  const handleLogin = async (credentials) => {
    try {
      const { data } = await api.post('/auth/login', credentials)
      const normalizedRole = String(data.role || '').toLowerCase()
      setSession({
        isLoggedIn: true,
        role: normalizedRole,
        user: {
          fullName: data.fullName,
          userId: data.userId,
          email: data.email,
          subject: data.subject
        }
      })
      setView('dashboard')

    } catch (err) {
      alert(err.message || 'Login failed')
      console.error("Login error:", err)
    }
  }

  // ===============================
  // 🚪 LOGOUT
  // ===============================
  const handleLogout = () => {
    setSession({
      isLoggedIn: false,
      role: 'student',
      user: { fullName: '', userId: '', email: '', subject: '' }
    })
    setView('dashboard')
  }

  const handleNavigate = (nextView) => {
    if (nextView) setView(nextView)
  }

  // ===============================
  // ➕ ADD ASSIGNMENT
  // ===============================
  const handlePublishAssignment = async (assignment) => {
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

      const { data } = await api.post('/assignments', payload)
      setAssignments(prev => [mapAssignment(data), ...prev])
      return true

    } catch (err) {
      console.error("Error adding assignment:", err)
      return false
    }
  }

  // ===============================
  // ✏ UPDATE ASSIGNMENT
  // ===============================
  const handleUpdateAssignment = async (updatedAssignment) => {
    try {
      const payload = {
        title: updatedAssignment.title,
        dueDate: updatedAssignment.dueDate,
        subject: updatedAssignment.subject,
        points: Number(updatedAssignment.points || 100),
        teacherId: session.user.userId,
        attachmentFileName: updatedAssignment.attachmentFileName || ''
      }
      const { data } = await api.put(`/assignments/${updatedAssignment.id}`, payload)

      setAssignments(prev =>
        prev.map(item => item.id === data.id ? mapAssignment(data) : item)
      )

    } catch (err) {
      console.error("Error updating assignment:", err)
    }
  }

  // ===============================
  // ❌ DELETE ASSIGNMENT
  // ===============================
  const handleDeleteAssignment = async (assignmentId) => {
    try {
      await api.delete(`/assignments/${assignmentId}`)

      setAssignments(prev =>
        prev.filter(item => item.id !== assignmentId)
      )

    } catch (err) {
      console.error("Error deleting assignment:", err)
    }
  }

  // ===============================
  // 📤 SUBMIT ASSIGNMENT (BACKEND)
  // ===============================
  const handleStudentSubmit = async (id, file) => {
    if (!file) return

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

      const { data } = await api.post('/submissions', newSubmission)
      setSubmissions(prev => [mapSubmission(data), ...prev])

    } catch (err) {
      console.error("Error submitting assignment:", err)
    }
  }

  // ===============================
  // 🎓 GRADE SUBMISSION
  // ===============================
  const handleGradeSubmission = async (id, grade, feedback) => {
    try {
      const { data } = await api.put(`/submissions/${id}`, { grade, feedback, status: "graded" })

      setSubmissions(prev =>
        prev.map(item =>
          item.id === id ? mapSubmission(data) : item
        )
      )

    } catch (err) {
      console.error("Error grading submission:", err)
    }
  }

  // ===============================
  // ⏳ LOADING STATE
  // ===============================
  if (loading) {
    return <h2 style={{ textAlign: 'center' }}>Loading...</h2>
  }

  // ===============================
  // 🔐 LOGIN PAGE
  // ===============================
  if (!session.isLoggedIn) {
    return <AuthGateway onLogin={handleLogin} />
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
          submissions={submissions}
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
        submissions={submissions}
        onGradeSubmission={handleGradeSubmission}
        assignments={assignments}
        user={session.user}
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
    />
  )
}