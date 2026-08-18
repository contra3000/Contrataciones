'use strict';

/*
 * wizard-montura.js
 * Montura del DOM mínimo para los tests de wizard (ronda 5 y 6). Comparte la
 * estructura del árbol que arma wizard.montar y las utilidades de espera, para
 * que los archivos de test no repitan la construcción y ninguno supere las 400
 * líneas.
 */

const { Nodo, documento, registrar } = require('./dom-stub.js');

function nodo(tag, id) {
  return registrar(new Nodo(tag, id));
}

function armarWizard() {
  const app = nodo('main', 'app');

  const seleccion = nodo('section', 'sgc-seleccion-operador');
  seleccion.appendChild(nodo('ul', 'sgc-lista-operadores'));
  app.appendChild(seleccion);

  const wiz = nodo('section', 'sgc-app');
  wiz.appendChild(nodo('span', 'sgc-operador-actual'));

  const aviso = nodo('div', 'sgc-borrador-aviso');
  aviso.hidden = true;
  aviso.appendChild(nodo('p', 'sgc-borrador-info'));
  aviso.appendChild(nodo('button', 'sgc-btn-retomar'));
  aviso.appendChild(nodo('button', 'sgc-btn-descartar'));
  wiz.appendChild(aviso);

  const pasosNav = nodo('ol', 'sgc-pasos');
  for (const idPaso of ['identificacion', 'renglones', 'fundamentacion', 'revision']) {
    const li = nodo('li');
    li.setAttribute('data-paso', idPaso);
    pasosNav.appendChild(li);
  }
  wiz.appendChild(pasosNav);
  wiz.appendChild(nodo('p', 'sgc-paso-msj'));

  const paso1 = nodo('section', 'sgc-paso-identificacion');
  paso1.appendChild(nodo('button', 'sgc-btn-modelo'));
  paso1.appendChild(nodo('input', 'sgc-archivo-modelo'));
  paso1.appendChild(nodo('p', 'sgc-fasttrack-msj'));
  paso1.appendChild(nodo('input', 'sgc-titulo'));
  paso1.appendChild(nodo('p', 'sgc-error-titulo'));
  paso1.appendChild(nodo('input', 'sgc-anio'));
  paso1.appendChild(nodo('p', 'sgc-error-anio'));
  paso1.appendChild(nodo('input', 'sgc-dependencia'));
  paso1.appendChild(nodo('p', 'sgc-error-dependencia'));
  wiz.appendChild(paso1);

  const paso2 = nodo('section', 'sgc-paso-renglones');
  paso2.appendChild(nodo('ul', 'sgc-lista-renglones'));
  paso2.appendChild(nodo('p', 'sgc-resumen'));
  wiz.appendChild(paso2);

  const paso3 = nodo('section', 'sgc-paso-fundamentacion');
  paso3.appendChild(nodo('textarea', 'sgc-justificacion'));
  paso3.appendChild(nodo('p', 'sgc-error-justificacion'));
  paso3.appendChild(nodo('textarea', 'sgc-objetivo'));
  wiz.appendChild(paso3);

  const paso4 = nodo('section', 'sgc-paso-revision');
  paso4.appendChild(nodo('dl', 'sgc-revision-filas'));
  paso4.appendChild(nodo('button', 'sgc-persistir'));
  paso4.appendChild(nodo('p', 'sgc-persistir-msj'));
  const exito = nodo('p', 'sgc-exito');
  exito.appendChild(nodo('strong', 'sgc-exito-id'));
  paso4.appendChild(exito);
  wiz.appendChild(paso4);

  wiz.appendChild(nodo('button', 'sgc-anterior'));
  wiz.appendChild(nodo('button', 'sgc-siguiente'));
  app.appendChild(wiz);

  return { raiz: app, nodos: documento.porId };
}

function completarHastaRevision(w, codigo) {
  w.nodos['sgc-titulo'].value = 'Resmas A4';
  w.nodos['sgc-anio'].value = '2026';
  w.nodos['sgc-dependencia'].value = 'División Usuario';
  w.nodos['sgc-siguiente'].click();
  globalThis.SGC.catalogo.renglones.cargar([
    { codigo, item: codigo, cantidad: 2, unidad: 'UN', aclaracion: '' }
  ]);
  w.nodos['sgc-siguiente'].click();
  w.nodos['sgc-justificacion'].value = 'Se necesita reponer insumos en uso corriente.';
  w.nodos['sgc-siguiente'].click();
}

const nuevaVuelta = () => new Promise((resolver) => setImmediate(resolver));

function esperarCondicion(condicion, etiqueta, timeoutMs) {
  return new Promise((resolver, rechazar) => {
    const inicio = Date.now();
    const temporizador = setInterval(() => {
      if (condicion()) {
        clearInterval(temporizador);
        resolver();
      } else if (Date.now() - inicio > (timeoutMs || 5000)) {
        clearInterval(temporizador);
        rechazar(new Error('el tiempo se agotó esperando: ' + etiqueta));
      }
    }, 20);
  });
}

module.exports = {
  nodo,
  armarWizard,
  completarHastaRevision,
  nuevaVuelta,
  esperarCondicion
};