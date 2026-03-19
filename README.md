# Clarifactu · v1.1.1

Aplicación de escritorio para gestión de facturación orientada a profesionales de terapia y otros autónomos. Funciona completamente offline, sin suscripciones ni servicios en la nube.

---

## Tecnología

- **Electron 29** — aplicación de escritorio multiplataforma
- **SQLite** (better-sqlite3) — base de datos local, sin servidor
- **Vanilla JS / HTML / CSS** — sin frameworks frontend
- **Chart.js** — gráficos del dashboard
- **AdmZip** — exportación de múltiples PDFs en ZIP

---

## Funcionalidades

### Clientes
- Alta, edición y eliminación de clientes
- Campos: nombre, NIF/DNI, email, teléfono, dirección, notas
- **Etiquetas / categorías**: asigna etiquetas de color libres a cada cliente; filtro por etiqueta mediante desplegable en la barra de búsqueda
- Búsqueda en tiempo real por nombre, NIF o email (filtrado local)
- **Paginación** (20 por página) con filtros activos
- **Historial del cliente**: modal con pestañas de Facturas (con resumen de total facturado, cobrado y pendiente) y Documentos; exportación de todas las facturas del cliente en un único ZIP

### Servicios
- Catálogo de servicios con nombre, descripción, precio y duración
- Búsqueda en tiempo real (filtrado local)
- **Paginación** (20 por página)
- Reutilización al crear facturas

### Facturas
- Creación de facturas con líneas de servicio ilimitadas
- Numeración automática configurable (prefijo, separador, año, dígitos)
- Reinicio manual del contador de numeración
- IVA e IRPF configurables por factura
- Vista previa de la factura antes de exportar
- Exportación a **PDF** (mediante ventana oculta de Electron)
- **Envío por email** directamente desde la aplicación (Gmail)
- Badge visual cuando una factura ya ha sido enviada por correo
- Edición, eliminación y **duplicación** de facturas existentes
- **Paginación** (20 por página) con todos los filtros activos

#### Facturas rectificativas (abonos)
- Generación de **facturas rectificativas** (tipo R1) desde cualquier factura existente
- Numeración independiente: `R-YYYY-NNNN` (serie propia, reinicio anual)
- Los importes se pre-rellenan automáticamente en negativo
- La factura original queda marcada como "Rectificada" con indicador visual
- Identificador cruzado: la rectificativa enlaza con la factura de origen

#### Selección múltiple y acciones en grupo
- **Checkbox** por fila + "seleccionar todo" en cabecera (con estado indeterminado)
- **Barra de acciones** que aparece al seleccionar una o más facturas
- **Envío masivo de emails**: confirmación previa, envío individual silencioso, omite clientes sin email
- **Descarga masiva de PDFs**: genera un único archivo `.zip` con todos los PDFs seleccionados
- **Eliminación múltiple**: confirmación única para borrar el lote

#### Estado de cobro
- Cada factura tiene estado: **Pendiente**, **Cobrada** o **Vencida**
- Días para considerar una factura vencida configurable en Ajustes (por defecto 30)
- Botón de toggle directo en la tabla para marcar/desmarcar como cobrada
- Fecha de cobro registrada automáticamente
- Filtro por estado de cobro en la lista de facturas
- Contador de importe pendiente visible en la barra de filtros

#### Filtros y exportación
- Filtro por año, estado de cobro y texto libre
- Ordenación por fecha, número, cliente o importe
- **Exportación a CSV** compatible con Excel (con BOM UTF-8), incluyendo todos los campos y estado de cobro

### Dashboard
- Resumen del año: facturado, nº facturas, clientes, servicios, documentos totales y documentos enviados este mes
- **Aviso de facturas pendientes de cobro** con importe total
- Gráfico de barras de ingresos mensuales
- Gráfico de línea de evolución acumulada
- **Gráfico de top 5 clientes** por volumen facturado (barras horizontales, seleccionable por año)
- **Comparativa año a año**: gráfico de barras agrupadas que compara los ingresos mensuales de dos años cualesquiera (selector independiente por año)
- Selector de año para navegar el historial
- Últimas facturas emitidas
- **Registro de actividad reciente** (últimas 25 acciones)
- **Resumen fiscal trimestral** (T1–T4): base imponible, IVA repercutido e IRPF retenido por trimestre — útil para el Modelo 130
- **Exportación del resumen fiscal a CSV** (compatible con Excel, BOM UTF-8)

