'use strict';

/*
 * expediente-montura.js
 * Andamiaje compartido por expediente.test.js y expediente-matriz.test.js:
 * la montura DOM mínima de la vista, el expediente forzado a un estado dado,
 * y el repositorio falso que nunca persiste por su cuenta. ORDEN-RONDA-07 §2.2.
 */

const path = require('node:path');

const RAIZ = path.join(__dirname, '..', '..');

const { documento } = require('./dom-stub.js');
const { nodo } = require('./wizard-montura.js');

require(path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'config.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'roles.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'cotas-encabezado.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'utils.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'auditoria.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'migraciones.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'requerimiento.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'anexo-eett.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'validacion.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'estados.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'documento.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'especificacion-tecnica.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'requerimiento.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'solicitud-contratacion.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'vista-previa-pliego.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'disposicion-adjudicacion.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'orden-compra.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'anexo-1.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'expediente-dialogo.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'expediente.js'));

const SGC = globalThis.SGC;

const MARIA = {
  nombre: 'María', apellido: 'González',
  email: 'maria.gonzalez@faa.mil.ar',
  roles: ['generador'], sector: 'usuario'
};

const CONTEXTO_CREACION = {
  timestamp: '2026-08-14T10:00:00.000Z',
  email: MARIA.email,
  rol: 'generador',
  equipo: 'PC-PRUEBA-01'
};

function armarExpediente() {
  const app = nodo('main', 'app');
  const exp = nodo('section', 'sgc-expediente');

  const cab = nodo('header', 'sgc-expediente-cabecera');
  cab.appendChild(nodo('button', 'sgc-expediente-volver'));
  cab.appendChild(nodo('h2', 'sgc-expediente-titulo'));
  cab.appendChild(nodo('p', 'sgc-expediente-resumen'));
  exp.appendChild(cab);
  exp.appendChild(nodo('p', 'sgc-expediente-mensaje'));

  const conflicto = nodo('div', 'sgc-expediente-conflicto');
  conflicto.hidden = true;
  conflicto.appendChild(nodo('p', 'sgc-expediente-conflicto-texto'));
  conflicto.appendChild(nodo('button', 'sgc-expediente-recargar'));
  exp.appendChild(conflicto);

  const cuerpo = nodo('div', 'sgc-expediente-cuerpo');
  const secDatos = nodo('section', 'sgc-expediente-datos-seccion');
  secDatos.appendChild(nodo('dl', 'sgc-expediente-datos'));
  cuerpo.appendChild(secDatos);
  const secReng = nodo('section', 'sgc-expediente-renglones-seccion');
  secReng.appendChild(nodo('ul', 'sgc-expediente-renglones'));
  cuerpo.appendChild(secReng);
  exp.appendChild(cuerpo);

  // Documento del estado (ORDEN-RONDA-08 §2.1): la vista compone la plantilla
  // correspondiente según el estado; la montura aporta la sección y el título.
  const secDoc = nodo('section', 'sgc-expediente-documento-seccion');
  secDoc.appendChild(nodo('h3', 'sgc-expediente-documento-titulo'));
  secDoc.appendChild(nodo('div', 'sgc-expediente-documento'));
  exp.appendChild(secDoc);

  const avisoArchivo = nodo('p', 'sgc-expediente-archivado');
  avisoArchivo.hidden = true;
  exp.appendChild(avisoArchivo);

  const acciones = nodo('section', 'sgc-expediente-acciones');
  const b1 = nodo('div', 'sgc-expediente-avanzar-bloque');
  b1.appendChild(nodo('button', 'sgc-expediente-avanzar'));
  b1.appendChild(nodo('p', 'sgc-expediente-avanzar-porque'));
  acciones.appendChild(b1);
  const b2 = nodo('div', 'sgc-expediente-devolver-bloque');
  b2.appendChild(nodo('button', 'sgc-expediente-devolver'));
  b2.appendChild(nodo('p', 'sgc-expediente-devolver-porque'));
  acciones.appendChild(b2);
  exp.appendChild(acciones);

  const secAud = nodo('section', 'sgc-expediente-auditoria-seccion');
  secAud.appendChild(nodo('ol', 'sgc-expediente-auditoria'));
  exp.appendChild(secAud);
  app.appendChild(exp);

  const dialogo = nodo('div', 'sgc-expediente-dialogo');
  dialogo.hidden = true;
  dialogo.appendChild(nodo('h3', 'sgc-expediente-dialogo-titulo'));
  const dDest = nodo('div', 'sgc-expediente-dialogo-destino-bloque');
  dDest.appendChild(nodo('select', 'sgc-expediente-dialogo-destino'));
  dialogo.appendChild(dDest);
  const dMot = nodo('div', 'sgc-expediente-dialogo-motivo-bloque');
  dMot.appendChild(nodo('select', 'sgc-expediente-dialogo-motivo'));
  dialogo.appendChild(dMot);
  const dObs = nodo('div', 'sgc-expediente-dialogo-observacion-bloque');
  dObs.appendChild(nodo('textarea', 'sgc-expediente-dialogo-observacion'));
  dialogo.appendChild(dObs);
  const dAcc = nodo('div', 'sgc-expediente-dialogo-acciones');
  dAcc.appendChild(nodo('button', 'sgc-expediente-dialogo-confirmar'));
  dAcc.appendChild(nodo('button', 'sgc-expediente-dialogo-cancelar'));
  dialogo.appendChild(dAcc);
  app.appendChild(dialogo);

  return { raiz: app, nodos: documento.porId };
}

function expedienteEnEstado(idEstado, numero) {
  const def = SGC.core.config.ESTADOS.find((e) => e.id === idEstado);
  const expediente = SGC.adapters.repo.construirExpediente({
    titulo: 'Expediente ' + numero,
    anio: '2026',
    identificacion: {
      numero: String(numero),
      anio: '2026',
      dependenciaSolicitante: 'División Usuario',
      finalidad: 'Reposición de insumos',
      lugar: 'FAA - Unidad de destino',
      vigencia: '2026-12-31'
    },
    fechaCreacion: '2026-08-14',
    fechaLimite: '2026-09-01',
    prioridad: 'Alta',
    rubro: '4210',
    tipo: 'Bien común',
    renglones: [
      { codigo: '2.1.1-439.102', cantidad: 2, unidad: 'UN', rubro: '4210' }
    ]
  }, CONTEXTO_CREACION, '2026-' + numero);
  expediente.estado = {
    id: idEstado,
    fase: def ? def.fase : null,
    desde: '2026-08-14T10:00:00.000Z'
  };
  // ORDEN-RONDA-08 §2.1: un expediente que está en un estado productor ya
  // generó su documento; sin él, el motor no lo deja avanzar.
  expediente.entregables = (def && def.entregablesObligatorios || []).slice();
  return expediente;
}

function repoFalso(montaje) {
  let expedienteActual = null;
  const guardados = [];
  const leidos = [];
  const repo = {
    _expediente: expedienteActual,
    _guardados: guardados,
    _leidos: leidos,
    leerExpediente: (id) => {
      leidos.push(id);
      return Promise.resolve({ expediente: expedienteActual, version: 1 });
    },
    guardarExpediente: (id, expedienteNuevo, versionEsperada, contexto) => {
      guardados.push({ id, expediente: expedienteNuevo, versionEsperada, contexto });
      return montaje.guardar(expedienteNuevo, versionEsperada, contexto);
    },
    avanzar: (id, versionEsperada, destino, contexto) => {
      guardados.push({ id, destino, versionEsperada, contexto });
      return montaje.guardar(null, versionEsperada, contexto);
    },
    devolver: (id, versionEsperada, destino, idMotivo, observacion, contexto) => {
      guardados.push({ id, destino, idMotivo, observacion, versionEsperada, contexto });
      return montaje.guardar(null, versionEsperada, contexto);
    },
    fijarExpediente: (expediente) => {
      expedienteActual = expediente;
    }
  };
  return repo;
}

module.exports = {
  SGC,
  MARIA,
  CONTEXTO_CREACION,
  armarExpediente,
  expedienteEnEstado,
  repoFalso
};