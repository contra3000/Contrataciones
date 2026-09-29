'use strict';

/*
 * transiciones-servidor-util.js
 * Andamiaje compartido por transiciones-servidor.test.js y
 * transiciones-servidor-matriz.test.js (ORDEN-RONDA-07 §2.2): el servidor
 * real con una carpeta de datos fresca, el contexto del padrón por rol
 * (ADR-021), los datos iniciales y el camino lineal del circuito hasta un
 * estado dado.
 */

const path = require('node:path');
const fs = require('node:fs');

const RAIZ = path.resolve(__dirname, '..', '..');

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
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.http.js'));

const { crearDirDatos, arrancarServidor, detenerServidor, pedir, enviarBytes } =
  require('./servidor-util.js');

const SGC = globalThis.SGC;
const config = SGC.core.config;
const ROLES = config.ROLES.map((r) => r.id);

// Correo del padrón (config/usuarios.ejemplo.json) para cada rol: el servidor
// cruza el contexto declarado contra el padrón antes de correr el motor
// (ADR-021), así que un rol sin su correo del padrón es rechazado en esa capa.
const EMAIL_POR_ROL = {
  generador: 'maria.gonzalez@faa.mil.ar',
  abastecimiento: 'juan.perez@faa.mil.ar',
  abastecimiento_supervisor: 'laura.fernandez@faa.mil.ar',
  contrataciones: 'carlos.ramirez@faa.mil.ar',
  contrataciones_supervisor: 'carlos.ramirez@faa.mil.ar',
  juridica: 'ana.torres@faa.mil.ar',
  contaduria: 'luis.diaz@faa.mil.ar'
};

function contexto(rol, extra) {
  return Object.assign({
    timestamp: '2026-08-18T10:00:00.000Z',
    email: EMAIL_POR_ROL[rol],
    rol,
    equipo: 'PC-ATAQUE-01'
  }, extra || {});
}

function datosIniciales() {
  return {
    titulo: 'Adquisición de resmas A4',
    anio: '2026',
    identificacion: {
      numero: '7',
      anio: '2026',
      dependenciaSolicitante: 'División Usuario',
      finalidad: 'Reposición de insumos',
      lugar: 'FAA - Unidad de destino',
      vigencia: '2026-12-31'
    },
    fechaCreacion: '2026-08-18',
    fechaLimite: '2026-09-30',
    prioridad: 'Alta',
    rubro: '4210',
    tipo: 'Bien común',
    renglones: [
      { codigo: '2.1.1-439.102', cantidad: 2, unidad: 'UN', rubro: '4210' }
    ]
  };
}

function rutaDatos(datosDir, id) {
  return path.join(datosDir, id.split('-')[0], id.split('-')[1] + '_Expediente', 'datos.json');
}

function docEnDisco(datosDir, id) {
  return JSON.parse(fs.readFileSync(rutaDatos(datosDir, id), 'utf8'));
}

function estadoEnDisco(datosDir, id) {
  return docEnDisco(datosDir, id).estado.id;
}

// Camino lineal del circuito (estadosSiguientes[0]) desde el estado inicial
// hasta `idEstado`, con el rol ejecutor de cada estado que se abandona.
function caminoHasta(idEstado) {
  const pasos = [];
  const porId = {};
  for (const e of config.ESTADOS) {
    porId[e.id] = e;
  }
  let actual = config.ESTADO_INICIAL;
  while (actual !== idEstado) {
    const def = porId[actual];
    const siguiente = (def.estadosSiguientes || [])[0];
    if (!siguiente) {
      throw new Error('sin camino hasta ' + idEstado + ' desde ' + actual);
    }
    pasos.push({ desde: actual, destino: siguiente, rol: def.rolEjecutor });
    actual = siguiente;
  }
  return pasos;
}

