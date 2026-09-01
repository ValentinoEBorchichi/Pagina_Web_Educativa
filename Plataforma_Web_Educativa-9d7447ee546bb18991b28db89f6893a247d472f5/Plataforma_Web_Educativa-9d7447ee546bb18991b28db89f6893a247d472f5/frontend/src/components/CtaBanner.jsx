import React from 'react';

const CtaBanner = () => {
  return (
    <div className="cta-banner">
      <h2>¡Inscripciones 2027 Abiertas!</h2>
      <p>Asegurá el lugar de tu hijo/a en nuestra institución. Vacantes limitadas en todos los niveles.</p>
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
        <a href="#preinscripcion" className="btn-hero btn-hero-orange">📋 Preinscribirse Ahora</a>
        <a href="#servicios" className="btn-hero btn-hero-outline">Conocer Más Servicios</a>
      </div>
    </div>
  );
};

export default CtaBanner;
