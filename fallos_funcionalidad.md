# Fallos de Funcionalidad — KIKOTO

## `server.js` — Bugs de Backend

### Criticos

| # | Linea | Bug | Impacto |
|---|---|---|---|
| 1 | 359 | `POST /bookings` solo devuelve `results[0]` aunque crea N reservas para un grupo | El frontend no conoce los IDs/detalles de los demas pasajeros del grupo |
| 2 | 367-370 | `PATCH /bookings/:id` — al limpiar el `localizador`, fuerza `estado = "Pendiente"` incluso si estaba `"Cancelado"` | Se pierde el estado de cancelacion sin intencion |
| 3 | 394-401 | `PUT /bookings/:id` no valida `tripType`, `origin != destination` ni formato de `paxEmail` como si hace POST | Se puede crear una reserva con origen=destino o email invalido via PUT |
| 4 | 566-568 | `PUT /vehicles/:id` permite dimensiones 0 o negativas | POST las rechaza, PUT no |
| 5 | 678 | `PATCH /invoices/:id` no valida que el `invoice_number` sea unico | Se puede duplicar el numero de factura via PATCH |
| 6 | 679 | `PATCH /invoices/:id` permite `importe = 0` o negativo | POST lo rechaza, PATCH no |
| 7 | 678 | `PATCH /invoices/:id` no valida formato de `fecha` | Se puede poner cualquier string como fecha |
| 8 | 813-814 | `POST /frequent-passengers` rechaza si el email esta vacio, pero el campo no esta marcado como requerido | Un pasajero sin email da `"Email invalido"` en vez de dejarlo pasar |
| 9 | 389 | `PUT /bookings/:id` bloquea TODA la edicion si hay vehiculo asignado | No se pueden editar campos no relacionados con el vehiculo (fechas, naviera, pasajero) |

**Soluciones propuestas:**

1. **Linea 359** — Cambiar `ok(res, results[0], 201)` por `ok(res, results, 201)` para devolver todas las reservas del grupo.

2. **Lineas 367-370** — Solo cambiar `estado` si no se recibe explicitamente en el body:
   ```js
   if (Object.prototype.hasOwnProperty.call(b, 'localizador')) {
     const loc = (b.localizador || '').toUpperCase().trim();
     if (loc && !isValidLoc(loc)) return fail(res, 'Formato de localizador invalido.');
     const changes = { localizador: loc || null };
     if (!Object.prototype.hasOwnProperty.call(b, 'estado')) {
       changes.estado = loc ? 'Confirmado' : 'Pendiente';
     }
     const n = store.update('bookings', r => r.id === id, changes);
     if (!n) return fail(res, 'Reserva no encontrada.', 404);
   }
   ```

3. **Lineas 394-401** — Anadir las mismas validaciones que POST:
   ```js
   if (b.tripType && !['ida','idayvuelta'].includes(b.tripType))
     return fail(res, 'tripType invalido.');
   if (b.origin && b.destination && b.origin.toLowerCase() === b.destination.toLowerCase())
     return fail(res, 'El origen y el destino no pueden ser el mismo puerto.');
   if (b.paxEmail && !isValidEmail(b.paxEmail))
     return fail(res, 'Email del pasajero invalido.');
   ```

4. **Lineas 566-568** — Anadir validacion de dimensiones en PUT:
   ```js
   if (changes.ancho !== undefined && changes.ancho <= 0) return fail(res, 'Ancho debe ser mayor que 0.');
   if (changes.largo !== undefined && changes.largo <= 0) return fail(res, 'Largo debe ser mayor que 0.');
   if (changes.alto  !== undefined && changes.alto  <= 0) return fail(res, 'Alto debe ser mayor que 0.');
   ```

5. **Linea 678** — Anadir validacion de unicidad en PATCH:
   ```js
   if (req.body.numero !== undefined) {
     const num = (req.body.numero || '').trim();
     const existing = store.find('invoices', i => i.invoice_number === num && i.id !== id);
     if (existing) return fail(res, 'Ya existe una factura con ese numero.', 409);
     changes.invoice_number = num;
   }
   ```

