# REGLAS ESTRICTAS DE ARQUITECTURA
1. NO generar archivos innecesarios en la raíz.
2. Trabajar SIEMPRE respetando la estructura existente: usar la carpeta `backend/` para Node.js/SQL y la carpeta `frontend/` para HTML/JS/CSS.
3. NO romper el diseño actual del frontend ni reescribir la web desde cero. Solo inyectar lógica de fetch().
4. Mantener la documentación al día: actualizar siempre el `README.md` de la raíz con los nuevos endpoints y el modelo de BD.

# CONTEXTO DEL PROYECTO
Sistema de Gestión ERP: "Educar para Transformar"
Integrantes: Valentino Borchichi y Sebastián Flores.
Arquitectura: Cliente-Servidor Multicapa. 
Frontend: HTML5, CSS3, JavaScript Vanilla. 
Backend: Node.js, Express. 
Base de Datos: Microsoft SQL Server.

# REQUERIMIENTOS FUNCIONALES (Reglas de Negocio)
- RF-01: Control de acceso por roles (Administrador, Docente, Alumno, Padre).
- RF-02 / RF-04: Gestión exclusiva de hijos asociados al padre. Un alumno pertenece a un único curso.
- RF-05: Alta de profesores y asignación a materias/cursos.
- RF-06: Límite estricto de máximo 2 actividades deportivas por alumno.
- RF-07: Bloqueo de inscripción deportiva si hay superposición/conflicto de horarios.
- RF-08 / RF-09: Inscripción a comedor y transporte (selección obligatoria entre 4 recorridos).

# ORGANIZACIÓN DEL TRABAJO
SPRINT 1 (Responsable: Valentino):
Implementar accesos (RF-01), límite de 2 deportes (RF-06) y control de superposición horaria (RF-07).

SPRINT 2 (Responsable: Sebastián):
Implementar vista de padres (RF-02), logística de transporte obligatorio (RF-09) y registro docente (RF-05).