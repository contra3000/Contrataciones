'use strict';

/*
 * pliego-plantillas.js
 * ORDEN-RONDA-16 §3 (H20). Plantillas del pliego versionadas y editables.
 *
 * La plantilla es un dato versionado (ADR-032):
 *   { id, nombre, contenido, criterios, version, autor, fecha, vigente,
 *     notaDeCambio }
 * El contenido íntegro vive en cada versión (reproducibilidad) y la versión
 * vigente es una marca, no la última fila (se puede volver sin borrar nada).
 * La nota de cambio es obligatoria.
 *
 * Almacenamiento: <datosDir>/plantillas/plantillas.json. Vive dentro de la
 * carpeta de datos, de modo que entra en el respaldo/restauración como el
 * padrón (ORDEN-RONDA-16 §3.9).
 *
 * Tamaño: se mantiene el contenido íntegro por versión; nunca un diff.
 */

const fs = require('node:fs');
const path = require('node:path');

const MARCADOR_INICIO = '{{';
const MARCADOR_FIN = '}}';

// Roles autorizados a publicar (ORDEN-RONDA-16 §3.4): contrataciones_supervisor
// o juridica, cualquiera de los dos, sin aprobación del otro.
const ROLES_PUBLICAN = ['contrataciones_supervisor', 'juridica'];

function rutaPlantillas(datosDir) {
  return path.join(datosDir, 'plantillas', 'plantillas.json');
}

// Semilla de la v1 (ORDEN-RONDA-16 §3.8): se usa como arranque cuando el
// almacenamiento local de cada despliegue todavía no tiene plantillas. Vive en
// config/plantillas-v1.json; una vez guardada (guardar), manda la copia local.
function semillaV1() {
  const ruta = path.resolve(__dirname, '..', 'config', 'plantillas-v1.json');
  try {
    const doc = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    return Array.isArray(doc.plantillas) ? doc.plantillas : [];
  } catch (e) {
    return [];
  }
}

function cargar(datosDir) {
  const ruta = rutaPlantillas(datosDir);
  if (!fs.existsSync(ruta)) {
    return semillaV1();
  }
  try {
    const doc = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    return Array.isArray(doc.plantillas) ? doc.plantillas : [];
  } catch (e) {
    return [];
  }
}

function guardar(datosDir, plantillas) {
  fs.mkdirSync(path.dirname(rutaPlantillas(datosDir)), { recursive: true });
  const tmp = rutaPlantillas(datosDir) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, plantillas }, null, 2), 'utf8');
  fs.renameSync(tmp, rutaPlantillas(datosDir));
}

function nuevoId(existentes) {
  let n = 1;
  while (existentes.some((p) => p.id === 'pl-' + n)) {
    n += 1;
  }
  return 'pl-' + n;
}

function versionVigente(plantilla) {
  if (!plantilla || !Array.isArray(plantilla.versions)) {
    return null;
  }
  const numero = plantilla.vigenteVersion;
  return plantilla.versions.find((v) => v.version === numero) || null;
}

function resumen(plantilla) {
  const v = versionVigente(plantilla);
  return {
    id: plantilla.id,
    nombre: plantilla.nombre,
    criterios: plantilla.criterios || {},
    vigenteVersion: plantilla.vigenteVersion,
    vigenteContenido: v ? v.contenido : null,
    versiones: plantilla.versions.length,
    notaDeCambioVigente: v ? v.notaDeCambio : null
  };
}

// ---------------------------------------------------------------------------
// Extracción de marcadores {{CAMPO}} (§3.3 paso 1)
// ---------------------------------------------------------------------------
function marcarAsignado(contenido, posicion) {
  // Un marcador se considera "asignado" cuando tiene algo entre las llaves.
  const cierre = contenido.indexOf(MARCADOR_FIN, posicion + 2);
  if (cierre === -1) {
    return false;
  }
  const interno = contenido.slice(posicion + 2, cierre).trim();
  return interno.length > 0;
}

function extraerMarcadores(contenido) {
  const encontrados = [];
  if (typeof contenido !== 'string') {
    return encontrados;
  }
  const visto = {};
  let i = 0;
  while (i < contenido.length - 1) {
    const inicio = contenido.indexOf(MARCADOR_INICIO, i);
    if (inicio === -1) {
      break;
    }
    const cierre = contenido.indexOf(MARCADOR_FIN, inicio + 2);
    if (cierre === -1) {
      break;
    }
    const nombre = contenido.slice(inicio + 2, cierre).trim();
    if (nombre.length > 0) {
      if (!visto[nombre]) {
        visto[nombre] = true;
        encontrados.push(nombre);
      }
    }
    i = cierre + 2;
  }
  return encontrados;
}