6-7. **Lineas 678-679** — Validar importe y fecha:
   ```js
   if (req.body.importe !== undefined) {
     const imp = parseFloat(req.body.importe);
     if (!imp || imp <= 0) return fail(res, 'Importe debe ser mayor que 0.');
     changes.importe = imp;
   }
   if (req.body.fecha !== undefined) {
     if (!isValidDate(req.body.fecha)) return fail(res, 'Formato de fecha invalido (YYYY-MM-DD).');
     changes.fecha = req.body.fecha;
   }
   ```

8. **Linea 814** — Cambiar la validacion de email para permitir vacio:
   ```js
   if (email && !isValidEmail(email)) return fail(res, 'Email invalido.');
   ```
   En vez de:
   ```js
   if (!isValidEmail(email)) return fail(res, 'Email invalido.');
   ```

9. **Linea 389** — En lugar de bloquear toda la edicion, permitir campos no relacionados con vehiculo. O bien eliminar la restriccion y solo bloquear los campos del vehiculo:
   ```js
   if (existing.veh_marca) {
     const forbidden = ['vehMarca','vehModelo','vehMatricula','vehAncho','vehLargo','vehAlto','vehicleCount'];
     const attempted = forbidden.filter(f => b[f] !== undefined);
     if (attempted.length) return fail(res, 'No se pueden modificar los datos del vehiculo de una reserva confirmada.', 403);
   }
   ```

---

### Moderados

| # | Linea | Bug | Impacto |
|---|---|---|---|
| 10 | 501-513 | `PUT /members/:id` — un `dni` vacio (`""`) se guarda sin pasar la validacion de formato | Se almacena un DNI invalido |
| 11 | 516 | `PUT /members/:id` no comprueba unicidad de `num_doc` | Se puede crear un `num_doc` duplicado |
| 12 | 498-509 | `PUT /members/:id` no valida formato de `fecha_nacimiento` ni `fecha_expiracion` | POST si lo hace, PUT no |
| 13 | 502 | `PUT /members/:id` no extrae el prefijo de telefono como hace POST | Si se envia `"+34 612..."`, se almacena duplicado |
| 14 | 739-741 | `PATCH /admins/:id` actualiza `is_active` antes de verificar si el admin existe | Operacion fantasma si el ID no existe |
| 15 | 740+764 | Si se envia `{activo: false, password: "..."}` PATCH primero desactiva y luego reactiva | Estado final contradictorio |
| 16 | 928 | `POST /sailings` y `/timetables` siempre devuelven datos demo, nunca llaman a la API real | Los datos de horarios son siempre estaticos |

**Soluciones propuestas:**

10. **Validar DNI vacio en PUT:**
    ```js
    if (changes.dni !== undefined) {
      if (!changes.dni) return fail(res, 'DNI obligatorio.');
      if (!isValidDni(changes.dni)) return fail(res, 'DNI invalido.');
      if (store.find('members', m => m.id !== id && m.dni === changes.dni))
        return fail(res, 'Ya existe un miembro con ese DNI.', 409);
    }
    ```

11. **Validar unicidad de `num_doc` en PUT:**
    ```js
    if (changes.num_doc) {
      if (store.find('members', m => m.id !== id && m.num_doc === changes.num_doc))
        return fail(res, 'Ya existe un miembro con ese documento.', 409);
    }
    ```

12. **Validar fechas en PUT:**
    ```js
    if (changes.fecha_nacimiento && !isValidDate(changes.fecha_nacimiento))
      return fail(res, 'Fecha de nacimiento invalida.');
    if (changes.fecha_expiracion && !isValidDate(changes.fecha_expiracion))
      return fail(res, 'Fecha de expiracion invalida.');
    if (changes.fecha_expiracion && changes.fecha_nacimiento && changes.fecha_expiracion <= changes.fecha_nacimiento)
      return fail(res, 'La expiracion debe ser posterior al nacimiento.');
    ```

13. **Extraer prefijo de telefono en PUT** (igual que hace POST):
    ```js
    if (b.telefono !== undefined) {
      let pre = existing.telefono_prefix || '+34', telNum = (b.telefono || '').trim();
      const m = telNum.match(/^(\+\d{1,4})\s*(.*)$/);
      if (m) { pre = m[1]; telNum = m[2]; }
      changes.telefono = telNum;
      changes.telefono_prefix = pre;
    }
    ```

