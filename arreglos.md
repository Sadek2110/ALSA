
---

# Prompt para corregir errores en el flujo de reserva de la web

Necesito que revises y corrijas varios errores funcionales y de validación dentro del flujo de reserva de la página web, especialmente en la parte de **pasajeros, vehículos, conductores, formularios y resumen final de la reserva**.

El objetivo es evitar incoherencias en la reserva, mejorar la experiencia del usuario y añadir validaciones correctas en todos los campos del formulario.

## Contexto general

La web permite hacer una reserva añadiendo pasajeros, vehículos y asignando conductores a esos vehículos.

Actualmente existen varios fallos:

* Se puede asignar el mismo conductor a más de un vehículo.
* Aparecen vehículos en pasos donde no deberían mostrarse.
* Algunos errores o avisos aparecen lejos del campo donde se produce el problema.
* Los inputs permiten introducir datos inválidos.
* Si se elimina un pasajero que era conductor de un vehículo, el vehículo puede quedarse sin conductor en el resumen.

Necesito que corrijas estos comportamientos de forma robusta, tanto a nivel visual como a nivel lógico.

---

# Correcciones necesarias

## 1. Evitar que un conductor ya asignado aparezca disponible para otro vehículo

Cuando un pasajero ya esté asignado como conductor de un vehículo, no debe poder seleccionarse como conductor de otro vehículo.

### Comportamiento esperado

Si el pasajero “Juan Pérez” ya está vinculado como conductor del Vehículo 1, entonces al añadir o editar el Vehículo 2:

* “Juan Pérez” **no debe aparecer en el desplegable de conductores**.
* No basta con mostrar un aviso después.
* Directamente no debe estar disponible como opción seleccionable.

### Criterio de aceptación

* Un mismo pasajero no puede ser conductor de dos vehículos diferentes.
* El desplegable de conductores debe filtrar automáticamente los pasajeros ya asignados.
* Si se edita un vehículo, su conductor actual sí debe aparecer como opción válida para ese mismo vehículo.
* Si se elimina la asignación de un conductor, ese pasajero vuelve a estar disponible para otro vehículo.

---

## 2. Mostrar los avisos de error justo donde ocurre el fallo

Actualmente algunos mensajes de error aparecen en sitios incorrectos o demasiado alejados del campo que genera el problema.

### Comportamiento esperado

Cada error debe mostrarse junto al campo, selector, botón o bloque donde se ha producido.

Ejemplos:

* Error en el nombre → debajo del input de nombre.
* Error en documento/NIF/pasaporte → debajo del input de documento.
* Error al seleccionar conductor → debajo del selector de conductor.
* Error al añadir vehículo → dentro del bloque de vehículo o justo debajo del botón relacionado.
* Error de pasajero incompleto → dentro de la tarjeta o sección de ese pasajero.

### Criterio de aceptación

* El usuario debe entender inmediatamente qué campo debe corregir.
* No deben mostrarse errores genéricos al final de la página si el error pertenece a un campo concreto.
* Los mensajes deben ser claros, cortos y útiles.

Ejemplo:

```text
Introduce un nombre válido.
El número de documento no tiene un formato válido.
Este conductor ya está asignado a otro vehículo.
Selecciona un conductor para este vehículo.
```

---

## 3. Al pulsar “Añadir vehículo”, no mostrar vehículos ya añadidos en ese paso

Cuando el usuario pulsa en **Añadir vehículo**, si ya existe un vehículo añadido previamente en la reserva, ese vehículo no debe volver a aparecer como opción disponible en el nuevo paso.

### Comportamiento esperado

Si ya se ha añadido un coche, moto, furgoneta u otro vehículo a la reserva, al añadir otro vehículo:

* No debe aparecer el mismo vehículo ya añadido como opción duplicada.
* El sistema debe mostrar únicamente opciones válidas para añadir un nuevo vehículo.
* Si la reserva solo permite un vehículo, el botón “Añadir vehículo” debería ocultarse o deshabilitarse una vez añadido el primero.

### Criterio de aceptación

