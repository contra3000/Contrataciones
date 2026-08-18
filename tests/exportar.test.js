'use strict';

/*
 * exportar.test.js
 * ORDEN-RONDA-07 §3.5 punto 9 y §3.2/§3.3/§3.4 sobre la montura DOM mínima:
 *
 *  - Ninguna descarga (JSON, resumen, documento) ocurre sin pasar por el modal
 *    de advertencia obligatorio (FSD §6): el descargador y el navegador son
 *    inyectables y se verifica que no se llamen antes de confirmar.
 *  - Confirmar con el botón descriptivo agenda la descarga con el contenido
 *    correcto: datos.json crudo, resumen.md con ADR-016, o la apertura del
 *    documento guardado.
 *  - Guardar documento generado llama a repo.guardarEntregable con el HTML
 *    compuesto y enlaza el archivo guardado (§3.3, ADR-016).
 *  - El botón Imprimir llama a window.print() con la clase que activa la hoja
 *    de impresión (§3.2).
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

const { documento, crearStoragePlano } = require('./helpers/dom-stub.js');
const { nodo, nuevaVuelta } = require('./helpers/wizard-montura.js');

require(path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'config.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'utils.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'auditoria.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'migraciones.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'validacion.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'estados.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'especificacion-tecnica.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'resumen.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'exportar.js'));

const SGC = globalThis.SGC;

const MARIA = {
  nombre: 'María', apellido: 'González',
  email: 'maria.gonzalez@faa.mil.ar',
  roles: ['generador'], sector: 'usuario'
};

const CONTEXTO = {
  timestamp: '2026-08-14T10:00:00.000Z',
  email: MARIA.email,
  rol: 'generador',
  equipo: 'PC-PRUEBA-01'
};

before(() => {
  globalThis.document = documento;
  globalThis.sessionStorage = crearStoragePlano();
});

function armarMontaje() {
  const app = nodo('main', 'app');
  const sec = nodo('section', 'sgc-expediente');
  sec.appendChild(nodo('button', 'sgc-expediente-documento-imprimir'));
  sec.appendChild(nodo('button', 'sgc-expediente-documento-guardar'));
  const enlace = nodo('a', 'sgc-expediente-documento-enlace');
  enlace.hidden = true;
  sec.appendChild(enlace);
  sec.appendChild(nodo('button', 'sgc-expediente-exportar-json'));
  sec.appendChild(nodo('button', 'sgc-expediente-exportar-resumen'));
  sec.appendChild(nodo('p', 'sgc-expediente-documento-msj'));
  app.appendChild(sec);

  const modal = nodo('div', 'sgc-modal-advertencia');
  modal.hidden = true;
  modal.appendChild(nodo('h3', 'sgc-modal-advertencia-titulo'));
  modal.appendChild(nodo('p', 'sgc-modal-advertencia-texto'));
  modal.appendChild(nodo('button', 'sgc-modal-advertencia-confirmar'));
  modal.appendChild(nodo('button', 'sgc-modal-advertencia-cancelar'));
  app.appendChild(modal);

  return { raiz: app, nodos: documento.porId };
}

function expedientePrueba() {
  return SGC.adapters.repo.construirExpediente({
    titulo: 'Adquisición de resmas A4',
    anio: '2026',
    identificacion: {
      numero: '11',
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
    renglones: [
      { codigo: '2.1.1-439.102', cantidad: 2, unidad: 'UN', rubro: '4210', aclaracion: 'Para mesa de entradas' }
    ]
  }, CONTEXTO, '2026-011');
}

function repoFalso() {
  const guardados = [];
  return {
    _guardados: guardados,
    guardarEntregable: (id, nombre, contenido, contexto) => {
      guardados.push({ id, nombre, contenido, contexto });
      return Promise.resolve({ ruta: 'entregables/' + nombre, version: 2 });
    }
  };
}

function montarExportar() {
  const montaje = armarMontaje();
  const repo = repoFalso();
  const descargas = [];
  const aperturas = [];
  SGC.views.exportar.montar(montaje.raiz);
  SGC.views.exportar.fijarRepo(repo);
  SGC.views.exportar.seleccionarOperador(MARIA);
  SGC.views.exportar.fijarProveedor(() => ({ expediente: expedientePrueba(), version: 1 }));
  SGC.views.exportar.fijarDescargador((nombre, contenido) => {
    descargas.push({ nombre, contenido });
  });
  SGC.views.exportar.fijarNavegador((url) => {
    aperturas.push(url);
  });
  return { montaje, repo, descargas, aperturas };
}

test('§3.5.9 exportar JSON abre el modal y nada se descarga sin confirmar', () => {
  const { montaje, descargas } = montarExportar();
  const nodos = montaje.nodos;

  nodos['sgc-expediente-exportar-json'].click();
  assert.equal(nodos['sgc-modal-advertencia'].hidden, false, 'el modal se abre');
  assert.ok(nodos['sgc-modal-advertencia-texto'].textContent.includes('aislado'),
    'el modal recuerda que el sistema es aislado');
  assert.equal(descargas.length, 0, 'sin confirmación no hay descarga');

  nodos['sgc-modal-advertencia-cancelar'].click();
  assert.equal(nodos['sgc-modal-advertencia'].hidden, true, 'cancelar cierra el modal');
  assert.equal(descargas.length, 0, 'cancelar no descarga');
});

test('exportar JSON: confirmar descarga el datos.json crudo del expediente', () => {
  const { montaje, descargas } = montarExportar();
  const nodos = montaje.nodos;

  nodos['sgc-expediente-exportar-json'].click();
  nodos['sgc-modal-advertencia-confirmar'].click();

  assert.equal(descargas.length, 1);
  assert.equal(descargas[0].nombre, 'datos.json');
  assert.equal(descargas[0].contenido, JSON.stringify(expedientePrueba(), null, 2),
    'el JSON exportado es el crudo, sin recortes');
  assert.equal(nodos['sgc-modal-advertencia'].hidden, true, 'el modal se cierra al confirmar');
});

test('exportar resumen.md: confirmar descarga el resumen con la declaración de ADR-016', () => {
  const { montaje, descargas } = montarExportar();
  const nodos = montaje.nodos;

  nodos['sgc-expediente-exportar-resumen'].click();
  assert.equal(descargas.length, 0, 'todavía no se descarga');
  nodos['sgc-modal-advertencia-confirmar'].click();

  assert.equal(descargas.length, 1);
  assert.equal(descargas[0].nombre, 'resumen.md');
  assert.ok(descargas[0].contenido.includes('ADR-016'), 'el resumen declara ADR-016');
  assert.ok(descargas[0].contenido.includes('maria.gonzalez@faa.mil.ar'), 'los hitos van en el resumen');
});

test('§3.3 guardar documento guarda el HTML compuesto, sin modal, y enlaza el archivo', async () => {
  const { montaje, repo, descargas } = montarExportar();
  const nodos = montaje.nodos;

  nodos['sgc-expediente-documento-guardar'].click();
  await nuevaVuelta();

  assert.equal(repo._guardados.length, 1);
  const guardado = repo._guardados[0];
  assert.equal(guardado.id, '2026-011');
  assert.equal(guardado.nombre, 'especificacion-tecnica.html');
  assert.ok(guardado.contenido.includes('<!DOCTYPE html>'), 'guarda el HTML compuesto');
  assert.ok(guardado.contenido.includes('2.1.1-439.102'), 'el documento guardado lleva los renglones');
  assert.ok(guardado.contenido.includes('Para mesa de entradas'), 'lleva las aclaraciones');
  assert.equal(guardado.contexto.email, 'maria.gonzalez@faa.mil.ar');

  assert.equal(descargas.length, 0, 'guardar en el sistema no es una descarga');
  assert.equal(nodos['sgc-modal-advertencia'].hidden, true, 'guardar no abre el modal');

  assert.equal(nodos['sgc-expediente-documento-enlace'].hidden, false, 'el documento queda enlazado');
  assert.equal(nodos['sgc-expediente-documento-enlace'].href,
    'api/expedientes/2026-011/entregables/especificacion-tecnica.html');
});

test('abrir el documento guardado pasa por el modal antes de navegar', async () => {
  const { montaje, aperturas } = montarExportar();
  const nodos = montaje.nodos;

  nodos['sgc-expediente-documento-guardar'].click();
  await nuevaVuelta();

  nodos['sgc-expediente-documento-enlace'].click();
  assert.equal(nodos['sgc-modal-advertencia'].hidden, false, 'el modal se abre antes de navegar');
  assert.equal(aperturas.length, 0, 'no navega sin confirmar');

  nodos['sgc-modal-advertencia-confirmar'].click();
  assert.equal(aperturas.length, 1, 'confirma la apertura');
  assert.equal(aperturas[0], 'api/expedientes/2026-011/entregables/especificacion-tecnica.html');
});

test('§3.2 el botón Imprimir llama a window.print con la clase de impresión puesta', () => {
  let claseDurantePrint = false;
  let llamadas = 0;
  globalThis.print = () => {
    llamadas += 1;
    claseDurantePrint = globalThis.document.body.classList.contains('imprimiendo');
  };

  const { montaje } = montarExportar();
  montaje.nodos['sgc-expediente-documento-imprimir'].click();

  assert.equal(llamadas, 1, 'window.print se llama una vez');
  assert.equal(claseDurantePrint, true, 'la hoja de impresión está activa durante la llamada');
  assert.equal(globalThis.document.body.classList.contains('imprimiendo'), false,
    'la clase se quita después de imprimir');
});