## 🛠️ Fase 1: Infraestructura y Comunicaciones

### 1.1 Configuración de Servidor de Correo

Se debe actualizar el cliente de correo del sistema (PHPMailer, Nodemailer o el servicio nativo del framework) con las nuevas credenciales:

- **SMTP (Envío):** `mail.kikoto.es` | **Puerto:** 465 | **Protocolo:** SSL/TLS
- **IMAP (Recepción):** `mail.kikoto.es` | **Puerto:** 993
- **Usuario:** `noreply@kikoto.es`
- **Password:** `powwar-fEbfex-0zywvu`

### 1.2 Integración de API Kikoto

- **Objetivo:** Sincronizar las rutas disponibles en tiempo real.
- **Acción:** Desarrollar el middleware para conectar con el endpoint de rutas de Kikoto y mapear la respuesta a los selectores de origen/destino del frontend.

---

## 🏗️ Fase 2: Lógica de Negocio y Flujo de Reserva

### 2.1 Reestructuración del Embudo de Venta (Booking Flow)

- **Punto de Entrada:** Al iniciar una reserva, el foco automático debe estar en **Ciudad de Origen**, eliminando el salto automático a la selección de fecha.
- **Tipos de Viaje:** Renombrar y limitar opciones a:
    1. **Ida**
    2. **Ida y vuelta**
- **Gestión de Vehículos:** En el selector de vehículos, añadir un input numérico (counter) para permitir elegir la **cantidad de vehículos** antes de proceder.

### 2.2 Validación de Pasajeros Frecuentes

- **Lógica Anti-Duplicados:** Implementar un check en la base de datos/API. Si el `ID` o `Documento` del pasajero ya existe en la lista de "Pasajeros Frecuentes":
    - Ocultar el botón/checkbox "Añadir como pasajero frecuente" en el formulario de registro.
    - Ocultar la opción en el resumen final.

### 2.3 Registro de Pasajeros Múltiples

- **Dinamicidad:** Permitir la adición de N pasajeros de forma dinámica, solicitando los datos obligatorios (Nombre, DNI/Pasaporte, etc.) para cada uno antes de cerrar el viaje.

---

## 💾 Fase 3: Gestión de Datos y CRUD

### 3.1 Entidad Vehículos

- **Nuevo Campo:** Añadir la columna `matricula` (String) en la tabla de vehículos y en el formulario de registro/edición.

### 3.2 Acciones Globales y Facturación

- **CRUD Completo:** Habilitar las funciones de **Borrar** y **Editar** en todas las entidades del sistema (Pasajeros, Vehículos, Rutas).
- **Estados de Factura:** Implementar un selector en el panel de administración para cambiar el estado de las facturas (ej: *Pendiente, Pagada, Anulada*).

---

## 👁️ Fase 4: Experiencia de Usuario (UX) y Resúmenes

### 4.1 Visibilidad de Trayectos (Round-trip Data)

En viajes de "Ida y vuelta", es obligatorio mostrar la información desglosada de ambos trayectos en:

1. Formulario de registro.
2. Pantalla de resumen de compra.
3. Sección "Mis Viajes" (Historial).

### 4.2 Interacción en Historial

- Al hacer clic en cualquier ítem del apartado "Viajes", se debe desplegar un **modal o vista de detalle** con el resumen completo de esa transacción específica.

---

## 🎨 Fase 5: Cambios Estéticos y Branding

### 5.1 Rediseño de Componentes (UI)

Se requiere aplicar estilos CSS personalizados a los siguientes elementos para mejorar la coherencia visual:

- `Select` de fecha de origen y destino.
- `Select` de usuario frecuente.
- `Select` de vehículo.

### 5.2 Limpieza de Interfaz

- **Login:** Eliminar el selector de idioma (Español) de la pantalla de acceso.

### 5.3 Actualización de Identidad Visual

- **Sustitución Global de Logo:** Reemplazar el archivo de imagen del logo en:
    - Header y Footer.
    - Plantillas de Email.
    - Generador de PDF (Facturas/Tickets).
    - Favicon.