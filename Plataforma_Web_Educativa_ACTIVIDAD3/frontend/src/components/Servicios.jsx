import React from 'react';

const Servicios = () => {
  return (
    <section className="section servicios" id="servicios">
      <div className="container">
        <h2 className="section-title fade-in">Ofrecemos</h2>
        <p className="section-sub fade-in">Servicios pensados para que las familias tengan tranquilidad y los estudiantes, las mejores condiciones para aprender.</p>

        <div className="servicios-grid">
          <div className="serv-card fade-in">
            <div className="serv-icon">🚌</div>
            <h3>Transporte Escolar</h3>
            <p>Servicio de micros propio, con rutas coordinadas y seguimiento en tiempo real para la tranquilidad de los padres.</p>
          </div>
          <div className="serv-card fade-in" style={{ transitionDelay: '.1s' }}>
            <div className="serv-icon">🍽️</div>
            <h3>Comedor</h3>
            <p>Menú equilibrado elaborado por nutricionistas, adaptado a las necesidades de cada etapa educativa.</p>
          </div>
          <div className="serv-card fade-in" style={{ transitionDelay: '.2s' }}>
            <div className="serv-icon">🔬</div>
            <h3>Laboratorios de Ciencias</h3>
            <p>Laboratorios equipados con tecnología actualizada para ciencias naturales, física, química e informática.</p>
          </div>
          <div className="serv-card fade-in" style={{ transitionDelay: '.3s' }}>
            <div className="serv-icon">🌐</div>
            <h3>Cursos de Idiomas</h3>
            <p>Inglés, Portugués y Francés con docentes especializados. Preparación para certificaciones internacionales.</p>
          </div>
          <div className="serv-card fade-in" style={{ transitionDelay: '.1s' }}>
            <div className="serv-icon">🏥</div>
            <h3>Enfermería</h3>
            <p>Servicio de enfermería permanente durante la jornada escolar con personal médico calificado.</p>
          </div>
          <div className="serv-card fade-in" style={{ transitionDelay: '.2s' }}>
            <div className="serv-icon">📚</div>
            <h3>Apoyo Estudiantil</h3>
            <p>Servicio de tutorías y acompañamiento pedagógico para reforzar aprendizajes y acompañar a cada alumno.</p>
          </div>
          <div className="serv-card fade-in" style={{ transitionDelay: '.3s' }}>
            <div className="serv-icon">🏊</div>
            <h3>Natación</h3>
            <p>Pileta propia con clases de natación en todos los niveles, a cargo de instructores certificados.</p>
          </div>
          <div className="serv-card fade-in" style={{ transitionDelay: '.4s' }}>
            <div className="serv-icon">💻</div>
            <h3>Plataforma Digital</h3>
            <p>Acceso a recursos educativos, calificaciones, comunicados y agenda escolar desde cualquier dispositivo.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Servicios;
