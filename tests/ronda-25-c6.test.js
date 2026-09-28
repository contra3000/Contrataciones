'use strict';

/*
 * ronda-25-c6.test.js
 * ORDEN-RONDA-25 pieza 6 · corregir renglones en su etapa, y nadie más.
 *
 * 1) Montura con la app real y un expediente sembrado en ESPECIFICACIONES_
 *    TECNICAS: el generador (quien ejecuta el estado) ve el editor de
 *    renglones, corrige la aclaración y guarda por PUT con versionEsperada.
 *    La corrección queda en el disco (item y cantidad intactos, versión +1)
 *    y reaparece al volver a abrir. Sin el editor, no hay forma de tocar una
 *    aclaración ya guardada (rojo, la prueba de 10 minutos).
 * 2) El caso del auditor (R53): un abastecimiento manda cantidad 99 por PUT
 *    en AUTORIZACION_SCo (estado que ejecuta abastecimiento_supervisor) →
 *    403 en castellano y en el disco sigue la cantidad anterior y la misma
 *    versión. Quitar la guardia de autorizarRolDelEstado → rojo.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const am = require('./helpers/aplicacion-montura.js');
const {
  contexto,
  crearEnEstado,
  docEnDisco,
  arrancarEntorno,
  limpiarEntorno,
  pedir
} = require('./helpers/transiciones-servidor-util.js');

const ID = '2026-0256';
const ACLARACION_CORREGIDA = 'Aclaración corregida por el generador';

function botonAbrirDelTablero(d, expId) {
  const botones = d.getElementById('sgc-kanban').querySelectorAll('button');
  return botones.find((b) => (b.getAttribute('aria-label') || '') === 'Abrir el expediente ' + expId);
}

function rutaDatos(datosDir) {
  return path.join(datosDir, '2026', ID.slice(5) + '_Expediente', 'datos.json');
}

function aclaracionDelDisco(datosDir) {
  return JSON.parse(fs.readFileSync(rutaDatos(datosDir), 'utf8')).renglones[0];
}

// Expediente sembrado en fase 1 (ESPECIFICACIONES_TECNICAS) con un renglón
// válido: cantidad numérica (como la guarda el sistema), unidad y una
// aclaración original que el generador va a corregir por la pantalla.
function sembrarExpediente(datosDir) {
  const SGC = globalThis.SGC;
  const contexto = {
    timestamp: '2026-09-25T12:00:00.000Z',
    email: 'generador.ronda25c6@test.local',
    rol: 'generador',
    equipo: 'PC-PRUEBA-25'
  };
  const base = {
    titulo: 'Expediente con renglón para corregir',
    anio: '2026',
    fechaCreacion: '2026-09-25',
    identificacion: {
      numero: ID.slice(5),
      anio: '2026',
      dependenciaSolicitante: 'División Usuario',
      finalidad: 'Reposición de insumos'
    },
    renglones: [
      {
        codigo: '2.1.1-439.102',
        item: 'Resma de papel A4',
        cantidad: 2,
        unidad: 'unidad',
        rubro: '4210',
        aclaracion: 'Aclaración original a corregir'
      }
    ],
    presupuestos: [],
    requerimiento: {}
  };
  const expediente = SGC.adapters.repo.construirExpediente(base, contexto, ID);
  const dirExp = path.join(datosDir, '2026', ID.slice(5) + '_Expediente');
  fs.mkdirSync(dirExp, { recursive: true });
  fs.writeFileSync(path.join(dirExp, 'datos.json'), JSON.stringify(expediente, null, 2), 'utf8');
  const entrada = SGC.adapters.repo.entradaIndice(ID, expediente, contexto);
  const dirIdx = path.join(datosDir, 'idx');
  fs.mkdirSync(dirIdx, { recursive: true });
  fs.writeFileSync(path.join(dirIdx, ID + '.json'), JSON.stringify(entrada, null, 2), 'utf8');
}

test('RONDA-25 pieza 6 · el generador corrige una aclaración en EETT y queda guardada', async function () {
  const m = await am.arrancar({ prefix: 'rp25-c6a-' });
  const d = m.documento;
  try {
    sembrarExpediente(m.datos);

    const op = await m.prepararOperador('generador.ronda25c6@test.local', 'Generadora', 'Ronda 25', 'generador');

    d.getElementById('sgc-nav-tablero').click();
    await m.esperar(() => !d.getElementById('sgc-kanban').hidden, 20000, 'tablero visible');
    await m.esperar(() => !!botonAbrirDelTablero(d, ID), 30000,
      'tarjeta del expediente sembrado en el tablero');
    botonAbrirDelTablero(d, ID).click();
    await m.esperar(() => !d.getElementById('sgc-expediente').hidden, 30000,
      'expediente abierto');

    // Quien ejecuta el estado actual ve el editor de renglones, con el renglón
    // del disco cargado (cargar(lista)).
    await m.esperar(() => !d.getElementById('sgc-renglones-editor-seccion').hidden, 30000,
      'el editor de renglones está visible en ESPECIFICACIONES_TECNICAS');
    const lista = d.getElementById('sgc-renglones-lista-renglones');
    await m.esperar(() => lista.children.length === 1, 20000,
      'el renglón sembrado aparece en el editor');
    let fila = lista.children[0];
    assert.ok(fila.textContent.indexOf('Resma de papel A4') !== -1,
      'el editor muestra la descripción del ítem ya guardada');
    assert.strictEqual(fila.querySelector('[aria-label="Cantidad del ítem"]').value, '2',
      'la cantidad ya guardada viene precargada');

    const antes = JSON.parse(fs.readFileSync(rutaDatos(m.datos), 'utf8'));
    const aclaracion = fila.querySelector('[aria-label="Aclaración opcional"]');
    m.escribirEnNodo(aclaracion, ACLARACION_CORREGIDA);
    d.getElementById('sgc-renglones-guardar').click();

    // El aviso de la pantalla confirma el guardado por PUT con versionEsperada.
    await m.esperar(() => !d.getElementById('sgc-renglones-msj').hidden &&
      (d.getElementById('sgc-renglones-msj').textContent || '').indexOf('Renglones guardados') !== -1,
      30000, 'la pantalla confirma que se guardaron los renglones');

    // En el disco: la aclaración corregida, item y cantidad intactos, versión +1.
    const enDisco = JSON.parse(fs.readFileSync(rutaDatos(m.datos), 'utf8'));
    assert.strictEqual(enDisco.version, antes.version + 1, 'el PUT sube la versión');
    assert.strictEqual(enDisco.renglones[0].aclaracion, ACLARACION_CORREGIDA,
      'la aclaración corregida queda en el disco');
    assert.strictEqual(enDisco.renglones[0].item, 'Resma de papel A4',
      'la descripción del ítem no se pierde al corregir');
    assert.strictEqual(enDisco.renglones[0].cantidad, 2,
      'la cantidad no cambia');

    // Volver a abrir (la pantalla reabre el expediente tras guardar): la
    // aclaración corregida quedó, visible en el editor.
    await m.esperar(() => {
      const actualizada = d.getElementById('sgc-renglones-lista-renglones');
      const f = actualizada && actualizada.children[0];
      const t = f ? f.querySelector('[aria-label="Aclaración opcional"]') : null;
      return t && t.value === ACLARACION_CORREGIDA;
    }, 30000, 'el editor muestra la aclaración corregida ya persistida');
    assert.ok(!!op.email, 'el operador generador quedó listo');
  } finally {
    await m.cerrar();
  }
});

test('RONDA-25 pieza 6 · abastecimiento no cambia renglones fuera de su etapa (403 y disco intacto)', { timeout: 300000 }, async () => {
  const entorno = await arrancarEntorno();
  try {
    const { id, version } = await crearEnEstado(entorno.base, entorno.datosDir, 'AUTORIZACION_SCo', assert);

    const leido = await pedir(entorno.base, 'GET', '/api/expedientes/' + id);
    assert.strictEqual(leido.status, 200, 'se lee el expediente');
    assert.strictEqual(leido.body.expediente.renglones[0].cantidad, 2, 'la cantidad sembrada');

    // El ataque del auditor (R53): un abastecimiento manda cantidad 99 (y una
    // aclaración nueva) por PUT, en un estado que ejecuta abastecimiento_supervisor.
    const copia = JSON.parse(JSON.stringify(leido.body.expediente));
    copia.renglones[0].cantidad = 99;
    copia.renglones[0].aclaracion = 'Cantidad alterada por abastecimiento';
    const put = await pedir(entorno.base, 'PUT', '/api/expedientes/' + id, {
      expediente: copia,
      versionEsperada: version,
      contexto: contexto('abastecimiento')
    });
    assert.strictEqual(put.status, 403, 'el abastecimiento no edita renglones fuera de su etapa');
    assert.match(put.body.error, /exige el rol/, 'el 403 es en castellano y nombra al rol del estado');

    const enDisco = docEnDisco(entorno.datosDir, id);
    assert.strictEqual(enDisco.renglones[0].cantidad, 2, 'la cantidad anterior queda en el disco');
    assert.notStrictEqual(enDisco.renglones[0].aclaracion, 'Cantidad alterada por abastecimiento',
      'la aclaración no se pisa');
    assert.strictEqual(enDisco.version, version, 'la versión no sube');
  } finally {
    await limpiarEntorno(entorno);
  }
});