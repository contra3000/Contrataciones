'use strict';

/*
 * ronda-27-c5-vista.test.js
 * ORDEN-RONDA-27 pieza 5 · la pantalla del ANEXO I, del lado del navegador.
 *
 * En ronda-27-c5.test.js el ANEXO I se prueba por la API, contra el servidor real.
 * Acá se prueba la otra mitad de la misma pieza: lo que hace la vista cuando el
 * registro de la SCo llega por la red, que es un problema distinto y muy fácil
 * de arruinar.
 *
 *  1. El número de SCo se lee de donde el expediente lo guarda de verdad
 *     (`campos.numeroSCo`, ORDEN-RONDA-26 §P4). Si se lo busca en otro lado, la
 *     vista no ve la SCo y todo lo demás pasa inadvertido.
 *  2. Cuando llega el registro, se precargan TODOS los campos, no los primeros
 *     tres: los que no vinieran seguirían mostrando los del expediente que se
 *     está mirando, que es un dato que no es de la SCo.
 *  3. Al cambiar de expediente no queda pegado el `anexo1Sco` del anterior, ni
 *     la versión de su registro (con la que se guardaría contra el registro
 *     equivocado), ni el renglón de un registro que llegó tarde.
 *  4. El guardado va contra la versión del REGISTRO, y el mensaje que queda
 *     sigue arrancando con "ANEXO 1 guardado (versión", que es lo que comprueba
 *     la recorrida de la ronda 20.
 *  5. El documento se vuelve a componer cuando llega el registro, para que lo
 *     que se imprime sea el de la SCo y no el del expediente.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

const { documento, Nodo } = require('./helpers/dom-stub.js');

require(path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'config.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'utils.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'requerimiento.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'expediente.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'anexo-uno.js'));

const SGC = globalThis.SGC;

const NODOS_EXIGIDOS = [
  'sgc-anexo1-msj',
  'sgc-anexo1-objeto',
  'sgc-anexo1-justificacion',
  'sgc-anexo1-unidad-resp',
  'sgc-anexo1-usuario-gde',
  'sgc-anexo1-unidad-dir',
  'sgc-anexo1-unidad-tel',
  'sgc-anexo1-unidad-correo',
  'sgc-anexo1-lugar-entrega',
  'sgc-anexo1-lugar-fact',
  'sgc-anexo1-requisitos',
  'sgc-anexo1-empresas',
  'sgc-anexo1-precio-ref',
  'sgc-anexo1-moneda-ext',
  'sgc-anexo1-pac-previsto',
  'sgc-anexo1-pac-orden',
  'sgc-anexo1-pac-trimestre',
  'sgc-anexo1-comision',
  'sgc-anexo1-personal',
  'sgc-anexo1-visita',
  'sgc-anexo1-interadmin',
  'sgc-anexo1-bienes-uso',
  'sgc-anexo1-hw-sw',
  'sgc-anexo1-reparaciones',
  'sgc-anexo1-doc-obligatoria',
  'sgc-anexo1-criterio',
  'sgc-anexo1-guardar',
  // Bloque de la SCo de la pieza 5 (opcional para `montar`, necesario para
  // comprobar que se pinta).
  'sgc-anexo1-sco',
  'sgc-anexo1-sco-capitulo',
  'sgc-anexo1-sco-nota'
];

const OPERADOR = {
  nombre: 'Juan', apellido: 'Pérez',
  email: 'juan.perez@faa.mil.ar',
  roles: ['abastecimiento'], sector: 'usuario', equipo: 'PC-PRUEBA-01'
};

before(() => {
  globalThis.document = documento;
});

function armarFormulario() {
  const raiz = new Nodo('section', 'sgc-anexo1-seccion');
  const nodos = {};
  for (const id of NODOS_EXIGIDOS) {
    const tag = id === 'sgc-anexo1-pac-trimestre'
      ? 'select'
      : (id === 'sgc-anexo1-pac-previsto' ? 'input' : 'input');
    const nodo = new Nodo(tag, id);
    raiz.appendChild(nodo);
    nodos[id] = nodo;
  }
  // La tabla de renglones de la SCo, con su cuerpo.
  const tabla = new Nodo('table', 'sgc-anexo1-sco-renglones');
  const cuerpo = new Nodo('tbody', 'sgc-anexo1-sco-cuerpo');
  tabla.appendChild(cuerpo);
  nodos['sgc-anexo1-sco-renglones'] = tabla;
  nodos['sgc-anexo1-sco-cuerpo'] = cuerpo;
  raiz.appendChild(tabla);
  return { raiz, nodos };
}

function expedienteEnSco(id, numeroSCo, datosExtra) {
  return {
    expedienteId: id,
    version: 4,
    estado: { id: 'ANALISIS_SCo' },
    // La forma real del expediente: el número de SCo vive en `campos`
    // (ORDEN-RONDA-26 §P4), no en `datos`.
    campos: { numeroSCo: numeroSCo },
    datos: Object.assign({
      titulo: 'Adquisición de resmas A4',
      identificacion: { numero: '7' },
      renglones: [{ codigo: '2.1.1-439.102', cantidad: 2, unidad: 'UN' }]
    }, datosExtra || {})
  };
}

function registroDeSco(numeroSCo, anexo1) {
  return {
    numeroSCo: numeroSCo,
    version: 5,
    expedientes: ['2026-001', '2026-007'],
    anexo1: anexo1,
    anexo1Origen: 'sco',
    anexo1PuntoDePartida: null,
    renglones: [{
      codigo: '2.1.1-439.102',
      cantidad: 4,
      unidad: 'UN',
      desglose: [{ expediente: '2026-001', cantidad: 2 }, { expediente: '2026-007', cantidad: 2 }]
    }]
  };
}

// Un repositorio falso con las promesas bajo control: `leerSCo` se resuelve
// cuando se le dice, para poder simular la llegada tardía.
function repoFalso(registrosPorNumero) {
  const guardados = [];
  const pendientes = [];
  return {
    _guardados: guardados,
    _pendientes: pendientes,
    leerSCo: function (numero) {
      return new Promise(function (resolve) {
        pendientes.push({ numero: numero, resolver: resolve });
      });
    },
    resolverLectura: function (numero, registro) {
      for (const p of pendientes) {
        if (p.numero === numero) {
          p.resolver(registro);
        }
      }
    },
    guardarAnexo1Sco: function (numero, anexo1, version, contexto) {
      guardados.push({ numero: numero, anexo1: anexo1, version: version, contexto: contexto });
      return Promise.resolve({
        ok: true,
        version: version + 1,
        registro: registroDeSco(numero, anexo1)
      });
    }
  };
}

function nuevaVuelta() {
  return new Promise(function (resolve) {
    setTimeout(resolve, 0);
  });
}

// La vista de expediente fingida: la del ANEXO I lee de ahí el expediente en
// pantalla y avisa cuando hay que recomponer el documento.
function fingirVistaExpediente(actual) {
  const recomposiciones = [];
  SGC.views.expediente = {
    obtener: function () { return { expediente: actual, version: actual ? actual.version : 0 }; },
    recomponerDocumento: function (exp) { recomposiciones.push(exp); },
    _recomposiciones: recomposiciones
  };
  return SGC.views.expediente;
}

function montarTodo(registrosPorNumero) {
  const { raiz, nodos } = armarFormulario();
  const repo = repoFalso(registrosPorNumero);
  SGC.views.anexoUno.montar(raiz);
  SGC.views.anexoUno.fijarRepo(repo);
  SGC.views.anexoUno.seleccionarOperador(OPERADOR);
  return { raiz, nodos, repo };
}

// El nodo donde caen las filas de la tabla de renglones de la SCo, que la vista
// busca por su propio identificador.
function cuerpoDeRenglones(raiz) {
  return raiz.querySelector('#sgc-anexo1-sco-cuerpo');
}

test('RONDA-27 pieza 5 · la vista ve la SCo por el número que el expediente guarda en `campos`', async () => {
  const { raiz, nodos, repo } = montarTodo();
  const expediente = expedienteEnSco('2026-001', '14/2026');
  fingirVistaExpediente(expediente);

  SGC.views.anexoUno.actualizar(expediente);
  await nuevaVuelta();
  repo.resolverLectura('14/2026', registroDeSco('14/2026', {
    objeto: 'Análisis de la SCo'
  }));
  await nuevaVuelta();

  assert.equal(SGC.views.anexoUno.versionSco(), 5,
    'leyó el registro de la SCo 14/2026: encontró el número en `campos.numeroSCo`');
  assert.equal(nodos['sgc-anexo1-sco'].hidden, false, 'y muestra el bloque de la SCo');
  assert.ok(nodos['sgc-anexo1-sco-capitulo'].textContent.includes('SCo 14/2026'),
    'con el número de la SCo en el capítulo');
  assert.ok(nodos['sgc-anexo1-sco-capitulo'].textContent.includes('2026-001, 2026-007'),
    'y los dos expedientes que la componen');

  const cuerpo = cuerpoDeRenglones(raiz);
  assert.equal(cuerpo.children.length, 1, 'la tabla tiene el renglón consolidado');
  assert.equal(cuerpo.children[0].children[2].textContent, '4', 'con la cantidad sumada');
  assert.equal(cuerpo.children[0].children[4].textContent, '2026-001: 2 · 2026-007: 2',
    'y el desglose de quién pidió qué');
});

test('RONDA-27 pieza 5 · con registro, se precargan TODOS los campos, no los primeros', async () => {
  const { nodos, repo } = montarTodo();
  const expediente = expedienteEnSco('2026-001', '14/2026', {
    // El expediente tiene su propio ANEXO I, con valores propios. Si al llegar el
    // registro de la SCo no se pisan todos los campos, estos quedan en pantalla y
    // se pueden guardar como si fueran de la SCo.
    anexo1: {
      objeto: 'objeto DEL EXPEDIENTE',
      justificacion: 'justificación DEL EXPEDIENTE',
      unidadResponsable: 'unidad DEL EXPEDIENTE',
      lugarEntrega: 'lugar DEL EXPEDIENTE',
      criterioEvaluacion: 'criterio DEL EXPEDIENTE',
      requisitosMinimos: 'requisitos DEL EXPEDIENTE'
    }
  });
  fingirVistaExpediente(expediente);

  SGC.views.anexoUno.actualizar(expediente);
  assert.equal(nodos['sgc-anexo1-objeto'].value, 'objeto DEL EXPEDIENTE',
    'mientras no llega el registro se ve el del expediente, como siempre');

  repo.resolverLectura('14/2026', registroDeSco('14/2026', {
    objeto: 'objeto DE LA SCO',
    justificacion: 'justificación DE LA SCO',
    unidadResponsable: 'unidad DE LA SCO',
    lugarEntrega: 'lugar DE LA SCO',
    criterioEvaluacion: 'criterio DE LA SCO',
    requisitosMinimos: 'requisitos DE LA SCO'
  }));
  await nuevaVuelta();

  assert.equal(nodos['sgc-anexo1-objeto'].value, 'objeto DE LA SCO');
  assert.equal(nodos['sgc-anexo1-justificacion'].value, 'justificación DE LA SCO');
  assert.equal(nodos['sgc-anexo1-unidad-resp'].value, 'unidad DE LA SCO');
  assert.equal(nodos['sgc-anexo1-lugar-entrega'].value, 'lugar DE LA SCO');
  assert.equal(nodos['sgc-anexo1-criterio'].value, 'criterio DE LA SCO');
  assert.equal(nodos['sgc-anexo1-requisitos'].value, 'requisitos DE LA SCO',
    'los seis campos que trae el registro, todos de la SCo');
  assert.equal(nodos['sgc-anexo1-personal'].value, '',
    'y el que el registro no trae queda vacío, no con el del expediente: ' +
    'el dato es de la SCo y no existe');
});

test('RONDA-27 pieza 5 · al cambiar de expediente no queda pegado el registro de la SCo anterior', async () => {
  const { raiz, nodos, repo } = montarTodo();
  const primero = expedienteEnSco('2026-001', '14/2026');
  fingirVistaExpediente(primero);
  SGC.views.anexoUno.actualizar(primero);
  repo.resolverLectura('14/2026', registroDeSco('14/2026', { objeto: 'objeto de la SCo 14' }));
  await nuevaVuelta();
  assert.equal(SGC.views.anexoUno.versionSco(), 5, 'el primero tiene su registro');

  // Ahora se abre otro expediente, de OTRA SCo.
  const segundo = expedienteEnSco('2026-009', '15/2026');
  fingirVistaExpediente(segundo);
  SGC.views.anexoUno.actualizar(segundo);
  await nuevaVuelta();

  assert.equal(primero.datos.anexo1Sco, undefined,
    'el expediente anterior NO conserva el `anexo1Sco`: si lo conservara, su ' +
    'documento seguiría saliendo con el ANEXO I de la SCo que ya se cerró');
  assert.equal(SGC.views.anexoUno.versionSco(), null,
    'y la versión cacheada es null: guardar sin recargar no va contra el registro viejo');
  assert.equal(nodos['sgc-anexo1-sco'].hidden, true,
    'el bloque de la SCo anterior se oculta: sus renglones sumados no son de esta');
  assert.equal(cuerpoDeRenglones(raiz).children.length, 0,
    'con la tabla vacía: los renglones sumados eran de la SCo anterior');

  repo.resolverLectura('15/2026', registroDeSco('15/2026', { objeto: 'objeto de la SCo 15' }));
  await nuevaVuelta();
  assert.equal(nodos['sgc-anexo1-objeto'].value, 'objeto de la SCo 15');
  assert.equal(nodos['sgc-anexo1-sco'].hidden, false,
    'y el bloque vuelve a aparecer con los renglones de la SCo que se está viendo');
  assert.equal(SGC.views.anexoUno.versionSco(), 5);
  assert.equal(segundo.datos.anexo1Sco.numeroSCo, '15/2026',
    'y ahora el registro colgado es el de la SCo que se está viendo');
  assert.equal(cuerpoDeRenglones(raiz).children.length, 1,
    'con los renglones de la SCo nueva, no los de la anterior');
});

test('RONDA-27 pieza 5 · lo que llega tarde de la SCo anterior no se pinta', async () => {
  const { raiz, nodos, repo } = montarTodo();
  const primero = expedienteEnSco('2026-001', '14/2026');
  fingirVistaExpediente(primero);
  SGC.views.anexoUno.actualizar(primero);

  // Antes de que llegue el registro de la 14, el usuario abre otro expediente.
  const segundo = expedienteEnSco('2026-009', '15/2026');
  fingirVistaExpediente(segundo);
  SGC.views.anexoUno.actualizar(segundo);

  // Llega la respuesta de la 14: es de otro expediente y no se pinta.
  repo.resolverLectura('14/2026', registroDeSco('14/2026', { objeto: 'objeto de la 14' }));
  await nuevaVuelta();

  assert.equal(SGC.views.anexoUno.versionSco(), null,
    'no se tomó la versión de una SCo que ya no se está viendo');
  assert.notEqual(nodos['sgc-anexo1-objeto'].value, 'objeto de la 14',
    'ni se escribió el objeto de la SCo anterior en el formulario nuevo');
  assert.equal(nodos['sgc-anexo1-objeto'].value, 'Adquisición de resmas A4',
    'que muestra la precarga del expediente nuevo, como corresponde');
  assert.equal(segundo.datos.anexo1Sco, undefined,
    'ni se colgó en el expediente que se está mostrando');
  assert.equal(cuerpoDeRenglones(raiz).children.length, 0,
    'y no se pintaron los renglones de la SCo que ya no se está viendo');
});

test('RONDA-27 pieza 5 · el guardado va contra la versión del registro y el mensaje sigue siendo el de siempre', async () => {
  const { nodos, repo } = montarTodo();
  const expediente = expedienteEnSco('2026-001', '14/2026');
  fingirVistaExpediente(expediente);
  SGC.views.anexoUno.actualizar(expediente);
  repo.resolverLectura('14/2026', registroDeSco('14/2026', { objeto: 'objeto de la SCo' }));
  await nuevaVuelta();

  nodos['sgc-anexo1-criterio'].value = 'menor precio';
  nodos['sgc-anexo1-guardar'].click();
  await nuevaVuelta();

  assert.equal(repo._guardados.length, 1, 'se guardó una vez');
  const guardado = repo._guardados[0];
  assert.equal(guardado.numero, '14/2026', 'contra la SCo del expediente abierto');
  assert.equal(guardado.version, 5, 'con la versión del REGISTRO, no la del expediente');
  assert.equal(guardado.anexo1.criterioEvaluacion, 'menor precio', 'con lo del formulario');
  assert.equal(guardado.contexto.email, 'juan.perez@faa.mil.ar', 'y con quién');

  const msj = nodos['sgc-anexo1-msj'].textContent;
  assert.ok(msj.indexOf('ANEXO 1 guardado (versión ') === 0,
    'el mensaje arranca con el texto de siempre, que es el que comprueba la ronda 20: ' + msj);
  assert.ok(msj.includes('14/2026'), 'y dice de qué SCo es');
  assert.ok(msj.includes('2 requerimientos'), 'y para cuántos requerimientos vale');

  // El segundo guardado usa la versión que devolvió el primero, sin recargar.
  nodos['sgc-anexo1-criterio'].value = 'precio y plazo';
  nodos['sgc-anexo1-guardar'].click();
  await nuevaVuelta();
  assert.equal(repo._guardados.length, 2, 'se guardó de nuevo');
  assert.equal(repo._guardados[1].version, 6,
    'contra la versión nueva, que es la que se tenía en pantalla: no contra la vieja');
});

test('RONDA-27 pieza 5 · si el registro todavía no llegó, esperar su versión en vez de inventar una', async () => {
  const { nodos, repo } = montarTodo();
  const expediente = expedienteEnSco('2026-001', '14/2026');
  fingirVistaExpediente(expediente);
  SGC.views.anexoUno.actualizar(expediente);
  await nuevaVuelta();

  // Se escribe un campo y se guarda antes de que llegue el registro.
  nodos['sgc-anexo1-objeto'].value = 'objeto escrito antes de que llegara';
  nodos['sgc-anexo1-guardar'].click();
  await nuevaVuelta();

  assert.equal(repo._guardados.length, 0,
    'no se llama al repositorio con una versión que no se leyó');
  assert.ok(nodos['sgc-anexo1-msj'].textContent.includes('Se guarda en cuanto llegue'),
    'y el mensaje avisa que se guarda al llegar el registro: ' +
      nodos['sgc-anexo1-msj'].textContent);

  // Cuando el registro llega, el guardado sale solo, contra su versión.
  repo.resolverLectura('14/2026', registroDeSco('14/2026', null));
  await nuevaVuelta();
  await nuevaVuelta();

  assert.equal(repo._guardados.length, 1, 'el clic que se había perdido se guarda al llegar');
  assert.equal(repo._guardados[0].version, 5, 'contra la versión del registro que llegó');
  assert.equal(repo._guardados[0].anexo1.objeto, 'objeto escrito antes de que llegara',
    'con lo que se había escrito al hacer el clic, no con lo que se repintó después');
});

test('RONDA-27 pieza 5 · al llegar el registro se vuelve a componer el documento, para que imprima el de la SCo', async () => {
  const { repo } = montarTodo();
  const expediente = expedienteEnSco('2026-001', '14/2026');
  const vista = fingirVistaExpediente(expediente);
  vista._recomposiciones.length = 0;

  SGC.views.anexoUno.actualizar(expediente);
  const antesDeLLegar = vista._recomposiciones.length;

  repo.resolverLectura('14/2026', registroDeSco('14/2026', { objeto: 'objeto de la SCo' }));
  await nuevaVuelta();

  assert.ok(vista._recomposiciones.length > antesDeLLegar,
    'se pidió recomponer el documento cuando llegó el registro');
  assert.equal(vista._recomposiciones[vista._recomposiciones.length - 1], expediente,
    'para el expediente que está en pantalla');
  assert.equal(expediente.datos.anexo1Sco.anexo1.objeto, 'objeto de la SCo',
    'y el documento tiene el ANEXO I de la SCo, que es lo que se imprimirá');
  assert.deepEqual(expediente.datos.anexo1Sco.renglones[0].desglose.length, 2,
    'con los renglones consolidados y su desglose');
});

test('RONDA-27 pieza 5 · sin SCo, el bloque no aparece y el ANEXO I sigue siendo el del expediente', async () => {
  const { nodos, repo } = montarTodo();
  const expediente = expedienteEnSco('2026-001', null, {
    anexo1: { objeto: 'objeto del expediente', criterioEvaluacion: 'menor precio' }
  });
  fingirVistaExpediente(expediente);

  SGC.views.anexoUno.actualizar(expediente);
  await nuevaVuelta();

  assert.equal(nodos['sgc-anexo1-sco'].hidden, true, 'sin SCo no hay bloque de SCo');
  assert.equal(nodos['sgc-anexo1-objeto'].value, 'objeto del expediente',
    'y se ve el ANEXO I propio del expediente, como antes de esta ronda');
  assert.equal(nodos['sgc-anexo1-criterio'].value, 'menor precio');
  assert.equal(SGC.views.anexoUno.versionSco(), null, 'y no hay versión de registro');

  // Y el guardado va por el camino del expediente, no por el de la SCo.
  let guardadoExpediente = null;
  repo.leerSCo = function () { return Promise.resolve(null); };
  repo.guardarExpediente = function (id, exp, version, contexto) {
    guardadoExpediente = { id: id, version: version, contexto: contexto };
    return Promise.resolve({ ok: true, version: version + 1 });
  };
  nodos['sgc-anexo1-guardar'].click();
  await nuevaVuelta();

  assert.equal(guardadoExpediente.id, '2026-001', 'se guardó en el expediente');
  assert.equal(guardadoExpediente.version, 4, 'contra la versión del expediente');
});

test('RONDA-27 pieza 5 · al ocultar la vista se suelta el registro de la SCo', async () => {
  const { nodos, repo } = montarTodo();
  const expediente = expedienteEnSco('2026-001', '14/2026');
  fingirVistaExpediente(expediente);
  SGC.views.anexoUno.actualizar(expediente);
  repo.resolverLectura('14/2026', registroDeSco('14/2026', { objeto: 'objeto de la SCo' }));
  await nuevaVuelta();
  assert.ok(expediente.datos.anexo1Sco, 'el registro está colgado mientras se ve');

  SGC.views.anexoUno.actualizar(null);
  assert.equal(expediente.datos.anexo1Sco, undefined,
    'al cerrar la vista el `anexo1Sco` se suelta: si quedara, el documento de ese ' +
    'expediente saldría con datos de una SCo que ya no se está mirando');
  assert.equal(SGC.views.anexoUno.versionSco(), null, 'y no queda versión de registro');
  assert.equal(nodos['sgc-anexo1-sco'].hidden, true, 'el bloque queda oculto');
});
