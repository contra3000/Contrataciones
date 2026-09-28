'use strict';

/*
 * ronda-25-c1.test.js
 * ORDEN-RONDA-25 §Pieza 1 · Se puede abrir lo que se guardó.
 *
 * El defecto: `requerimiento-formulario.js` avisa que el anexo se guardó y no
 * ofrece cómo abrirlo. El servidor ya lo sirve con GET
 * /api/expedientes/<id>/entregables/<nombre>.
 *
 * En la montura (app real + servidor real, nada se llama a mano):
 *  - el expediente sembrado en disco llega con condiciones particulares, así
 *    que "Generar anexo(s) de EETT" guarda un anexo de verdad (alfa);
 *  - el anexo aparece en la lista de documentos guardados del expediente, con
 *    su "Ver" apuntando a la ruta que ya sirve el servidor;
 *  - "Ver" pide esa ruta y recibe 200: la misma que después abre la pestaña
 *    nueva (exportar.js la agenda detrás del modal de advertencia).
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const am = require('./helpers/aplicacion-montura.js');
const su = require('./helpers/servidor-util.js');

const ID = '2026-0251';
const ANEXO = 'anexo-eett-alfa.html';

function botonAbrirDelTablero(d, expId) {
  const botones = d.getElementById('sgc-kanban').querySelectorAll('button');
  return botones.find((b) => (b.getAttribute('aria-label') || '') === 'Abrir el expediente ' + expId);
}

function cookieDe(respuesta) {
  const set = respuesta.encabezados['set-cookie'];
  const una = Array.isArray(set) ? set[0] : set;
  return una ? una.split(';')[0] : null;
}

// La pestaña nueva lleva la cookie del dominio: este GET es lo que hace el
// navegador cuando "Ver" abre la ruta en otra pestaña.
async function sesionDe(base, email, claveFija) {
  const login = await su.pedir(base, 'POST', '/api/sesion/login',
    { email: email, clave: claveFija });
  assert.strictEqual(login.status, 200, 'login del operador para la pestaña nueva');
  const cookie = cookieDe(login);
  assert.ok(cookie, 'el login devuelve la cookie de sesión');
  return cookie;
}

// Siembra el expediente en el disco del servidor de la montura (datos de
// prueba, como importarPadron): datos.json + entrada del índice fragmentado.
// Las condiciones particulares hacen que el planificador de anexos dé un único
// anexo (alfa) sin depender del largo de ninguna aclaración.
function sembrarExpediente(datosDir) {
  const SGC = globalThis.SGC;
  const contexto = {
    timestamp: '2026-09-25T12:00:00.000Z',
    email: 'generador.ronda25c1@test.local',
    rol: 'generador',
    equipo: 'PC-PRUEBA-25'
  };
  const base = {
    titulo: 'Expediente con anexo por condiciones particulares',
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
        descripcion: 'Resma de papel A4',
        item: 'Resma de papel A4',
        cantidad: '2',
        unidad: 'unidad',
        rubro: '4210',
        aclaracion: 'Aclaración corta, no desborda la celda impresa'
      }
    ],
    presupuestos: [],
    requerimiento: {
      condicionesParticulares: 'Condiciones particulares de prueba para el anexo de EETT.'
    }
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

test('RONDA-25 pieza 1 · un anexo guardado aparece en la lista y su "Ver" pide la ruta y recibe 200', async function () {
  const m = await am.arrancar({ prefix: 'rp25-c1-' });
  const d = m.documento;
  try {
    sembrarExpediente(m.datos);

    const op = await m.prepararOperador('generador.ronda25c1@test.local', 'Generadora', 'Ronda 25', 'generador');

    d.getElementById('sgc-nav-tablero').click();
    await m.esperar(() => !d.getElementById('sgc-kanban').hidden, 20000, 'tablero visible');
    await m.esperar(() => !!botonAbrirDelTablero(d, ID), 30000,
      'tarjeta del expediente sembrado en el tablero');
    botonAbrirDelTablero(d, ID).click();
    await m.esperar(() => !d.getElementById('sgc-expediente').hidden &&
      (d.getElementById('sgc-expediente-resumen').textContent || '').indexOf('Estado:') !== -1,
      30000, 'expediente abierto y renderizado');
    await m.esperar(() => !d.getElementById('sgc-requerimiento-seccion').hidden,
      30000, 'la sección de carga del requerimiento está visible');

    // "Generar anexo(s) de EETT": guarda el anexo de verdad por la pantalla.
    d.getElementById('sgc-generar-anexos').click();
    await m.esperar(() => !d.getElementById('sgc-requerimiento-msj').hidden &&
      (d.getElementById('sgc-requerimiento-msj').textContent || '').indexOf('guardado(s)') !== -1,
      30000, 'el aviso de la pantalla confirma que el anexo se guardó');

    // El anexo aparece en la lista de documentos guardados del expediente.
    const lista = d.getElementById('sgc-expediente-entregables');
    await m.esperar(() => lista && !d.getElementById('sgc-expediente-entregables-bloque').hidden &&
      lista.querySelector('[data-documento="' + ANEXO + '"]'),
      30000, 'el anexo figura en la lista de documentos guardados');

    const fila = lista.querySelector('[data-documento="' + ANEXO + '"]');
    const ver = fila.querySelector('[data-ruta]');
    assert.ok(ver, 'el anexo tiene su "Ver"');
    const ruta = ver.getAttribute('data-ruta');
    assert.strictEqual(ruta, 'api/expedientes/' + ID + '/entregables/' + ANEXO,
      'el "Ver" apunta a la ruta que ya sirve el servidor');

    // "Ver" pide esa ruta: la pestaña nueva que abre la app es esta URL (con la
    // sesión del operador, como en el navegador) y el servidor responde 200
    // con el documento guardado.
    const cookie = await sesionDe(m.base, op.email, op.claveFija);
    const pedido = await su.pedir(m.base, 'GET', '/' + ruta, undefined, { Cookie: cookie });
    assert.strictEqual(pedido.status, 200, 'el servidor sirve el anexo guardado');
    assert.ok(pedido.raw.indexOf('Anexo de Especificaciones Técnicas') !== -1,
      'el cuerpo es el HTML del anexo guardado');
  } finally {
    await m.cerrar();
  }
});