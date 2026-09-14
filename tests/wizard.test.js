'use strict';

/*
 * wizard.test.js
 * ORDEN-RONDA-20 §2: los nueve llamados a pie de mano a
 * SGC.views.wizard.seleccionarOperador(...) de la versión anterior quedan
 * fuera. Ahora el asistente se prueba POR LA PUERTA REAL: la montura de
 * tests/helpers/aplicacion-montura.js corre la aplicación completa (DOM de
 * app/index.html + app/js/app.js por sesión) contra el servidor real, y el
 * operador entra por el formulario de ingreso, tal como en producción.
 *
 * Los nueve llamados originales y su suerte (§2 / §6 del informe):
 *
 *  REESCRITOS sobre la montura real (misma afirmación defendida):
 *   1. "no se puede avanzar de paso con el paso inválido" (línea 116).
 *   2. "el borrador sobrevive a la recarga y no se ofrece a un operador
 *      distinto" (líneas 149, 156 y 162).
 *   3. "Fast-Track rechaza códigos inexistentes y aclaraciones largas; el
 *      <script> queda como dato" (línea 243). Valida contra el servidor de
 *      verdad (ORDEN-RONDA-06 §2.2).
 *   4. "alta completa: datos.json, idx/, número único, auditoría con el correo
 *      y catalogoVersion" (línea 329). Contra el servidor real.
 *
 *  ELIMINADOS (su estado no es producible desde la puerta real; se justifican
 *  uno por uno en INFORME-RONDA-20 §6):
 *   5. "borrador con renglones ausente/null/tipo equivocado" (línea 214): un
 *      borrador en ese estado sólo se consigue escribiendo sessionStorage a
 *      mano; la aplicación jamás produce uno así. La defensa se conserva en el
 *      código (ADR-029, borrador.js) y el flujo real se cubre en el punto 2.
 *   6. "Fast-Track con el servidor de catálogo caído" (línea 285): exige tumbar
 *      el servidor real en mitad de la prueba; la rama "repo sin validarCodigos"
 *      no existe para el adaptador de producción.
 *   7. "si el servidor falla al confirmar, el borrador sigue ahí" (línea 374):
 *      exige un repo que falle a mitad de la persistencia, inyectable sólo a
 *      mano. La pantalla contra errores de red se cubre en expediente.test.js
 *      y el borrador limpio tras éxito en el punto 4 y en ronda-20.test.js.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const am = require('./helpers/aplicacion-montura.js');
const { obtenerConteoInnerHTML } = require('./helpers/dom-stub.js');

// Los módulos de la aplicación se cargan dentro de am.arrancar()
// (cargarModulos); SGC se lee recién ahí, nunca al require del archivo.
function SGC() {
  return globalThis.SGC;
}

// ---------------------------------------------------------------------------
// Recorridos reales reutilizados (todo por el DOM, nada a mano)
// ---------------------------------------------------------------------------

async function entrarARenglones(m, d) {
  m.escribir('sgc-titulo', 'Resmas A4');
  m.escribir('sgc-anio', '2026');
  m.escribir('sgc-dependencia', 'División Usuario');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-renglones').hidden, 20000,
    'paso de renglones visible');
}

async function cargarUnRenglonReal(m, d, indice) {
  await m.esperar(() => (d.getElementById('sgc-estado').textContent || '').indexOf('ítems') !== -1,
    30000, 'índice del catálogo cargado');
  const clases = SGC().catalogo.carga.obtenerEstado().clases.filter(function (c) {
    return c[3] > 0;
  });
  assert.ok(clases.length >= 1, 'el catálogo real tiene al menos una clase con ítems');
  const clase = clases[indice % clases.length];
  m.escribir('sgc-campo-clases', clase[2]);
  await m.esperar(() => d.getElementById('sgc-opcion-clase-0'), 20000,
    'opción de la clase renderizada');
  m.mousedown('sgc-opcion-clase-0');
  await m.esperar(() => d.getElementById('sgc-opcion-item-0'), 30000,
    'ítems de la clase cargados');
  m.mousedown('sgc-opcion-item-0');
  await m.esperar(() => d.getElementById('sgc-lista-renglones').children.length === indice + 1,
    20000, 'renglón ' + (indice + 1) + ' agregado');
  const fila = d.getElementById('sgc-lista-renglones').children[indice];
  const unidad = fila.querySelector('[aria-label="Unidad de medida"]');
  assert.ok(unidad, 'cada fila expone el campo de unidad');
  m.escribirEnNodo(unidad, 'UN');
}

async function irARevision(m, d) {
  await entrarARenglones(m, d);
  await cargarUnRenglonReal(m, d, 0);
  await m.esperar(() => (d.getElementById('sgc-resumen').textContent || '').indexOf('0 con error') !== -1,
    20000, 'el renglón queda sin errores');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-fundamentacion').hidden, 20000,
    'paso de fundamentación visible');
  m.escribir('sgc-justificacion', 'Se necesita papel para el área.');
  d.getElementById('sgc-siguiente').click();
  await m.esperar(() => !d.getElementById('sgc-paso-revision').hidden, 20000,
    'paso de revisión visible');
}

// ---------------------------------------------------------------------------
// §3.6.2 — No avanza con el paso inválido
// ---------------------------------------------------------------------------
test('no se puede avanzar de paso con el paso inválido y el motivo queda a la vista', async function () {
  const m = await am.arrancar({ prefix: 'sgc-wz-1-' });
  try {
    await m.prepararGenerador('maria.uno@test.local', 'María', 'González');
    const d = m.documento;

    m.escribir('sgc-titulo', 'Un título');
    m.escribir('sgc-anio', '20');
    m.escribir('sgc-dependencia', '');
    d.getElementById('sgc-siguiente').click();

    assert.equal(d.getElementById('sgc-paso-identificacion').hidden, false, 'sigue en el paso 1');
    assert.equal(d.getElementById('sgc-paso-renglones').hidden, true, 'no avanza al paso 2');
    assert.equal(d.getElementById('sgc-error-anio').hidden, false, 'el error del año está a la vista');
    assert.match(d.getElementById('sgc-error-anio').textContent, /cuatro dígitos/);
    assert.equal(d.getElementById('sgc-error-dependencia').hidden, false,
      'el error de dependencia está a la vista');
    assert.match(d.getElementById('sgc-error-dependencia').textContent, /dependencia solicitante/);
  } finally {
    await m.cerrar();
  }
});

// ---------------------------------------------------------------------------
// §3.6.3 — Borrador: recarga y operador distinto
// ---------------------------------------------------------------------------
test('el borrador sobrevive a la recarga y no se ofrece a un operador distinto', async function () {
  const m = await am.arrancar({ prefix: 'sgc-wz-2-' });
  try {
    await m.prepararGenerador('maria.dos@test.local', 'María', 'González');
    const d = m.documento;

    // La caminata hasta revisión hace que la aplicación escriba el borrador
    // (guardarBorrador en cada paso) en el sessionStorage de esta "pestaña".
    await irARevision(m, d);

    // La recarga conserva la cookie de sesión y el sessionStorage: al volver,
    // la aplicación reanuda la sesión sola y ofrece el borrador a su dueña.
    m.recargar();
    await m.esperar(() => d.getElementById('sgc-borrador-aviso').hidden === false &&
      (d.getElementById('sgc-borrador-info').textContent || '')
        .indexOf('maria.dos@test.local') !== -1,
      30000, 'el borrador se ofrece de nuevo a la dueña tras la recarga');

    d.getElementById('sgc-btn-retomar').click();
    assert.equal(d.getElementById('sgc-borrador-aviso').hidden, true, 'retomar cierra el aviso');
    assert.equal(d.getElementById('sgc-titulo').value, 'Resmas A4');
    assert.equal(d.getElementById('sgc-anio').value, '2026');

    // Otro operador (abastecimiento) entra por la puerta real: la aplicación
    // selecciona su operador y el borrador de la generadora no se ofrece. Con
    // la sesión de la generadora todavía viva, salir primero es lo que haría
    // una persona (y evita que el auto-login de la recarga compita con el
    // ingreso del administrador para el alta del nuevo operador).
    d.getElementById('sgc-sesion-salir').click();
    await m.esperar(() => !d.getElementById('sgc-ingreso').hidden, 20000,
      'ingreso limpio tras salir');
    await m.prepararOperador('juan.dos@test.local', 'Juan', 'Pérez', 'abastecimiento');
    assert.equal(d.getElementById('sgc-borrador-aviso').hidden, true,
      'el borrador ajeno no se ofrece');
  } finally {
    await m.cerrar();
  }
});

// ---------------------------------------------------------------------------
// §3.6.4 — Fast-Track con entrada hostil (validación real del servidor)
// ---------------------------------------------------------------------------
test('Fast-Track rechaza códigos inexistentes y aclaraciones largas; el <script> queda como dato', async function () {
  const m = await am.arrancar({ prefix: 'sgc-wz-4-' });
  try {
    await m.prepararGenerador('maria.cuatro@test.local', 'María', 'González');
    const d = m.documento;

    // El Fast-Track se usa desde su lugar real: el campo de la identificación.
    async function importarArchivo(objeto) {
      const entrada = d.getElementById('sgc-archivo-modelo');
      entrada.files = [{ contenido: JSON.stringify(objeto) }];
      entrada.emit('change');
      await m.esperar(() => d.getElementById('sgc-fasttrack-msj').hidden === false,
        30000, 'el Fast-Track respondió');
      return d.getElementById('sgc-fasttrack-msj').textContent;
    }

    const CODIGO_REAL = '2.1.1-439.102';
    const validoBase = {
      anio: '2026', dependenciaSolicitante: 'D', justificacion: 'J', objetivo: '',
      renglones: [{ codigo: CODIGO_REAL, cantidad: 1, unidad: 'UN', aclaracion: '' }]
    };

    const msj1 = await importarArchivo(Object.assign({}, validoBase, {
      titulo: 'T',
      renglones: [{ codigo: '99.9-9999.9', cantidad: 1, unidad: 'UN', aclaracion: '' }]
    }));
    assert.match(msj1, /99\.9-9999\.9/);
    assert.match(msj1, /no existen en el catálogo/);
    assert.equal(d.getElementById('sgc-titulo').value, '', 'no se toca el formulario');

    const msj2 = await importarArchivo(Object.assign({}, validoBase, {
      titulo: 'T',
      renglones: [{ codigo: CODIGO_REAL, cantidad: 1, unidad: 'UN', aclaracion: 'x'.repeat(2001) }]
    }));
    assert.match(msj2, /2000 caracteres/);

    const baseInnerHTML = obtenerConteoInnerHTML();
    const msj3 = await importarArchivo(Object.assign({}, validoBase, {
      titulo: '<script>alert(1)</script>'
    }));
    assert.match(msj3, /importado correctamente/);
    assert.equal(d.getElementById('sgc-titulo').value, '<script>alert(1)</script>',
      'el contenido llega como valor de campo, no como HTML');
    assert.equal(obtenerConteoInnerHTML(), baseInnerHTML,
      'el Fast-Track no asignó innerHTML (sin inyección)');
    assert.equal(d.body.querySelectorAll('script').length, 0,
      'no se inyectó ningún elemento <script> en el DOM');
  } finally {
    await m.cerrar();
  }
});

// ---------------------------------------------------------------------------
// §3.6.5 — Alta completa contra el servidor real
// ---------------------------------------------------------------------------
test('alta completa: datos.json, entrada en idx/, número único, auditoría con el correo', { timeout: 60000 }, async function () {
  const m = await am.arrancar({ prefix: 'sgc-wz-6-' });
  try {
    await m.prepararGenerador('maria.seis@test.local', 'María', 'González');
    const d = m.documento;

    await irARevision(m, d);
    await m.esperar(() => (d.getElementById('sgc-estado').textContent || '').indexOf('ítems') !== -1,
      30000, 'índice del catálogo cargado');
    const version = SGC().catalogo.carga.obtenerEstado().manifiesto.catalogoVersion;

    d.getElementById('sgc-persistir').click();
    await m.esperar(() => !d.getElementById('sgc-exito').hidden, 30000,
      'expediente creado y confirmado');
    const id = d.getElementById('sgc-exito-id').textContent.replace(/^Expediente\s*/, '').trim();
    assert.match(id, /^2026-\d{3}$/, 'número único con el formato del año');

    const carpeta = path.join(m.datos, '2026', id.split('-')[1] + '_Expediente');
    const doc = JSON.parse(fs.readFileSync(path.join(carpeta, 'datos.json'), 'utf8'));
    assert.equal(doc.titulo, 'Resmas A4');
    assert.equal(doc.catalogoVersion, version, 'la versión del catálogo queda registrada (ADR-014)');
    assert.equal(doc.estado.id, 'ESPECIFICACIONES_TECNICAS');
    assert.equal(doc.schemaVersion, SGC().core.migraciones.VERSION_ACTUAL);
    assert.ok(fs.existsSync(path.join(m.datos, 'idx', id + '.json')), 'existe la entrada en idx/');
    assert.ok(doc.auditoria.length >= 1, 'la auditoría quedó registrada');
    assert.equal(doc.auditoria[0].accion, 'crearExpediente');
    assert.equal(doc.auditoria[0].email, 'maria.seis@test.local',
      'la auditoría registra el correo del operador');
    assert.equal(globalThis.sessionStorage.claves().length, 0,
      'el borrador se limpió tras el alta');
  } finally {
    await m.cerrar();
  }
});