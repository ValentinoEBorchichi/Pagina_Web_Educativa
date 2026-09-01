import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const toggleMenu = () => setIsOpen(!isOpen);

  useEffect(() => {
    // Scrollspy: marca como activa la sección visible debajo del header sticky.
    // El offset se calcula con la altura real del header para que la categoría
    // resaltada coincida con la sección a la que apunta, también al hacer scroll.
    // Nota: 'preinscripcion' no está en el menú, así que no se lista (Idiomas
    // queda resaltado hasta que aparece el footer = Contacto).
    const ids = ['institucion', 'niveles', 'servicios', 'noticias', 'idiomas'];

    const handleScroll = () => {
      const header = document.querySelector('.topbar');
      const offset = (header ? header.offsetHeight : 80) + 24;

      // Si estamos arriba de todo, la categoría activa es "Inicio" ('').
      if (window.scrollY < 80) {
        setActiveSection('');
        return;
      }

      // Desde la sección Preinscripción hacia abajo (CTA y footer) marcamos
      // "Contacto" y se mantiene resaltado hasta el final de la página.
      const preins = document.getElementById('preinscripcion');
      if (preins && window.scrollY >= preins.offsetTop - offset) {
        setActiveSection('contacto');
        return;
      }

      // Elegimos la sección por su posición real en la página: de todas las que
      // ya pasaron bajo el header, la que esté más abajo (mayor offsetTop).
      // Esto evita que el orden del menú (Actividades antes que Idiomas) choque
      // con el orden del DOM (la sección Idiomas está físicamente antes).
      let current = '';
      let maxTop = -Infinity;
      ids.forEach((id) => {
        const sec = document.getElementById(id);
        if (sec && window.scrollY >= sec.offsetTop - offset && sec.offsetTop > maxTop) {
          current = id;
          maxTop = sec.offsetTop;
        }
      });
      setActiveSection(current);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const handleLogout = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (window.confirm('¿Estás seguro de que deseas cerrar la sesión?')) {
      logout();
      setIsOpen(false);
      navigate('/');
    }
  };

  return (
    <header className="topbar" style={{ background: 'linear-gradient(to right, #f8fafc, #eff6ff)', borderBottom: '2px solid var(--blue-lt)' }}>
      <div className="topbar-inner">
        {/* Logo */}
        <a href="/" className="logo" style={{ marginLeft: '-12px' }}>
          <div className="logo-icon" style={{ width: '70px', height: '70px' }}>
            <img src="/img/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div className="logo-text">
            <span style={{ fontSize: '1.2rem', fontFamily: 'Playfair Display, serif', fontWeight: 900, lineHeight: 1.3 }}>EDUCAR</span>
            <span style={{ fontSize: '0.7rem', fontFamily: 'Playfair Display, serif', fontWeight: 800, lineHeight: 1.3 }}>Para Transformar</span>
          </div>
        </a>

        {/* Nav Desktop */}
        <nav>
          <a href="/" className={activeSection === '' ? 'active' : ''}>Inicio</a>
          <a href="#institucion" className={activeSection === 'institucion' ? 'active' : ''}>Nosotros</a>
          <a href="#niveles" className={activeSection === 'niveles' ? 'active' : ''}>Niveles Educativos</a>
          <a href="#servicios" className={activeSection === 'servicios' ? 'active' : ''}>Servicios</a>
          <a href="#noticias" className={activeSection === 'noticias' ? 'active' : ''}>Actividades</a>
          <a href="#idiomas" className={activeSection === 'idiomas' ? 'active' : ''}>Idiomas</a>
          <a href="#contacto" className={activeSection === 'contacto' ? 'active' : ''}>Contacto</a>
        </nav>

        {/* Buttons */}
        <div className="topbar-btns">
          {!user ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Link to="/login?role=padre" className="btn btn-green" style={{ fontSize: '0.8rem', padding: '10px 18px' }}>👨‍👩‍👧 Padres</Link>
              <Link to="/login?role=alumno" className="btn btn-violet" style={{ fontSize: '0.8rem', padding: '10px 18px' }}>🎒 Alumnos</Link>
              <Link to="/login?role=docente" className="btn btn-blue" style={{ fontSize: '0.8rem', padding: '10px 18px' }}>👨‍🏫 Docentes</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, color: 'var(--blue)', fontSize: '0.8rem', marginRight: '8px' }}>Hola, {user.nombre}</span>
              <Link to={`/${user.rol}`} className="btn btn-violet" style={{ fontSize: '0.75rem', padding: '6px 12px' }}>Mi Panel</Link>
              <button onClick={handleLogout} className="btn" style={{ background: 'white', color: 'var(--text)', fontSize: '0.75rem', padding: '6px 12px', border: '1px solid #e2e8f0' }}>Salir</button>
            </div>
          )}
          <div className="hamburger" id="menuBtn" onClick={toggleMenu}>
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
      {/* Mobile Nav */}
      <nav className={`mobile-nav ${isOpen ? 'open' : ''}`} id="mobileNav">
        <a href="/" onClick={() => setIsOpen(false)}>Inicio</a>
        <a href="#institucion" onClick={() => setIsOpen(false)}>Nosotros</a>
        <a href="#niveles" onClick={() => setIsOpen(false)}>Niveles Educativos</a>
        <a href="#servicios" onClick={() => setIsOpen(false)}>Servicios</a>
        <a href="#noticias" onClick={() => setIsOpen(false)}>Actividades</a>
        <a href="#idiomas" onClick={() => setIsOpen(false)}>Idiomas</a>
        <a href="#contacto" onClick={() => setIsOpen(false)}>Contacto</a>
        {user && <a href="#" onClick={handleLogout}>Cerrar Sesión</a>}
      </nav>
    </header>
  );
};

export default Navbar;
