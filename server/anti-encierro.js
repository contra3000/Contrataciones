'use strict';

/*
 * anti-encierro.js
 * ORDEN-RONDA-18 §3.2 (ADR-037). Anti-encierro del padrón: el sistema nunca
 * queda sin al menos un administrador activo. Única guardia, en un solo lugar,
 * aplicada sobre el ESTADO FINAL de una operación — no sobre el padrón de hoy.
 *
 * El CSV de importación no trae columna "administrador", así que la importación
 * sólo puede DESACTIVAR admins (omitirlos con desactivarAusentes o marcarlos
 * inactivos); la administración manual puede además quitarles la marca. En
 * ambos casos lo que importa es: ¿el padrón que quedaría tiene, todavía, un
 * administrador activo? Si no, la operación se rechaza.
 *
 * La regla ("siempre", "nunca") la sostiene el test de dos administradores
 * omitidos: falla si se revierte este módulo.
 */

function adminsActivos(padron) {
  return Array.isArray(padron.usuarios)
    ? padron.usuarios.filter((u) => u && u.administrador === true && u.activo !== false)
    : [];
}

// Recibe el padrón RESULTANTE de una operación y responde una sola pregunta:
// ¿queda al menos un administrador activo? (fail closed: padrón no-array → falso).
function tieneAdminActivo(padronResultante) {
  return adminsActivos(padronResultante).length > 0;
}

module.exports = { adminsActivos, tieneAdminActivo };