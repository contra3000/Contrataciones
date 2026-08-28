'use strict';

/*
 * anexo-eett.test.js
 * ORDEN-RONDA-10 §4 (H12): regla de desborde del anexo de Especificaciones
 * Técnicas.
 *
 *  - Bordes de la aclaración: 255 y 256 se imprimen en el requerimiento y no
 *    generan anexo; 257 desborda: el requerimiento dice "según anexo alfa" y
 *    el anexo lleva el texto COMPLETO (sin recortes).
 *  - Dos renglones que desbordan: alfa y bravo, sin colisiones, cada anexo con
 *    la ficha de su renglón (Renglón N° | Código SIByS | Descripción ONC |
 *    Especificaciones Técnicas).
 *  - Sin desborde ni condiciones particulares: no se genera nada. Sólo con
 *    condiciones: se genera un único anexo con sólo ellas.
 *  - Inyección en condiciones particulares y campos nuevos: escapado en
 *    componer(), texto puro en montar() (nunca innerHTML).
 *  - Criterio de conteo: puntos de código Unicode, no unidades UTF-16.
 *  - Leyenda obligatoria de ADR-023 en los tres lugares: pie del documento,
 *    resumen.md y pantalla del expediente (app/index.html en disco).
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const RAIZ = path.join(__dirname, '..');

const { documento } = require('./helpers/dom-stub.js');

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
require(path.join(RAIZ, 'app', 'js', 'renders', 'especificacion-tecnica.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'requerimiento.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'anexo-eett.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'resumen.js'));

const SGC = globalThis.SGC;

const CONTEXTO = {
  timestamp: '2026-08-14T10:00:00.000Z',
  email: 'maria.gonzalez@faa.mil.ar',
  rol: 'generador',
  equipo: 'PC-PRUEBA-01'
};

before(() => {
  globalThis.document = documento;
});

function expedienteConRenglones(renglones, condiciones) {
  const base = {
    titulo: 'Adquisición de insumos',
    anio: '2026',
    identificacion: {
      numero: '9',
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
    renglones
  };
  const exp = SGC.adapters.repo.construirExpediente(base, CONTEXTO, '2026-009');
  if (condiciones) {
    // El expediente es plano (sin wrapper .datos), igual que datos.json.
    exp.requerimiento = { condicionesParticulares: condiciones };
  }
  return exp;
}

test('§3.2.1 bordes: 255 y 256 se imprimen y no generan anexo', () => {
  for (const largo of [255, 256]) {
    const exp = expedienteConRenglones([
      { codigo: '2.1.1-439.101', cantidad: 1, unidad: 'UN', aclaracion: 'x'.repeat(largo) }
    ]);
    assert.equal(SGC.core.anexoEett.desborda(exp.renglones[0].aclaracion), false);
    assert.equal(SGC.renders.anexoEett.componerTodos(exp).length, 0,
      'con ' + largo + ' caracteres no hay anexo');
    assert.equal(SGC.core.anexoEett.tieneContenido(exp), false);
    const html = SGC.renders.requerimiento.componer(exp);
    assert.ok(html.includes('x'.repeat(Math.min(largo, 80))), 'el texto se imprime (' + largo + ')');
    assert.ok(!html.includes('según anexo'), 'no hay referencia a anexo (' + largo + ')');
  }
});

test('§3.2.2 borde 257: el requerimiento remite al anexo y éste lleva el texto completo', () => {
  const texto = 'y'.repeat(257) + '<script>alert(1)</script>';
  const exp = expedienteConRenglones([
    { codigo: '2.1.1-439.102', cantidad: 2, unidad: 'UN', item: 'Bolsa', aclaracion: texto }
  ]);
  assert.equal(SGC.core.anexoEett.tieneContenido(exp), true);
  const htmlReq = SGC.renders.requerimiento.componer(exp);
  assert.ok(htmlReq.includes('según anexo alfa'), 'la celda remite al anexo alfa');
  assert.ok(!htmlReq.includes('yyyyyyyyyy'), 'el texto desbordado no se imprime en el requerimiento');
  const anexos = SGC.renders.anexoEett.componerTodos(exp);
  assert.equal(anexos.length, 1);
  assert.equal(anexos[0].nombre, 'alfa');
  assert.equal(anexos[0].archivo, 'anexo-eett-alfa.html');
  assert.ok(anexos[0].html.includes('y'.repeat(257)), 'el anexo lleva el texto completo');
  assert.ok(anexos[0].html.includes('&lt;script&gt;'), 'el anexo lleva también lo no alfabético, escapado');
  // La ficha del renglón tiene las cuatro columnas pedidas por la orden.
  for (const col of ['Renglón N°', 'Código SIByS', 'Descripción ONC', 'Especificaciones Técnicas']) {
    assert.ok(anexos[0].html.includes(col), 'falta la columna ' + col);
  }
});

test('§3.2.3 dos renglones que desbordan: alfa y bravo, cada uno con su texto', () => {
  const exp = expedienteConRenglones([
    { codigo: '2.1.1-439.101', cantidad: 1, unidad: 'UN', aclaracion: 'a'.repeat(300) },
    { codigo: '2.1.1-439.102', cantidad: 1, unidad: 'UN', aclaracion: '' },
    { codigo: '2.1.1-439.103', cantidad: 1, unidad: 'UN', aclaracion: 'b'.repeat(400) }
  ]);
  const htmlReq = SGC.renders.requerimiento.componer(exp);
  assert.ok(htmlReq.includes('según anexo alfa'));
  assert.ok(htmlReq.includes('según anexo bravo'));
  const anexos = SGC.renders.anexoEett.componerTodos(exp);
  assert.deepEqual(anexos.map((a) => a.nombre), ['alfa', 'bravo']);
  assert.deepEqual(anexos.map((a) => a.archivo),
    ['anexo-eett-alfa.html', 'anexo-eett-bravo.html']);
  assert.ok(anexos[0].html.includes('a'.repeat(300)), 'alfa lleva el primer texto');
  assert.ok(!anexos[0].html.includes('bbbbbbbbbb'), 'alfa no lleva el segundo texto');
  assert.ok(anexos[1].html.includes('b'.repeat(300)), 'bravo lleva el segundo texto');
  assert.ok(!anexos[1].html.includes('aaaaaaaaaa'), 'bravo no lleva el primer texto');
});

test('§3.2.4 sin desborde y sin condiciones: no se genera ningún anexo', () => {
  const exp = expedienteConRenglones([
    { codigo: '2.1.1-439.101', cantidad: 1, unidad: 'UN', aclaracion: 'texto corto' }
  ]);
  assert.equal(SGC.core.anexoEett.tieneContenido(exp), false);
  assert.deepEqual(SGC.renders.anexoEett.componerTodos(exp), []);
});

test('§3.2.5 sólo condiciones particulares: un único anexo con sólo ellas', () => {
  const exp = expedienteConRenglones([
    { codigo: '2.1.1-439.101', cantidad: 1, unidad: 'UN', aclaracion: 'corto' }
  ], 'Entrega en dos tramos; embalaje reforzado.');
  assert.equal(SGC.core.anexoEett.tieneContenido(exp), true);
  const anexos = SGC.renders.anexoEett.componerTodos(exp);
  assert.equal(anexos.length, 1);
  assert.equal(anexos[0].nombre, 'alfa');
  assert.ok(anexos[0].html.includes('Entrega en dos tramos'), 'las condiciones están');
  assert.ok(!anexos[0].html.includes('Especificaciones Técnicas</th>'),
    'sin ficha de renglón cuando nadie desborda');
});

test('§3.2.6 inyección en condiciones particulares: escapado en componer, texto en montar', () => {
  const malicioso = 'Condiciones <script>alert(1)</script> e <img src=x onerror=alert(1)>';
  const exp = expedienteConRenglones(
    [{ codigo: '2.1.1-439.101', cantidad: 1, unidad: 'UN', aclaracion: '' }],
    malicioso
  );
  const anexos = SGC.renders.anexoEett.componerTodos(exp);
  assert.ok(anexos[0].html.includes('&lt;script&gt;'), 'escapado en el archivo');
  assert.ok(!anexos[0].html.includes('<script>alert'), 'sin script vivo en el archivo');

  const contenedor = documento.createElement('div');
  SGC.renders.anexoEett.montar(contenedor, exp, 'alfa');
  let visto = '';
  const recorrer = (n) => {
    if (n.textContent) {
      visto += ' ' + n.textContent;
    }
    for (const hijo of n.children || []) {
      recorrer(hijo);
    }
  };
  recorrer(contenedor);
  assert.ok(visto.includes('<script>alert(1)</script>'), 'en la página es texto puro');
});

test('§3.2.7 criterio de conteo: puntos de código, no unidades UTF-16', () => {
  const ae = SGC.core.anexoEett;
  assert.equal(ae.contarCaracteres('ñáé'), 3, 'los acentos cuentan 1 cada uno');
  assert.equal('🛩'.length, 2, 'sanity UTF-16');
  assert.equal(ae.contarCaracteres('🛩'), 1, 'un emoji cuenta 1 punto de código');
  assert.equal(ae.nombreAnexo(26), 'zulu');
  assert.equal(ae.nombreAnexo(27), 'alfa-2', 'alfabeto agotado: sufijo numérico');
  assert.equal(ae.nombreAnexo(28), 'bravo-2');
});

test('§3.2.8 la leyenda ADR-023 está en el pie del entregable, en resumen.md y en la pantalla', () => {
  const leyenda = SGC.renders.documento.LEYENDA_ADR023;
  const normalizar = (t) => t.replace(/\s+/g, ' ').trim();
  const exp = expedienteConRenglones([
    { codigo: '2.1.1-439.101', cantidad: 1, unidad: 'UN', aclaracion: 'x'.repeat(300) }
  ]);
  const anexoHtml = SGC.renders.anexoEett.componerTodos(exp)[0].html;
  assert.ok(normalizar(anexoHtml).includes(normalizar(leyenda)), 'pie del anexo');
  const reqHtml = SGC.renders.requerimiento.componer(exp);
  assert.ok(normalizar(reqHtml).includes(normalizar(leyenda)), 'pie del requerimiento');
  const resumen = SGC.renders.resumen.componer(exp);
  assert.ok(normalizar(resumen).includes(normalizar(leyenda)), 'resumen.md');
  const pantalla = fs.readFileSync(path.join(RAIZ, 'app', 'index.html'), 'utf8');
  assert.ok(normalizar(pantalla).includes(normalizar(leyenda)), 'pantalla del expediente');
});

test('§3.2.9 la leyenda ADR-016 también comparte las tres superficies (ORDEN-RONDA-10-CIERRE §1.1)', () => {
  const leyenda = SGC.renders.documento.LEYENDA_ADR016;
  const normalizar = (t) => t.replace(/\s+/g, ' ').trim();
  // Con al menos un renglón que desborda hay anexo; es el entregable cuyo pie
  // tiene que llevar la leyenda.
  const exp = expedienteConRenglones([
    { codigo: '2.1.1-439.101', cantidad: 1, unidad: 'UN', aclaracion: 'x'.repeat(300) }
  ]);
  const anexoHtml = SGC.renders.anexoEett.componerTodos(exp)[0].html;
  assert.ok(normalizar(anexoHtml).includes(normalizar(leyenda)), 'pie del anexo');
  const reqHtml = SGC.renders.requerimiento.componer(exp);
  assert.ok(normalizar(reqHtml).includes(normalizar(leyenda)), 'pie del requerimiento');
  const resumen = SGC.renders.resumen.componer(exp);
  assert.ok(normalizar(resumen).includes(normalizar(leyenda)), 'resumen.md');
  const pantalla = fs.readFileSync(path.join(RAIZ, 'app', 'index.html'), 'utf8');
  assert.ok(normalizar(pantalla).includes(normalizar(leyenda)), 'pantalla del expediente');
});