* No se pueden duplicar vehículos accidentalmente.
* No aparecen vehículos ya asignados en el selector de nuevo vehículo.
* El resumen de la reserva no debe contener vehículos duplicados salvo que la lógica de negocio lo permita expresamente.

---

## 4. Añadir validación completa a todos los inputs

Se deben validar todos los campos del formulario para evitar que el usuario introduzca datos incoherentes o inválidos.

### Campos a validar

Revisar todos los inputs del flujo de reserva, incluyendo como mínimo:

* Nombre.
* Apellidos.
* Fecha de nacimiento.
* Tipo de documento.
* Número de documento.
* Nacionalidad.
* Teléfono.
* Email.
* Matrícula.
* Marca del vehículo.
* Modelo del vehículo.
* Longitud/altura del vehículo, si aplica.
* Datos de mascota, si existen.
* Cualquier otro campo editable por el usuario.

---

## 5. Validación de nombre y apellidos

No debe permitirse introducir nombres o apellidos formados únicamente por números, símbolos o caracteres raros.

### Reglas recomendadas

El nombre y apellidos deben:

* Tener al menos 2 caracteres.
* No estar compuestos solo por números.
* No permitir caracteres extraños como `@`, `#`, `$`, `%`, `*`, `{}`, `[]`, etc.
* Permitir letras con tildes y caracteres habituales en nombres reales.
* Permitir espacios, guiones y apóstrofes cuando tenga sentido.

### Ejemplos válidos

```text
Daniel
María José
José-Luis
O'Connor
García López
```

### Ejemplos inválidos

```text
12345
111
@@@
Daniel123
%%%%
A
```

### Mensaje de error sugerido

```text
Introduce un nombre válido.
```

---

## 6. Validación del número de documento

El número de documento debe validarse según el tipo de documento seleccionado.

### Tipos posibles

Si existen varios tipos de documento, aplicar validación específica para cada uno:

* DNI.
* NIE.
* Pasaporte.
* Documento nacional extranjero, si aplica.

### Reglas mínimas

* No permitir campos vacíos si el documento es obligatorio.
* No permitir documentos demasiado cortos.
* No permitir documentos formados solo por símbolos.
* Normalizar espacios y mayúsculas.
* Validar formato de DNI/NIE español si el tipo seleccionado es DNI/NIE.

### Ejemplos

DNI válido:

```text
12345678Z
```

NIE válido:

```text
X1234567L
Y1234567X
Z1234567R
```

Pasaporte válido:

```text
AB123456
P1234567
```

Ejemplos inválidos:

```text
123
AAAA
@@@@@
123456789999999
```

### Mensaje de error sugerido

```text
Introduce un número de documento válido.
```

---

## 7. Validación de matrícula del vehículo

La matrícula del vehículo debe tener un formato razonable.

### Reglas recomendadas

* Eliminar espacios innecesarios.
* Convertir a mayúsculas.
* No permitir solo números si el país exige formato alfanumérico.
* No permitir símbolos raros.
* Validar formato español si corresponde.

### Ejemplos válidos España

```text
1234ABC
1234 ABC
```

### Ejemplos inválidos

```text
@@@@
123
ABC
123456789999
```

### Mensaje de error sugerido

```text
Introduce una matrícula válida.
```

---

## 8. Si se elimina un conductor, eliminar también el vehículo asociado

Actualmente, si se añade un vehículo con un conductor y posteriormente se elimina ese conductor/pasajero, el vehículo puede quedarse sin conductor.

Esto no debe ocurrir.

### Comportamiento esperado

Si el usuario elimina un pasajero que está asignado como conductor de un vehículo:

* El vehículo asociado debe eliminarse automáticamente de la reserva.
* No debe quedar un vehículo sin conductor.
* No debe aparecer un aviso molesto si el sistema ya resuelve el problema automáticamente.
* El resumen final no debe mostrar vehículos huérfanos, sin pasajero o sin conductor.

### Criterio de aceptación

Ejemplo:

1. Añado pasajero “Daniel”.
2. Añado vehículo “Coche” y asigno a Daniel como conductor.
3. Elimino al pasajero Daniel.
4. El sistema debe eliminar también el vehículo vinculado a Daniel.
5. En el resumen no debe aparecer ese vehículo.

