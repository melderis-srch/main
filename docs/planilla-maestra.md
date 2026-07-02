# Diseño: Planilla Maestra + ID de caso

> Documento de trabajo — Fase 1. Todavía NO implementado. Sirve para acordar el
> modelo antes de escribir código. Cuando esté aprobado, se implementa el backend
> (GAS) y luego se adaptan las vistas.

## 1. Objetivo

Unificar hoy 3 planillas / 5 hojas en **una sola planilla maestra**, y darle a cada
cirugía un **identificador único de caso (`casoId`)** que viaje por todas las
etapas del pipeline:

```
Presupuesto ──▶ Cirugía autorizada ──▶ Consumo ──▶ Factura ──▶ Cobranza
      └──────────────────── mismo casoId ────────────────────┘
```

### Regla de identidad del caso (decidido)

- **1 caso = 1 cirugía** (identificada por `paciente + fechaCx + material`).
- **Una misma cirugía facturada en 2+ veces = el mismo caso.** Las facturas se
  acumulan en la hoja `Facturas` bajo el mismo `casoId`. (Misma `fechaCx`, mismo
  `material` → mismo caso.)
- **Reintervención = caso nuevo.** Si cambia la `fechaCx`, es otro `casoId`, aunque
  sea el mismo paciente y material.

Con eso:
- Se termina el matcheo por nombre (typos → duplicados).
- Nombres, obras sociales y fechas se cargan **una vez** y se muestran en todos los
  módulos por referencia (no se copian a mano).
- Todas las métricas del pipeline salen de una consulta sobre el `casoId`.

## 2. Qué está disperso hoy (punto de partida)

| Planilla actual | Hoja | Rol | Se unifica en |
|---|---|---|---|
| Cirugías (`1ZMN…Fq-M`) | `Cirugías` | cirugías + costos + margen | hoja `Cirugias` |
| Cirugías | `Consolidado` | pivote anual (métricas × mes) | se recalcula desde datos |
| Financiero (`1Qy7…O-9E`) | `VENTASCOBROS` | facturación y cobranza | hojas `Facturas` + `Cobros` |
| Financiero | `GASTOSPAGOS` | pagos a proveedores | hoja `Pagos` |
| Presupuestos (`1nFT…Sm5U`) | `Presupuestos` | cotizaciones y conversión | hoja `Presupuestos` |

Ganancia colateral de unificar: el trigger de edición vuelve a poder ser un
`onEdit` simple (hoy tiene que ser instalable solo porque cruza 3 archivos), y las
escrituras dejan de abrir 2 spreadsheets extra.

## 3. El `casoId`

- **Formato:** `CX-AAAA-NNNN` (ej. `CX-2026-0142`). Legible, ordenable, y el año
  ayuda a leerlo de un vistazo. Alternativa técnica: UUID; se descarta por ser
  ilegible para una humana operando la planilla.
- **Se genera en dos momentos (decidido):**
  1. Cuando un presupuesto pasa a `Autorizada` (la cascada crea el caso), **o**
  2. Cuando se carga **manualmente una nueva cirugía** desde la app (sin presupuesto
     previo). Ese path también genera `casoId`.
  - Un presupuesto sin autorizar **no** tiene caso todavía.
- **El correlativo `NNNN`** se lleva por año en una celda de control (hoja `_config`)
  para evitar condiciones de carrera; se incrementa con `LockService`.
- **Nunca se reutiliza ni se edita a mano.** Es la columna A (congelada) de las hojas
  del pipeline.

## 4. Estructura de la planilla maestra

Una sola planilla. Hojas:

### 4.1 `Casos` (índice maestro — 1 fila por caso)
La tabla espina. Guarda los datos "de identidad" que hoy se repiten en cada hoja.