### Búsqueda global
- Acceso con **Ctrl+K** desde cualquier pantalla
- Busca simultáneamente en facturas, clientes y servicios
- Resultados agrupados por tipo con navegación por teclado (↑↓ Enter Esc)
- Clic en un resultado navega directamente a la sección correspondiente

### Atajos de teclado
- **Ctrl+K** — búsqueda global
- **Alt+1–6** — navegación directa a cada sección (Dashboard, Clientes, Servicios, Facturas, Documentos, Configuración)
- **D** — ir a Documentos
- **N** — nuevo documento (abre directamente el modal)
- **?** — mostrar ayuda de atajos

### Registro de actividad
- Historial de las últimas acciones: facturas creadas, emails enviados, PDFs exportados, facturas eliminadas
- Límite automático de 500 entradas para no crecer indefinidamente
- Visible en el dashboard con marcas de tiempo relativas

### Documentos

- Creación de documentos genéricos (informes, certificados, comunicados…) independientes de las facturas
- Campos: título, destinatario (cliente opcional) y cuerpo de texto libre
- **Variables en el cuerpo**: `{nombre}` (nombre del cliente), `{fecha}` y `{hoy}` (fecha del día) se sustituyen automáticamente al generar el PDF o la vista previa
- **Plantillas de documento**: gestión de plantillas reutilizables (crear, editar, eliminar); al crear un documento se puede aplicar una plantilla con un clic
- **Vista previa** del documento con la plantilla final antes de exportar
- Exportación a **PDF** con plantilla profesional: logo, datos de la empresa, destinatario, título, cuerpo y pie con fecha y firma
- **Firma incrustada** automáticamente en el pie del documento si está configurada
- **Envío por email** directamente al cliente (si tiene email registrado), con asunto y mensaje personalizables
- Badge **"Enviado"** en la lista cuando el documento ya fue enviado, con fecha en tooltip
- **Duplicar** documento con un clic (crea una copia con prefijo "Copia de")
- Búsqueda por título, contenido o cliente
- **Ordenación** por título, destinatario o fecha (clic en cabecera de columna, asc/desc)
- Registro en el **log de actividad** al enviar un documento por email

### Onboarding inicial
- **Asistente de configuración** de 4 pasos que se lanza automáticamente en el primer arranque
- Pasos: Bienvenida → Datos de la empresa → Numeración de facturas (con vista previa en tiempo real) → Listo
- Botón "Omitir" disponible en cualquier momento
- Los usuarios existentes con datos ya guardados no verán el asistente

### Actualizaciones automáticas
- Comprobación automática de nuevas versiones al iniciar la aplicación
- **Barra de descarga** en la parte inferior con progreso en tiempo real
- **Banner de instalación** una vez descargada la actualización: aplica y reinicia con un clic
- Distribución mediante **GitHub Releases**

### Configuración

#### Empresa
- Nombre/razón social, NIF, dirección, email, teléfono, IBAN
- Logo personalizado (almacenado en base de datos como base64)
- **Firma**: se puede **dibujar** directamente con el ratón o pantalla táctil (canvas con color y grosor ajustables) o **subir una imagen**; se incrusta en el pie de los documentos PDF
- Información adicional (pie de factura)

#### Apariencia
- **Modo oscuro** completo (toggle instantáneo, persiste entre sesiones)
- **Plantillas de factura PDF**: Clásica (azul), Minimal (gris), Moderna (morado)

#### Facturas
- Formato del número: prefijo, separador, año, nº de dígitos, número inicial
- Vista previa del número en tiempo real
- Reinicio del contador de numeración
- **Días de vencimiento** configurables (por defecto 30) para el estado "Vencida"

#### Email
- Integración con **Gmail** mediante contraseña de aplicación
- Asunto y cuerpo del email personalizables con variables: `{numero}`, `{cliente}`, `{total}`, `{fecha}`
- Botón de prueba de conexión

#### Backup
- Creación de copia de seguridad con un clic
- Registro de los **5 backups más recientes** (los anteriores se eliminan automáticamente)
- Descarga del backup a cualquier ubicación
- Restauración de un backup anterior (con aviso de confirmación y reinicio automático)
- Importación de un backup externo (archivo `.db`)

#### Avanzado — Verifactu (AEAT)
- Cumplimiento del **RD 1007/2023** (Verifactu), activable/desactivable
- Encadenamiento de huellas **SHA-256** entre facturas
- Código **QR de verificación** en el PDF (cuando está activado)
- Envío al endpoint SOAP de la AEAT (preproducción y producción)
- Soporte para certificado digital `.p12/.pfx` y **DNIe / tarjeta inteligente** (almacén de Windows)
- Exportación del XML Verifactu
- Estados por factura: Pendiente / Enviada / Error

