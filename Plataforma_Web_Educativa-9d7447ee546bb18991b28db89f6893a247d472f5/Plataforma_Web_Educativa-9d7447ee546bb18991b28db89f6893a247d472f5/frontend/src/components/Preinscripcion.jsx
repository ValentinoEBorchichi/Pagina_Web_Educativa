import { API_URL } from '../config';
import React, { useState } from 'react';

// Validadores por campo. Devuelven '' si está OK o el mensaje de error.
// Se usan tanto en vivo (onChange/onBlur) como en el submit, de modo que el
// error de un campo aparece apenas se completa, sin necesidad de llenar todo.
// Un nombre válido solo tiene letras (con acentos/ñ), espacios y signos básicos
// de nombres (apóstrofo, punto, guion). No se aceptan números ni otros símbolos.
const NOMBRE_REGEX = /^[\p{L}\s'’.-]+$/u;

const validators = {
    alumno_nombre: (v) => {
        if (!v.trim()) return 'Ingresá el nombre completo del alumno.';
        if (!NOMBRE_REGEX.test(v.trim())) return 'El nombre solo puede contener letras (sin números ni símbolos).';
        return '';
    },
    alumno_dni: (v) => {
        if (!v.trim()) return 'El DNI es obligatorio.';
        if (!/^\d+$/.test(v.trim())) return 'El DNI debe ser estrictamente numérico (sin puntos ni letras).';
        return '';
    },
    alumno_edad: (v) => {
        if (v === '' || v === null) return 'Ingresá la edad.';
        const n = Number(v);
        if (isNaN(n)) return 'La edad debe ser un número.';
        if (n < 3 || n > 18) return 'La edad del alumno debe estar entre 3 y 18 años.';
        return '';
    },
    nivel: (v) => !v ? 'Seleccioná un nivel.' : '',
    turno: (v) => !v ? 'Seleccioná un turno.' : '',
    tutor_nombre: (v) => {
        if (!v.trim()) return 'Ingresá el nombre del tutor.';
        if (!NOMBRE_REGEX.test(v.trim())) return 'El nombre solo puede contener letras (sin números ni símbolos).';
        return '';
    },
    tutor_telefono: (v) => {
        if (!v.trim()) return 'El teléfono es obligatorio.';
        if (!/^\d+$/.test(v.trim())) return 'El teléfono debe contener solo números.';
        if (v.trim().length < 10) return 'El teléfono debe tener al menos 10 dígitos (incluyendo código de área).';
        return '';
    },
    tutor_email: (v) => {
        const val = v.trim();
        if (!val) return 'El correo es obligatorio.';
        // Mensajes específicos según el problema, como en el caso de prueba Test-009.
        if (!val.includes('@')) return `Incluí un signo @ en la dirección de correo. "${val}" no incluye @.`;
        const dominio = val.split('@')[1] || '';
        if (!dominio || !dominio.includes('.')) return 'Ingresá texto después del signo @; la dirección está incompleta.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'El correo electrónico no tiene un formato válido.';
        return '';
    },
    observaciones: () => ''
};

const Preinscripcion = () => {
    const [formData, setFormData] = useState({
        alumno_nombre: '',
        alumno_dni: '',
        alumno_edad: '',
        nivel: '',
        turno: '',
        tutor_nombre: '',
        tutor_telefono: '',
        tutor_email: '',
        observaciones: ''
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Valida un campo y actualiza su error en el acto (validación inline).
    const validateField = (name, value) => {
        const fn = validators[name];
        const error = fn ? fn(value) : '';
        setErrors((prev) => ({ ...prev, [name]: error }));
        return error;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        // Mientras el campo ya tiene un error marcado, lo re-evaluamos en vivo
        // para que desaparezca apenas el dato pase a ser válido.
        if (errors[name]) validateField(name, value);
    };

    // Al salir del campo (blur) mostramos su error si corresponde, sin esperar al submit.
    const handleBlur = (e) => {
        const { name, value } = e.target;
        validateField(name, value);
    };

    const validateAll = () => {
        const newErrors = {};
        Object.keys(validators).forEach((name) => {
            const err = validators[name](formData[name] ?? '');
            if (err) newErrors[name] = err;
        });
        setErrors(newErrors);
        return newErrors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        const validation = validateAll();
        if (Object.keys(validation).length > 0) {
            // Llevamos el foco al primer campo con error.
            const first = Object.keys(validation)[0];
            const el = document.querySelector(`[name="${first}"]`);
            if (el) el.focus();
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/preinscripciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                setMessage({ type: 'success', text: '¡Preinscripción enviada con éxito! Nos contactaremos pronto.' });
                setFormData({
                    alumno_nombre: '',
                    alumno_dni: '',
                    alumno_edad: '',
                    nivel: '',
                    turno: '',
                    tutor_nombre: '',
                    tutor_telefono: '',
                    tutor_email: '',
                    observaciones: ''
                });
                setErrors({});
            } else {
                setMessage({ type: 'error', text: data.message || 'Ocurrió un error al enviar el formulario.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error de conexión con el servidor.' });
        } finally {
            setLoading(false);
        }
    };

    // Estilo del input según tenga error o no (borde rojo para feedback inmediato).
    const fieldStyle = (name) => ({
        ...inputStyle,
        borderColor: errors[name] ? '#dc2626' : '#e2e8f0'
    });

    // Renderiza el mensaje de error inline justo debajo del campo.
    const FieldError = ({ name }) => errors[name] ? (
        <span style={errorTextStyle}>{errors[name]}</span>
    ) : null;

    return (
        <section className="section" id="preinscripcion" style={{ background: 'var(--bg)' }}>
            <div className="container">
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h2 className="section-title fade-in">Preinscripción 2027</h2>
                    <p className="section-sub fade-in" style={{ margin: '0 auto' }}>Completá el siguiente formulario para iniciar el proceso de admisión. Las vacantes se asignan por orden de llegada y disponibilidad por nivel.</p>
                </div>

                <div className="fade-in" style={{
                    background: 'var(--white)',
                    padding: '40px',
                    borderRadius: 'var(--radius)',
                    boxShadow: 'var(--shadow-sm)',
                    maxWidth: '800px',
                    margin: '0 auto'
                }}>
                    {message.text && (
                        <div style={{
                            padding: '16px',
                            borderRadius: '8px',
                            marginBottom: '24px',
                            textAlign: 'center',
                            fontWeight: '700',
                            backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
                            color: message.type === 'success' ? '#166534' : '#991b1b',
                            border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`
                        }}>
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} noValidate>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                            {/* Datos del Alumno */}
                            <div>
                                <h3 style={{ color: 'var(--blue)', marginBottom: '16px', fontSize: '1.1rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px' }}>Datos del Alumno</h3>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={labelStyle}>Nombre Completo</label>
                                    <input type="text" name="alumno_nombre" value={formData.alumno_nombre} onChange={handleChange} onBlur={handleBlur} style={fieldStyle('alumno_nombre')} placeholder="Nombre y Apellido" />
                                    <FieldError name="alumno_nombre" />
                                </div>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={labelStyle}>DNI (Sin puntos ni letras)</label>
                                    <input type="text" name="alumno_dni" value={formData.alumno_dni} onChange={handleChange} onBlur={handleBlur} style={fieldStyle('alumno_dni')} placeholder="Solo números" />
                                    <FieldError name="alumno_dni" />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={labelStyle}>Edad</label>
                                        <input type="number" min="3" max="18" name="alumno_edad" value={formData.alumno_edad} onChange={handleChange} onBlur={handleBlur} style={fieldStyle('alumno_edad')} placeholder="Ej: 6" />
                                        <FieldError name="alumno_edad" />
                                    </div>
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={labelStyle}>Nivel</label>
                                        <select name="nivel" value={formData.nivel} onChange={handleChange} onBlur={handleBlur} style={fieldStyle('nivel')}>
                                            <option value="">Elegir...</option>
                                            <option value="Inicial">Inicial</option>
                                            <option value="Primario">Primario</option>
                                            <option value="Secundario">Secundario</option>
                                        </select>
                                        <FieldError name="nivel" />
                                    </div>
                                </div>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={labelStyle}>Turno Preferente</label>
                                    <select name="turno" value={formData.turno} onChange={handleChange} onBlur={handleBlur} style={fieldStyle('turno')}>
                                        <option value="">Seleccionar turno</option>
                                        <option value="Mañana">Mañana</option>
                                        <option value="Tarde">Tarde</option>
                                        <option value="Jornada Extendida">Jornada Extendida</option>
                                    </select>
                                    <FieldError name="turno" />
                                </div>
                            </div>

                            {/* Datos del Tutor */}
                            <div>
                                <h3 style={{ color: 'var(--green)', marginBottom: '16px', fontSize: '1.1rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px' }}>Datos del Responsable</h3>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={labelStyle}>Nombre del Tutor</label>
                                    <input type="text" name="tutor_nombre" value={formData.tutor_nombre} onChange={handleChange} onBlur={handleBlur} style={fieldStyle('tutor_nombre')} placeholder="Nombre y Apellido" />
                                    <FieldError name="tutor_nombre" />
                                </div>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={labelStyle}>Teléfono de Contacto</label>
                                    <input type="tel" name="tutor_telefono" value={formData.tutor_telefono} onChange={handleChange} onBlur={handleBlur} style={fieldStyle('tutor_telefono')} placeholder="Ej: 3624123456" />
                                    <FieldError name="tutor_telefono" />
                                </div>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={labelStyle}>Correo Electrónico</label>
                                    <input type="email" name="tutor_email" value={formData.tutor_email} onChange={handleChange} onBlur={handleBlur} style={fieldStyle('tutor_email')} placeholder="ejemplo@correo.com" />
                                    <FieldError name="tutor_email" />
                                </div>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={labelStyle}>Observaciones (Opcional)</label>
                                    <textarea name="observaciones" value={formData.observaciones} onChange={handleChange} style={{ ...inputStyle, height: '100px', resize: 'none' }} placeholder="Alguna información relevante..."></textarea>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '32px', textAlign: 'center' }}>
                            <button type="submit" className="btn btn-hero btn-hero-orange" disabled={loading} style={{ width: '100%', maxWidth: '400px', justifyContent: 'center', gap: '10px' }}>
                                {loading ? (
                                    <>
                                        <div className="loader"></div>
                                        <span>Enviando...</span>
                                    </>
                                ) : 'Enviar Preinscripción'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </section>
    );
};

const labelStyle = { display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '0.85rem' };

const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit'
};

const errorTextStyle = {
    display: 'block',
    color: '#dc2626',
    fontSize: '0.78rem',
    fontWeight: 700,
    marginTop: '5px'
};

export default Preinscripcion;
