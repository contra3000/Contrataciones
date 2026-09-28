'use strict';

/*
 * ronda-25-c5.test.js
 * ORDEN-RONDA-25 pieza 5 · la descripción del ítem se guarda y se imprime.
 *
 * 1) Alta por la montura con ítems del catálogo real: el renglón guarda `item`
 *    (la descripción del catálogo) y el documento del estado muestra la
 *    DESCRIPCIÓN en cada renglón. Sin el `item` en datosParaPersistir el
 *    documento queda sin descripción (rojo, auditoría E1).
 * 2) tools/completar-descripciones.js sobre un expediente sin `item`: lo
 *    completa desde app/catalogo y el resto del datos.json queda igual byte a
 *    byte (la versión anterior queda en hist/v<N>.json, como el servidor).
 * 3) No queda ninguna fabricación de la descripción en tests (el grep de la
 *    auditoría da 0).
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const am = require('./helpers/aplicacion-montura.js');

const RAIZ = path.join(__dirname, '..');
const HERRAMIENTA = path.join(RAIZ, 'tools', 'completar-descripciones.js');
const CATALOGO = path.join(RAIZ, 'app', 'catalogo');

function indiceDelCatalogo() {
  const dirItems = path.join(CATALOGO, 'items');
  const indice = new Map();
  for (const nombre of fs.readdirSync(dirItems)) {
    if (!nombre.endsWith('.json')) {
      continue;
    }
    const lista = JSON.parse(fs.readFileSync(path.join(dirItems, nombre), 'utf8'));
    for (const item of lista) {
      if (item && typeof item.codigo === 'string' &&
          typeof item.item === 'string' && item.item.length > 0) {
        indice.set(item.codigo, item.item);
      }
    }
  }
  return indice;
}

function botonAbrirDelTablero(d, expId) {
  const botones = d.getElementById('sgc-kanban').querySelectorAll('button');
  return botones.find((b) => (b.getAttribute('aria-label') || '') === 'Abrir el expediente ' + expId);
}

function recorrerTests(dir, acumulado) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      recorrerTests(ruta, acumulado);
    } else if (entrada.isFile() && entrada.name.endsWith('.js')) {
      const lineas = fs.readFileSync(ruta, 'utf8').split('\n');
      lineas.forEach((linea, i) => {
        if (/descripcion\s*:/.test(linea)) {
          acumulado.push(entrada.name + ':' + (i + 1));
        }
      });
    }
  }
  return acumulado;
}

test('RONDA-25 pieza 5 · un alta por la montura con ítems del catálogo guarda la descripción en cada renglón', async function () {
  const m = await am.arrancar({ prefix: 'rp25c5-' });
  const d = m.documento;
  try {
    await m.prepararOperador('generador.r25c5@test.local', 'Generadora', 'Ronda 25', 'generador');

    m.escribir('sgc-titulo', 'Adquisición de ítems para el parque');
    m.escribir('sgc-anio', '2026');
    m.escribir('sgc-dependencia', 'División Logística');
    d.getElementById('sgc-siguiente').click();
    await m.esperar(() => !d.getElementById('sgc-paso-renglones').hidden, 20000,
      'paso de renglones visible');
    await m.esperar(() => (d.getElementById('sgc-estado').textContent || '').indexOf('ítems') !== -1,
      30000, 'índice del catálogo cargado');

    // Dos ítems del catálogo REAL, agregados por el DOM (como ronda-20).
    const clases = globalThis.SGC.catalogo.carga.obtenerEstado().clases;
    const clasesConItems = clases.filter((c) => c[3] > 0);
    assert.ok(clasesConItems.length >= 2, 'el catálogo real tiene al menos dos clases con ítems');
    for (let i = 0; i < 2; i++) {
      m.escribir('sgc-campo-clases', clasesConItems[i][2]);
      await m.esperar(() => d.getElementById('sgc-opcion-clase-0'), 20000,
        'opción de la clase ' + (i + 1) + ' renderizada');
      m.mousedown('sgc-opcion-clase-0');
      await m.esperar(() => d.getElementById('sgc-opcion-item-0'), 30000,
        'ítems de la clase ' + (i + 1) + ' cargados');
      m.mousedown('sgc-opcion-item-0');
      await m.esperar(() => d.getElementById('sgc-lista-renglones').children.length === i + 1,
        20000, 'renglón ' + (i + 1) + ' agregado');
    }
    const items = globalThis.SGC.catalogo.renglones.obtener().map((r) => r.item);
    assert.strictEqual(items.length, 2, 'quedaron dos renglones');
    assert.ok(items.every((it) => typeof it === 'string' && it.length > 0),
      'cada renglón lleva la descripción del catálogo real');

    for (const fila of d.getElementById('sgc-lista-renglones').children) {
      const unidad = fila.querySelector('[aria-label="Unidad de medida"]');
      assert.ok(unidad, 'cada fila expone el campo de unidad');
      m.escribirEnNodo(unidad, 'unidad');
    }
    await m.esperar(() => (d.getElementById('sgc-resumen').textContent || '').indexOf('0 con error') !== -1,
      20000, 'los renglones quedan sin errores');

    d.getElementById('sgc-siguiente').click();
    await m.esperar(() => !d.getElementById('sgc-paso-fundamentacion').hidden, 20000,
      'paso de fundamentación visible');
    m.escribir('sgc-justificacion', 'Se reponen ítems del catálogo para el funcionamiento del área.');
    d.getElementById('sgc-siguiente').click();
    await m.esperar(() => !d.getElementById('sgc-paso-revision').hidden, 20000,
      'paso de revisión visible');
    d.getElementById('sgc-persistir').click();
    await m.esperar(() => !d.getElementById('sgc-exito').hidden, 30000,
      'expediente creado para la pieza 5');
    const expId = d.getElementById('sgc-exito-id').textContent.replace(/^Expediente\s*/, '').trim();
    assert.ok(expId, 'muestra el id del expediente');

    // Se abre el expediente por el tablero: el documento del estado imprime la
    // DESCRIPCIÓN de cada renglón (renders: r.descripcion || r.item).
    d.getElementById('sgc-nav-tablero').click();
    await m.esperar(() => !d.getElementById('sgc-kanban').hidden, 20000, 'tablero visible');
    await m.esperar(() => !!botonAbrirDelTablero(d, expId), 30000,
      'tarjeta del expediente creado en el tablero');
    botonAbrirDelTablero(d, expId).click();
    await m.esperar(() => !d.getElementById('sgc-expediente').hidden, 30000,
      'expediente abierto');
    await m.esperar(() => {
      const sector = d.getElementById('sgc-expediente-documento');
      const texto = sector ? sector.textContent : '';
      return texto.indexOf(items[0]) !== -1 && texto.indexOf(items[1]) !== -1;
    }, 30000, 'el documento del estado muestra la descripción de cada renglón');
  } finally {
    await m.cerrar();
  }
});