#### Info
- Versión de la aplicación y stack técnico
- Estado de la licencia activa (clave y fecha de activación)
- Botón para cambiar o activar una nueva licencia

---

## Sistema de licencias

La aplicación requiere una clave de licencia para activarse. La validación es **completamente offline** mediante HMAC-SHA256.

- **Formato**: `XXXXX-XXXXX-XXXXX-XXXXX-XXXXX` (5 grupos de 5 caracteres alfanuméricos)
- **Activación**: pantalla de bienvenida al primer arranque, o desde Configuración → Info
- **Persistencia**: se guarda en `%APPDATA%/Clarifactu/license.json`

### Generar claves

```bash
node scripts/generate-key.js       # genera 1 clave
node scripts/generate-key.js 20    # genera 20 claves
```

---

## Factura PDF

El documento generado incluye:
- Logo y datos de la empresa (nombre, NIF, dirección, info adicional, IBAN)
- Datos del cliente (nombre, NIF, dirección)
- Tabla de líneas de servicio con cantidad, precio unitario y total
- Desglose de base imponible, IVA e IRPF
- Notas de la factura
- QR de verificación Verifactu (si está activado)
- **3 plantillas visuales** seleccionables desde Configuración → Apariencia

---

## Instalación y desarrollo

```bash
# Instalar dependencias
npm install

# Reconstruir módulos nativos para Electron
npm run rebuild

# Iniciar en modo desarrollo (con DevTools)
npm run dev

# Iniciar en modo normal
npm start

# Generar icono de la aplicación
npm run icon

# Generar instalador NSIS + ejecutable portable (.exe)
npm run build

# Publicar nueva versión en GitHub Releases
GH_TOKEN=<tu_token> npm run publish
```

### Tests

```bash
# Tests unitarios (DB, Verifactu, utilidades)
npx jest tests/unit --verbose

# Test de integración con endpoint AEAT (requiere red)
npx jest tests/integration --testTimeout=20000 --verbose
```

---

## Estructura del proyecto

```
Clarifactu/
├── main.js                  # Proceso principal Electron + handlers IPC
├── preload.js               # contextBridge → window.api
├── assets/
│   ├── icon.ico             # Icono de la aplicación (multi-tamaño)
│   └── icon.png             # Icono en PNG (256x256)
├── scripts/
│   ├── generate-key.js      # Generador de claves de licencia
│   └── generate-icon.js     # Generador del icono de la aplicación
├── src/
│   ├── license.html         # Pantalla de activación de licencia
│   ├── license-preload.js   # Preload para la ventana de licencia
│   ├── database/
│   │   └── db.js            # Esquema SQLite + todas las queries
│   └── renderer/
│       ├── index.html       # Shell de la app con sidebar
│       ├── app.js           # Router, modales, toasts, búsqueda global, paginación
│       ├── styles.css       # Diseño completo (modo claro y oscuro)
│       └── pages/
│           ├── dashboard.js
│           ├── clients.js
│           ├── services.js
│           ├── new-invoice.js
│           ├── invoices.js
│           ├── documents.js
│           ├── onboarding.js
│           └── settings.js
├── tests/
│   ├── unit/
│   │   ├── db.test.js
│   │   ├── verifactu.test.js
│   │   └── utils.test.js
│   └── integration/
│       └── verifactu-submission.test.js
└── dist/                    # Ejecutable generado
```

---

## Base de datos

Ubicación: `%APPDATA%/Clarifactu/clarifactu.db`

Las migraciones se aplican automáticamente en cada arranque, por lo que actualizar la aplicación no requiere ningún paso manual.

---

## Notas

- La aplicación funciona **100% offline**. Ningún dato sale del equipo salvo el envío voluntario de facturas a la AEAT (Verifactu) o por email.
- El logo y la firma se almacenan como base64 en la base de datos.
- El contador de facturas (y el de rectificativas) se reinicia automáticamente cada año nuevo.
- Los backups son copias exactas del archivo `.db` y pueden restaurarse en cualquier instalación de Clarifactu.
- El sistema de licencias es offline; las claves son válidas en cualquier equipo que tenga el mismo binario.
- Las actualizaciones automáticas solo funcionan en la versión instalada (no en modo `npm run dev`).
