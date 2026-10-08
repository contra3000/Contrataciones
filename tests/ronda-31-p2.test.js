'use strict';

/*
 * ronda-31-p2.test.js
 * RONDA-31 · pieza 2 · "Lo que traba o no se ve" (ORDEN-RONDA-31 pieza 2).
 *
 * El Jefe apretó "Siguiente", eligió el renglón que estaba mal, escribió letras
 * en "Año" y siguió sin presupuestos. Cada cosa que le dolió se prueba acá,
 * apretando los botones de la pantalla, sin llamar funciones de vista:
 *
 *  - c) "Año" no acepta letras: lo que no sea dígito se descarta mientras se
 *    escribe (la validación de cuatro dígitos no cambia);
 *  - d) "Siguiente" con el renglón 2 sin unidad lleva el foco a ese campo, lo
 *    marca con campo-con-error y lo trae a la vista —el mensaje de arriba queda
 *    como está—;
 *  - e) sin valores de referencia, el paso "2 · Renglones" queda marcado con la
 *    clase pendiente y dice "· falta"; al volver, cada renglón dice "Faltan
 *    valores de referencia…", y todo desaparece solo cuando se completan;
 *  - a) la aclaración larga genera el anexo de EETT, y sin registrarlo
 *    "Exportar" sigue deshabilitado aunque se imprima (pieza 2a): con el
 *    registro, se habilita y el archivo baja con lo hecho;
 *  - b) dos aperturas del mismo expediente: la lectura lenta VIEJA no pisa en
 *    pantalla a la nueva (carrera de abrir()).
 *
 * (b) corre al final y con la montura de la vista de expediente: la montura del
 * generador y ésta comparten el mismo documento del stub, y el orden importa.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');

const gm = require('./helpers/generador-montura.js');
const { nuevaVuelta } = require('./helpers/wizard-montura.js');
const expedienteMontura = require('./helpers/expediente-montura.js');

const AVISO_FALTAN = 'Faltan valores de referencia: 2 de fuentes distintas, o 1 y una justificación.';

let m = null;

before(async () => {
  m = await gm.arrancar();
});

function SGC() {
  return globalThis.SGC;
}

async function entrarComoUsuario() {
  await m.correr();
  await m.esperar(() => {
    const est = SGC().catalogo.carga.obtenerEstado();
    return !!(est.manifiesto && est.rubros && est.clases);
  }, 30000, 'el catálogo no llegó');
  m.setear('sgc-generador-nombre', 'Ana Pérez');
  m.completarIdentidad();
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

async function claseConItems() {
  const clases = SGC().catalogo.carga.obtenerEstado().clases.filter((c) => c[3] > 0);
  assert.ok(clases.length >= 2, 'el catálogo real tiene al menos dos clases con ítems');
  return clases;
}

// El <li> del renglón, escrito como una persona. Con `conUnidad` en false el
// renglón queda a propósito sin unidad, que es lo que necesita el test (d).
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

// El <li> de un paso de la barra, buscado por su data-paso (el selector del
// stub no entiende 'li[data-paso=...]').
function liDePaso(paso) {
  const nav = m.documento.getElementById('sgc-pasos');
  for (const hijo of nav.children) {
    if (hijo.getAttribute('data-paso') === paso) {
      return hijo;
    }
  }
  return null;
}

function marcaFalta(li) {
  for (const hijo of li.children) {
    if (hijo.className === 'paso-falta') {
      return hijo;
    }
  }
  return null;
}

function avisoDe(indice) {
  return m.documento.getElementById('sgc-req-valores')
    .querySelector('[data-aviso-valores="' + indice + '"]');
}

test('RONDA-31 pieza 2c · "Año" no acepta letras mientras se escribe', async () => {
  await m.correr();
  const d = m.documento;

  // Se tipea como una persona: cada tecla dispara 'input'. Las letras se
  // descartan en el momento y lo que queda es sólo lo que se escribió antes y
  // después.
  m.escribir('sgc-anio', '20a26');
  assert.strictEqual(d.getElementById('sgc-anio').value, '2026',
    'las letras se descartan y quedan los dígitos');

  m.escribir('sgc-anio', 'x2026y');
  assert.strictEqual(d.getElementById('sgc-anio').value, '2026',
    'también al principio y al final');

  // El filtro no toca ningún otro campo.
  m.escribir('sgc-dependencia', 'División 2');
  assert.strictEqual(d.getElementById('sgc-dependencia').value, 'División 2',
    'la dependencia sigue aceptando lo que sea');
});

test('RONDA-31 pieza 2d · "Siguiente" lleva el foco al primer campo con error, marcado y a la vista', async () => {
  await entrarComoUsuario();
  await irAlPasoRenglones();
  const d = m.documento;

  const clases = await claseConItems();
  await agregarRenglonReal(0, clases[0][2], true);
  await agregarRenglonReal(1, clases[1][2], false);

  // Espía de scrollIntoView sobre el campo, como el navegador lo llamaría. El
  // stub no tiene layout, así que lo que se afirma es la llamada.
  const unidad = d.getElementById('sgc-lista-renglones')
    .children[1].querySelectorAll('[aria-label="Unidad de medida"]')[0];
  assert.ok(unidad, 'el renglón 2 tiene el campo de unidad de medida');
  const llamadasUnidad = [];
  unidad.scrollIntoView = function (opciones) {
    llamadasUnidad.push(opciones);
  };
  const msj = d.getElementById('sgc-paso-msj');
  const llamadasMsj = [];
  msj.scrollIntoView = function (opciones) {
    llamadasMsj.push(opciones);
  };

  d.getElementById('sgc-siguiente').click();

  assert.strictEqual(d.getElementById('sgc-paso-renglones').hidden, false,
    'con un renglón incompleto no se avanza de paso');
  assert.strictEqual(d.activeElement, unidad,
    'el foco queda en el primer campo con error: la unidad del renglón 2');
  assert.strictEqual(unidad.classList.contains('campo-con-error'), true,
    'el campo queda marcado con la clase campo-con-error');
  assert.deepStrictEqual(llamadasUnidad, [{ block: 'center' }],
    'el campo se trae a la vista con scrollIntoView({block: "center"})');
  assert.strictEqual(msj.hidden, false, 'el motivo de no avanzar sigue a la vista');
  assert.match(msj.textContent, /Rengl.n 2: .*unidad/i,
    'el motivo dice qué le falta al renglón: ' + msj.textContent);
  assert.deepStrictEqual(llamadasMsj, [],
    'el mensaje de arriba no se trae a la vista: manda el campo');

  // Corregido el renglón, la marca roja se va sola al poder avanzar.
  m.escribirEnNodo(unidad, 'UN');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-fundamentacion').hidden, 20000,
    'paso de fundamentación visible');
  assert.strictEqual(unidad.classList.contains('campo-con-error'), false,
    'al avanzar, la marca roja del campo se quita');
});

test('RONDA-31 pieza 2e · sin valores, el paso queda marcado "falta" y cada renglón dice qué le falta', async () => {
  await entrarComoUsuario();
  await irAlPasoRenglones();
  const d = m.documento;

  const clases = await claseConItems();
  await agregarRenglonReal(0, clases[0][2], true);
  await agregarRenglonReal(1, clases[1][2], true);

  // Al abrir el paso, con los renglones cargados y SIN valores, cada renglón
  // ya dice qué le falta (en el mismo nodo de aviso de siempre).
  const aviso0 = avisoDe(0);
  const aviso1 = avisoDe(1);
  assert.strictEqual(aviso0.hidden, false, 'el renglón 1 avisa apenas se abre el paso');
  assert.strictEqual(aviso0.textContent, AVISO_FALTAN,
    'con el texto exacto de la orden: ' + aviso0.textContent);
  assert.strictEqual(aviso1.hidden, false, 'el renglón 2 también');
  assert.strictEqual(aviso1.textContent, AVISO_FALTAN,
    'y con el mismo texto');

  // Seguir sin valores: el paso de renglones queda marcado en la barra.
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-fundamentacion').hidden, 20000,
    'paso de fundamentación visible');

  const liRenglones = liDePaso('renglones');
  assert.ok(liRenglones.classList.contains('pendiente'),
    'el paso "2 · Renglones" queda con la clase pendiente');
  const marca = marcaFalta(liRenglones);
  assert.ok(marca, 'el paso lleva la marca "· falta"');
  // ORDEN-RONDA-32 pieza 1b: la marca lleva un espacio inicial, para que el
  // paso lea "2 · Renglones · falta" y no "2 · Renglones· falta".
  assert.strictEqual(marca.textContent, ' · falta', 'la marca dice " · falta"');

  // De vuelta en el paso 2, los avisos siguen ahí.
  d.getElementById('sgc-anterior').click();
  await m.esperar(() => !d.getElementById('sgc-paso-renglones').hidden, 20000,
    'paso de renglones visible de nuevo');
  assert.strictEqual(avisoDe(0).hidden, false, 'el renglón 1 sigue avisando');
  assert.strictEqual(avisoDe(1).hidden, false, 'el renglón 2 sigue avisando');

  // Completados los dos renglones con dos fuentes distintas cada uno, todo se
  // borra solo: ni aviso en los renglones ni marca en el paso.
  const presupuesto = await m.agregarDocumento({
    nombre: 'presupuesto-resma-2026.pdf', proveedor: 'Librería Sur', fecha: '12/02/2026'
  });
  const precioPlaza = await m.agregarDocumento({
    nombre: 'precio-plaza-resma-2026.pdf', proveedor: 'Comercial Casas', fecha: '10/02/2026'
  });
  m.cargarValores([
    [{ presupuestoId: presupuesto.id, base: 'unitario', valor: '4200' },
      { presupuestoId: precioPlaza.id, base: 'unitario', valor: '4500' }],
    [{ presupuestoId: presupuesto.id, base: 'unitario', valor: '800' },
      { presupuestoId: precioPlaza.id, base: 'unitario', valor: '900' }]
  ]);

  assert.strictEqual(avisoDe(0).hidden, true,
    'con dos fuentes distintas el aviso del renglón 1 desaparece');
  assert.strictEqual(avisoDe(0).textContent, '', 'y no deja texto');
  assert.strictEqual(avisoDe(1).hidden, true,
    'el aviso del renglón 2 también desaparece');
  assert.strictEqual(liRenglones.classList.contains('pendiente'), false,
    'el paso "2 · Renglones" deja de estar pendiente');
  assert.strictEqual(marcaFalta(liRenglones), null,
    'y la marca "· falta" se quita del todo');
});

test('RONDA-31 pieza 2a · sin registrar el anexo de EETT, "Exportar" sigue deshabilitado aunque se imprima', async () => {
  await entrarComoUsuario();
  await irAlPasoRenglones();
  const d = m.documento;

  const clases = await claseConItems();
  await agregarRenglonReal(0, clases[0][2], true);
  // Una aclaración que desborda los 256: eso genera el anexo de EETT.
  const aclaracion = 'Aclaración larga. '.repeat(20);
  assert.ok(aclaracion.length > 256, 'la aclaración supera el tope del anexo');
  m.escribirEnNodo(
    d.getElementById('sgc-lista-renglones').children[0]
      .querySelector('[aria-label="Aclaración opcional"]'),
    aclaracion);

  // Dos fuentes distintas para el renglón: la regla de valores no es lo que
  // falta acá.
  const presupuesto = await m.agregarDocumento({
    nombre: 'presupuesto-folio-2026.pdf', proveedor: 'Librería Sur', fecha: '12/02/2026'
  });
  const precioPlaza = await m.agregarDocumento({
    nombre: 'precio-plaza-folio-2026.pdf', proveedor: 'Comercial Casas', fecha: '10/02/2026'
  });
  m.cargarValores([
    [{ presupuestoId: presupuesto.id, base: 'unitario', valor: '820' },
      { presupuestoId: precioPlaza.id, base: 'unitario', valor: '900' }]
  ]);

  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-fundamentacion').hidden, 20000,
    'paso de fundamentación visible');
  m.escribir('sgc-justificacion', 'El folio se compra directo al proveedor.');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-revision').hidden, 20000,
    'paso de revisión visible');

  // Sin imprimir, falta el documento: y con la aclaración larga, falta TAMBIÉN
  // el anexo de EETT — ése es el registro que la pieza 2a agrega.
  const antes = SGC().generadorDocumentos.revision().revision.faltantes;
  assert.ok(antes.entregables.indexOf('especificacion-tecnica') !== -1,
    'antes de imprimir falta el documento');
  assert.ok(antes.entregables.indexOf('anexo-eett') !== -1,
    'y falta el anexo de EETT, que la aclaración larga genera');
  assert.strictEqual(d.getElementById('sgc-btn-exportar').disabled, true,
    'sin registrar nada, "Exportar" está deshabilitado');

  d.getElementById('sgc-btn-imprimir').click();

  const despues = SGC().generadorDocumentos.revision().revision.faltantes;
  assert.deepStrictEqual(despues.entregables, [],
    'imprimir registra el documento Y el anexo de EETT');
  assert.strictEqual(d.getElementById('sgc-btn-exportar').disabled, false,
    'recién ahí "Exportar" se habilita');

  d.getElementById('sgc-btn-exportar').click();
  await m.esperar(() => m.descargas.length > 0, 10000, 'el exportado no se descargó');
  const archivo = JSON.parse(await m.descargas[m.descargas.length - 1].texto());
  assert.strictEqual(archivo.expediente.renglones[0].aclaracion, aclaracion,
    'el JSON baja con el renglón y su aclaración larga');
  assert.strictEqual(archivo.expediente.presupuestos.length, 2,
    'y con los dos documentos de referencia');
  assert.deepStrictEqual(m.red.llamadas, [],
    'todo el camino (elegir, imprimir, exportar) sigue sin pedir nada por red');
});

test('RONDA-31 pieza 2b · la lectura vieja de un expediente no pisa a la nueva: gana la última apertura', async () => {
  const { raiz, nodos } = expedienteMontura.armarExpediente();
  const SGCexp = expedienteMontura.SGC;
  SGCexp.views.expediente.montar(raiz);

  const lento = expedienteMontura.expedienteEnEstado('DICTAMEN_INICIAL', 41);
  const rapido = expedienteMontura.expedienteEnEstado('DICTAMEN_INICIAL', 42);
  let llamadas = 0;
  // La primera lectura tarda y trae el 41; la segunda llega enseguida con el
  // 42. Sin el contador de aperturas, la primera (vieja) terminaría de llegar
  // DESPUÉS y taparía en pantalla a la segunda.
  const repo = {
    leerExpediente: function () {
      llamadas++;
      if (llamadas === 1) {
        return new Promise(function (resolver) {
          setTimeout(function () {
            resolver({ expediente: lento, version: 1 });
          }, 40);
        });
      }
      return Promise.resolve({ expediente: rapido, version: 2 });
    }
  };
  SGCexp.views.expediente.fijarRepo(repo);
  SGCexp.views.expediente.seleccionarOperador(expedienteMontura.MARIA);

  SGCexp.views.expediente.abrir('2026-041');
  SGCexp.views.expediente.abrir('2026-042');

  await m.esperar(() => nodos['sgc-expediente-titulo'].textContent === 'Expediente 42',
    5000, 'la segunda lectura se aplica');
  assert.strictEqual(nodos['sgc-expediente-mensaje'].hidden, true,
    'la lectura rápida no deja ningún aviso');

  // La lectura lenta llega después: no tiene que pisar lo que ya está.
  await new Promise((resolver) => setTimeout(resolver, 80));
  await nuevaVuelta();
  assert.strictEqual(nodos['sgc-expediente-titulo'].textContent, 'Expediente 42',
    'la lectura vieja, que llegó después, no pisa a la nueva');
  assert.strictEqual(nodos['sgc-expediente-mensaje'].hidden, true,
    'ni deja aviso de error de la vieja');
});
