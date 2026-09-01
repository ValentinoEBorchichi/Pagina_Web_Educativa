import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegistroPage from './pages/RegistroPage';
import AdminDashboard from './pages/AdminDashboard';
import AlumnoDashboard from './pages/AlumnoDashboard';
import PadreDashboard from './pages/PadreDashboard';
import DocenteDashboard from './pages/DocenteDashboard';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegistroPage />} />
          
          {/* Dashboards */}
          <Route path="/admin" element={
            <ProtectedRoute roles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/docente" element={
            <ProtectedRoute roles={['docente']}>
              <DocenteDashboard />
            </ProtectedRoute>
          } />
          <Route path="/alumno" element={
            <ProtectedRoute roles={['alumno']}>
              <AlumnoDashboard />
            </ProtectedRoute>
          } />
          <Route path="/padre" element={
            <ProtectedRoute roles={['padre']}>
              <PadreDashboard />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
