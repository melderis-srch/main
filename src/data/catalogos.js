// ============================================================
// Catálogos de Clientes y Productos (para el generador de presupuestos)
// ============================================================
// Estos arrays se repueblan a partir del sistema viejo:
//   - Clientes: 305 registros extraídos del "Listado de Clientes" (PDF).
//   - Productos: 372 registros extraídos de la tabla prod_articulo (MySQL).
//
// Se dejan vacíos hasta reimportar los datos (se perdieron al reiniciarse
// el contenedor). El generador funciona igual con carga manual: los campos
// aceptan texto libre y los buscadores usan estas listas cuando estén cargadas.
//
// Formato:
//   CLIENTES: { codigo, denominacion, condicionIva, cuit, direccion, localidad }
//   PRODUCTOS: { codigo, denominacion, marca, origen, alternativa, precio, gravado }
// ============================================================

export const CLIENTES = [];

export const PRODUCTOS = [];
