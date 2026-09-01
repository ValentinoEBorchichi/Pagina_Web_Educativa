import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const DashboardLayout = ({ title, children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        if (window.confirm('¿Estás seguro de que deseas cerrar la sesión?')) {
            logout();
            navigate('/');
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'Nunito, sans-serif' }}>
            {/* Header del Dashboard */}
            <header style={{ 
                background: 'linear-gradient(135deg, var(--blue) 0%, var(--blue-lt) 100%)', 
                padding: '12px 24px', 
                boxShadow: '0 4px 20px rgba(26,95,168,0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                color: 'white'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: 'white', padding: '4px', borderRadius: '10px' }}>
                        <img src="/img/logo.png" alt="Logo" style={{ height: '35px', display: 'block' }} />
                    </div>
                    <div>
                        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.3rem', color: 'white', margin: 0, letterSpacing: '0.02em' }}>{title}</h1>
                        <p style={{ fontSize: '0.65rem', margin: 0, fontWeight: 700, textTransform: 'uppercase', opacity: 0.8 }}>Gestión Institucional</p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0 }}>{user?.nombre}</p>
                        <p style={{ fontSize: '0.65rem', margin: 0, textTransform: 'uppercase', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{user?.rol}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => navigate('/')} className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', fontSize: '0.75rem', padding: '8px 16px' }}>Inicio</button>
                        <button onClick={handleLogout} className="btn" style={{ background: 'var(--orange)', color: 'white', fontSize: '0.75rem', padding: '8px 16px', boxShadow: '0 4px 10px rgba(245,130,13,0.3)' }}>Cerrar Sesión</button>
                    </div>
                </div>
            </header>

            {/* Contenido Principal */}
            <main style={{ padding: '32px 24px', maxWidth: '1200px', margin: '0 auto' }}>
                {children}
            </main>
        </div>
    );
};

export default DashboardLayout;