// Vocabulario de campos que la aplicación sabe emitir al YAML. Coincide con
// los que construye views/pliego-yaml.js (y los dos exigidos por el generador
// para servicios: plazo_entrega_servicio y garantia_servicio, §3.7).
const EMISIBLES = [
  'tipo_documento', 'tipo_contrato', 'version', 'tipo_procedimiento',
  'nro_procedimiento', 'ejercicio', 'clase_modalidad', 'tipo_oc',
  'nro_expediente_gde', 'rubros', 'nombre_proceso', 'objeto',
  'organismos_requirentes.nombre', 'organismos_requirentes.domicilio',
  'organismos_requirentes.telefono', 'organismos_requirentes.correo',
  'organismos_requirentes.horario', 'organismos_requirentes.frecuencia_provision',
  'organismos_requirentes.plazo_entrega', 'ofertas_parciales',
  'ofertas_alternativas', 'duracion_contrato', 'apendice_eett',
  'plazo_entrega_servicio', 'garantia_servicio'
];
const EMISIBLES_SET = new Set(EMISIBLES);

// Acepta el marcador simple o con prefijo de apéndice (p. ej. APENDICE_1_objeto).
function esEmisible(nombre) {
  if (EMISIBLES_SET.has(nombre)) {
    return true;
  }
  return EMISIBLES_SET.has(nombre.replace(/^APENDICE_\d+_/, ''));
}

// Contrasta los marcadores de una plantilla contra lo que la app emite.
// Devuelve los desconocidos (bloquean) y los emitidos sin usar (aviso).
function validarMarcadores(contenido) {
  const usados = extraerMarcadores(contenido);
  const desconocidos = usados.filter((n) => !esEmisible(n));
  const sinUsar = EMISIBLES.filter((n) => !usados.includes(n));
  return {
    marcadores: usados,
    desconocidos: desconocidos.sort(),
    sinUsar: sinUsar.sort()
  };
}

// ---------------------------------------------------------------------------
// Tabla de reglas (§3.2): criterios { tipoContrato, modalidad, procedimiento }
// con '*' como comodín. Gana la más específica (menos comodines); ante empate,
// la de mayor prioridad declarada. Nunca "la primera del archivo".
// ---------------------------------------------------------------------------
function contarComodines(criterios) {
  const c = criterios || {};
  let n = 0;
  for (const clave of ['tipoContrato', 'modalidad', 'procedimiento']) {
    if (!c[clave] || c[clave] === '*') {
      n += 1;
    }
  }
  return n;
}

function coinciden(criterios, atributos) {
  for (const clave of ['tipoContrato', 'modalidad', 'procedimiento']) {
    const esperado = criterios && criterios[clave];
    if (!esperado || esperado === '*') {
      continue;
    }
    const real = atributos && atributos[clave];
    if (String(real || '') !== String(esperado)) {
      return false;
    }
  }
  return true;
}

// Devuelve { plantilla, regla, porDefecto }. `porDefecto` indica que se usó la
// de defecto por falta de coincidencia (el llamador debe decirlo en pantalla).
function seleccionar(plantillas, atributos) {
  const candidatas = plantillas.map((p) => {
    const v = versionVigente(p);
    const criterios = (v && v.criterios) || p.criterios || {};
    return { plantilla: p, criterios, comodines: contarComodines(criterios) };
  });

  const coincidentes = candidatas.filter((c) => coinciden(c.criterios, atributos));
  if (coincidentes.length === 0) {
    const defecto = candidatas.find((c) => esDefecto(c.criterios));
    if (defecto) {
      return { plantilla: defecto.plantilla, regla: defecto.criterios, porDefecto: true };
    }
    return { plantilla: null, regla: null, porDefecto: true };
  }
  coincidentes.sort((a, b) => {
    if (a.comodines !== b.comodines) {
      return a.comodines - b.comodines;
    }
    // Empate por especificidad: mayor prioridad declarada.
    return (prioridad(b.criterios) - prioridad(a.criterios)) || (a.plantilla.id < b.plantilla.id ? -1 : 1);
  });
  const ganador = coincidentes[0];
  return { plantilla: ganador.plantilla, regla: ganador.criterios, porDefecto: esDefecto(ganador.criterios) };
}

function esDefecto(criterios) {
  const c = criterios || {};
  return (!c.tipoContrato || c.tipoContrato === '*') &&
    (!c.modalidad || c.modalidad === '*') &&
    (!c.procedimiento || c.procedimiento === '*');
}

function prioridad(criterios) {
  const c = criterios || {};
  return typeof c.prioridad === 'number' ? c.prioridad : 0;
}

// ---------------------------------------------------------------------------
// Validación de marcadores para publicación (§3.3): un marcador desconocido
// impide publicar. La generación del pliego de prueba la hace el probador.
// ---------------------------------------------------------------------------
function validarParaPublicar(contenido) {
  const m = validarMarcadores(contenido);
  if (m.desconocidos.length > 0) {
    return {
      valido: false,
      error: 'la plantilla usa marcadores que la aplicación no sabe emitir: ' +
        m.desconocidos.join(', '),
      desconocidos: m.desconocidos
    };
  }
  return { valido: true, sinUsar: m.sinUsar };
}

module.exports = {
  ROLES_PUBLICAN,
  EMISIBLES,
  rutaPlantillas,
  cargar,
  guardar,
  nuevoId,
  versionVigente,
  resumen,
  extraerMarcadores,
  validarMarcadores,
  validarParaPublicar,
  seleccionar,
  esDefecto,
  contarComodines
};
