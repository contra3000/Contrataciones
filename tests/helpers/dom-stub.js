'use strict';

/*
 * dom-stub.js
 * DOM mínimo para probar la capa de vistas (wizard, renglones) en Node sin
 * navegador. Cubre exactamente lo que usan los módulos de la app:
 *
 * - Nodos con id, tag, className, textContent, hidden, value, files, type,
 *   min/step/maxLength/rows/placeholder y las propiedades que la app asigna.
 * - appendChild / removeChild / remove, classList (add/remove/contains/toggle),
 *   setAttribute / getAttribute / hasAttribute / removeAttribute.
 * - addEventListener / emit: dispara los handlers registrados para un tipo.
 * - querySelector('#id', '[attr="v"]') y querySelectorAll con el subconjunto
 *   de selectores que usa la app (tags, ':not([type=hidden])', '[attr="v"]').
 * - document.createElement, document.body, document.getElementById.
 * - Contador de asignaciones a innerHTML: la app no debe inyectar HTML, así
 *   que los tests afirman que el contador queda en cero.
 *
 * Para suplantar sesión en los tests: `globalThis.sessionStorage` se reemplaza
 * por un storage plano {getItem, setItem, removeItem}.
 */

let conteoInnerHTML = 0;

function obtenerConteoInnerHTML() {
  return conteoInnerHTML;
}

function separarSelector(selector) {
  return String(selector).split(',').map((p) => p.trim()).filter((p) => p.length > 0);
}

function coincide(nodo, parte) {
  if (parte.charAt(0) === '#') {
    return nodo.id === parte.slice(1);
  }
  const atributo = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(parte);
  if (atributo) {
    const nombre = atributo[1];
    if (atributo[2] === undefined) {
      return nodo.hasAttribute(nombre);
    }
    return nodo.getAttribute(nombre) === atributo[2];
  }
  const etiqueta = /^(\w+)/.exec(parte);
  if (!etiqueta) {
    throw new Error('dom-stub: selector no soportado "' + parte + '"');
  }
  if (nodo.tag !== etiqueta[1]) {
    return false;
  }
  const not = /:not\(\[([\w-]+)=(?:"([\w-]*)"|([\w-]*))\]\)/.exec(parte);
  if (not) {
    const nombre = not[1];
    const valor = not[2] !== undefined ? not[2] : not[3];
    return nodo.getAttribute(nombre) !== valor;
  }
  return true;
}

class ListaClases {
  constructor(nodo) {
    this.nodo = nodo;
  }

  _refrescar() {
    this.nodo.className = Array.from(this.nodo._clases).join(' ');
  }

  add(clase) {
    this.nodo._clases.add(clase);
    this._refrescar();
  }

  remove(clase) {
    this.nodo._clases.delete(clase);
    this._refrescar();
  }

  contains(clase) {
    return this.nodo._clases.has(clase);
  }

  toggle(clase, fuerza) {
    const tiene = this.nodo._clases.has(clase);
    const activar = fuerza === undefined ? !tiene : Boolean(fuerza);
    if (activar) {
      this.nodo._clases.add(clase);
    } else {
      this.nodo._clases.delete(clase);
    }
    this._refrescar();
    return activar;
  }
}

class Nodo {
  constructor(tag, id) {
    this.tag = String(tag).toLowerCase();
    this.id = id || '';
    this.children = [];
    this.parentNode = null;
    this._clases = new Set();
    this.className = '';
    this.classList = new ListaClases(this);
    this.atributos = {};
    this.eventos = {};
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.type = this.tag === 'input' ? 'text' : '';
    this.files = null;
    this.href = '';
    this.download = '';
    this.min = '';
    this.step = '';
    this.maxLength = undefined;
    this.rows = undefined;
    this.placeholder = '';
    this.foco = false;
  }

  get innerHTML() {
    return this._innerHtml || '';
  }

  set innerHTML(valor) {
    conteoInnerHTML++;
    this._innerHtml = String(valor);
  }

  appendChild(nodo) {
    if (nodo.parentNode) {
      nodo.parentNode.removeChild(nodo);
    }
    nodo.parentNode = this;
    this.children.push(nodo);
    return nodo;
  }

  removeChild(nodo) {
    const indice = this.children.indexOf(nodo);
    if (indice !== -1) {
      this.children.splice(indice, 1);
      nodo.parentNode = null;
    }
    return nodo;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  setAttribute(nombre, valor) {
    this.atributos[nombre] = String(valor);
    if (nombre === 'class') {
      this.className = String(valor);
    }
  }

  getAttribute(nombre) {
    return Object.prototype.hasOwnProperty.call(this.atributos, nombre)
      ? this.atributos[nombre]
      : null;
  }

  hasAttribute(nombre) {
    return Object.prototype.hasOwnProperty.call(this.atributos, nombre);
  }

  removeAttribute(nombre) {
    delete this.atributos[nombre];
  }

  addEventListener(tipo, fn) {
    if (!this.eventos[tipo]) {
      this.eventos[tipo] = [];
    }
    this.eventos[tipo].push(fn);
  }

  emit(tipo, evento) {
    const lista = this.eventos[tipo] || [];
    for (const fn of lista.slice()) {
      fn(evento || {});
    }
  }

  focus() {
    this.foco = true;
  }

  click() {
    this.emit('click');
  }

  querySelector(selector) {
    const encontrados = this._buscar(separarSelector(selector));
    return encontrados.length > 0 ? encontrados[0] : null;
  }

  querySelectorAll(selector) {
    return this._buscar(separarSelector(selector));
  }

  _buscar(partes) {
    const encontrados = [];
    const visitar = (nodo) => {
      if (nodo !== this && partes.some((p) => coincide(nodo, p))) {
        encontrados.push(nodo);
      }
      for (const hijo of nodo.children) {
        visitar(hijo);
      }
    };
    visitar(this);
    return encontrados;
  }
}

const documento = {
  body: new Nodo('body'),
  porId: {},
  createElement: (tag) => new Nodo(tag),
  getElementById: (id) => documento.porId[id] || null
};

function registrar(nodo) {
  if (nodo.id) {
    documento.porId[nodo.id] = nodo;
  }
  return nodo;
}

function crearStoragePlano() {
  const mapa = {};
  return {
    setItem: (clave, valor) => {
      mapa[clave] = String(valor);
    },
    getItem: (clave) => (Object.prototype.hasOwnProperty.call(mapa, clave) ? mapa[clave] : null),
    removeItem: (clave) => {
      delete mapa[clave];
    },
    claves: () => Object.keys(mapa)
  };
}

module.exports = {
  Nodo,
  documento,
  registrar,
  crearStoragePlano,
  obtenerConteoInnerHTML
};