14. **Verificar existencia del admin antes de mutar en PATCH:**
    ```js
    app.patch('/api/admins/:id', requireAuth, (req, res) => {
      const id = parseInt(req.params.id);
      const admin = store.find('administrators', a => a.id === id);
      if (!admin) return fail(res, 'Administrador no encontrado.', 404);
      // ... resto de la logica
    });
    ```

15. **Documentar o rechazar combinacion `activo` + `password`:**
    ```js
    if (b.activo !== undefined && b.password !== undefined) {
      return fail(res, 'No se puede activar/desactivar y cambiar contrasena en la misma peticion.');
    }
    ```

16. **Llamar a la API real en sailings/timetables** o documentar que son datos demo. Si se quiere conectar:
    ```js
    // Reemplazar `ok(res, demoSailings(date))` por:
    if (KIKOTO_API_TOKEN) {
      const data = await fetchKikoto(`/sailings?from=${departure_port_id}&to=${destination_port_id}&date=${date}`);
      return ok(res, data.data || demoSailings(date));
    }
    return ok(res, demoSailings(date));
    ```

---

### Seguridad

| # | Linea | Bug | Impacto |
|---|---|---|---|
| 17 | 188-192 | Credenciales demo (`admin@kikoto.com / Admin123`) hardcodeadas, bypass de `is_active` | Un admin desactivado puede seguir entrando con la pass demo |
| 18 | 106 | `SESSION_SECRET` con fallback `"kikoto-secret-2024-node"` visible en el codigo | Cualquiera que lea el codigo puede falsificar cookies de sesion |
| 19 | — | No hay control de roles — cualquier admin autenticado puede hacer todo | Un admin de bajo nivel tiene permisos de super_admin |

**Soluciones propuestas:**

17. **Anadir comprobacion de `is_active` al login demo:**
    ```js
    if (email === DEMO_EMAIL.toLowerCase() && password === DEMO_PASSWORD) {
      const user = store.find('users', u => u.email.toLowerCase() === DEMO_EMAIL && u.is_active);
      if (!user) return fail(res, 'Cuenta desactivada.', 403);
      // ... continuar login
    }
    ```
    O mejor: eliminar las credenciales hardcodeadas en produccion y usar un flag `DEMO_MODE`.

18. **Rechazar arranque sin `SESSION_SECRET`:**
    ```js
    if (!process.env.SESSION_SECRET) {
      console.error('FATAL: SESSION_SECRET no configurado. Abortando.');
      process.exit(1);
    }
    ```

19. **Anadir middleware de roles:**
    ```js
    function requireRole(...roles) {
      return (req, res, next) => {
        if (!req.session.adminId) return res.status(401).json({ error: 'No autenticado.' });
        const user = store.find('users', u => u.id === req.session.adminId);
        if (!user || !roles.includes(user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
        next();
      };
    }
    // Uso: app.delete('/api/admins/:id', requireAuth, requireRole('super_admin'), ...)
    ```

---

## `store.js` — Bugs de Datos

| # | Linea | Bug | Impacto |
|---|---|---|---|
| 1 | 56 | `insert()` permite que `data.id` sobreescriba el ID autoincrementado si el objeto incluye un campo `id` | IDs duplicados o inconsistentes |
| 2 | 65 | `update()` permite sobreescribir campos inmutables (`id`, `created_at`) via `changes` | Se corrompe la clave primaria o la fecha de creacion |
| 3 | 83,87,65,73 | `all()`, `find()`, `update()`, `remove()` crean arrays vacios en `_db` para tablas inexistentes | Un typo como `all('usres')` contamina la BD con una tabla vacia persistida |
| 4 | 87,89 | `find()` y `all()` devuelven referencias directas a objetos internos de `_db` | Cualquier caller puede mutar datos sin pasar por `update()`/`save()` |
| 5 | 22-28 | Si `kikoto.json` esta corrupto, `load()` lo reemplaza con seed data sin advertir | Perdida silenciosa de todos los datos |
| 6 | 56-62 | Si `save()` falla, las mutaciones ya estan en `_db` en memoria | Datos "fallidos" se persisten en la siguiente escritura exitosa |

**Soluciones propuestas:**

