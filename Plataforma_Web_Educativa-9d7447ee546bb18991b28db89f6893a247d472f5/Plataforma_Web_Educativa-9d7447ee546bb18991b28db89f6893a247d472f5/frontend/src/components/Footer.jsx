import React from 'react';

// Destinos reales de las redes/enlaces institucionales. Se pueden reemplazar por
// los perfiles oficiales del colegio cuando existan.
const REDES = {
  facebook: 'https://www.facebook.com/UTN.FRRe',
  instagram: 'https://www.instagram.com/utn.frre',
  youtube: 'https://www.youtube.com/@utnfrre',
  twitter: 'https://x.com/utnfrre',
  utn: 'https://www.frre.utn.edu.ar/',
};

const Footer = () => {
  return (
    <footer id="contacto">
      <div className="footer-grid">
        {/* Contacto */}
        <div className="footer-col">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <div className="logo-icon" style={{ width: '44px', height: '44px', fontSize: '1.3rem' }}>🎓</div>
            <div className="logo-text">
              <span style={{ color: '#fff', fontSize: '1rem' }}>EDUCAR</span>
              <span style={{ color: 'var(--green)', fontSize: '.85rem' }}>Para Transformar</span>
            </div>
          </div>
          <p style={{ fontSize: '.87rem', lineHeight: '1.8', marginBottom: '16px' }}>Centro educativo privado de jornada extendida. Formando el futuro desde el Nivel Inicial hasta el Secundario.</p>
          <div className="footer-contact-item"><span className="icon">📍</span><span>C. French 414, Resistencia, Chaco</span></div>
          <div className="footer-contact-item"><span className="icon">📞</span><span>Te: (0362) 443-2683</span></div>
          <div className="footer-contact-item"><span className="icon">✉️</span><span>info@educartransformar.edu.ar</span></div>
        </div>

        {/* Enlaces */}
        <div className="footer-col">
          <h4>Enlaces Rápidos</h4>
          <ul>
            <li><a href="/">• Inicio</a></li>
            <li><a href="#institucion">• Nosotros</a></li>
            <li><a href="#niveles">• Niveles Educativos</a></li>
            <li><a href="#servicios">• Servicios</a></li>
            <li><a href="#noticias">• Actividades</a></li>
            <li><a href="#idiomas">• Idiomas</a></li>
            <li><a href="#preinscripcion">• Inscripciones</a></li>
          </ul>
        </div>

        {/* Redes Sociales */}
        <div className="footer-col">
          <h4>Redes Sociales</h4>
          <ul style={{ marginBottom: '16px' }}>
            <li><a href={REDES.facebook} target="_blank" rel="noopener noreferrer">• Facebook</a></li>
            <li><a href={REDES.instagram} target="_blank" rel="noopener noreferrer">• Instagram</a></li>
            <li><a href={REDES.youtube} target="_blank" rel="noopener noreferrer">• YouTube</a></li>
            <li><a href={REDES.twitter} target="_blank" rel="noopener noreferrer">• Twitter / X</a></li>
            <li><a href={REDES.utn} target="_blank" rel="noopener noreferrer">• UTN FRRe</a></li>
          </ul>
          <div className="social-icons">
            <a className="social-icon" href={REDES.facebook} target="_blank" rel="noopener noreferrer" title="Facebook">f</a>
            <a className="social-icon" href={REDES.twitter} target="_blank" rel="noopener noreferrer" title="Twitter / X">𝕏</a>
            <a className="social-icon" href={REDES.instagram} target="_blank" rel="noopener noreferrer" title="Instagram">📷</a>
            <a className="social-icon" href={REDES.youtube} target="_blank" rel="noopener noreferrer" title="YouTube">▶</a>
          </div>
        </div>

        {/* Acceso Plataforma */}
        <div className="footer-col">
          <h4>Acceso Plataforma</h4>
          <p style={{ marginBottom: '14px', fontSize: '.85rem' }}>Ingresá a tu espacio personal para gestionar información académica.</p>
          <div className="footer-btns">
            <a href="/login?role=padre" className="footer-btn footer-btn-green">👨‍👩‍👧 Acceso Padres</a>
            <a href="/login?role=alumno" className="footer-btn footer-btn-outline">🎒 Acceso Alumnos</a>
            <a href="/login?role=docente" className="footer-btn footer-btn-outline">👨‍🏫 Acceso Docentes</a>
          </div>
        </div>
      </div>

      <div className="footer-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>© 2026 Educar para Transformar. Todos los derechos reservados.</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <span style={{ fontSize: '0.75rem' }}>Diseñado para apertura Marzo 2027 · Resistencia, Chaco, Argentina</span>
          <a href="/login?role=admin" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textDecoration: 'none', fontWeight: 700 }}>Acceso Administrador</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
