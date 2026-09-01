import { API_URL } from '../config';
import React, { createContext, useState, useContext, useEffect, useRef } from 'react';

const AuthContext = createContext();

// Tiempo de inactividad permitido antes de cerrar la sesión (30 minutos).
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const inactivityTimer = useRef(null);

    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        if (savedUser && token) {
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);

    // Cierre de sesión automático tras 30 minutos de inactividad.
    // El temporizador se reinicia con cualquier interacción del usuario.
    useEffect(() => {
        if (!user) return;

        const cerrarPorInactividad = () => {
            logout();
            alert('Tu sesión se cerró por inactividad. Iniciá sesión nuevamente.');
        };

        const reiniciarTemporizador = () => {
            if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
            inactivityTimer.current = setTimeout(cerrarPorInactividad, INACTIVITY_LIMIT_MS);
        };

        const eventos = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
        eventos.forEach(ev => window.addEventListener(ev, reiniciarTemporizador));
        reiniciarTemporizador();

        return () => {
            if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
            eventos.forEach(ev => window.removeEventListener(ev, reiniciarTemporizador));
        };
    }, [user]);

    const login = async (username, password) => {
        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                setUser(data.user);
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                return { success: true };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            return { success: false, message: 'Error de conexión con el servidor' };
        }
    };

    const registrar = async (nombre, email, password) => {
        try {
            const response = await fetch(`${API_URL}/api/auth/registro`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            return { success: false, message: 'Error de conexión con el servidor' };
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    };

    // Wrapper de fetch que adjunta el JWT y cierra la sesión automáticamente si el token expiró.
    const apiFetch = async (url, options = {}) => {
        const token = localStorage.getItem('token');
        const headers = {
            ...(options.headers || {}),
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) {
            logout();
        }
        return response;
    };

    return (
        <AuthContext.Provider value={{ user, login, registrar, logout, loading, apiFetch }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