test('RONDA-25 pieza 5 · la herramienta completa item desde el catálogo y el resto queda igual byte a byte', () => {
  const indice = indiceDelCatalogo();
  const pares = Array.from(indice.entries());
  assert.ok(pares.length >= 2, 'el catálogo real tiene ítems con descripción');
  const [codigoUno, itemUno] = pares[0];
  const [codigoDos, itemDos] = pares[1];

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-r25c5-'));
  try {
    const dirExp = path.join(tmp, '2026', '0001_Expediente');
    fs.mkdirSync(dirExp, { recursive: true });
    const original = {
      expedienteId: '2026-0001',
      anio: '2026',
      numero: '0001',
      titulo: 'Expediente sin descripciones',
      schemaVersion: 5,
      estado: { id: 'ESPECIFICACIONES_TECNICAS', fase: 'preparacion', desde: '2026-09-25T12:00:00.000Z' },
      version: 4,
      ultimoUsuario: 'generador.r25c5.herramienta@test.local',
      ultimaModificacion: '2026-09-25T12:00:00.000Z',
      solicitante: { nombre: 'Generadora', apellido: 'Ronda 25', email: 'g@test.local', sector: 'OxO' },
      campos: { operador: 'g@test.local', dependenciaSolicitante: 'División', justificacion: 'Prueba.', objetivo: '' },
      renglones: [
        { codigo: codigoUno, cantidad: '2', unidad: 'unidad', aclaracion: '' },
        { codigo: codigoDos, cantidad: '5', unidad: 'unidad', aclaracion: 'Entrega en planta' }
      ],
      auditoria: [{ accion: 'crearExpediente', email: 'g@test.local', rol: 'generador' }]
    };
    const rutaDatos = path.join(dirExp, 'datos.json');
    const bytesOriginales = JSON.stringify(original, null, 2);
    fs.writeFileSync(rutaDatos, bytesOriginales, 'utf8');

    const res = spawnSync(process.execPath, [HERRAMIENTA, '--datos', tmp], { encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stderr || res.stdout);

    const datosObject = JSON.parse(fs.readFileSync(rutaDatos, 'utf8'));
    assert.strictEqual(datosObject.version, 5, 'la versión sube en 1 como cualquier escritura');
    assert.strictEqual(datosObject.renglones[0].item, itemUno,
      'el primer renglón recibió la descripción del catálogo');
    assert.strictEqual(datosObject.renglones[1].item, itemDos,
      'el segundo renglón recibió la descripción del catálogo');
    assert.strictEqual(datosObject.renglones[0].aclaracion, '',
      'la aclaración del renglón no cambió');
    assert.strictEqual(datosObject.renglones[1].aclaracion, 'Entrega en planta',
      'la aclaración del renglón no cambió');

    // El resto queda igual byte a byte: la serialización del servidor es la
    // misma (JSON.stringify(objeto, null, 2)), así que el archivo nuevo sólo
    // difiere en los `item` agregados y en `version`.
    const esperado = JSON.parse(bytesOriginales);
    esperado.version = 5;
    esperado.renglones[0].item = itemUno;
    esperado.renglones[1].item = itemDos;
    assert.strictEqual(fs.readFileSync(rutaDatos, 'utf8'), JSON.stringify(esperado, null, 2),
      'el resto del datos.json quedó igual byte a byte');

    // La versión anterior quedó en hist/, igual que el servidor.
    assert.ok(fs.existsSync(path.join(dirExp, 'hist', 'v4.json')), 'la versión anterior quedó en hist/');
    assert.strictEqual(fs.readFileSync(path.join(dirExp, 'hist', 'v4.json'), 'utf8'),
      bytesOriginales, 'hist/v4.json es el expediente anterior, byte a byte');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('RONDA-25 pieza 5 · no queda ninguna fabricación de la descripción en tests', () => {
  const malos = recorrerTests(path.join(RAIZ, 'tests'), []);
  assert.deepStrictEqual(malos, [], 'ningún test fabrica la descripción (grep en 0)');
});