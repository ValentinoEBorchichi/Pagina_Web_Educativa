import React from 'react';

const Niveles = () => {
  return (
    <section className="section niveles" id="niveles">
      <div className="container">
        <h2 className="section-title fade-in">Niveles Educativos</h2>
        <p className="section-sub fade-in">Una propuesta educativa continua, articulada y de excelencia para cada etapa del crecimiento.</p>

        <div className="niveles-grid">
          <div className="nivel-card fade-in">
            <div className="nivel-card-bg" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600&q=80')" }}></div>
            <div className="nivel-card-overlay"></div>
            <div className="nivel-card-content">
              <h3>Nivel Inicial</h3>
              <p>Sala de 3, 4 y 5 años · Jornada extendida</p>
            </div>
          </div>
          <div className="nivel-card fade-in" style={{ transitionDelay: '.1s' }}>
            <div className="nivel-card-bg" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&q=80')" }}></div>
            <div className="nivel-card-overlay"></div>
            <div className="nivel-card-content">
              <h3>Nivel Primario</h3>
              <p>1° a 6° grado · Apoyo escolar incluido</p>
            </div>
          </div>
          <div className="nivel-card fade-in" style={{ transitionDelay: '.2s' }}>
            <div className="nivel-card-bg" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&q=80')" }}></div>
            <div className="nivel-card-overlay"></div>
            <div className="nivel-card-content">
              <h3>Nivel Secundario</h3>
              <p>1° a 5° año · Orientación en Ciencias y Humanidades</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Niveles;
