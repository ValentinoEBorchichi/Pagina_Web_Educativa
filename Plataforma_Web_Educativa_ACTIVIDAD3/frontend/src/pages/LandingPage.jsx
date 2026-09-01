import React, { useEffect } from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import QuickAccess from '../components/QuickAccess';
import Institucion from '../components/Institucion';
import Niveles from '../components/Niveles';
import Servicios from '../components/Servicios';
import Idiomas from '../components/Idiomas';
import Noticias from '../components/Noticias';
import Preinscripcion from '../components/Preinscripcion';
import CtaBanner from '../components/CtaBanner';
import Footer from '../components/Footer';

const LandingPage = () => {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.12 }
    );

    document.querySelectorAll('.fade-in').forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <QuickAccess />
        <Institucion />
        <Niveles />
        <Servicios />
        <Noticias />
        <Idiomas />
        <Preinscripcion />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
};

export default LandingPage;