// ORDEN-RONDA-26 pieza 5: para avanzar de ESPECIFICACIONES_TECNICAS el motor
// exige dos valores de referencia por renglón, y cada uno cita un presupuesto
// que de verdad existe (el PUT que guarda los valores los valida contra los
// presupuestos, server/expedientes.js erroresDeRenglones). Se suben los dos
// archivos (PNG válido, ORDEN-RONDA-23 §3) y después se actualizan los
// valores. Cada subida versiona; la versión devuelta es la del PUT final.
async function cargarValoresEett(base, id, version, ctx, assert) {
  const firmaPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (let n = 1; n <= 2; n += 1) {
    const subida = await enviarBytes(base, '/api/expedientes/' + id + '/presupuestos', firmaPng, {
      'Content-Type': 'image/png',
      'X-SGC-Nombre-Original': encodeURIComponent('presupuesto-' + n + '.png'),
      'X-SGC-Contexto': encodeURIComponent(JSON.stringify(ctx))
    });
    assert.equal(subida.status, 201, 'se sube el presupuesto ' + n);
    assert.equal(subida.body.id, 'presupuesto-' + n);
    version = subida.body.version;
  }
  const leido = await pedir(base, 'GET', '/api/expedientes/' + id);
  assert.equal(leido.status, 200, 'se lee el expediente para cargar los valores');
  const exp = leido.body.expediente;
  exp.presupuestos = exp.presupuestos || [];
  for (const renglon of Array.isArray(exp.renglones) ? exp.renglones : []) {
    renglon.valoresReferencia = [
      { presupuestoId: 'presupuesto-1', base: 'unitario', valor: 100 },
      { presupuestoId: 'presupuesto-2', base: 'unitario', valor: 200 }
    ];
  }
  const c = await pedir(base, 'PUT', '/api/expedientes/' + id, {
    expediente: exp,
    versionEsperada: version,
    contexto: ctx
  });
  assert.equal(c.status, 200, 'se guardan los dos valores de referencia');
  return c.body.version;
}

async function crearEnEstado(base, datosDir, idEstado, assert) {
  const creado = await pedir(base, 'POST', '/api/expedientes', {
    datosIniciales: datosIniciales(),
    contexto: contexto('generador')
  });
  assert.equal(creado.status, 201, 'se crea el expediente');
  const id = creado.body.id;
  let version = creado.body.version;
  const pasos = caminoHasta(idEstado);
  for (const paso of pasos) {
    // ORDEN-RONDA-08 §2.1: el estado que se abandona ya produjo su documento;
    // se guarda antes de avanzar usando la versión que el guardado devuelve.
    const entrega = config.entregableDelEstado(paso.desde);
    if (entrega) {
      const g = await pedir(base, 'POST', '/api/expedientes/' + id + '/entregables', {
        id: entrega.id,
        nombre: entrega.archivo,
        contenido: '<p>Documento de ' + entrega.id + '</p>',
        contexto: contexto(paso.rol)
      });
      assert.equal(g.status, 201, 'se guarda el entregable ' + entrega.id);
      version = g.body.version;
    }
    // ORDEN-RONDA-26 pieza 5: para abandonar ESPECIFICACIONES_TECNICAS hay
    // que dejar cargados los dos valores de referencia por renglón.
    if (paso.desde === 'ESPECIFICACIONES_TECNICAS') {
      version = await cargarValoresEett(base, id, version, contexto(paso.rol), assert);
    }
    // ORDEN-RONDA-26 pieza 4: un estado con campos requeridos (SOLICITUD_
    // CONTRATACION exige `numeroSCo`) ya los completó antes de abandonarlo.
    const defPaso = config.ESTADOS.find((e) => e.id === paso.desde);
    const requeridos = (defPaso && defPaso.camposRequeridos) || [];
    if (requeridos.length > 0) {
      const leido = await pedir(base, 'GET', '/api/expedientes/' + id);
      assert.equal(leido.status, 200, 'se lee el expediente en ' + paso.desde);
      const exp = leido.body.expediente;
      exp.campos = exp.campos || {};
      for (const campo of requeridos) {
        exp.campos[campo] = 'Campo de prueba';
      }
      const c = await pedir(base, 'PUT', '/api/expedientes/' + id, {
        expediente: exp,
        versionEsperada: version,
        contexto: contexto(paso.rol)
      });
      assert.equal(c.status, 200, 'se completan los campos de ' + paso.desde);
      version = c.body.version;
    }
    const r = await pedir(base, 'POST', '/api/expedientes/' + id + '/avanzar', {
      versionEsperada: version,
      destino: paso.destino,
      contexto: contexto(paso.rol)
    });
    assert.equal(r.status, 200, 'camino hacia ' + idEstado + ': ' + paso.desde + ' -> ' + paso.destino);
    version = r.body.version;
    assert.equal(estadoEnDisco(datosDir, id), paso.destino, 'el servidor persiste el paso');
  }
  return { id, version };
}

async function arrancarEntorno() {
  const datosDir = crearDirDatos('sgc-transiciones-');
  const ctx = await arrancarServidor(datosDir);
  const base = 'http://127.0.0.1:' + ctx.puerto;
  return { datosDir, ctx, base };
}

async function limpiarEntorno(entorno) {
  await detenerServidor(entorno.ctx);
  if (entorno.datosDir) {
    fs.rmSync(entorno.datosDir, { recursive: true, force: true });
  }
}

module.exports = {
  SGC,
  config,
  ROLES,
  EMAIL_POR_ROL,
  contexto,
  datosIniciales,
  docEnDisco,
  estadoEnDisco,
  caminoHasta,
  crearEnEstado,
  cargarValoresEett,
  arrancarEntorno,
  limpiarEntorno,
  pedir,
  enviarBytes
};