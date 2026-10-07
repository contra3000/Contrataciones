'use strict';

/*
 * ronda-30-p1.test.js
 * ORDEN-RONDA-30 · pieza 1 · "presupuestos distintos de verdad, y los errores a
 * la vista".
 *
 * La ronda 29 dejó la REGLA de que los dos valores de un renglón tienen que
 * salir de presupuestos distintos (core/validacion.js, renglonesSinValores
 * cuenta presupuestoId distintos) pero no dejó ni el TEXTO que lo dice ni que
 * se le avise a quien lo está cometiendo. Esta pieza cierra las dos cosas, y
 * con ellas el otro motivo de "Siguiente no hace nada":
 *
 *  - b) el texto del botón que se deshabilita nombra la regla ("2 valores de
 *     referencia de presupuestos distintos en Renglón N");
 *  - c) el aviso aparece debajo del renglón que está mal, en el momento en que
 *     se elige el presupuesto repetido, y no en el botón de otro paso;
 *  - d) el motivo de no avanzar se trae a la vista, porque el mensaje está
 *     arriba de todo y el botón al final.
 *
 * Todo se aprieta como una persona: se entra por la pantalla de identidad, se
 * escriben los cuatro datos, se elige el rol, se buscan renglones del catálogo
 * real, se cargan valores con m.cargarValores y se aprietan los botones. No se
 * llama ninguna función de las vistas.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');

const gm = require('./helpers/generador-montura.js');

const AVISO = 'Los dos valores tienen que salir de presupuestos distintos.';

let m = null;

before(async () => {
  m = await gm.arrancar();
});

function SGC() {
  return globalThis.SGC;
}

async function arrancar() {
  await m.correr();
  await m.esperar(() => {
    const est = SGC().catalogo.carga.obtenerEstado();
    return !!(est.manifiesto && est.rubros && est.clases);
  }, 30000, 'el catálogo no llegó');
}

// El <li> del renglón: se le escribe la unidad como una persona, en el input
// que la vista pintó. Con `conUnidad` en false el renglón se deja a propósito
// sin unidad, que es lo que necesita el test (d).
async function agregarRenglonReal(indice, claseNombre, conUnidad) {
  m.escribir('sgc-campo-clases', claseNombre);
  await m.esperar(() => m.documento.getElementById('sgc-opcion-clase-0'), 20000,
    'opción de la clase renderizada');
  m.mousedown('sgc-opcion-clase-0');
  await m.esperar(() => m.documento.getElementById('sgc-opcion-item-0'), 30000,
    'ítems de la clase cargados');
  m.mousedown('sgc-opcion-item-0');
  await m.esperar(() => m.documento.getElementById('sgc-lista-renglones').children.length === indice + 1,
    20000, 'renglón ' + (indice + 1) + ' agregado');
  if (conUnidad !== false) {
    const fila = m.documento.getElementById('sgc-lista-renglones').children[indice];
    m.escribirEnNodo(fila.querySelector('[aria-label="Unidad de medida"]'), 'UN');
  }
}

async function claseConItems() {
  const clases = SGC().catalogo.carga.obtenerEstado().clases.filter((c) => c[3] > 0);
  assert.ok(clases.length >= 1, 'el catálogo real tiene clases con ítems');
  return clases;
}

async function agregarPresupuesto(archivo, proveedor, fecha) {
  await m.agregarDocumento({ nombre: archivo, proveedor, fecha });
}

function presupuestos() {
  return SGC().generadorPresupuestos.listar();
}

function avisoDe(indice) {
  return m.documento.getElementById('sgc-req-valores')
    .querySelector('[data-aviso-valores="' + indice + '"]');
}

async function entrarComoUsuario() {
  await arrancar();
  m.escribirIdentidad({ grado: 'Cabo', nombre: 'Ana', apellido: 'Pérez', numeroControl: '12345' });
  m.elegirRol('generador');
  await m.esperar(() => SGC().generadorValores, 20000, 'el rol Usuario montado');
}

async function irAlPasoRenglones() {
  const d = m.documento;
  m.escribir('sgc-titulo', 'Resmas A4');
  m.escribir('sgc-anio', '2026');
  m.escribir('sgc-dependencia', 'División Usuario');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-renglones').hidden, 20000,
    'paso de renglones visible');
}

test('RONDA-30 pieza 1b · dos valores del mismo presupuesto dejan "Exportar" deshabilitado, con el renglón', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await irAlPasoRenglones();

  const clases = await claseConItems();
  for (let i = 0; i < 3; i++) {
    await agregarRenglonReal(i, clases[i][2]);
  }
  await agregarPresupuesto('presupuesto-resma-2026.pdf', 'Librería Sur', '12/02/2026');
  await agregarPresupuesto('presupuesto-resma-2026-b.pdf', 'Papelera Norte', '13/02/2026');
  const [p1, p2] = presupuestos().map((p) => p.id);
  m.cargarValores([
    [{ presupuestoId: p1, base: 'unitario', valor: '4200' },
      { presupuestoId: p2, base: 'unitario', valor: '4500' }],
    [{ presupuestoId: p1, base: 'unitario', valor: '800' },
      { presupuestoId: p2, base: 'unitario', valor: '900' }],
    [{ presupuestoId: p1, base: 'unitario', valor: '15000' },
      { presupuestoId: p2, base: 'unitario', valor: '16000' }]
  ]);

  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-fundamentacion').hidden, 20000,
    'paso de fundamentación visible');
  m.escribir('sgc-justificacion', 'Se necesita papel para el área.');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-revision').hidden, 20000,
    'paso de revisión visible');
  d.getElementById('sgc-btn-imprimir').click();

  const exportar = d.getElementById('sgc-btn-exportar');
  const msj = d.getElementById('sgc-exportar-msj');
  assert.strictEqual(exportar.disabled, false,
    'con dos presupuestos distintos por renglón se puede exportar');

  // El Jefe eligió el mismo presupuesto dos veces en el segundo renglón.
  m.cargarValores([
    [{ presupuestoId: p1, base: 'unitario', valor: '4200' },
      { presupuestoId: p2, base: 'unitario', valor: '4500' }],
    [{ presupuestoId: p1, base: 'unitario', valor: '800' },
      { presupuestoId: p1, base: 'unitario', valor: '900' }],
    [{ presupuestoId: p1, base: 'unitario', valor: '15000' },
      { presupuestoId: p2, base: 'unitario', valor: '16000' }]
  ]);

  await m.esperar(() => exportar.disabled === true, 10000,
    'con un renglón de dos valores del mismo presupuesto no se puede exportar');

  assert.match(msj.textContent,
    /2 valores de referencia de fuentes distintas, o 1 valor y una justificación, en Rengl.n 2/,
    'el motivo dice la regla y nombra el renglón: ' + msj.textContent);
});

test('RONDA-30 pieza 1c · el mismo presupuesto en las dos filas avisa debajo de ese renglón', async () => {
  await entrarComoUsuario();
  await irAlPasoRenglones();

  const clases = await claseConItems();
  await agregarRenglonReal(0, clases[0][2]);
  await agregarRenglonReal(1, clases[1][2]);
  await agregarPresupuesto('presupuesto-resma-2026.pdf', 'Librería Sur', '12/02/2026');
  await agregarPresupuesto('presupuesto-resma-2026-b.pdf', 'Papelera Norte', '13/02/2026');
  const [p1, p2] = presupuestos().map((p) => p.id);

  // Las dos filas del primer renglón con el mismo presupuesto: el aviso tiene
  // que estar ahí mismo, sin apretar nada.
  m.cargarValores([
    [{ presupuestoId: p1, base: 'unitario', valor: '4200' },
      { presupuestoId: p1, base: 'unitario', valor: '4500' }],
    [{ presupuestoId: p1, base: 'unitario', valor: '800' },
      { presupuestoId: p2, base: 'unitario', valor: '900' }]
  ]);

  const suyo = avisoDe(0);
  assert.strictEqual(suyo.hidden, false,
    'el renglón con los dos valores del mismo presupuesto avisa');
  assert.strictEqual(suyo.textContent, AVISO,
    'el aviso es el texto de la orden, tal cual');
  assert.ok(suyo.parentNode, 'el aviso está dentro del bloque del renglón');

  const otro = avisoDe(1);
  assert.strictEqual(otro.hidden, true,
    'el renglón con presupuestos distintos no avisa de nada');
  assert.strictEqual(otro.textContent, '', 'y no deja texto del aviso anterior');

  // Corregir el segundo valor: el aviso se borra solo.
  m.cargarValores([
    [{ presupuestoId: p1, base: 'unitario', valor: '4200' },
      { presupuestoId: p2, base: 'unitario', valor: '4500' }]]);

  assert.strictEqual(suyo.hidden, true,
    'al elegir un presupuesto distinto, el aviso desaparece');
  assert.strictEqual(suyo.textContent, '', 'y no queda el texto');

  // Y lo que falta NO es elegir un presupuesto: eso lo dice la revisión del
  // renglón. Con base y valor puestos pero sin presupuesto elegido, este aviso
  // calla de "presupuestos repetidos" —sería el motivo equivocado— y, como el
  // renglón sigue incompleto, el mismo nodo dice lo que le falta (pieza 2e de
  // la ronda 31).
  const cont = m.documento.getElementById('sgc-req-valores');
  const sinPresupuesto = cont.querySelector('[data-presupuesto="0:1"]');
  const baseSinPresupuesto = cont.querySelector('[data-base="0:1"]');
  const valorSinPresupuesto = cont.querySelector('[data-valor="0:1"]');
  sinPresupuesto.value = '';
  baseSinPresupuesto.value = 'unitario';
  valorSinPresupuesto.value = '4500';
  // El bloque escucha por delegación y el stub no burbujea: el 'change' se
  // emite en el contenedor con target apuntando al campo, como el navegador.
  cont.emit('change', { target: sinPresupuesto });
  cont.emit('change', { target: baseSinPresupuesto });
  cont.emit('change', { target: valorSinPresupuesto });

  assert.strictEqual(cont.querySelector('[data-presupuesto="0:1"]').value, '',
    'la segunda fila sigue sin elegir presupuesto');
  assert.notStrictEqual(suyo.textContent, AVISO,
    'una fila sin presupuesto no hace aparecer el aviso de presupuestos repetidos');
  assert.match(suyo.textContent, /Faltan valores de referencia/,
    'y el mismo nodo dice qué le falta al renglón: ' + suyo.textContent);
});

test('RONDA-30 pieza 1d · "Siguiente" con un renglón sin unidad trae el motivo a la vista', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await irAlPasoRenglones();

  const clases = await claseConItems();
  await agregarRenglonReal(0, clases[0][2], false);

  // ORDEN-RONDA-31 pieza 2d: el foco va al PRIMER campo con error (unidad del
  // renglón), no al mensaje de arriba. Espías de scrollIntoView sobre los dos
  // nodos, como el navegador los llamaría. El stub no tiene layout, así que lo
  // que se afirma es la llamada, no el desplazamiento.
  const msj = d.getElementById('sgc-paso-msj');
  const llamadasMsj = [];
  msj.scrollIntoView = function (opciones) {
    llamadasMsj.push(opciones);
  };
  const unidad = d.getElementById('sgc-lista-renglones')
    .children[0].querySelectorAll('[aria-label="Unidad de medida"]')[0];
  assert.ok(unidad, 'el renglón tiene el campo de unidad de medida');
  const llamadasUnidad = [];
  unidad.scrollIntoView = function (opciones) {
    llamadasUnidad.push(opciones);
  };

  d.getElementById('sgc-siguiente').click();

  assert.strictEqual(d.getElementById('sgc-paso-renglones').hidden, false,
    'con un renglón incompleto no se avanza de paso');
  assert.strictEqual(msj.hidden, false, 'el motivo está a la vista');
  assert.match(msj.textContent, /Rengl.n 1: .*unidad/i,
    'el motivo dice qué le falta al renglón: ' + msj.textContent);
  assert.deepStrictEqual(llamadasUnidad, [{ block: 'center' }],
    'el campo con error se trae a la vista con scrollIntoView({block: "center"})');
  assert.strictEqual(d.activeElement, unidad,
    'y el foco queda en el primer campo con error');
  assert.strictEqual(unidad.classList.contains('campo-con-error'), true,
    'el campo queda marcado con la clase campo-con-error');
  assert.deepStrictEqual(llamadasMsj, [],
    'el mensaje de arriba no se trae a la vista: manda el campo');
});
