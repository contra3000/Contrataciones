'use strict';

/*
 * requerimiento-servidor.test.js
 * ORDEN-RONDA-09 §3.3 (ADR-022/ADR-023): la pantalla de especificaciones
 * técnicas guarda por el mismo PUT de siempre y el servidor valida los
 * valores de referencia antes de escribir.
 *
 *  - Base ausente, valor negativo, base "total" con cantidad inválida o un
 *    presupuestoId que no existe en el expediente → 400 sin escritura.
 *  - Una aclaración de 300 caracteres (> MAX_ACLARACION = 256) se acepta
 *    completa por la API y queda en disco; el render del requerimiento la
 *    reemplaza por "según anexo <nombre>" y el anexo de EETT la imprime
 *    entera con la leyenda del ADR-023 en el pie.
 *
 * ORDEN-RONDA-10-CIERRE §1.3 (auditoría §2.1): verificaciones contra el
 * servidor real de los rechazos que faltaban:
 *  - Un cuerpo que supera el límite del servidor se responde con 413 y un
 *    mensaje en español (no se corta el socket sin decir nada).
 *  - La CREACIÓN valida los renglones igual que el PUT: forma inválida o un
 *    presupuestoId citado cuando todavía no hay presupuestos → 400.
 *  - La justificación tiene tope duro (MAX_JUSTIFICACION = 20000): 20.000
 *    caracteres entran, 20.001 no; también en el campo del encabezado.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

require(path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'config.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'roles.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'utils.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'auditoria.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'migraciones.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'validacion.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'requerimiento.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'estados.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'anexo-eett.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.http.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'documento.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'requerimiento.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'anexo-eett.js'));

const {
  contexto,
  arrancarEntorno,
  limpiarEntorno,
  docEnDisco,
  pedir
} = require('./helpers/transiciones-servidor-util.js');

const ENTORNO = {};

before(async () => {
  Object.assign(ENTORNO, await arrancarEntorno());
});

after(async () => {
  await limpiarEntorno(ENTORNO);
});

async function crearExpediente() {
  const r = await pedir(ENTORNO.base, 'POST', '/api/expedientes', {
    datosIniciales: {
      titulo: 'Con EETT', anio: '2026',
      renglones: [
        { codigo: '2.1.1-439.102', cantidad: 3, unidad: 'UN' },
        { codigo: '2.1.1-439.103', cantidad: 4, unidad: 'UN' }
      ]
    },
    contexto: contexto('generador')
  });
  assert.equal(r.status, 201, 'se crea el expediente');
  return r.body.id;
}

async function leerExpediente(id) {
  const r = await pedir(ENTORNO.base, 'GET', '/api/expedientes/' + id);
  assert.equal(r.status, 200);
  return r.body.expediente;
}

async function subirPresupuesto(id, nombre) {
  const r = await pedir(ENTORNO.base, 'POST', '/api/expedientes/' + id + '/presupuestos', {
    nombreOriginal: nombre + '.pdf',
    tipo: 'application/pdf',
    contenido: Buffer.from('%PDF-1.4 ' + nombre).toString('base64'),
    contexto: contexto('generador')
  });
  assert.equal(r.status, 201, 'el presupuesto se sube');
  return r.body.id;
}

function ponerValores(expediente, indice, valores) {
  const copia = JSON.parse(JSON.stringify(expediente));
  copia.renglones[indice].valoresReferencia = valores;
  return copia;
}

test('el PUT rechaza una fila sin base elegida y no escribe nada', async () => {
  const id = await crearExpediente();
  const pid = await subirPresupuesto(id, 'proveedor-x');
  const expediente = await leerExpediente(id);
  const roto = ponerValores(expediente, 0, [
    { presupuestoId: pid, valor: 100 }
  ]);
  const r = await pedir(ENTORNO.base, 'PUT', '/api/expedientes/' + id, {
    expediente: roto,
    versionEsperada: expediente.version,
    contexto: contexto('generador')
  });
  assert.equal(r.status, 400, 'la base es obligatoria');
  assert.ok(/base/i.test(JSON.stringify(r.body)), 'el error menciona la base');
  assert.equal(docEnDisco(ENTORNO.datosDir, id).version, expediente.version,
    'la versión en disco no cambia');
});

test('el PUT rechaza un valor negativo', async () => {
  const id = await crearExpediente();
  const pid = await subirPresupuesto(id, 'proveedor-x');
  const expediente = await leerExpediente(id);
  const roto = ponerValores(expediente, 0, [
    { presupuestoId: pid, base: 'unitario', valor: -1 }
  ]);
  const r = await pedir(ENTORNO.base, 'PUT', '/api/expedientes/' + id, {
    expediente: roto,
    versionEsperada: expediente.version,
    contexto: contexto('generador')
  });
  assert.equal(r.status, 400, 'un valor negativo no pasa');
  assert.equal(docEnDisco(ENTORNO.datosDir, id).version, expediente.version);
});

test('el PUT rechaza base "total" cuando la cantidad no permite normalizar', async () => {
  const id = await crearExpediente();
  const pid = await subirPresupuesto(id, 'proveedor-x');
  const expediente = await leerExpediente(id);
  // El renglón 2 tiene cantidad 4 > 0, así que se prueba sobre uno con
  // cantidad positiva pero se pide normalizar contra cantidad 0: el núcleo
  // exige cantidad positiva para base "total", así que se usa un renglón
  // con cantidad 0 creado ad-hoc en el propio PUT.
  const roto = ponerValores(expediente, 0, [
    { presupuestoId: pid, base: 'total', valor: 900 }
  ]);
  roto.renglones[0].cantidad = 0;
  const r = await pedir(ENTORNO.base, 'PUT', '/api/expedientes/' + id, {
    expediente: roto,
    versionEsperada: expediente.version,
    contexto: contexto('generador')
  });
  assert.equal(r.status, 400, 'base total con cantidad 0 no pasa');
  assert.equal(docEnDisco(ENTORNO.datosDir, id).version, expediente.version);
});

test('el PUT rechaza un presupuestoId que no existe en el expediente', async () => {
  const id = await crearExpediente();
  const expediente = await leerExpediente(id);
  const roto = ponerValores(expediente, 0, [
    { presupuestoId: 'presupuesto-99', base: 'unitario', valor: 100 }
  ]);
  const r = await pedir(ENTORNO.base, 'PUT', '/api/expedientes/' + id, {
    expediente: roto,
    versionEsperada: expediente.version,
    contexto: contexto('generador')
  });
  assert.equal(r.status, 400, 'no se puede citar un presupuesto ajeno');
  assert.ok(/presupuesto/i.test(JSON.stringify(r.body)));
  assert.equal(docEnDisco(ENTORNO.datosDir, id).version, expediente.version);
});

test('una aclaración de 300 caracteres entra completa y genera el anexo de EETT', async () => {
  const id = await crearExpediente();
  const pid = await subirPresupuesto(id, 'proveedor-x');
  const expediente = await leerExpediente(id);
  const textoLargo = 'Chapa galvanizada '.repeat(17) + 'con marco de acero';
  assert.ok(textoLargo.length > 256, 'la aclaración supera el límite impreso');
  assert.ok(textoLargo.length <= 2000, 'y entra dentro del límite total');

  const copia = JSON.parse(JSON.stringify(expediente));
  copia.renglones[0].aclaracion = textoLargo;
  copia.renglones[0].valoresReferencia = [
    { presupuestoId: pid, base: 'unitario', valor: 150 }
  ];
  const r = await pedir(ENTORNO.base, 'PUT', '/api/expedientes/' + id, {
    expediente: copia,
    versionEsperada: expediente.version,
    contexto: contexto('generador')
  });
  assert.equal(r.status, 200, 'la API acepta la aclaración larga');

  const enDisco = docEnDisco(ENTORNO.datosDir, id);
  assert.equal(enDisco.renglones[0].aclaracion, textoLargo,
    'el texto completo queda en disco, sin recortes');

  // Verificación del requerimiento y del anexo resultantes (§2.1): el
  // expediente plano que consume el render es el mismo que arma el cliente.
  const doc = {
    id: enDisco.id,
    version: enDisco.version,
    estado: enDisco.estado,
    renglones: enDisco.renglones,
    presupuestos: enDisco.presupuestos,
    requerimiento: enDisco.requerimiento || {}
  };
  const plan = SGC.core.anexoEett.planificar(doc);
  assert.equal(plan.anexos.length, 1, 'un solo renglón desborda');
  assert.equal(plan.anexos[0].nombre, 'alfa', 'el primero se llama alfa');

  const htmlReq = SGC.renders.requerimiento.componer(doc);
  assert.ok(htmlReq.indexOf('según anexo alfa') !== -1,
    'el requerimiento imprime la referencia, no el texto largo');
  assert.ok(htmlReq.indexOf(textoLargo) === -1,
    'y el texto completo no aparece en el requerimiento');

  const anexos = SGC.renders.anexoEett.componerTodos(doc);
  assert.equal(anexos.length, 1);
  assert.equal(anexos[0].archivo, 'anexo-eett-alfa.html');
  assert.ok(anexos[0].html.indexOf(textoLargo) !== -1,
    'el anexo contiene la aclaración completa');
  assert.ok(anexos[0].html.indexOf(SGC.renders.documento.LEYENDA_ADR023) !== -1,
    'el pie del anexo lleva la leyenda del ADR-023');
});

// ---------------------------------------------------------------------------
// ORDEN-RONDA-10-CIERRE §1.3: rechazos que faltaban, contra servidor real.
// ---------------------------------------------------------------------------

test('un cuerpo que supera el límite se responde con 413 y mensaje en español', async () => {
  const enorme = 'x'.repeat(5 * 1024 * 1024);
  const r = await pedir(ENTORNO.base, 'POST', '/api/expedientes', {
    datosIniciales: { titulo: enorme },
    contexto: contexto('generador')
  });
  assert.equal(r.status, 413, 'el servidor responde 413, no corta el socket');
  assert.ok(r.body && typeof r.body.error === 'string',
    'la respuesta es JSON con error');
  assert.match(r.body.error, /supera el límite/i);
  assert.match(r.body.error, /achique el contenido/i, 'el mensaje dice qué hacer');
});

test('la creación rechaza un renglón inválido (misma guardia que el PUT)', async () => {
  const r = await pedir(ENTORNO.base, 'POST', '/api/expedientes', {
    datosIniciales: {
      titulo: 'Renglón roto', anio: '2026',
      renglones: [
        { codigo: '2.1.1-439.102', cantidad: -1, unidad: 'UN' }
      ]
    },
    contexto: contexto('generador')
  });
  assert.equal(r.status, 400, 'cantidad negativa no crea expediente');
  assert.ok(/renglón 1/i.test(JSON.stringify(r.body)), 'el error señala el renglón');
});

test('la creación rechaza citar un presupuesto que todavía no existe', async () => {
  const r = await pedir(ENTORNO.base, 'POST', '/api/expedientes', {
    datosIniciales: {
      titulo: 'Cita fantasma', anio: '2026',
      renglones: [
        {
          codigo: '2.1.1-439.102', cantidad: 2, unidad: 'UN',
          valoresReferencia: [
            { presupuestoId: 'presupuesto-1', base: 'unitario', valor: 10 }
          ]
        }
      ]
    },
    contexto: contexto('generador')
  });
  assert.equal(r.status, 400, 'en la creación no hay presupuestos que citar');
  assert.match(JSON.stringify(r.body), /presupuesto/);
});

test('el PUT acepta una justificación de exactamente 20.000 caracteres', async () => {
  const id = await crearExpediente();
  const pid = await subirPresupuesto(id, 'proveedor-x');
  const expediente = await leerExpediente(id);
  const copia = JSON.parse(JSON.stringify(expediente));
  copia.fundamentacion = { justificacion: 'Necesidad. '.repeat(2000).slice(0, 20000) };
  assert.equal(copia.fundamentacion.justificacion.length, 20000);
  copia.renglones[0].valoresReferencia = [
    { presupuestoId: pid, base: 'unitario', valor: 150 }
  ];
  const r = await pedir(ENTORNO.base, 'PUT', '/api/expedientes/' + id, {
    expediente: copia,
    versionEsperada: expediente.version,
    contexto: contexto('generador')
  });
  assert.equal(r.status, 200, 'el tope duro es inclusivo hacia abajo');
  assert.equal(docEnDisco(ENTORNO.datosDir, id).fundamentacion.justificacion.length, 20000);
});

test('el PUT rechaza una justificación de 20.001 caracteres y de 50.000', async () => {
  const id = await crearExpediente();
  const pid = await subirPresupuesto(id, 'proveedor-x');

  // Caso límite: un carácter más que el tope ya no entra.
  const expediente = await leerExpediente(id);
  const limiteMasUno = JSON.parse(JSON.stringify(expediente));
  limiteMasUno.fundamentacion = { justificacion: 'a'.repeat(20001) };
  limiteMasUno.renglones[0].valoresReferencia = [
    { presupuestoId: pid, base: 'unitario', valor: 150 }
  ];
  const r1 = await pedir(ENTORNO.base, 'PUT', '/api/expedientes/' + id, {
    expediente: limiteMasUno,
    versionEsperada: expediente.version,
    contexto: contexto('generador')
  });
  assert.equal(r1.status, 400, '20001 > 20000: rechazado');
  assert.match(r1.body.error, /justificación/);
  assert.equal(docEnDisco(ENTORNO.datosDir, id).version, expediente.version);

  // El caso que pregunta la auditoría: pegar 50.000 caracteres.
  const pegote = await leerExpediente(id);
  const pegoteCopia = JSON.parse(JSON.stringify(pegote));
  pegoteCopia.fundamentacion = { justificacion: 'b'.repeat(50000) };
  pegoteCopia.renglones[0].valoresReferencia = [
    { presupuestoId: pid, base: 'unitario', valor: 150 }
  ];
  const r2 = await pedir(ENTORNO.base, 'PUT', '/api/expedientes/' + id, {
    expediente: pegoteCopia,
    versionEsperada: pegote.version,
    contexto: contexto('generador')
  });
  assert.equal(r2.status, 400, '50.000 caracteres tampoco entran');
  assert.equal(docEnDisco(ENTORNO.datosDir, id).version, pegote.version,
    'nada queda escrito con el texto desbordado');
});

test('el PUT también topa la "Justificación de la necesidad" del encabezado', async () => {
  const id = await crearExpediente();
  const pid = await subirPresupuesto(id, 'proveedor-x');
  const expediente = await leerExpediente(id);
  const copia = JSON.parse(JSON.stringify(expediente));
  copia.requerimiento = Object.assign({}, copia.requerimiento || {}, {
    justificacionNecesidad: 'c'.repeat(25000)
  });
  copia.renglones[0].valoresReferencia = [
    { presupuestoId: pid, base: 'unitario', valor: 150 }
  ];
  const r = await pedir(ENTORNO.base, 'PUT', '/api/expedientes/' + id, {
    expediente: copia,
    versionEsperada: expediente.version,
    contexto: contexto('generador')
  });
  assert.equal(r.status, 400, 'el campo del encabezado tiene el mismo tope');
  assert.match(r.body.error, /Justificación de la necesidad/);
  assert.equal(docEnDisco(ENTORNO.datosDir, id).version, expediente.version);
});
