'use strict';

/*
 * padron-csv.js
 * ORDEN-RONDA-17 (H21). Importación y exportación CSV del padrón.
 *
 * - Exportación: cabecera nombre;apellido;email;rol;sector;activo, con ';' de
 *   separador, comillas dobles cuando el campo lo pide y BOM a la salida para
 *   Excel/Notepad.
 * - Importación: tolera BOM y CRLF, valida cada línea (email, rol y repetidos)
 *   ANTES de tocar el padrón (todo-o-nada con una sola escritura), nunca
 *   reemplaza credenciales existentes y, con `desactivarAusentes`, no deja al
 *   sistema sin administrador activo (anti-encierro). Las mismas reglas de
 *   validación que el alta manual las recibe por `exigirAdmin`, que viene del
 *   módulo de administración (no se duplica la puerta de sesión aquí).
 */

const credenciales = require('./credenciales.js');
const { diccionarioDePalabras } = require('./palabras.js');
const identidad = require('./identidad.js');
const antiEncierro = require('./anti-encierro.js');

const SUFIJOS_INVALIDOS = identidad.SUFIJOS_INVALIDOS;
const RE_EMAIL = identidad.RE_EMAIL;

// ORDEN-RONDA-18 §3.6: tope defensivo de filas por importación. El alto manual
// es de a uno; una vuelta grande de padrón entra en tandas.
const TOPE_IMPORTACION = 500;

