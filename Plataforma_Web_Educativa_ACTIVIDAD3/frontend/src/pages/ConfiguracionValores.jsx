import React, { useState } from 'react';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';

const valoresIniciales = {
    cuota: '',
    deporte: '',
    transporte: '',
    comedor: '',
    vigencia: ''
};

const inputStyle = {
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '0.9rem',
    outline: 'none',
    width: '100%'
};

const ConfiguracionValores = () => {
    const [valores, setValores] = useState(valoresIniciales);
    const [mensaje, setMensaje] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const { apiFetch } = useAuth();

    const handleChange = ({ target }) => {
        setValores((actuales) => ({ ...actuales, [target.name]: target.value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setMensaje(null);
        setGuardando(true);

        try {
            const tarifas = [
                ['cuota', valores.cuota],
                ['deporte', valores.deporte],
                ['transporte', valores.transporte],
                ['comedor', valores.comedor]
            ];

            const respuestas = await Promise.all(tarifas.map(([tipo_servicio, monto]) => apiFetch(
                `${API_URL}/api/admin/tarifas`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tipo_servicio, monto: Number(monto), vigencia: valores.vigencia })
                }
            )));

            if (respuestas.every((respuesta) => respuesta.status === 201)) {
                setValores(valoresIniciales);
                setMensaje({ tipo: 'ok', texto: 'Valores configurados correctamente.' });
            } else {
                setMensaje({ tipo: 'error', texto: 'No se pudieron guardar todos los valores.' });
            }
        } catch (error) {
            setMensaje({ tipo: 'error', texto: 'Error de conexión con el servidor.' });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <section style={{ background: 'var(--white)', padding: '24px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)' }}>
            <h2 style={{ marginTop: 0 }}>Configuración de valores</h2>

            {mensaje && (
                <div role="alert" style={{
                    marginBottom: '16px',
                    padding: '14px',
                    borderRadius: '12px',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    background: mensaje.tipo === 'ok' ? '#dcfce7' : '#fee2e2',
                    color: mensaje.tipo === 'ok' ? '#166534' : '#dc2626',
                    border: `1px solid ${mensaje.tipo === 'ok' ? '#bbf7d0' : '#fecaca'}`
                }}>
                    {mensaje.texto}
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <label>
                    Cuota mensual
                    <input name="cuota" type="number" min="0.01" step="0.01" value={valores.cuota} onChange={handleChange} required style={inputStyle} />
                </label>
                <label>
                    Deportes
                    <input name="deporte" type="number" min="0.01" step="0.01" value={valores.deporte} onChange={handleChange} required style={inputStyle} />
                </label>
                <label>
                    Transporte (4 recorridos)
                    <input name="transporte" type="number" min="0.01" step="0.01" value={valores.transporte} onChange={handleChange} required style={inputStyle} />
                </label>
                <label>
                    Comedor
                    <input name="comedor" type="number" min="0.01" step="0.01" value={valores.comedor} onChange={handleChange} required style={inputStyle} />
                </label>
                <label>
                    Fecha de vigencia
                    <input name="vigencia" type="date" value={valores.vigencia} onChange={handleChange} required style={inputStyle} />
                </label>
                <button type="submit" className="btn btn-violet" disabled={guardando} style={{ alignSelf: 'end', height: '45px' }}>
                    {guardando ? 'Guardando...' : 'Guardar valores'}
                </button>
            </form>
        </section>
    );
};

export default ConfiguracionValores;
