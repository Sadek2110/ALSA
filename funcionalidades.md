# Cambios Estéticos y Funcionalidades

## 🎨 Fase 1: Cambios Estéticos y Branding

### 1.1 Rediseño de Componentes (UI)

Se requiere aplicar estilos CSS personalizados a los siguientes elementos para mejorar la coherencia visual:

Todos los `select` de la pagina web, cambiar el color del cuadro, del texto y del triangulo que indica que es un select.

## 2 Funcionalidades

### 2.1 Crud en todas las secciones ✅

COMPLETADO. Edición disponible en todas las secciones:
- Reservas: editar via modal (bloqueado si tiene vehículo asignado)
- Miembros: editar via modal
- Vehículos: editar via modal
- Facturas: editar via modal
- Localizadores: edición inline en tabla de Viajes

### 2.2 Poder elegir el numero de vehiculos ✅

COMPLETADO. En el paso 4 del wizard (datos del vehículo) hay un contador +/- para elegir entre 1 y 10 vehículos. El número se guarda en el campo `vehicle_count` de la reserva y se muestra en el modal de detalle.

### 2.3 Editar el resumen de los viajes

PENDIENTE. Requiere definir:
- Qué es el "resumen" de un viaje (¿descripción libre? ¿notas?)
- Qué es la "tabla de precios" (no existe aún en el sistema)

Una vez definido, se puede añadir el campo `notes` a la tabla `bookings` y mostrarlo/editarlo en el modal de edición de reservas.

## 3 Bugs corregidos

### 3.1 `demoSailings` no definida ✅
La función `demoSailings()` llamada en `/api/sailings` y `/api/timetables` no existía, causando ReferenceError. Ahora devuelve 5 navieras de demo con horarios escalonados.

### 3.2 Paso 5 del wizard nunca se mostraba ✅
`showWizStep5()` comprobaba `wz.passenger` (singular, inexistente) en lugar de `wz.passengers` (array). El paso de confirmación no se renderizaba nunca. Corregido.

### 3.3 Email de notificación hardcodeado ✅
El email de notificaciones de reserva estaba hardcodeado a `sadekjoud@gmail.com`. Ahora usa la variable de entorno `NOTIFICATION_EMAIL` (con fallback al valor anterior).
