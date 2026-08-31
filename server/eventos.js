'use strict';

/*
 * eventos.js
 * ORDEN-RONDA-12 §3.1 (ADR-024). Registro de eventos append-only por
 * expediente. Un archivo JSONL por expediente en la misma carpeta que
 * datos.json. Escritura atómica con la misma primitiva del resto.
 *
 * El registro captura de más y no de menos (ADR-024 §1): cada evento
 * lleva timestamp, y los campos opcionales se omiten si no aplican.
 */

const fs = require('node:fs');
const path = require('node:path');

function rutaEventos(datosDir, id) {
  const parts = id.split('-');
  const anio = parts[0] || String(new Date().getFullYear());
  const dir = path.join(datosDir, anio, id + '_Expediente');
  return path.join(dir, 'eventos.jsonl');
}

function escribirEvento(datosDir, id, evento) {
  const linea = JSON.stringify(evento) + '\n';
  const ruta = rutaEventos(datosDir, id);
  const dir = path.dirname(ruta);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.appendFileSync(ruta, linea, 'utf8');
}

function registrarTransicion(datosDir, id, origen, destino, contexto) {
  escribirEvento(datosDir, id, rolEfectivoCondicional({
    tipo: 'transicion',
    timestamp: new Date().toISOString(),
    origen: origen,
    destino: destino,
    rol: contexto && contexto.rol || null,
    email: contexto && contexto.email || null,
    equipo: contexto && contexto.equipo || null
  }, contexto));
}

function registrarDevolucion(datosDir, id, origen, destino, motivo, observacion, contexto) {
  escribirEvento(datosDir, id, rolEfectivoCondicional({
    tipo: 'devolucion',
    timestamp: new Date().toISOString(),
    origen: origen,
    destino: destino,
    motivo: motivo || null,
    observacion: observacion || null,
    rol: contexto && contexto.rol || null,
    email: contexto && contexto.email || null,
    equipo: contexto && contexto.equipo || null
  }, contexto));
}

// ADR-033 (ORDEN-RONDA-14 §3.5): cuando el paso lo ejecutó un rol distinto del
// propio —un supervisor actuando como su supervisado— el registro dice
// "rol_efectivo". El contexto lo enriquece el servidor recién cuando el motor
// confirmó la transición; los registros planos no llevan el campo.
function rolEfectivoCondicional(objeto, contexto) {
  const cx = contexto || {};
  if (typeof cx.rolEfectivo === 'string' && cx.rolEfectivo !== (cx.rol || null)) {
    objeto.rolEfectivo = cx.rolEfectivo;
  }
  return objeto;
}

function registrarEdicion(datosDir, id, grupoCampos, versionAnterior, versionNueva, contexto) {
  escribirEvento(datosDir, id, {
    tipo: 'edicion',
    timestamp: new Date().toISOString(),
    grupoCampos: grupoCampos,
    versionAnterior: versionAnterior,
    versionNueva: versionNueva,
    rol: contexto && contexto.rol || null,
    email: contexto && contexto.email || null,
    equipo: contexto && contexto.equipo || null
  });
}

function registrarConflicto(datosDir, id, ruta, razon, contexto) {
  escribirEvento(datosDir, id, {
    tipo: 'conflicto',
    timestamp: new Date().toISOString(),
    httpRuta: ruta,
    razon: razon,
    rol: contexto && contexto.rol || null,
    email: contexto && contexto.email || null
  });
}

function registrarRechazo(datosDir, id, httpRuta, statusCode, razon, contexto) {
  escribirEvento(datosDir, id, {
    tipo: 'rechazo',
    timestamp: new Date().toISOString(),
    httpRuta: httpRuta,
    statusCode: statusCode,
    razon: razon,
    rol: contexto && contexto.rol || null,
    email: contexto && contexto.email || null
  });
}

function registrarEntregable(datosDir, id, entregableId, accion, contexto) {
  escribirEvento(datosDir, id, {
    tipo: 'entregable',
    timestamp: new Date().toISOString(),
    entregableId: entregableId,
    accion: accion,
    rol: contexto && contexto.rol || null,
    email: contexto && contexto.email || null
  });
}

function registrarExportacion(datosDir, id, formato, contexto) {
  escribirEvento(datosDir, id, {
    tipo: 'exportacion',
    timestamp: new Date().toISOString(),
    formato: formato,
    rol: contexto && contexto.rol || null,
    email: contexto && contexto.email || null
  });
}

