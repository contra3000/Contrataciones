'use strict';

/*
 * pliego-plantillas-api.js
 * ORDEN-RONDA-16 §3 (H20) + RONDA-17 §4/§5. Manejadores HTTP de las plantillas
 * del pliego. La persistencia, selección por reglas, marcadores y validación
 * viven en pliego-plantillas.js; aquí las rutas, el rol (ADR-021) y los
 * eventos. Solo modifican (publicar, volver, editar) contrataciones_supervisor
 * o jurídica; todos los roles autenticados ven plantillas e historial
 * (§5 RONDA-17). La regeneración usa la versión estampada del expediente.
 */

const fs = require('node:fs');
const path = require('node:path');

function crearManejadoresPlantillas(entorno) {
  const {
    datosDir,
    ayudantes,
    eventos
  } = entorno;
  const { responderJson, parsearCuerpo, escribirAtomico, rutaExpediente } = ayudantes;
  const SGC = globalThis.SGC;

  // Carga diferida del núcleo para no acoplar el ciclo de arranque.
  const nucleo = require('./pliego-plantillas.js');
  const repo = SGC.adapters.repo;

  // Escritura con versión bump + historial de la previa (ADR-005/009).
  function escriboHist(exp, actual) {
    fs.mkdirSync(path.join(exp.dir, 'hist'), { recursive: true });
    escribirAtomico(path.join(exp.dir, 'hist', 'v' + actual.version + '.json'),
      JSON.stringify(actual, null, 2));
  }
  function escriboDatos(id, actualizado, contexto) {
    escribirAtomico(rutaExpediente(datosDir, id).datos, JSON.stringify(actualizado, null, 2));
    const entrada = repo.entradaIndice(id, actualizado, contexto);
    fs.mkdirSync(path.join(datosDir, 'idx'), { recursive: true });
    escribirAtomico(path.join(datosDir, 'idx', id + '.json'), JSON.stringify(entrada, null, 2));
  }

  function esPublicador(contexto) {
    const cx = contexto || {};
    if (!cx.rol) {
      return false;
    }
    const v = SGC.core.autorizacion.verificar(entorno.padronVivo.usuarios(), cx);
    return v.ok && nucleo.ROLES_PUBLICAN.indexOf(cx.rol) !== -1;
  }

  function versRespuesta(p, v) {
    return {
      id: p.id, nombre: p.nombre, contenido: v.contenido,
      version: v.version, vigente: v.vigente === true,
      criterios: v.criterios || {}, notaDeCambio: v.notaDeCambio
    };
  }

  function apiListar(req, res, textoCuerpo) {
    const plantillas = nucleo.cargar(datosDir).map((p) => nucleo.resumen(p));
    return responderJson(res, 200, plantillas);
  }

  function apiLeer(req, res, textoCuerpo, id) {
    const plantillas = nucleo.cargar(datosDir);
    const p = plantillas.find((x) => x.id === id);
    if (!p) {
      return responderJson(res, 404, { error: 'no existe la plantilla "' + id + '"' });
    }
    return responderJson(res, 200, {
      id: p.id,
      nombre: p.nombre,
      versiones: p.versions,
      vigenteVersion: p.vigenteVersion
    });
  }

  // Publica una versión nueva (o la v1): notaDeCambio, marcadores y huella probada.
  function apiPublicarVersion(req, res, textoCuerpo, id) {
    const cuerpo = parsearCuerpo(textoCuerpo) || {};
    if (!esPublicador(cuerpo.contexto)) {
      return responderJson(res, 403, { error: 'solo contrataciones_supervisor o jurídica pueden publicar plantillas' });
    }
    if (!id) {
      return responderJson(res, 400, { error: 'falta el id de la plantilla' });
    }
    const contenido = typeof cuerpo.contenido === 'string' ? cuerpo.contenido : '';
    const nombre = typeof cuerpo.nombre === 'string' ? cuerpo.nombre.trim() : '';
    const notaDeCambio = typeof cuerpo.notaDeCambio === 'string' ? cuerpo.notaDeCambio.trim() : '';
    if (contenido.trim() === '') {
      return responderJson(res, 400, { error: 'el contenido de la plantilla no puede estar vacío' });
    }
    if (notaDeCambio === '') {
      return responderJson(res, 400, { error: 'la nota de cambio es obligatoria (la versión vigente debe mantener el porqué del cambio)' });
    }
    const criterios = (cuerpo.criterios && typeof cuerpo.criterios === 'object') ? cuerpo.criterios : {};

    // Validación de marcadores (§3.3 paso 1).
    const validacion = nucleo.validarParaPublicar(contenido);
    if (!validacion.valido) {
      return responderJson(res, 422, { error: validacion.error, desconocidos: validacion.desconocidos });
    }
    // RONDA-17 §2: prueba atada al contenido (huella) en el servidor; el cliente
    // no la declara, y las versiones viejas se vuelven a probar al editar.
    if (!nucleo.estaProbada(contenido)) {
      return responderJson(res, 422, { error: 'publicar exige probar el pliego con "Probar ahora" antes (la prueba se ata al contenido exacto)' });
    }

    const plantillas = nucleo.cargar(datosDir);
    const encontrada = plantillas.find((x) => x.id === id);
    const ahora = new Date().toISOString();
    const autor = (cuerpo.contexto || {}).email || null;
    const vNueva = {
      version: encontrada ? encontrada.versions.length + 1 : 1,
      contenido, criterios, autor, fecha: ahora, vigente: true, notaDeCambio
    };

    let plantilla;
    if (encontrada) {
      encontrada.versions.push(vNueva);
      encontrada.versions.forEach((v) => { v.vigente = v.version === vNueva.version; });
      encontrada.vigenteVersion = vNueva.version;
      encontrada.nombre = nombre || encontrada.nombre;
      plantilla = encontrada;
    } else {
      plantilla = {
        id,
        nombre: nombre || id,
        creada: ahora,
        criterios,
        vigenteVersion: 1,
        versions: [vNueva]
      };
      plantillas.push(plantilla);
    }
    nucleo.guardar(datosDir, plantillas);

    // Registro de evento de plantilla (append-only, ya no es expediente).
    planillaEvento(datosDir, eventos, plantilla.id, 'publicar_version',
      { version: nucleo.versionVigente(plantilla).version, autor },
      cuerpo.contexto);

    return responderJson(res, 200, {
      id: plantilla.id,
      vigenteVersion: plantilla.vigenteVersion,
      notaDeCambio
    });
  }

  function apiVolver(req, res, textoCuerpo, id) {
    const cuerpo = parsearCuerpo(textoCuerpo) || {};
    if (!esPublicador(cuerpo.contexto)) {
      return responderJson(res, 403, { error: 'solo contrataciones_supervisor o jurídica pueden modificar plantillas' });
    }
    const version = parseInt(cuerpo.version, 10);
    const plantillas = nucleo.cargar(datosDir), p = plantillas.find((x) => x.id === id);
    if (!p) {
      return responderJson(res, 404, { error: 'no existe la plantilla "' + id + '"' });
    }
    const v = p.versions.find((x) => x.version === version);
    if (!v) {
      return responderJson(res, 404, { error: 'no existe la versión ' + version + ' de "' + id + '"' });
    }
    p.vigenteVersion = version;
    p.versions.forEach((x) => { x.vigente = x.version === version; });
    nucleo.guardar(datosDir, plantillas);
    planillaEvento(datosDir, eventos, id, 'volver_version',
      { version, autor: (cuerpo.contexto || {}).email || null }, cuerpo.contexto);
    return responderJson(res, 200, { id, vigenteVersion: version });
  }

  function apiSeleccionar(req, res, textoCuerpo) {
    const cuerpo = parsearCuerpo(textoCuerpo) || {};
    const atributos = (cuerpo.atributos && typeof cuerpo.atributos === 'object') ? cuerpo.atributos : {};
    const resultado = nucleo.seleccionar(nucleo.cargar(datosDir), atributos);
    return responderJson(res, 200, {
      plantillaId: resultado.plantilla ? resultado.plantilla.id : null,
      porDefecto: resultado.porDefecto,
      regla: resultado.regla
    });
  }

  function apiValidar(req, res, textoCuerpo, id) {
    const cuerpo = parsearCuerpo(textoCuerpo) || {};
    const contenido = typeof cuerpo.contenido === 'string' ? cuerpo.contenido : '';
    const m = nucleo.validarMarcadores(contenido);
    return responderJson(res, 200, m);
  }

  function apiProbar(req, res, textoCuerpo, id) {
    const probador = require('./pliego-probador.js');
    return probador.probar(req, res, textoCuerpo, id, entorno).catch(() => {});
  }

  // Deriva los atributos de selección (tipo de contrato, modalidad,
  // procedimiento) desde el expediente (reglas + tipo_contrato/tipo_documento).
  function atributosDeExpediente(expediente) {
    const datos = (expediente && typeof expediente.datos === 'object' && expediente.datos) || expediente || {};
    const req = (datos.requerimiento && typeof datos.requerimiento === 'object') ? datos.requerimiento : {};
    const a1 = (datos.anexo1 && typeof datos.anexo1 === 'object') ? datos.anexo1 : {};
    const str = (v) => (typeof v === 'string' ? v.trim() : '');

    // Normaliza la modalidad de compra a un valor estable para las reglas.
    const modal = String(str(req.modalidadCompra));
    const modalidad = /oca|orden de compra abierta/i.test(modal) ? 'OCA'
      : /directa/i.test(modal) ? 'directa' : modal;

    const tc = str(req.tipoContrato || a1.tipoContrato);
    const tipoContrato = /servicio/i.test(tc) ? 'servicios'
      : /bien/i.test(tc) ? 'bienes' : (tc || '');

    return {
      tipoContrato,
      modalidad: modalidad || str(req.claseModalidad) || '*',
      procedimiento: str(req.procedimientoSeleccion) || '*'
    };
  }

  // Estampa el id y la versión de la plantilla que produjo el pliego en el
  // expediente (versión bump + historial, como el resto de las escrituras).
  function apiEstampar(req, res, textoCuerpo, id) {
    const cuerpo = parsearCuerpo(textoCuerpo) || {};
    const exp = ayudantes.rutaExpediente(datosDir, id);
    if (!fs.existsSync(exp.datos)) {
      return responderJson(res, 404, { error: 'expediente no encontrado: ' + id });
    }
    const actual = JSON.parse(fs.readFileSync(exp.datos, 'utf8'));
    const atributos = atributosDeExpediente(actual);
    const sel = nucleo.seleccionar(nucleo.cargar(datosDir), atributos);
    if (!sel.plantilla) {
      return responderJson(res, 422, { error: 'no hay plantilla vigente que coincida con este expediente' });
    }
    const v = nucleo.versionVigente(sel.plantilla);
    const contexto = cuerpo.contexto || {};
    const nuevaVersion = actual.version + 1;
    escriboHist(exp, actual);
    const actualizado = JSON.parse(JSON.stringify(actual));
    actualizado.version = nuevaVersion;
    actualizado.plantilla = {
      id: sel.plantilla.id,
      version: v.version,
      fecha: new Date().toISOString(),
      porDefecto: !!sel.porDefecto
    };
    if (typeof contexto.timestamp === 'string' && typeof actualizado.actualizado === 'string') {
      actualizado.actualizado = contexto.timestamp;
    }
    if (typeof contexto.email === 'string' && typeof actualizado.ultimoUsuario === 'string') {
      actualizado.ultimoUsuario = contexto.email;
    }
    escriboDatos(id, actualizado, contexto);
    eventos.escribirEvento(datosDir, id, {
      tipo: 'plantilla_estampa',
      timestamp: new Date().toISOString(),
      plantillaId: sel.plantilla.id,
      plantillaVersion: v.version,
      porDefecto: !!sel.porDefecto,
      rol: contexto.rol || null,
      email: contexto.email || null
    });
    return responderJson(res, 200, {
      plantilla: actualizado.plantilla,
      porDefecto: !!sel.porDefecto
    });
  }

  // §4 (RONDA-17): regenerar usa la versión ESTAMPADA del expediente, no la
  // vigente de hoy; si esa versión ya no existe, se dice.
  function apiRegenerar(req, res, textoCuerpo, id) {
    const exp = ayudantes.rutaExpediente(datosDir, id);
    if (!fs.existsSync(exp.datos)) {
      return responderJson(res, 404, { error: 'expediente no encontrado: ' + id });
    }
    const estampa = JSON.parse(fs.readFileSync(exp.datos, 'utf8')).plantilla;
    if (!estampa || !estampa.id || typeof estampa.version !== 'number') {
      return responderJson(res, 422, { error: 'el expediente "' + id + '" no tiene plantilla estampada' });
    }
    const r = nucleo.versionDe(nucleo.cargar(datosDir), estampa.id, estampa.version);
    if (r.error) {
      return responderJson(res, 404, {
        error: 'la versión ' + estampa.version + ' de la plantilla "' + estampa.id +
          '" ya no existe: no se puede regenerar el pliego del expediente "' + id + '"'
      });
    }
    return responderJson(res, 200,
      Object.assign({ expedienteId: id }, versRespuesta(r.plantilla, r.version)));
  }

  // Entrega el contenido de la versión vigente para acompañar el YAML.
  function apiVigente(req, res, textoCuerpo, id) {
    const p = nucleo.cargar(datosDir).find((x) => x.id === id);
    if (!p) {
      return responderJson(res, 404, { error: 'no existe la plantilla "' + id + '"' });
    }
    const v = nucleo.versionVigente(p);
    if (!v) {
      return responderJson(res, 404, { error: 'la plantilla "' + id + '" no tiene versión vigente' });
    }
    return responderJson(res, 200, versRespuesta(p, v));
  }

  // §4 (RONDA-17): GET /api/plantillas/:id/versiones/:version entrega la
  // versión CONCRETA, sin caer a la vigente (la regeneración la usa así).
  function apiVersionEspecifica(req, res, textoCuerpo, id, numero) {
    const r = nucleo.versionDe(nucleo.cargar(datosDir), id, numero);
    if (r.error) {
      return responderJson(res, 404, { error: r.error });
    }
    return responderJson(res, 200, versRespuesta(r.plantilla, r.version));
  }

  function enrutar(req, res, conCuerpo, api) {
    const ruta = (req.url || '').split('?')[0];
    if (ruta === '/api/plantillas' && req.method === 'GET') {
      return conCuerpo((r, s, texto) => api.apiListarPlantillas(r, s, texto));
    }
    if (ruta === '/api/plantillas/seleccionar' && req.method === 'POST') {
      return conCuerpo((r, s, texto) => api.apiSeleccionarPlantilla(r, s, texto));
    }
    if (ruta.startsWith('/api/plantillas/')) {
      const partes = ruta.slice('/api/plantillas/'.length).split('/').filter(Boolean);
      if (partes.length === 1 && req.method === 'GET') {
        return conCuerpo((r, s, texto) => api.apiLeerPlantilla(r, s, texto, partes[0]));
      }
      if (partes.length === 2 && partes[1] === 'publicar' && req.method === 'POST') {
        return conCuerpo((r, s, texto) => api.apiPublicarVersion(r, s, texto, partes[0]));
      }
      if (partes.length === 2 && partes[1] === 'volver' && req.method === 'POST') {
        return conCuerpo((r, s, texto) => api.apiVolverVersion(r, s, texto, partes[0]));
      }
      if (partes.length === 2 && partes[1] === 'validar' && req.method === 'POST') {
        return conCuerpo((r, s, texto) => api.apiValidarPlantilla(r, s, texto, partes[0]));
      }
      if (partes.length === 2 && partes[1] === 'probar' && req.method === 'POST') {
        return conCuerpo((r, s, texto) => api.apiProbarPlantilla(r, s, texto, partes[0]));
      }
      if (partes.length === 2 && partes[1] === 'vigente' && req.method === 'GET') {
        return conCuerpo((r, s, texto) => api.apiVigentePlantilla(r, s, texto, partes[0]));
      }
      if (partes.length === 3 && partes[1] === 'versiones' && req.method === 'GET') {
        const numero = parseInt(partes[2], 10);
        if (!(numero > 0)) {
          return conCuerpo((r, s) => responderJson(s, 400, { error: 'la versión debe ser un número positivo' }));
        }
        return conCuerpo((r, s, texto) => api.apiVersionEspecificaPlantilla(r, s, texto, partes[0], numero));
      }
    }
    // Estampa §3.5: POST /api/expedientes/<id>/plantilla selecciona la plantilla
    // por las reglas, la estampa en el expediente y registra el evento.
    const mEstampa = ruta.match(/^\/api\/expedientes\/([^/]+)\/plantilla$/);
    if (mEstampa && req.method === 'POST') {
      return conCuerpo((r, s, texto) => api.apiEstampar(r, s, texto, mEstampa[1]), mEstampa[1]);
    }
    // §4 (RONDA-17): GET /api/expedientes/<id>/regenerar usa la versión
    // estampada del expediente (404 claro si esa versión ya no existe).
    const mRegenerar = ruta.match(/^\/api\/expedientes\/([^/]+)\/regenerar$/);
    if (mRegenerar && req.method === 'GET') {
      return conCuerpo((r, s, texto) => api.apiRegenerar(r, s, texto, mRegenerar[1]), mRegenerar[1]);
    }
    return null;
  }

  return {
    apiListarPlantillas: apiListar,
    apiLeerPlantilla: apiLeer,
    apiPublicarVersion,
    apiVolverVersion: apiVolver,
    apiSeleccionarPlantilla: apiSeleccionar,
    apiValidarPlantilla: apiValidar,
    apiProbarPlantilla: apiProbar,
    apiEstampar,
    apiVigentePlantilla: apiVigente,
    apiRegenerar,
    apiVersionEspecificaPlantilla: apiVersionEspecifica,
    atributosDeExpediente,
    enrutar,
    esPublicador
  };
}

function planillaEvento(datosDir, eventos, id, tipo, detalle, contexto) {
  try {
    const dir = path.join(datosDir, 'plantillas');
    fs.mkdirSync(dir, { recursive: true });
    const linea = JSON.stringify({
      tipo,
      plantillaId: id,
      timestamp: new Date().toISOString(),
      detalle,
      rol: contexto && contexto.rol || null,
      email: contexto && contexto.email || null
    }) + '\n';
    fs.appendFileSync(path.join(dir, 'eventos.jsonl'), linea, 'utf8');
  } catch (e) { /* el registro nunca debe tumbar una publicación */ }
}

module.exports = {
  crearManejadoresPlantillas,
  planillaEvento
};