| Col | Campo | Tipo | Notas |
|---|---|---|---|
| A | `casoId` | texto | PK, `CX-AAAA-NNNN` |
| B | `paciente` | texto | canónico (se corrige una vez, vale para todos) |
| C | `medico` | texto | canónico |
| D | `obraSocial` | texto | canónico |
| — | `sanatorio` | texto | dónde se realiza la cirugía (canónico) |
| E | `estadoCaso` | texto | máquina de estados, ver §5 |
| F | `fechaCotizacion` | fecha | |
| G | `fechaAutorizacion` | fecha | |
| H | `fechaCx` | fecha | |
| I | `presupuestoId` | texto | FK a `Presupuestos` (vacío si cirugía cargada a mano) |
| J | `material` | texto | ayuda a distinguir mismo-caso vs reintervención |
| K | `creadoEl` | fecha | auditoría |
| L | `actualizadoEl` | fecha | auditoría |

> `numeroFactura` **no** vive acá: un caso puede tener varias facturas, así que los
> N° de factura viven en la hoja `Facturas` (1 fila por factura). El `estadoCaso`
> "facturado" se deriva de que exista al menos una factura.

> Paciente / médico / OS viven **acá** como fuente de verdad. Las demás hojas los
> referencian por `casoId`; el front los muestra haciendo el join. Corregís un
> nombre una vez y se arregla en todos lados.

### 4.2 `Presupuestos`
Igual que hoy, + `casoId` (se completa al autorizar) y `presupuestoId` (PK propia,
correlativo `PR-AAAA-NNNN`), porque un caso puede tener varios presupuestos
(cotización + mejora, o recotización).

| Campo | Tipo | | Campo | Tipo |
|---|---|---|---|---|
| `presupuestoId` | texto (PK) | | `precioMejora` | monto |
| `casoId` | texto (FK, vacío si aún no autorizado) | | `estado` | enum (ver §6) |
| `paciente` | texto | | `fechaAutorizacion` | fecha |
| `medico` | texto | | `condicionPago` | texto |
| `obraSocial` | texto | | `realizada` | bool |
| `material` | texto | | `fechaCx` | fecha |
| `numeroPresupuesto` | texto | | `observaciones` | texto |
| `precioCotizacion` | monto | | | |
| `fechaCotizacion` | fecha | | | |

### 4.3 `Cirugias`
Costos y margen de la cirugía. Ya no guarda paciente/médico/OS como texto libre:
los toma del caso. (Se pueden dejar como columnas *espejo* de solo-lectura escritas
por el backend, para que la hoja siga siendo legible sola — ver §7.)

| Campo | Tipo | Notas |
|---|---|---|
| `casoId` | texto (FK) | ← clave, reemplaza el match por nombre |
| `mes` | texto | **autocalculado** desde `fechaCx` (no se tipea) |
| `pedidoPresupuestado` | texto | |
| `consumo` | texto | se concilia con módulo Calidad (fase posterior) |
| `valorImplantes` | monto | |
| `valorDescartables` | monto | |
| `valorLogistica` | monto | |
| `correccionGastos` | monto | |
| `valorTotalCostos` | monto | |
| `montoPresupuesto` | monto | |
| `retencionesOtros` | monto | |

> Nota: hoy una cirugía puede tener varias filas (merge). Con `casoId` como clave,
> **1 caso = 1 fila de cirugía**. El merge deja de ser necesario; la migración
> fusiona las filas duplicadas existentes (ver §9).

### 4.4 `Facturas`
Datos de la factura emitida. **1 caso puede tener varias facturas** (decidido): hay
cirugías que se facturan en dos o más veces contra el mismo caso. Por eso esta hoja
es 1 fila por factura, enlazadas por `casoId`. Separada de `Cobros` para no mezclar
"qué facturé" con "qué cobré" (hoy VENTASCOBROS mezcla todo en una fila).

| Campo | Tipo |
|---|---|
| `casoId` | texto (FK) |
| `numeroFactura` | texto |
| `montoFacturado` | monto |
| `fechaFactura` | fecha |
| `fechaEntrega` | fecha |
| `notas` | texto |

### 4.5 `Cobros`
Un caso puede tener 1..N cobros (pagos parciales, echeq + transferencia). Por eso
va en su propia hoja, 1 fila por movimiento de cobro.