function registrarRenglon(datosDir, id, accion, indice, datos, contexto) {
  escribirEvento(datosDir, id, {
    tipo: 'renglon',
    timestamp: new Date().toISOString(),
    accion: accion,
    indice: indice,
    datos: datos || null,
    rol: contexto && contexto.rol || null,
    email: contexto && contexto.email || null
  });
}

function registrarAclaracion(datosDir, id, indice, longitud, contexto) {
  escribirEvento(datosDir, id, {
    tipo: 'aclaracion',
    timestamp: new Date().toISOString(),
    indice: indice,
    longitud: longitud,
    rol: contexto && contexto.rol || null,
    email: contexto && contexto.email || null
  });
}

function registrarBusquedaCatalogo(datosDir, id, termino, resultados, contexto) {
  escribirEvento(datosDir, id, {
    tipo: 'busqueda_catalogo',
    timestamp: new Date().toISOString(),
    termino: termino,
    resultados: resultados,
    sinResultado: resultados === 0,
    rol: contexto && contexto.rol || null,
    email: contexto && contexto.email || null
  });
}

function registrarPermanencia(datosDir, id, paso, milisegundos, contexto) {
  escribirEvento(datosDir, id, {
    tipo: 'permanencia',
    timestamp: new Date().toISOString(),
    paso: paso,
    milisegundos: milisegundos,
    rol: contexto && contexto.rol || null,
    email: contexto && contexto.email || null
  });
}

function registrarAreaSolicitante(datosDir, id, indice, area, contexto) {
  escribirEvento(datosDir, id, {
    tipo: 'area_solicitante',
    timestamp: new Date().toISOString(),
    indice: indice,
    area: area,
    rol: contexto && contexto.rol || null,
    email: contexto && contexto.email || null
  });
}

function registrarPrecargaEditada(datosDir, id, campo, valorRequerimiento, valorAnexo1, contexto) {
  escribirEvento(datosDir, id, {
    tipo: 'precarga_editada',
    timestamp: new Date().toISOString(),
    campo: campo,
    valorRequerimiento: valorRequerimiento,
    valorAnexo1: valorAnexo1,
    rol: contexto && contexto.rol || null,
    email: contexto && contexto.email || null
  });
}

function registrarValorReferencia(datosDir, id, indice, valores, preventivo, contexto) {
  escribirEvento(datosDir, id, {
    tipo: 'valor_referencia',
    timestamp: new Date().toISOString(),
    indice: indice,
    valores: valores,
    preventivo: preventivo,
    rol: contexto && contexto.rol || null,
    email: contexto && contexto.email || null
  });
}

function registrarReuso(datosDir, id, origenId, contexto) {
  escribirEvento(datosDir, id, {
    tipo: 'reuso_base',
    timestamp: new Date().toISOString(),
    origen: origenId,
    rol: contexto && contexto.rol || null,
    email: contexto && contexto.email || null,
    equipo: contexto && contexto.equipo || null
  });
}

// Helper para apiGuardar: detecta ediciones de grupo y precarga del ANEXO 1.
const PRECAMPOS_PRECARGA = ['objeto', 'justificacion', 'empresasConsultadas',
  'precioReferencia', 'monedaExtranjera', 'unidadResponsable', 'usuarioGde',
  'unidadDireccion', 'unidadTelefono', 'unidadCorreo', 'lugarEntrega',
  'lugarFacturacion', 'requisitosMinimos'];

