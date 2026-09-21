'use strict';

/*
 * ronda-23-c4.test.js
 * ORDEN-RONDA-23 §4: el límite del presupuesto es 20 MB y se declara UNA sola
 * vez (core/limites.js). De ese único valor salen los tres consumidores:
 *
 *  - el control del servidor (server/presupuestos.js),
 *  - el aviso previo del cliente (views/requerimiento-presupuestos.js),
 *  - el texto del mensaje (el rechazo 413).
 *
 * El test que lo prueba de verdad: se cambia el número EN CALIENTE y se verifica
 * que los TRES cambien. También §4 pide el indicador de progreso a la vista.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

const { documento } = require('./helpers/dom-stub.js');
const { nodo } = require('./helpers/wizard-montura.js');
const su = require('./helpers/servidor-util.js');
const { contexto } = require('./helpers/transiciones-servidor-util.js');

const servidor = require(path.join(RAIZ, 'server', 'servidor.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'requerimiento-presupuestos.js'));

const SGC = globalThis.SGC;
const LIMITES = SGC.core.limites;

globalThis.document = documento;

function pdfDe(bytes) {
  const contenido = Buffer.alloc(bytes, 7);
  contenido.write('%PDF-1.4', 0, 'utf8');
  return contenido;
}

function cabeceras(tipo, nombre) {
  return {
    'Content-Type': tipo,
    'X-SGC-Nombre-Original': encodeURIComponent(nombre),
    'X-SGC-Contexto': encodeURIComponent(JSON.stringify(contexto('generador')))
  };
}

async function armarServidor() {
  const datosDir = su.crearDirDatos('sgc-p4-single-');
  const srv = servidor.crearServidor(datosDir, { declarado: true });
  await new Promise((res) => srv.listen(0, '127.0.0.1', res));
  return { datosDir, srv, base: 'http://127.0.0.1:' + srv.address().port };
}

async function cerrarServidor(entorno) {
  await new Promise((res) => {
    if (typeof entorno.srv.closeAllConnections === 'function') {
      entorno.srv.closeAllConnections();
    }
    entorno.srv.close(res);
  });
}

async function crearExpediente(base) {
  const r = await su.pedir(base, 'POST', '/api/expedientes', {
    datosIniciales: {
      titulo: 'Límite único', anio: '2026',
      renglones: [{ codigo: '2.1.1-439.102', cantidad: 1, unidad: 'UN' }]
    },
    contexto: contexto('generador')
  });
  assert.equal(r.status, 201, 'se crea el expediente');
  return r.body.id;
}

// Cambia el número vivo, corre la prueba y lo restaura pase lo que pase.
async function conLimite(bytes, tarea) {
  const original = LIMITES.LIMITE_PRESUPUESTO_BYTES;
  LIMITES.LIMITE_PRESUPUESTO_BYTES = bytes;
  try {
    return await tarea();
  } finally {
    LIMITES.LIMITE_PRESUPUESTO_BYTES = original;
  }
}

// ---------------------------------------------------------------------------
// 1. El texto y el mensaje siguen al número
// ---------------------------------------------------------------------------
test('cambiar el número cambia el texto del límite y el mensaje del rechazo', async () => {
  assert.equal(LIMITES.LIMITE_PRESUPUESTO_BYTES, 20 * 1024 * 1024, 'el límite es 20 MB');
  assert.equal(LIMITES.textoLimite(), '20 MB');
  await conLimite(3 * 1024 * 1024, () => {
    assert.equal(LIMITES.textoLimite(), '3 MB', 'el texto sigue al único valor');
    const mensaje = LIMITES.mensajeLimite(4 * 1024 * 1024);
    assert.match(mensaje, /límite de 3 MB/, 'el máximo sale del único valor');
    assert.match(mensaje, /4 MB/, 'el recibido también');
  });
  assert.equal(LIMITES.textoLimite(), '20 MB', 'se restaura solo');
});

// ---------------------------------------------------------------------------
// 2. El control del servidor sigue al número
// ---------------------------------------------------------------------------
test('bajar el número cambia el control del servidor: 1.5 MB se rechaza con 1 MB', async () => {
  const entorno = await armarServidor();
  try {
    const id = await crearExpediente(entorno.base);
    await conLimite(1 * 1024 * 1024, async () => {
      const r = await su.enviarBytes(entorno.base, '/api/expedientes/' + id + '/presupuestos',
        pdfDe(1536 * 1024), cabeceras('application/pdf', 'grande.pdf'));
      assert.equal(r.status, 413, 'con el número bajado, 1.5 MB no entra');
      assert.match(r.body.error, /límite de 1 MB/, 'el mensaje usa el número vivo');
      assert.match(r.body.error, /1\.5 MB/, 'dice lo que llegó');
    });
    // Restaurado el número, el MISMO servidor ya acepta ese archivo.
    const ok = await su.enviarBytes(entorno.base, '/api/expedientes/' + id + '/presupuestos',
      pdfDe(1536 * 1024), cabeceras('application/pdf', 'grande.pdf'));
    assert.equal(ok.status, 201, 'vuelto a 20 MB el mismo archivo entra');
  } finally {
    await cerrarServidor(entorno);
  }
});

// ---------------------------------------------------------------------------
// 3. El aviso del cliente sigue al número, antes de subir
// ---------------------------------------------------------------------------
function montarVista(repo, avisos) {
  const raiz = nodo('section', 'sgc-r23c4');
  const entrada = nodo('input', 'sgc-req-presupuesto-archivo');
  const lista = nodo('ul', 'sgc-req-presupuestos-lista');
  raiz.appendChild(entrada);
  raiz.appendChild(lista);
  const ganchos = {
    listos: () => true,
    repo: () => repo,
    expedienteId: () => '2026-999',
    contexto: () => ({ email: 'x@y' }),
    avisar: (mensaje, esError) => avisos.push({ mensaje, esError })
  };
  SGC.views.expediente = { abrir: () => {} };
  SGC.views.requerimientoPresupuestos.montar(raiz, ganchos);
  return { lista };
}

test('el aviso previo del cliente usa el número vivo: dice el máximo y el peso real', async () => {
  const avisos = [];
  let llamoAlRepo = false;
  const vista = montarVista({
    guardarPresupuesto: () => { llamoAlRepo = true; return Promise.resolve({ id: 'x' }); }
  }, avisos);
  try {
    await conLimite(1 * 1024 * 1024, async () => {
      vista.lista.textContent = '';
      SGC.views.requerimientoPresupuestos.subirArchivos([
        { name: 'grande.pdf', type: 'application/pdf', size: 2 * 1024 * 1024 }
      ]);
      assert.strictEqual(llamoAlRepo, false, 'no viaja al servidor: se avisa antes de leerlo');
      assert.match(vista.lista.textContent, /grande\.pdf/, 'el aviso va al lado del archivo');
      assert.match(vista.lista.textContent, /máximo de 1 MB/, 'el máximo sale del único valor');
      assert.match(vista.lista.textContent, /2 MB/, 'dice el tamaño real');
    });
  } finally {
    LIMITES.LIMITE_PRESUPUESTO_BYTES = 20 * 1024 * 1024;
  }
});

// ---------------------------------------------------------------------------
// 4. Indicador de progreso a la vista
// ---------------------------------------------------------------------------
test('mientras sube, la lista del archivo muestra el avance', async () => {
  const avisos = [];
  const vista = montarVista({
    guardarPresupuesto: (id, datos) => {
      datos.onProgress(512 * 1024, 1024 * 1024);
      return Promise.resolve({ id: 'presupuesto-1' });
    }
  }, avisos);
  vista.lista.textContent = '';
  SGC.views.requerimientoPresupuestos.subirArchivos([
    { name: 'cotizacion.pdf', type: 'application/pdf', size: 1024 * 1024 }
  ]);
  assert.match(vista.lista.textContent, /subiendo 50%/,
    'el progreso se ve en la lista, para que nadie lo lea como "se colgó"');
});