| Campo | Tipo | | Campo | Tipo |
|---|---|---|---|---|
| `cobroId` | texto (PK) | | `medioPago` | texto |
| `casoId` | texto (FK) | | `lugarPago` | texto |
| `montoCobrado` | monto | | `condicionPago` | texto |
| `retGanancias` | monto | | `fechaCobroEsperada` | fecha |
| `retIIBB` | monto | | `fechaCobroReal` | fecha |
| `retSuss` | monto | | `fechaCobroCheque` | fecha |
| `retSellados` | monto | | `notas` | texto |

### 4.6 `Pagos` (proveedores)
Como hoy GASTOSPAGOS, con arreglos de lectura (booleanos robustos, ver §7). No
tiene `casoId` obligatorio (un pago a proveedor puede cubrir varias cirugías), pero
se agrega `casoId` **opcional** para poder imputar un implante a un caso cuando se
sabe.

### 4.7 `OrdenesCompra` (nueva — para estimar compra de implantes/mes)
| Campo | Tipo |
|---|---|
| `ocId` | texto (PK) |
| `proveedor` | texto |
| `material` | texto |
| `cantidad` | número |
| `precioUnitario` | monto |
| `mesObjetivo` | texto (AAAA-MM) |
| `estado` | enum: `pendiente` / `recibida` |
| `numeroFactura` | texto (FK a Pagos cuando llega) |
| `casoId` | texto (FK opcional) |

### 4.8 `Usuarios` (para Fase 2 — roles)
| Campo | Tipo |
|---|---|
| `email` | texto (PK) |
| `rol` | texto |
| `modulos` | texto (lista separada por coma) |

### 4.9 `_config`
Celdas de control: correlativos por año (`casoSeq_2026`, `presupSeq_2026`, …),
versión de esquema, etc.

## 5. Máquina de estados del caso (`estadoCaso`)

Un solo campo derivado que resume dónde está el caso. Se calcula en **una única
función** del backend (elimina las 3–5 copias de reglas que hay hoy):

```
cotizado ─▶ autorizado ─▶ realizado ─▶ facturado ─▶ cobrado
                │
                └─▶ perdido   (presupuesto PERDIDA/BAJA/RECHAZADA)
```

- `cotizado`: existe presupuesto, sin autorizar.
- `autorizado`: presupuesto Autorizada (nace el `casoId`).
- `realizado`: tiene `fechaCx` pasada / marcada realizada.
- `facturado`: tiene al menos una fila en `Facturas`. (Puede haber varias; si la
  suma facturada aún no cubre el presupuesto, el caso sigue mostrándose como
  "facturado parcial" — dato útil para el seguimiento.)
- `cobrado`: la suma de `Cobros` cubre el neto de todas las `Facturas` del caso.
  Si cubre solo una parte → "cobrado parcial".
- `perdido`: estado terminal negativo.

## 6. Enums normalizados (fin de los strings libres)

Hoy "Autorizada" vs "AUTORIZADA" vs "autorizada" rompen cálculos. Se define un set
cerrado y una función `normalizarEstado()` que mapea variantes a un valor canónico:

- **Estado presupuesto:** `Cotizada`, `Autorizada`, `Perdida`, `Baja`, `Rechazada`.
- **Estado OC:** `pendiente`, `recibida`.
- Se validan al escribir (dropdown en la hoja + validación en el GAS).

## 7. Reglas de robustez (arreglan la queja "no se lee/carga bien")

1. **Booleanos:** aceptar `true`, `TRUE`, `VERDADERO`, `Sí`, `SI`, `X`, `1` como
   verdadero. Escribir siempre checkbox real.
2. **Fechas:** guardar como `Date` real en la celda (no texto). El backend
   devuelve ISO; el front formatea. Fin de la ambigüedad dd/MM.
3. **Montos:** validar numérico al escribir; si no parsea, **rechazar con aviso**
   en vez de guardar $0 en silencio.
4. **Columnas espejo** (paciente/médico/OS en hojas del pipeline): las escribe el
   backend desde `Casos`, marcadas visualmente como solo-lectura, para que cada
   hoja siga siendo legible por sí sola sin perder la fuente de verdad única.
5. **Una sola fuente de verdad para métricas:** el Dashboard y el Consolidado leen
   los mismos agregados calculados por el backend, no cada uno por su lado.

