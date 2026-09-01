# Educar para Transformar - Plataforma Institucional

Sistema integral de gestión para el centro educativo "Educar para Transformar", desarrollado con una arquitectura moderna, modular y escalable.

## 🚀 Tecnologías Utilizadas

### Frontend
*   **React 19** + **Vite**: Interfaz de usuario rápida y reactiva.
*   **React Router 7**: Gestión de navegación y rutas protegidas.
*   **Context API**: Manejo de estado global y autenticación.
*   **CSS3 (Vanilla)**: Sistema de diseño personalizado, responsive y moderno.

### Backend
*   **Node.js** + **Express**: Servidor robusto para la API REST.
*   **SQLite**: Base de datos ligera y portátil para persistencia de datos.
*   **JWT (JSON Web Tokens)**: Autenticación segura y persistencia de sesión.
*   **Bcryptjs**: Cifrado de contraseñas de alta seguridad.

---

## 🛠️ Instalación y Ejecución

El proyecto se divide en dos carpetas principales: `frontend` y `backend`.

### 1. Configuración del Backend
```powershell
cd backend
npm install
node seed.js  # Solo la primera vez para crear usuarios de prueba
npm run dev
```
*El servidor correrá en `http://localhost:3000`*

### 2. Configuración del Frontend
```powershell
cd frontend
npm install
npm run dev
```
*La aplicación estará disponible en `http://localhost:5173`*

---

## 🔑 Credenciales de Demo

Para probar los diferentes roles y dashboards, utilice los siguientes usuarios:

| Rol | Usuario | Contraseña | Funcionalidad |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin` | `admin123` | Gestión de preinscripciones |
| **Docente** | `docente` | `docente123` | Carga de notas y agenda |
| **Alumno** | `alumno` | `alumno123` | Notas, horarios y avisos |
| **Padre** | `padre` | `padre123` | Seguimiento y cuotas |

---

## 📂 Arquitectura del Proyecto

*   `backend/src/`: Controladores, rutas y middlewares organizados modularmente.
*   `backend/database/`: Archivo SQLite para persistencia local.
*   `frontend/src/components/`: Componentes atómicos y layouts reutilizables.
*   `frontend/src/pages/`: Vistas principales y dashboards por rol.
*   `frontend/src/context/`: Lógica global de autenticación.

---

## ✨ Funcionalidades Destacadas
*   **Landing Page Modular:** Secciones institucionales con animaciones de entrada.
*   **Preinscripción Online:** Formulario funcional con validación y persistencia en DB.
*   **Autenticación JWT:** Sistema de seguridad con protección de rutas por roles.
*   **Dashboards Personalizados:** Experiencia única según el tipo de usuario.
*   **Diseño Responsive:** Adaptado para una navegación fluida en móviles, tablets y PC.

---
© 2026 Educar para Transformar. Todos los derechos reservados.
