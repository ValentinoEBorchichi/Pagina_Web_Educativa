import React from 'react';

const Institucion = () => {
  return (
    <section className="section institucion" id="institucion">
      <div className="container">
        <h2 className="section-title fade-in">Nuestra Institución</h2>
        <p className="section-sub fade-in">Somos un centro educativo de gestión privada con <strong>jornada extendida</strong>, ubicado en las afueras de Resistencia, Chaco. Nos enfocamos en brindar una educación de calidad y desarrollo integral, formando ciudadanos críticos, creativos y comprometidos con su comunidad.</p>

        <div className="inst-cards">
          <div className="inst-card fade-in">
            <div className="inst-card-img">
              <img src="https://plus.unsplash.com/premium_photo-1663050763436-818382a24bb8?q=80&w=600&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Niveles educativos" />
            </div>
            <div className="inst-card-body">
              <h3>📚 Nivel Inicial · Primario · Secundario</h3>
              <p>Cobertura educativa completa desde los primeros años hasta la finalización del nivel medio, con propuestas pedagógicas innovadoras.</p>
            </div>
          </div>
          <div className="inst-card fade-in" style={{ transitionDelay: '.1s' }}>
            <div className="inst-card-img">
              <img src="https://images.unsplash.com/photo-1562774053-701939374585?w=600&q=80" alt="Instalaciones modernas" />
            </div>
            <div className="inst-card-body">
              <h3>🏊 Instalaciones Modernas</h3>
              <p>Pileta de natación, laboratorios equipados, biblioteca, comedor, enfermería y amplios espacios verdes para el desarrollo pleno.</p>
            </div>
          </div>
          <div className="inst-card fade-in" style={{ transitionDelay: '.2s' }}>
            <div className="inst-card-img">
              <img src="https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=600&q=80" alt="Actividades deportivas" />
            </div>
            <div className="inst-card-body">
              <h3>⚽ Actividades Deportivas y Culturales</h3>
              <p>Fútbol, natación, atletismo, música, teatro y artes visuales. Una formación integral que trasciende el aula.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Institucion;