function crearCapaCsv(entorno, exigirAdmin) {
  const { responderJson, parsearCuerpo } = entorno.ayudantes;
  const SGC = globalThis.SGC;
  const ROLES = SGC.core.config.ROLES.map((r) => r.id);

  function leerPadron() {
    return entorno.padronVivo.leer() || { schemaVersion: '2.0.0', usuarios: [] };
  }

  function guardarPadron(padron) {
    entorno.padronVivo.guardar(padron);
  }

  function buscar(padron, email) {
    return Array.isArray(padron.usuarios)
      ? padron.usuarios.find((u) => u && u.email === email) || null
      : null;
  }

  // Para el anti-encierro y el prever: el padrón RESULTANTE que la importación
  // dejaría. Sólo le importa el estado de `activo` (el CSV no toca la marca
  // `administrador`): los omitidos se desactivan si `desactivarAusentes`, y los
  // que vienen en el CSV quedan con el `activo` que traen.
  function patronResultanteDeImportacion(padron, entradas, ausentes, desactivarAusentes) {
    const r = JSON.parse(JSON.stringify(padron));
    if (desactivarAusentes) {
      for (const au of ausentes) {
        const u = r.usuarios.find((x) => x.email === au);
        if (u) {
          u.activo = false;
        }
      }
    }
    for (const e of entradas) {
      const u = r.usuarios.find((x) => x.email === e.email);
      if (u) {
        u.activo = e.activo;
      }
    }
    return r;
  }

  // ORDEN-RONDA-18 §3.3 (ADR-031): neutralización única compartida con el
  // navegador. El servidor corre el core del frontend (APP_CORE), así que
  // SGC.core.csvSeguro está cargado; acá se usa su `campoCSV` y no se duplica.
  function csvCampo(v) {
    const SGC = globalThis.SGC;
    if (!SGC.core.csvSeguro) {
      throw new Error('csv-seguro.js no está cargado (falta en APP_CORE): no se exportan CSVs sin neutralizar fórmulas');
    }
    return SGC.core.csvSeguro.campoCSV(v, ';');
  }

  function apiExportarCsv(req, res, textoCuerpo) {
    const cuerpo = parsearCuerpo(textoCuerpo) || {};
    if (!exigirAdmin(res, req, cuerpo)) {
      return null;
    }
    const filas = [['nombre', 'apellido', 'email', 'rol', 'sector', 'activo']];
    for (const u of leerPadron().usuarios) {
      filas.push([
        u.nombre || '', u.apellido || '', u.email, u.rol || '', u.sector || '',
        u.activo === false ? 'no' : 'si'
      ]);
    }
    const csv = filas.map((f) => f.map(csvCampo).join(';')).join('\r\n') + '\r\n';
    res.writeHead(200, {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': 'attachment; filename="padron.csv"'
    });
    return res.end('\uFEFF' + csv);
  }

  // Parser CSV pequeño y sin dependencias: soporta comillas dobles y ';'.
  function parserCsv(texto) {
    const limpia = texto.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lineas = limpia.split('\n').filter((l) => l.trim() !== '');
    const salida = [];
    for (let n = 0; n < lineas.length; n++) {
      const partes = [];
      let campo = '';
      let entreComillas = false;
      const l = lineas[n];
      for (let i = 0; i < l.length; i++) {
        const ch = l[i];
        if (ch === '"') {
          if (entreComillas && l[i + 1] === '"') {
            campo += '"';
            i++;
          } else {
            entreComillas = !entreComillas;
          }
        } else if (ch === ';' && !entreComillas) {
          partes.push(campo.trim());
          campo = '';
        } else {
          campo += ch;
        }
      }
      partes.push(campo.trim());
      salida.push(partes);
    }
    return salida;
  }

  function parsearEntradas(partes, n) {
    const [nombre, apellido, email, rol, sector, activo] = partes;
    if (!nombre || !apellido || !email || !rol) {
      return { ok: false, error: 'línea ' + (n + 1) + ': se espera nombre;apellido;email;rol;[sector];[activo]' };
    }
    // ORDEN-RONDA-18 §3.5: el correo es identidad y no distingue mayúsculas.
    const emailNormal = identidad.normalizarEmail(desneutralizar(email));
    if (SUFIJOS_INVALIDOS.some((c) => emailNormal.indexOf(c) !== -1) || !RE_EMAIL.test(emailNormal)) {
      return { ok: false, error: 'línea ' + (n + 1) + ': el email "' + email + '" no es válido' };
    }
    if (ROLES.indexOf(rol) === -1) {
      return { ok: false, error: 'línea ' + (n + 1) + ': el rol "' + rol + '" no existe (roles: ' + ROLES.join(', ') + ')' };
    }
    // ORDEN-RONDA-18 §3.1: vocabulario cerrado, sin tildes, vacío = activo,
    // mal = error de línea. Nunca se resuelve en silencio como false.
    const na = identidad.normalizarActivo(desneutralizar(activo), n + 1);
    if (na.error) {
      return { ok: false, error: na.error };
    }
    return {
      ok: true,
      entrada: {
        nombre: desneutralizar(nombre), apellido: desneutralizar(apellido),
        email: emailNormal, rol,
        sector: (sector === null || sector === undefined || String(sector).trim() === '')
          ? null
          : desneutralizar(sector),
        activo: na.activo
      }
    };
  }

  // Reversa de la neutralización de csv-seguro.js (§3.3): si el campo viaja con
  // la marca de expedio dada a las fórmulas, se la quita para que el dato
  // vuelva exacto. Si no es una marca, no se toca.
  function desneutralizar(v) {
    const SGC = globalThis.SGC;
    if (!SGC.core.csvSeguro || v === null || v === undefined) {
      return v;
    }
    return SGC.core.csvSeguro.desneutralizarFormulas(v);
  }

  function apiImportar(req, res, textoCuerpo) {
    const cuerpo = parsearCuerpo(textoCuerpo) || {};
    if (!exigirAdmin(res, req, cuerpo)) {
      return null;
    }
    const csv = typeof cuerpo.csv === 'string' ? cuerpo.csv : '';
    const desactivarAusentes = cuerpo.desactivarAusentes === true;
    if (csv.trim() === '') {
      return responderJson(res, 400, { error: 'importar: falta el campo "csv" con las líneas nombre;apellido;email;rol' });
    }
    const filas = parserCsv(csv);
    // ORDEN-RONDA-17 §1.4: la exportación escribe una línea de encabezado y
    // la importación la tolera; también se acepta un CSV sin encabezado.
    const encabezado = ['nombre', 'apellido', 'email', 'rol', 'sector', 'activo']
      .join(';').toLowerCase();
    if (filas.length > 0 && filas[0].map((c) => String(c).toLowerCase())
      .join(';') === encabezado) {
      filas.shift();
    }
    const entradas = [];
    for (let n = 0; n < filas.length; n++) {
      const r = parsearEntradas(filas[n], n);
      if (!r.ok) {
        return responderJson(res, 422, { error: r.error });
      }
      entradas.push(r.entrada);
    }
    if (entradas.length === 0) {
      return responderJson(res, 400, { error: 'importar: el CSV no trae ninguna línea' });
    }
    const vistos = {};
    for (const e of entradas) {
      if (vistos[e.email]) {
        return responderJson(res, 422, { error: 'email repetido en el CSV: ' + e.email });
      }
      vistos[e.email] = true;
    }
    // ORDEN-RONDA-18 §3.6: tope defensivo de filas por importación.
    if (entradas.length > TOPE_IMPORTACION) {
      return responderJson(res, 422, {
        error: 'importar: el CSV trae ' + entradas.length + ' filas; el tope es de ' + TOPE_IMPORTACION + ' (hacelo en tandas)'
      });
    }

    const padron = leerPadron();
    const emailsActivos = padron.usuarios.filter((u) => u.activo !== false).map((u) => u.email);
    // Ausentes: activos hoy que no vienen en el CSV. Con `desactivarAusentes`
    // se bajan (y el anti-encierro se chequea antes, SIEMPRE respecto de lo que
    // la importación dejaría al final, sea por baja, desactivación u omisión).
    const ausentes = emailsActivos.filter((emailActivo) => !vistos[emailActivo]);
    // RONDA-18 §3.4: modo prever. Reporta a quiénes desactivaría (nombre,
    // apellido, correo) SIN escribir nada, para que la persona decida con el
    // diff a la vista. Valida el CSV completo de igual manera que la
    // importación real; sólo difiere en que no aplica.
    if (cuerpo.soloPrever === true) {
      const ausentesDetalle = ausentes.map((emailActivo) => {
        const u = buscar(padron, emailActivo);
        return { email: emailActivo, nombre: u ? u.nombre : '', apellido: u ? u.apellido : '' };
      });
      const resultante = patronResultanteDeImportacion(padron, entradas, ausentes, desactivarAusentes);
      return responderJson(res, 200, {
        prever: true,
        ausentes: ausentesDetalle,
        totalAusentes: ausentesDetalle.length,
        aplica: antiEncierro.tieneAdminActivo(resultante)
      });
    }
    // Anti-encierro (RONDA-18 §3.2): la guardia se aplica sobre el ESTADO FINAL
    // con la misma función que la administración manual (anti-encierro.js). Se
    // simula el padrón que la importación dejaría y se pregunta si queda un
    // administrador activo. El CSV no trae columna "administrador": la
    // importación sólo puede DESACTIVAR admins, nunca agregarlos.
    if (!antiEncierro.tieneAdminActivo(
      patronResultanteDeImportacion(padron, entradas, ausentes, desactivarAusentes))) {
      return responderJson(res, 422, {
        error: 'importar: dejaría al sistema sin administrador activo, así no se aplica; ' +
          'deje al menos un administrador activo en el CSV o no marque desactivar ausentes'
      });
    }
    if (desactivarAusentes) {
      for (const ausente of ausentes) {
        const u = buscar(padron, ausente);
        if (u) {
          u.activo = false;
        }
      }
    }

    const creados = [];
    const cambios = [];
    const detalles = [];
    for (const e of entradas) {
      const existente = buscar(padron, e.email);
      if (existente) {
        // Diff por campo (§1.5): se dice quién cambia y qué campo.
        const dif = [];
        if ((existente.nombre || '') !== (e.nombre || '')) dif.push('nombre');
        if ((existente.apellido || '') !== (e.apellido || '')) dif.push('apellido');
        if ((existente.rol || '') !== (e.rol || '')) dif.push('rol');
        if ((existente.sector || '') !== (e.sector || '')) dif.push('sector');
        if ((existente.activo !== false) !== e.activo) dif.push('activo');
        if (dif.length > 0) {
          cambios.push(e.email);
          detalles.push({ email: e.email, campos: dif });
        }
        existente.nombre = e.nombre;
        existente.apellido = e.apellido;
        existente.rol = e.rol;
        existente.sector = e.sector;
        existente.activo = e.activo;
        // credenciales se dejan intactas (nunca se reemplazan por una importación).
      } else {
        const clave = credenciales.generarClave(diccionarioDePalabras());
        padron.usuarios.push({
          nombre: e.nombre, apellido: e.apellido, email: e.email, rol: e.rol,
          sector: e.sector, activo: e.activo,
          credenciales: Object.assign(credenciales.crearHash(clave), {
            provisoria: true, fallosContinuos: 0, bloqueado: false
          })
        });
        creados.push({ email: e.email, clave });
      }
    }

    // Todo o nada: las validaciones ya corrieron; la escritura es un solo paso.
    guardarPadron(padron);

    const desactivados = desactivarAusentes ? ausentes : [];

    return responderJson(res, 200, {
      creados,
      cambios,
      detalles,
      yaExistentes: entradas.map((e) => e.email).filter((e) => !creados.some((c) => c.email === e) && !cambios.includes(e)),
      ausentes,
      desactivados,
      desactivarAusentes
    });
  }

  return { apiExportarCsv, apiImportar };
}

module.exports = { crearCapaCsv };