### Importante

No quiero que simplemente aparezca un aviso diciendo que falta conductor.
Quiero que la lógica limpie automáticamente la reserva para evitar inconsistencias.

---

# Validación del resumen final

Antes de permitir continuar al pago o confirmar la reserva, el resumen debe comprobar que toda la información es coherente.

## El resumen no debe permitir

* Vehículos sin conductor.
* Conductores duplicados en varios vehículos.
* Pasajeros incompletos.
* Documentos inválidos.
* Matrículas inválidas.
* Vehículos duplicados si no están permitidos.
* Datos obligatorios vacíos.
* Errores ocultos en pasos anteriores.

## Comportamiento esperado

Si hay errores, el sistema debe:

* Bloquear la continuación.
* Mostrar el error en el paso o campo correspondiente.
* Llevar al usuario al bloque donde debe corregirlo, si es posible.
* No mostrar errores genéricos sin contexto.

---

# Requisitos técnicos

Revisa la lógica del estado de la reserva para asegurarte de que las relaciones entre pasajeros, vehículos y conductores se mantienen correctamente.

## Relaciones que deben mantenerse

Cada vehículo debe tener:

```text
vehicle.driverId
```

o una relación equivalente con un pasajero existente.

Cada conductor debe ser un pasajero válido de la reserva.

No debe existir ningún `driverId` que apunte a un pasajero eliminado.

No debe existir ningún vehículo sin conductor si la lógica de negocio exige conductor obligatorio.

---

# Casos de prueba obligatorios

Comprueba como mínimo los siguientes escenarios:

## Caso 1: Conductor duplicado

1. Crear pasajero A.
2. Crear pasajero B.
3. Añadir Vehículo 1 con pasajero A como conductor.
4. Añadir Vehículo 2.
5. Verificar que pasajero A no aparece en el desplegable del Vehículo 2.

Resultado esperado:

```text
El pasajero A no puede seleccionarse de nuevo como conductor.
```

---

## Caso 2: Editar vehículo existente

1. Crear pasajero A.
2. Añadir Vehículo 1 con pasajero A como conductor.
3. Editar Vehículo 1.

Resultado esperado:

```text
El pasajero A debe seguir apareciendo como conductor del Vehículo 1 porque ya pertenece a ese vehículo.
```

---

## Caso 3: Eliminar conductor con vehículo asociado

1. Crear pasajero A.
2. Añadir Vehículo 1 con pasajero A como conductor.
3. Eliminar pasajero A.

Resultado esperado:

```text
El Vehículo 1 se elimina automáticamente.
No aparece ningún vehículo sin conductor en el resumen.
```

---

## Caso 4: Inputs inválidos

Probar los siguientes valores:

```text
Nombre: 12345
Apellido: @@@
Documento: 123
Matrícula: %%%%
Email: prueba
Teléfono: abcdef
```

Resultado esperado:

```text
El sistema bloquea el avance y muestra cada error debajo del campo correspondiente.
```

---

## Caso 5: Vehículos duplicados

1. Añadir un vehículo.
2. Pulsar de nuevo en “Añadir vehículo”.

Resultado esperado:

```text
El vehículo ya añadido no debe aparecer como opción duplicada.
```

---

# Resultado esperado final

Al terminar la corrección, el flujo de reserva debe funcionar así:

* No se puede asignar un conductor a más de un vehículo.
* Los conductores ya usados no aparecen en otros desplegables.
* Los vehículos ya añadidos no aparecen como opción duplicada.
* Todos los inputs tienen validaciones correctas.
* Los errores aparecen exactamente donde ocurre el fallo.
* Si se elimina un conductor, también se elimina automáticamente su vehículo asociado.
* El resumen final nunca muestra vehículos sin pasajero o conductor.
* El usuario no puede continuar con una reserva incoherente o incompleta.

---

# Prioridad

Estos errores son de prioridad alta porque afectan directamente a la calidad de la reserva y pueden generar billetes mal emitidos, incidencias con navieras y problemas de atención al cliente.

Corrige la lógica de estado, los formularios, las validaciones y la interfaz para que el flujo sea consistente de principio a fin.