function registrarGuardado(datosDir, id, actual, expedienteNuevo, nuevaVersion, contexto) {
  const grupos = [];
  if (JSON.stringify(expedienteNuevo.renglones) !== JSON.stringify(actual.renglones)) { grupos.push('renglones'); }
  if (JSON.stringify(expedienteNuevo.datos) !== JSON.stringify(actual.datos)) { grupos.push('datos'); }
  if (JSON.stringify(expedienteNuevo.imputacion) !== JSON.stringify(actual.imputacion)) { grupos.push('imputacion'); }
  if (JSON.stringify(expedienteNuevo.presupuestos) !== JSON.stringify(actual.presupuestos)) { grupos.push('presupuestos'); }
  if (grupos.length > 0) {
    registrarEdicion(datosDir, id, grupos, actual.version, nuevaVersion, contexto);
  }
  var datosActual = actual.datos || {};
  var datosNuevo = expedienteNuevo.datos || {};
  var anexoActual = (datosActual.anexo1 && typeof datosActual.anexo1 === 'object') ? datosActual.anexo1 : {};
  var anexoNuevo = (datosNuevo.anexo1 && typeof datosNuevo.anexo1 === 'object') ? datosNuevo.anexo1 : {};
  for (var p = 0; p < PRECAMPOS_PRECARGA.length; p++) {
    var campo = PRECAMPOS_PRECARGA[p];
    var valViejo = anexoActual[campo];
    var valNuevo = anexoNuevo[campo];
    if (JSON.stringify(valViejo) !== JSON.stringify(valNuevo)) {
      registrarPrecargaEditada(datosDir, id, campo, valViejo, valNuevo, contexto);
    }
  }
}

function leerEventos(datosDir, id) {
  const ruta = rutaEventos(datosDir, id);
  if (!fs.existsSync(ruta)) return [];
  return fs.readFileSync(ruta, 'utf8')
    .split('\n')
    .filter(function (l) { return l.trim() !== ''; })
    .map(function (l) { return JSON.parse(l); });
}

// ---------------------------------------------------------------------------
// Compendio del Jefe de Contrataciones (ORDEN-RONDA-14 §2.2)
// ---------------------------------------------------------------------------

function crearManejadoresEventos(entorno) {
  const { datosDir, ayudantes } = entorno;
  const { responderJson, parsearCuerpo } = ayudantes;
  const SGC = globalThis.SGC;

  // Guardia común con sugerencias: el compendio es sólo del Jefe de
  // Contrataciones, verificado contra el padrón en el servidor.
  function esJefe(contexto) {
    const cx = contexto || {};
    const v = SGC.core.autorizacion.verificar(entorno.padronVivo.usuarios(), cx);
    return v.ok && cx.rol === 'contrataciones_supervisor';
  }

  // Recorre la carpeta de datos (años → expedientes) y agrupa las líneas de
  // eventos que cada expediente haya registrado. Líneas ilegibles de un
  // expediente no tumban el compendio: se sigue con los demás.
  function compendio() {
    const resultado = [];
    if (!fs.existsSync(datosDir)) {
      return resultado;
    }
    const anios = fs.readdirSync(datosDir).filter(function (n) {
      return /^\d{4}$/.test(n);
    });
    for (const anio of anios) {
      const dirAnio = path.join(datosDir, anio);
      const carpetas = fs.existsSync(dirAnio) ? fs.readdirSync(dirAnio) : [];
      for (const carpeta of carpetas) {
        if (!carpeta.endsWith('_Expediente')) {
          continue;
        }
        const id = carpeta.slice(0, -'_Expediente'.length);
        try {
          const eventos = leerEventos(datosDir, id);
          if (eventos.length > 0) {
            resultado.push({ id, eventos });
          }
        } catch (e) {
          // expediente con eventos ilegibles: se saltea
        }
      }
    }
    return resultado;
  }

  // GET /api/eventos: el compendio de eventos y sugerencias del Jefe.
  function apiEventos(req, res, textoCuerpo) {
    const cuerpo = parsearCuerpo(textoCuerpo) || {};
    if (!esJefe(cuerpo.contexto)) {
      return responderJson(res, 403, { error: 'solo el Jefe de Contrataciones puede consultar el compendio de eventos' });
    }
    const eventos = compendio();
    let sucesos = 0;
    for (const grupo of eventos) {
      sucesos += grupo.eventos.length;
    }
    return responderJson(res, 200, {
      expedientes: eventos.length,
      sucesos,
      eventos
    });
  }

  return {
    esJefe,
    apiEventos
  };
}

module.exports = {
  rutaEventos,
  escribirEvento,
  registrarTransicion,
  registrarDevolucion,
  registrarEdicion,
  registrarConflicto,
  registrarRechazo,
  registrarEntregable,
  registrarExportacion,
  registrarRenglon,
  registrarAclaracion,
  registrarBusquedaCatalogo,
  registrarPermanencia,
  registrarAreaSolicitante,
  registrarPrecargaEditada,
  registrarValorReferencia,
  registrarReuso,
  registrarGuardado,
  leerEventos,
  crearManejadoresEventos
};