1. **Insert: el ID auto-generado siempre gana:**
   ```js
   function insert(table, data) {
     const db = load();
     if (!db[table]) db[table] = [];
     const id = nextId(table);
     const { id: _discard, ...cleanData } = data;
     const row = { ...cleanData, id, created_at: now(), updated_at: now() };
     db[table].push(row);
     save();
     return { ...row };
   }
   ```

2. **Update: proteger campos inmutables:**
   ```js
   function update(table, pred, changes) {
     const db = load();
     let n = 0;
     db[table] = db[table].map(r => {
       if (pred(r)) {
         n++;
         const { id: _1, created_at: _2, ...safe } = changes;
         return { ...r, ...safe, updated_at: now() };
       }
       return r;
     });
     if (n) save();
     return n;
   }
   ```

3. **Operaciones de lectura no mutan el estado:**
   ```js
   function all(table, pred = () => true) {
     const db = load();
     const rows = db[table] || [];
     return rows.filter(pred).map(r => ({ ...r }));
   }

   function find(table, pred) {
     const db = load();
     const rows = db[table] || [];
     const row = rows.find(pred);
     return row ? { ...row } : null;
   }
   ```
   Y proteger `update`/`remove` antes de mutar:
   ```js
   function update(table, pred, changes) {
     const db = load();
     if (!db[table]) return 0;
     // ...
   }
   function remove(table, pred) {
     const db = load();
     if (!db[table]) return 0;
     // ...
   }
   ```

4. **Ver solucion 3** — los `.map(r => ({ ...r }))` ya cubren esto.

5. **Distinguir archivo no encontrado de archivo corrupto:**
   ```js
   function load() {
     if (_db) return _db;
     try {
       _db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
     } catch (err) {
       if (err.code === 'ENOENT') {
         _db = seed();
         save();
         console.log('Base de datos inicializada con datos de demo.');
       } else {
         console.error('ERROR: Base de datos corrupta. Copia de seguridad recomendada.');
         console.error('Ruta:', FILE);
         console.error('Detalle:', err.message);
         process.exit(1);
       }
     }
     return _db;
   }
   ```

6. **Rollback en `insert()` si `save()` falla:**
   ```js
   function insert(table, data) {
     const db = load();
     if (!db[table]) db[table] = [];
     const id = nextId(table);
     const { id: _discard, ...cleanData } = data;
     const row = { ...cleanData, id, created_at: now(), updated_at: now() };
     db[table].push(row);
     try {
       save();
     } catch (err) {
       db[table].pop();
       db._seq[table] = id - 1;
       throw err;
     }
     return { ...row };
   }
   ```

---

## `public/app.js` — Bugs de Frontend

### Criticos

| # | Bug | Impacto | Solucion |
|---|---|---|---|
| 1 | `doAddTrip`, `deleteTrip`, `editTrip` referencian `state.trips` y `state.nextId` que no existen | TypeError si se llaman | Eliminar estas funciones muertas o migrarlas a usar `state.bookings` y la API |
| 2 | `updateBookingStatus` cambia estado en local y llama `saveToStorage()` que es un **no-op** | El cambio de estado se pierde al recargar | Reemplazar `saveToStorage()` por `await api('PATCH', '/bookings/' + id, { estado })` |
| 3 | Drag-and-drop de archivos: se muestra el nombre pero el archivo no se adjunta al `<input>` | El archivo se descarta silenciosamente | Guardar el `File` en una variable (ej. `state._pendingInvoiceFile`) y usarla en `doAddInvoice` |
| 4 | `submitEditVehicle` envia dimensiones como **strings** en vez de numeros | La API las rechaza o almacena mal | Cambiar `val('ev-ancho')` por `parseFloat(val('ev-ancho'))`, etc. |
| 5 | Campo `apellido` vs `apellido1` inconsistente entre datos demo, creacion y display | Muestra `undefined` en el apellido | Unificar: usar `m.apellido \|\| m.apellido1 \|\| ''` en el render y `apellido1` en formularios |

**Detalle solucion #2:**
```js
async function updateBookingStatus(id, estado) {
  try {
    const updated = await api('PATCH', '/bookings/' + id, { estado });
    const idx = state.bookings.findIndex(b => b.id === id);
    if (idx !== -1) state.bookings[idx] = { ...state.bookings[idx], ...updated };
    renderViajes();
  } catch (err) {
    toast('Error al actualizar estado: ' + err.message, 'error');
  }
}
```