## 8. Decisiones (resueltas)

1. **Origen del `casoId`:** al **autorizar** un presupuesto **o** al cargar
   **manualmente una nueva cirugía**. ✅
2. **Identidad del caso:** 1 caso = 1 cirugía (`paciente + fechaCx + material`).
   Varias facturas por caso ✅. Reintervención (otra `fechaCx`) = caso nuevo ✅.
3. **Consolidado:** calculado por el sistema (backend), fuente única. ✅
4. **Visibilidad / columnas espejo:** cada etapa muestra **toda la info que se pueda
   y que el rol del usuario tenga permiso de ver** (ver §8.1). ✅

### 8.1 Visibilidad por etapa y por rol

Idea acordada: en cada etapa, el paciente arrastra toda su información disponible del
caso; **qué campos se muestran depende del rol**. Para no atar la vista al layout de
la planilla, se define en `_config` (o en la hoja `Usuarios`) un mapa
**rol → módulos visibles → campos visibles**. Ejemplos:

- Rol *calidad*: ve paciente, médico, OS, `fechaCx`, `material`, `consumo`; **no** ve
  montos ni cobros.
- Rol *administración*: ve facturación y cobranza completas; no necesita el detalle
  clínico.
- Rol *dueña/gerencia*: ve todo.

La planilla maestra puede tener **vistas/tabs por rol** (filtros guardados o hojas
espejo de solo-lectura) para quien opere directo sobre Sheets; la app aplica el mismo
mapa para ocultar/mostrar campos y módulos. Esto se implementa a fondo en la **Fase 2
(roles)**, pero el modelo de datos ya lo deja preparado guardando el mapa en `_config`.

## 9. Plan de migración (sin perder datos)

1. Crear la planilla maestra nueva con las hojas vacías + `_config`.
2. Script de migración (GAS, una sola corrida) que:
   a. Lee las 3 planillas viejas.
   b. Agrupa cirugías duplicadas por la clave actual (`paciente+fechaCx`) → 1 caso.
   c. Asigna `casoId` correlativo y crea la fila en `Casos`.
   d. Reparte los datos a `Presupuestos` / `Cirugias` / `Facturas` / `Cobros` /
      `Pagos` enlazando por `casoId`.
   e. Normaliza estados, booleanos y fechas de paso.
   f. Deja un reporte de casos ambiguos (typos, fechas que no matchearon) para
      **revisar a mano** — no adivina.
3. Congelar las planillas viejas como backup de solo lectura.
4. Apuntar el backend a la maestra (un solo ID en vez de 3).
5. Adaptar las vistas para unir por `casoId`.

> La migración NO se hace automática a ciegas: el paso (f) te deja una lista de lo
> que no pudo enlazar con confianza, para que lo resuelvas vos antes del cutover.

## 10. Qué NO entra en Fase 1 (fases siguientes)

- **Login + roles** (Fase 2): hoja `Usuarios` + Google Identity + gateo por módulo.
  Requiere pasar la navegación a rutas.
- **Módulo Consumo / Calidad** (Fase 3): concilia `consumo` de la cirugía contra lo
  presupuestado; sistema aparte que se integra por `casoId`.
- **Órdenes de compra** operativas (Fase 3): la hoja ya queda definida acá, la
  operatoria y las métricas de "compra de implantes/mes" se construyen después.
- **Lectura automática de facturas (OCR/PDF)** (Fase 4): el "lujo".

## 11. Orden de trabajo propuesto para la implementación de Fase 1

1. Acordar §8 (decisiones abiertas).
2. Crear planilla maestra + `_config` + validaciones/dropdowns.
3. Escribir el GAS nuevo contra la maestra (lecturas/escrituras + `casoId` +
   función única de estado/normalización).
4. Script de migración + reporte de ambigüedades.
5. Cutover en un entorno de prueba, revisar reporte, corregir a mano.
6. Adaptar las vistas del front a unir por `casoId`.
7. Recién ahí: pulido de Cobranza + Pagos (Fase 3, punto 3 de tu lista).
</content>
</invoke>
