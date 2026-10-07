'use strict';

/*
 * ronda-29-p2.test.js
 * RONDA-29 · pieza 2 · "identidad y documentos sin firma" (ORDEN-RONDA-29 §2).
 *
 * La pantalla "¿Quién sos?" pasó de un nombre libre a cuatro datos: grado,
 * nombre, apellido y número de control. Los cuatro son obligatorios antes de
 * elegir el rol, y los cuatro van a la vista (en el asistente) y en el sello
 * del JSON que se exporta. Los tres documentos que van al sistema de firmas
 * no llevan "Operador solicitante" ni el espacio de firma (eso lo afirma
 * plantillas.test.js, que es el dueño de las plantillas; acá se afirma que el
 * bloque no aparece en lo que el generador imprime).
 *
 * La montura es la de helpers/generador-montura.js: app/generador.html abierto
 * como file://, sin servidor, con el catálogo real entrando por <script>.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');

const gm = require('./helpers/generador-montura.js');

const GRADOS = [
  'Personal Civil',
  'Cabo',
  'Cabo Primero',
  'Cabo Principal',
  'Suboficial Auxiliar',
  'Suboficial Ayudante',
  'Suboficial Principal',
  'Suboficial Mayor',
  'Alférez',
  'Teniente',
  'Primer Teniente',
  'Capitán',
  'Mayor',
  'Vicecomodoro',
  'Comodoro',
  'Brigadier'
];

let m = null;

before(async () => {
  m = await gm.arrancar();
});

function SGC() {
  return globalThis.SGC;
}

async function arrancar() {
  await m.correr();
  return m;
}

async function esperarCatalogo() {
  await m.esperar(() => {
    const est = SGC().catalogo.carga.obtenerEstado();
    return !!(est.manifiesto && est.rubros && est.clases);
  }, 30000, 'el catálogo no llegó');
}

function identidad() {
  return m.documento.getElementById('sgc-generador-identidad');
}

function error() {
  return m.documento.getElementById('sgc-generador-error');
}

function altaVisible() {
  return m.documento.getElementById('sgc-app').hidden === false;
}

// ---------------------------------------------------------------------------
// Los cuatro datos, obligatorios
// ---------------------------------------------------------------------------

test('el desplegable de grado ofrece la lista, en orden, y arranca sin elegir', async () => {
  await arrancar();
  const grado = m.documento.getElementById('sgc-generador-grado');
  assert.ok(grado, 'generador.html tiene el desplegable de grado');

  const opciones = grado.children.map((o) => o.value);
  assert.deepStrictEqual(opciones, [''].concat(GRADOS),
    'la primera opción es "no eligió" y después los quince grados, en orden');
  assert.deepStrictEqual(SGC().generador.GRADOS, GRADOS,
    'la lista del desplegable es la del código, en el mismo orden');
  assert.strictEqual(grado.value, '', 'arranca sin grado');
});

test('sin grado no se entra, y el aviso dice qué falta', async () => {
  await arrancar();
  m.setear('sgc-generador-nombre', 'Ana');
  m.setear('sgc-generador-apellido', 'Pérez');
  m.escribir('sgc-generador-numero-control', '12345');
  m.elegirRol('generador');

  assert.strictEqual(altaVisible(), false, 'sin grado no se abre el alta');
  assert.strictEqual(error().hidden, false, 'el aviso se ve');
  assert.match(error().textContent, /grado/i, 'el aviso dice que falta el grado');
});

test('sin apellido, sin nombre o sin número de control tampoco se entra', async () => {
  const completo = { grado: 'Cabo', nombre: 'Ana', apellido: 'Pérez', numeroControl: '12345' };
  const casos = [
    { falta: 'apellido', datos: Object.assign({}, completo, { apellido: '' }) },
    { falta: 'nombre', datos: Object.assign({}, completo, { nombre: '' }) },
    { falta: 'número de control', datos: Object.assign({}, completo, { numeroControl: '' }) }
  ];
  for (const caso of casos) {
    await arrancar();
    // Se escriben los cuatro uno por uno, con el que falta en blanco: por eso
    // no se usa el ayudante, que completa lo que no le digan.
    m.setear('sgc-generador-grado', caso.datos.grado);
    m.escribir('sgc-generador-nombre', caso.datos.nombre);
    m.escribir('sgc-generador-apellido', caso.datos.apellido);
    m.escribir('sgc-generador-numero-control', caso.datos.numeroControl);
    m.elegirRol('generador');
    assert.strictEqual(altaVisible(), false, 'sin ' + caso.falta + ' no se abre el alta');
    assert.match(error().textContent, new RegExp(caso.falta.split(' ')[0], 'i'),
      'el aviso dice que falta ' + caso.falta + ': ' + error().textContent);
  }
});

test('el número de control es un entero: "12a" no deja entrar', async () => {
  await arrancar();
  m.setear('sgc-generador-grado', 'Cabo');
  m.setear('sgc-generador-nombre', 'Ana');
  m.setear('sgc-generador-apellido', 'Pérez');
  // Setear y no escribir: lo pegado con una letra llega así al campo, y el
  // sistema no lo "limpia" para dar por buena una escritura que no es un número.
  m.setear('sgc-generador-numero-control', '12a');
  m.elegirRol('generador');

  assert.strictEqual(altaVisible(), false, 'con 12a no se abre el alta');
  assert.strictEqual(error().hidden, false, 'el aviso se ve');
  assert.match(error().textContent, /entero/i,
    'el aviso dice que tiene que ser un entero: ' + error().textContent);
});

test('el número de control se muestra con puntos de miles: 12345 se ve 12.345', async () => {
  await arrancar();
  const campo = m.escribir('sgc-generador-numero-control', '12345');
  assert.strictEqual(campo.value, '12.345', 'el campo muestra el número con puntos');

  m.escribir('sgc-generador-numero-control', '1234567');
  assert.strictEqual(campo.value, '1.234.567', 'y con más de cuatro dígitos también');

  // Con los puntos escritos a mano, el entero es el mismo: 12.345 se acepta.
  m.escribir('sgc-generador-numero-control', '12.345');
  assert.strictEqual(campo.value, '12.345', 'no duplica los puntos');
  m.setear('sgc-generador-grado', 'Cabo');
  m.setear('sgc-generador-nombre', 'Ana');
  m.setear('sgc-generador-apellido', 'Pérez');
  m.elegirRol('generador');
  assert.strictEqual(altaVisible(), true, '12.345 escrito con puntos es el mismo número');
});

// ---------------------------------------------------------------------------
// Lo que ven los demás: el asistente a la vista y el sello del archivo
// ---------------------------------------------------------------------------

async function agregarRenglonReal(indice, claseNombre) {
  m.escribir('sgc-campo-clases', claseNombre);
  await m.esperar(() => m.documento.getElementById('sgc-opcion-clase-0'), 20000,
    'opción de la clase renderizada');
  m.mousedown('sgc-opcion-clase-0');
  await m.esperar(() => m.documento.getElementById('sgc-opcion-item-0'), 30000,
    'ítems de la clase cargados');
  m.mousedown('sgc-opcion-item-0');
  await m.esperar(() => m.documento.getElementById('sgc-lista-renglones').children.length === indice + 1,
    20000, 'renglón ' + (indice + 1) + ' agregado');
  const fila = m.documento.getElementById('sgc-lista-renglones').children[indice];
  m.escribirEnNodo(fila.querySelector('[aria-label="Unidad de medida"]'), 'UN');
}

// Un alta completa, con renglones del catálogo real, para poder exportar: el
// sello sólo se ve en el archivo que baja "Exportar para Abastecimiento".
async function altaExportable() {
  const d = m.documento;
  await esperarCatalogo();
  m.escribir('sgc-titulo', 'Resmas A4');
  m.escribir('sgc-anio', '2026');
  m.escribir('sgc-dependencia', 'División Usuario');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-renglones').hidden, 20000,
    'paso de renglones visible');

  const clases = SGC().catalogo.carga.obtenerEstado().clases.filter((c) => c[3] > 0);
  assert.ok(clases.length >= 3, 'el catálogo real tiene al menos tres clases con ítems');
  for (let i = 0; i < 3; i++) {
    await agregarRenglonReal(i, clases[i][2]);
  }
  await m.esperar(() => (d.getElementById('sgc-resumen').textContent || '').indexOf('0 con error') !== -1,
    20000, 'los tres renglones quedan sin errores');

  await m.agregarDocumento({ nombre: 'presupuesto-resma-2026.pdf', proveedor: 'Librería Sur', fecha: '12/02/2026' });
  await m.agregarDocumento({ nombre: 'presupuesto-resma-2026-b.pdf', proveedor: 'Papelera Norte', fecha: '13/02/2026' });

  const presupuestos = SGC().generadorPresupuestos.listar();
  const presupuesto1 = presupuestos[0].id;
  const presupuesto2 = presupuestos[1].id;
  m.cargarValores([
    [{ presupuestoId: presupuesto1, base: 'unitario', valor: '4200' },
      { presupuestoId: presupuesto2, base: 'unitario', valor: '4500' }],
    [{ presupuestoId: presupuesto1, base: 'unitario', valor: '800' },
      { presupuestoId: presupuesto2, base: 'unitario', valor: '900' }],
    [{ presupuestoId: presupuesto1, base: 'unitario', valor: '15000' },
      { presupuestoId: presupuesto2, base: 'unitario', valor: '16000' }]
  ]);

  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-fundamentacion').hidden, 20000,
    'paso de fundamentación visible');
  m.escribir('sgc-justificacion', 'Se necesita papel para el área.');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-revision').hidden, 20000,
    'paso de revisión visible');
}

test('con los cuatro datos, el operador a la vista los lleva todos', async () => {
  await arrancar();
  await esperarCatalogo();
  m.escribirIdentidad({
    grado: 'Suboficial Principal',
    nombre: 'Ana',
    apellido: 'Pérez',
    numeroControl: '12345'
  });
  m.elegirRol('generador');
  await m.esperar(() => SGC().generadorValores, 20000, 'el rol Usuario montado');

  const linea = m.documento.getElementById('sgc-operador-actual').textContent;
  assert.match(linea, /Suboficial Principal/, 'el grado a la vista: ' + linea);
  assert.match(linea, /Ana Pérez/, 'el nombre y el apellido a la vista: ' + linea);
  assert.match(linea, /12\.345/, 'el número de control a la vista, con puntos: ' + linea);

  // Y el operador del núcleo lleva los cuatro, con el número como entero.
  const operador = SGC().generador.operadorActual();
  assert.strictEqual(operador.grado, 'Suboficial Principal');
  assert.strictEqual(operador.nombre, 'Ana');
  assert.strictEqual(operador.apellido, 'Pérez');
  assert.strictEqual(operador.numeroControl, 12345, 'el número de control es un entero');
});

test('el sello del JSON lleva los cuatro datos, con el número de control entero', async () => {
  await arrancar();
  await esperarCatalogo();
  m.escribirIdentidad({
    grado: 'Capitán',
    nombre: 'Ana',
    apellido: 'Pérez',
    numeroControl: '12345'
  });
  m.elegirRol('generador');
  await m.esperar(() => SGC().generadorValores, 20000, 'el rol Usuario montado');
  await altaExportable();

  const d = m.documento;
  d.getElementById('sgc-btn-imprimir').click();
  await m.esperar(() => SGC().generadorDocumentos.expedienteLocal().entregables.length > 0, 20000,
    'EETT compuesta');

  // Lo que ve el Jefe al imprimir: los tres documentos, sin el bloque del
  // operador ni el espacio de firma.
  const impreso = d.getElementById('sgc-generador-impresion').textContent;
  assert.match(impreso, /Solicitud de Gastos/, 'la Solicitud de Gastos está compuesta');
  assert.ok(!impreso.includes('Operador solicitante'),
    'lo impreso no dice "Operador solicitante"');
  assert.ok(!impreso.includes('Firma y aclaración'),
    'lo impreso no tiene el espacio de firma');

  const antes = m.descargas.length;
  const exportar = d.getElementById('sgc-btn-exportar');
  assert.strictEqual(exportar.disabled, false, 'con la EETT compuesta se puede exportar');
  exportar.click();
  await m.esperar(() => m.descargas.length > antes, 20000, 'el archivo no se descargó');
  const descarga = m.descargas[m.descargas.length - 1];
  const archivo = JSON.parse(await descarga.texto());

  assert.strictEqual(archivo.sello.grado, 'Capitán', 'el sello dice el grado');
  assert.strictEqual(archivo.sello.nombre, 'Ana', 'el sello dice el nombre');
  assert.strictEqual(archivo.sello.apellido, 'Pérez', 'el sello dice el apellido');
  assert.strictEqual(archivo.sello.numeroControl, 12345, 'el sello dice el número de control');
  assert.strictEqual(typeof archivo.sello.numeroControl, 'number',
    'el número de control va como número, no como texto');
  assert.ok(!String(archivo.sello.numeroControl).includes('.'),
    'en el JSON el número va sin puntos: los puntos son de la pantalla');
});

test('un archivo viejo, con sólo el nombre, se sigue importando', async () => {
  await arrancar();
  await esperarCatalogo();
  m.escribirIdentidad({ grado: 'Cabo', nombre: 'Ana', apellido: 'Pérez', numeroControl: '12345' });
  m.elegirRol('generador');
  await m.esperar(() => SGC().generadorValores, 20000, 'el rol Usuario montado');
  await altaExportable();

  const d = m.documento;
  d.getElementById('sgc-btn-imprimir').click();
  await m.esperar(() => SGC().generadorDocumentos.expedienteLocal().entregables.length > 0, 20000,
    'EETT compuesta');
  const antes = m.descargas.length;
  d.getElementById('sgc-btn-exportar').click();
  await m.esperar(() => m.descargas.length > antes, 20000, 'el archivo no se descargó');
  const texto = await m.descargas[m.descargas.length - 1].texto();

  // Un archivo como los de antes de la ronda 29: el sello con `nombre` y nada
  // más. La huella no está, así que se carga con el aviso de que no se puede
  // comprobar: lo que importa acá es que se importe.
  const viejo = JSON.parse(texto);
  delete viejo.sello.grado;
  delete viejo.sello.apellido;
  delete viejo.sello.numeroControl;
  delete viejo.sello.huella;

  await m.correr();
  m.limpiarDescargas();
  await esperarCatalogo();
  m.escribirIdentidad({ grado: 'Cabo', nombre: 'Ana', apellido: 'Pérez', numeroControl: '12345' });
  m.elegirRol('generador');
  await m.esperar(() => SGC().generadorValores, 20000, 'el rol Usuario montado');

  const antesDeImportar = m.documento.getElementById('sgc-titulo').value;
  assert.strictEqual(antesDeImportar, '', 'arranca sin título');
  m.elegirArchivo(JSON.stringify(viejo), 'requerimiento-viejo.json');
  await m.esperar(() => m.documento.getElementById('sgc-titulo').value === 'Resmas A4', 20000,
    'el requerimiento viejo se importó');
});
