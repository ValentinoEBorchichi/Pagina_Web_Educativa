import React, { useState, useEffect, useRef } from 'react';

const Idiomas = () => {
  // La animación de entrada la controla este componente con su propio observer,
  // para no depender del observer global de LandingPage (que es poco confiable
  // según el orden de las secciones y dejaba la sección en blanco).
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fade = (extra = '') => `fade-in ${visible ? 'visible' : ''} ${extra}`.trim();

  return (
    <section className="section" id="idiomas" style={{ background: 'var(--white)' }} ref={sectionRef}>
      <div className="container">
        <h2 className={`section-title ${fade()}`}>Departamento de Idiomas</h2>
        <p className={`section-sub ${fade()}`}>
          Formamos ciudadanos del mundo con un sólido dominio de lenguas extranjeras desde los primeros años.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: '24px',
            marginTop: '40px',
          }}
        >
          <div className={`serv-card ${fade()}`} style={{ borderTopColor: '#012169' }}>
            <div className="serv-icon" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <img
                src="https://flagcdn.com/w80/gb.png"
                alt="Bandera Reino Unido"
                style={{ width: '50px', height: '35px', objectFit: 'cover', borderRadius: '6px' }}
              />
            </div>
            <h3>Inglés</h3>
            <p>Programa intensivo desde Nivel Inicial. Preparación para exámenes.</p>
          </div>

          <div
            className={`serv-card ${fade()}`}
            style={{ borderTopColor: '#009c3b', transitionDelay: '.1s' }}
          >
            <div className="serv-icon" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <img
                src="https://flagcdn.com/w80/br.png"
                alt="Bandera Brasil"
                style={{ width: '50px', height: '35px', objectFit: 'cover', borderRadius: '6px' }}
              />
            </div>
            <h3>Portugués</h3>
            <p>
              Dado el contexto regional, el portugués es clave para la integración con
              el Mercosur y las oportunidades laborales.
            </p>
          </div>

          <div
            className={`serv-card ${fade()}`}
            style={{ borderTopColor: '#002395', transitionDelay: '.2s' }}
          >
            <div className="serv-icon" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <img
                src="https://flagcdn.com/w80/fr.png"
                alt="Bandera Francia"
                style={{ width: '50px', height: '35px', objectFit: 'cover', borderRadius: '6px' }}
              />
            </div>
            <h3>Francés</h3>
            <p>
              Formación en idioma francés con enfoque cultural y literario.
              Preparación para exámenes.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Idiomas;