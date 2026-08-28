'use strict';

/*
 * requerimiento-formulario.test.js
 * ORDEN-RONDA-10 §4 (H11): la pantalla de carga del requerimiento.
 *
 *  - Prellenado derivable: unidad ← dependencia solicitante, lugar, fecha de
 *    hoy, objeto ← título, justificación ← fundamentación, rubro.
 *  - El presupuesto se elige de una LISTA (sólo los que tiene el expediente) y
 *    la base se elige explícitamente SIN valor por defecto. No hay forma de
 *    guardar un presupuestoId inexistente: la pantalla lo bloquea igual que el
 *    servidor.
 *  - El cálculo vivo de la pantalla es el MISMO cálculo del núcleo, en un caso
 *    mezclado de bases unitarias y totales.
 *  - El borrador local sobrevive un cierre y recupera los campos nuevos,
 *    incluidos los valores de referencia y las condiciones particulares.
 *  - Guardar persiste por el repositorio con la versión esperada y limpia el
 *    borrador; con errores de forma no llama al servidor.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

const { documento, crearStoragePlano } = require('./helpers/dom-stub.js');
const { nodo } = require('./helpers/wizard-montura.js');

require(path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'config.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'roles.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'utils.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'auditoria.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'migraciones.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'validacion.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'requerimiento.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'anexo-eett.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'estados.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'documento.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'expediente-dialogo.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'requerimiento-valores.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'requerimiento-oca.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'requerimiento-encabezado.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'requerimiento-presupuestos.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'requerimiento-borrador.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'requerimiento-formulario.js'));

const SGC = globalThis.SGC;

before(() => {
  globalThis.document = documento;
});

const MARIA = {
  nombre: 'María', apellido: 'González',
  email: 'maria.gonzalez@faa.mil.ar',
  roles: ['generador'], sector: 'usuario'
};

function armarExpediente() {
  const base = {
    titulo: 'Adquisición de insumos de escritorio',
    anio: '2026',
    identificacion: {
      numero: '12',
      anio: '2026',
      dependenciaSolicitante: 'División Usuario',
      finalidad: 'Reposición de insumos',
      lugar: 'FAA - Unidad de destino',
      vigencia: '2026-12-31'
    },
    fechaCreacion: '2026-08-14',
    fechaLimite: '2026-09-30',
    prioridad: 'Alta',
    rubro: '4210',
    tipo: 'Bien común',
    fundamentacion: { justificacion: 'Los insumos están en uso corriente.' },
    renglones: [
      { codigo: '2.1.1-439.101', cantidad: 3, unidad: 'UN', item: 'Resma A4' },
      { codigo: '2.1.1-439.102', cantidad: 4, unidad: 'UN', item: 'Tóner' }
    ],
    presupuestos: [
      { id: 'presupuesto-1', nombreOriginal: 'cotizacion-a.pdf', peso: 2048 },
      { id: 'presupuesto-2', nombreOriginal: 'cotizacion-b.pdf', peso: 4096 }
    ]
  };
  return SGC.adapters.repo.construirExpediente(base, {
    timestamp: '2026-08-14T10:00:00.000Z',
    email: MARIA.email,
    rol: 'generador',
    equipo: 'PC-PRUEBA-01'
  }, '2026-012');
}

function armarMontura() {
  const raiz = nodo('div', 'sgc-montura-requerimiento');
  const seccion = nodo('section', 'sgc-requerimiento-seccion');
  seccion.hidden = true;
  seccion.appendChild(nodo('div', 'sgc-req-encabezado'));
  seccion.appendChild(nodo('textarea', 'sgc-req-condiciones'));
  seccion.appendChild(nodo('input', 'sgc-req-presupuesto-archivo'));
  seccion.appendChild(nodo('ul', 'sgc-req-presupuestos-lista'));
  seccion.appendChild(nodo('div', 'sgc-req-valores'));
  seccion.appendChild(nodo('p', 'sgc-req-total'));
  seccion.appendChild(nodo('button', 'sgc-generar-anexos'));
  seccion.appendChild(nodo('button', 'sgc-requerimiento-guardar'));
  seccion.appendChild(nodo('p', 'sgc-requerimiento-msj'));
  raiz.appendChild(seccion);
  return raiz;
}

function armarTodo(expediente) {
  const aperturas = [];
  const guardados = [];
  SGC.views.expediente = {
    obtener: () => ({ expediente: expediente, version: 7 }),
    abrir: (id) => aperturas.push(id)
  };
  const repoFalso = {
    guardarExpediente: (id, exp, version, contexto) => {
      guardados.push({ id, exp, version, contexto });
      return Promise.resolve({ ok: true, version: version + 1 });
    }
  };
  const formulario = SGC.views.requerimientoFormulario;
  const storage = crearStoragePlano();
  formulario.fijarStorage(storage);
  formulario.fijarRepo(repoFalso);
  formulario.seleccionarOperador(MARIA);
  const raiz = armarMontura();
  formulario.montar(raiz);
  formulario.actualizar();
  return { formulario, storage, guardados, aperturas, raiz };
}

function inputDe(raiz, atributo, valor) {
  return raiz.querySelector('[data-' + atributo + '="' + valor + '"]');
}

test('§3.1.1 prellenado derivable del expediente', () => {
  const exp = armarExpediente();
  const m = armarTodo(exp);
  const campos = m.formulario.leerBorrador ? null : null;
  void campos;
  const encabezado = m.raiz.querySelector('#sgc-req-encabezado');
  const valorDe = (clave) =>
    encabezado.querySelector('[data-campo="' + clave + '"]').value;
  assert.equal(valorDe('unidadSolicitante'), 'División Usuario');
  assert.equal(valorDe('lugar'), 'FAA - Unidad de destino');
  assert.equal(valorDe('fecha'), new Date().toISOString().slice(0, 10));
  assert.equal(valorDe('objeto'), 'Adquisición de insumos de escritorio');
  assert.equal(valorDe('justificacionNecesidad'), 'Los insumos están en uso corriente.');
  assert.equal(valorDe('rubroCodigo'), '4210');
});

test('§3.1.2 el presupuesto se elige de una lista y la base no trae valor por defecto', () => {
  const exp = armarExpediente();
  const m = armarTodo(exp);
  const valores = m.raiz.querySelector('#sgc-req-valores');
  const selPresupuestos = valores.querySelectorAll('[data-presupuesto="0:0"]');
  assert.equal(selPresupuestos.length, 1, 'hay un selector de presupuesto por fila');
  const opciones = selPresupuestos[0].children;
  assert.equal(opciones.length, 3, 'placeholder + los dos presupuestos reales');
  const valoresOpcion = opciones.map((o) => o.value).sort();
  assert.deepEqual(valoresOpcion, ['', 'presupuesto-1', 'presupuesto-2'],
    'no existe opción para un presupuesto que el expediente no tenga');
  for (const sel of valores.querySelectorAll('[data-base="0:0"]')) {
    assert.equal(sel.children[0].value, '', 'la primera opción de base es el placeholder');
    assert.ok(sel.children[0].textContent.indexOf('elegir') !== -1);
    for (let i = 1; i < sel.children.length; i++) {
      assert.notEqual(sel.children[i].selected, true, 'ninguna base viene preseleccionada');
    }
  }
});

test('§3.1.3 no hay forma de guardar un presupuestoId inexistente desde la pantalla', async () => {
  const exp = armarExpediente();
  const m = armarTodo(exp);
  const seccion = m.raiz.querySelector('#sgc-requerimiento-seccion');
  const selP = inputDe(m.raiz, 'presupuesto', '0:0');
  selP.value = 'presupuesto-fantasma';
  selP.setAttribute('data-presupuesto', '0:0');
  seccion.emit('input', { target: selP });
  const selB = inputDe(m.raiz, 'base', '0:0');
  selB.value = 'unitario';
  seccion.emit('input', { target: selB });
  const inV = inputDe(m.raiz, 'valor', '0:0');
  inV.value = '100';
  seccion.emit('input', { target: inV });

  m.raiz.querySelector('#sgc-requerimiento-guardar').click();
  await new Promise((r) => setImmediate(r));
  assert.equal(m.guardados.length, 0, 'el servidor no recibe nada inválido');
  const msj = m.raiz.querySelector('#sgc-requerimiento-msj');
  assert.equal(msj.hidden, false);
  assert.match(msj.textContent, /presupuesto citado no existe/);
});

test('§3.1.4 el cálculo vivo es el mismo cálculo del núcleo (bases mezcladas)', async () => {
  const exp = armarExpediente();
  const m = armarTodo(exp);
  const seccion = m.raiz.querySelector('#sgc-requerimiento-seccion');
  function escribir(atributo, clave, valor) {
    const n = inputDe(m.raiz, atributo, clave);
    n.value = valor;
    seccion.emit('input', { target: n });
  }
  // Renglón 1: dos cotizaciones unitarias (la segunda fila se agrega en
  // pantalla). Renglón 2: una total por todo.
  escribir('presupuesto', '0:0', 'presupuesto-1');
  escribir('base', '0:0', 'unitario');
  escribir('valor', '0:0', '100');
  SGC.views.requerimientoValores.agregarFila(0);
  escribir('presupuesto', '0:1', 'presupuesto-2');
  escribir('base', '0:1', 'unitario');
  escribir('valor', '0:1', '200');
  escribir('presupuesto', '1:0', 'presupuesto-2');
  escribir('base', '1:0', 'total');
  escribir('valor', '1:0', '900');

  const req = SGC.core.requerimiento;
  const esperado1 = req.preventivoRenglon({
    codigo: exp.renglones[0].codigo, cantidad: 3, unidad: 'UN',
    valoresReferencia: [
      { presupuestoId: 'presupuesto-1', base: 'unitario', valor: 100 },
      { presupuestoId: 'presupuesto-2', base: 'unitario', valor: 200 }
    ]
  });
  const esperado2 = req.preventivoRenglon({
    codigo: exp.renglones[1].codigo, cantidad: 4, unidad: 'UN',
    valoresReferencia: [{ presupuestoId: 'presupuesto-2', base: 'total', valor: 900 }]
  });
  const texto1 = inputDe(m.raiz, 'calculo', '0').textContent;
  const texto2 = inputDe(m.raiz, 'calculo', '1').textContent;
  const formatear = (n) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.').replace('.', ',', 1);
  void formatear;
  assert.ok(texto1.indexOf(esperado1.promedio.toFixed(2).split('.')[0]) !== -1, 'promedio del renglón 1 visible');
  assert.ok(texto1.indexOf('450,00') !== -1, 'preventivo renglón 1 = 3 × promedio 150');
  assert.ok(texto2.indexOf('225,00') !== -1, 'promedio renglón 2 = 900 / 4');
  const total = m.raiz.querySelector('#sgc-req-total').textContent;
  assert.ok(total.indexOf(String(Math.round((esperado1.preventivo + esperado2.preventivo) * 100) / 100)) !== -1 ||
    total.indexOf('1.350,00') !== -1 || total.indexOf('1350,00') !== -1,
    'el total general coincide con preventivoContratación');
});

test('§3.1.5 el borrador sobrevive un cierre y recupera todo, incluidos los valores', async () => {
  const exp = armarExpediente();
  const m = armarTodo(exp);
  const seccion = m.raiz.querySelector('#sgc-requerimiento-seccion');
  function escribir(atributo, clave, valor) {
    const n = inputDe(m.raiz, atributo, clave);
    n.value = valor;
    seccion.emit('input', { target: n });
  }
  escribir('base', '0:0', 'total');
  escribir('valor', '0:0', '500');
  m.raiz.querySelector('#sgc-req-condiciones').value = 'Entrega única.';
  seccion.emit('input', { target: m.raiz.querySelector('#sgc-req-condiciones') });
  const objetoInput = m.raiz.querySelector('[data-campo="objeto"]');
  objetoInput.value = 'Objeto editado a mano';
  seccion.emit('input', { target: objetoInput });

  // "Cierre": otra instancia de montura sobre el mismo storage.
  const antes = m.formulario.leerBorrador();
  assert.equal(antes.datos.campos.objeto, 'Objeto editado a mano');
  assert.deepEqual(antes.datos.valores[0],
    [{ presupuestoId: '', base: 'total', valor: 500 }]);
  assert.equal(antes.datos.condicionesParticulares, 'Entrega única.');

  const raiz2 = armarMontura();
  m.formulario.montar(raiz2);
  m.formulario.actualizar();
  const condicion2 = raiz2.querySelector('#sgc-req-condiciones');
  assert.equal(condicion2.value, 'Entrega única.');
  assert.equal(raiz2.querySelector('[data-campo="objeto"]').value, 'Objeto editado a mano');
  const leido = SGC.views.requerimientoValores.leer();
  assert.deepEqual(leido.valores[0], [{ presupuestoId: '', base: 'total', valor: 500 }],
    'los valores de referencia vuelven del borrador');
});

test('§3.1.6 guardar persiste por el repositorio, limpia el borrador y refresca', async () => {
  const exp = armarExpediente();
  const m = armarTodo(exp);
  const seccion = m.raiz.querySelector('#sgc-requerimiento-seccion');
  function escribir(atributo, clave, valor) {
    const n = inputDe(m.raiz, atributo, clave);
    n.value = valor;
    seccion.emit('input', { target: n });
  }
  escribir('presupuesto', '0:0', 'presupuesto-1');
  escribir('base', '0:0', 'unitario');
  escribir('valor', '0:0', '150');
  escribir('presupuesto', '1:0', 'presupuesto-2');
  escribir('base', '1:0', 'total');
  escribir('valor', '1:0', '800');
  m.raiz.querySelector('#sgc-req-condiciones').value = 'Garantía de 6 meses.';
  seccion.emit('input', { target: m.raiz.querySelector('#sgc-req-condiciones') });

  m.raiz.querySelector('#sgc-requerimiento-guardar').click();
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.equal(m.guardados.length, 1, 'una sola llamada al servidor');
  const llamada = m.guardados[0];
  assert.equal(llamada.version, 7, 'usa la versión esperada');
  assert.equal(llamada.exp.requerimiento.condicionesParticulares, 'Garantía de 6 meses.');
  assert.deepEqual(llamada.exp.renglones[0].valoresReferencia,
    [{ presupuestoId: 'presupuesto-1', base: 'unitario', valor: 150 }]);
  assert.deepEqual(llamada.exp.renglones[1].valoresReferencia,
    [{ presupuestoId: 'presupuesto-2', base: 'total', valor: 800 }]);
  assert.equal(llamada.exp.renglones[0].cantidadMaxima, undefined,
    'sin OCA declarada no se inventan cantidades máximas');
  assert.equal(m.aperturas.length >= 1, true, 'refresca el expediente tras guardar');
  assert.equal(m.formulario.leerBorrador(), null, 'el borrador se limpia al guardar');
});