**Detalle solucion #3:**
```js
// Anadir al state:
state._pendingInvoiceFile = null;

// En doDrop:
function doDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file) return;
  state._pendingInvoiceFile = file;
  $('i-file-label').textContent = file.name + ' (' + (file.size / 1024 / 1024).toFixed(1) + ' MB)';
  $('i-file-label').className = '';
}

// En onFileSelect:
function onFileSelect() {
  const fi = $('i-file');
  if (fi.files.length) {
    state._pendingInvoiceFile = fi.files[0];
    $('i-file-label').textContent = fi.files[0].name;
    $('i-file-label').className = '';
  }
}

// En doAddInvoice, reemplazar:
// const fi = $('i-file');
// if (fi.files.length > 0) { fd.append('archivo', fi.files[0]); }
// por:
if (state._pendingInvoiceFile) { fd.append('archivo', state._pendingInvoiceFile); state._pendingInvoiceFile = null; }
```

**Detalle solucion #4:**
```js
async function submitEditVehicle() {
  // ...
  const ancho = parseFloat(val('ev-ancho'));
  const largo = parseFloat(val('ev-largo'));
  const alto  = parseFloat(val('ev-alto'));
  if (ancho <= 0 || largo <= 0 || alto <= 0) {
    toast('Las dimensiones deben ser mayores que 0.', 'error');
    return;
  }
  // ... enviar como numeros
}
```

### Moderados

| # | Bug | Impacto | Solucion |
|---|---|---|---|
| 6 | `handleForgotPwd` simula envio de email pero no llama a ningun endpoint | Enganoso para el usuario | Implementar endpoint `/api/auth/forgot-password` o mostrar "Funcionalidad no disponible" |
| 7 | Validacion de password solo chequea longitud >= 8, pero el UI muestra criterios mas estrictos | Passwords debiles son aceptadas | Implementar validacion completa: mayuscula, numero, especial |
| 8 | `updateBookingLocalizador` puede poner `b.estado = undefined` si la API no devuelve estado | Badge muestra "undefined" | Usar `b.estado = updated.estado \|\| b.estado` |
| 9 | No hay debounce en `updateBookingLocalizador` (inline `onchange`) | Peticiones concurrentes pueden sobreescribir datos | Anadir debounce de 300-500ms |
| 10 | Boton "Buscar disponibilidad" sin proteccion contra doble click | Multiples llamadas concurrentes | Deshabilitar boton al inicio de `doSearchSailings`, rehabilitar en `finally` |
| 11 | `onFileSelect` y `doDrop` no validan tipo ni tamano de archivo | Se pueden subir archivos no permitidos | Validar `file.type` y `file.size` antes de aceptar |
| 12 | Modal de editar factura no permite cambiar el archivo adjunto | Imposible reemplazar un PDF | Anadir campo de archivo en el modal de edicion |
| 13 | Comentarios del codigo mencionan "backend PHP" en un proyecto Node.js | Confusion para desarrolladores | Actualizar comentarios |
| 14 | Validacion de telefono en el wizard de pasajeros no usa `isPhone()` | Se aceptan telefonos invalidos | Cambiar `if (!tel)` por `if (!tel \|\| !isPhone(tel))` |

---

## Resumen de Prioridades

| Prioridad | Bugs |
|---|---|
| **Critica** | Frontend #1 (TypeError), Frontend #2 (datos no persisten), Frontend #3 (archivos no se suben), Backend #1 (grupo devuelve 1), Backend #3 (sin validacion en PUT bookings), Store #4 (referencias mutables), Store #5 (perdida silenciosa de datos) |
| **Alta** | Backend #2 (estado sobreescrito), Backend #9 (edicion bloqueada con vehiculo), Frontend #4 (dimensiones string), Frontend #5 (apellido undefined), Backend #5-7 (facturas sin validacion en PATCH), Seguridad #17-19 |
| **Media** | Backend #10-13 (validaciones faltantes en PUT members), Store #1-3 (IDs, inmutabilidad, tablas fantasma), Frontend #8-11 (debounce, doble click, validacion archivo) |
| **Baja** | Frontend #6 (forgot password), Frontend #12 (editar factura sin archivo), Frontend #13 (comentarios PHP), Backend #16 (sailings demo) |