/*
 * sugerencias.js
 * ORDEN-RONDA-13 §6 (H19). Diálogo de sugerencias del piloto.
 *
 * El registro es `datosDir/sugerencias.jsonl`, un archivo JSONL append-only:
 * cada suceso es una línea que se agrega al final. Nada se edita ni se borra
 * retroactivamente; marcar una sugerencia como atendida agrega una línea
 * {tipo:'atendida', sugerenciaId, ...} que se cruza con su sugerencia al
 * leer. Tope defensivo de sucesos: con 4.000 líneas ya escritas, la
 * sugerencia 4.001 se rechaza con 400 y la vista del Jefe de Contrataciones
 * se lo avisa al operador.
 *
 * La vista del operador es de ayuda, no de canal de asistencia en caliente:
 * el piloto describe el problema y el Jefe lo ve en su pantalla, sin
 * impresión, vía correo ni base de datos.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const TOPE_SUCESOS = 4000;
const MAX_CONTENIDO = 4000;
const CAMPOS_SUGERENCIA = [
  'contenido',
  'pantalla',
  'expediente',
  'paso',
  'appVersion',
  'catalogoVersion',
  'navegador'
];

function crearManejadoresSugerencias(entorno) {
  const { datosDir, ayudantes: extra } = entorno;
  const { responderJson, parsearCuerpo } = extra;
  const SGC = globalThis.SGC;

  const archivo = path.join(datosDir, 'sugerencias.jsonl');

  // ORDEN-RONDA-14 §2.2: la lista y el "atender" son del Jefe de
  // Contrataciones, verificado contra el padrón en el servidor (el rol no lo
  // elige el cliente). Crear una sugerencia sigue abierto a cualquier operador
  // autenticado en el padrón.
  function esJefe(contexto) {
    const cx = contexto || {};
    const usuarios = entorno.padronVivo.usuarios();
    const v = SGC.core.autorizacion.verificar(usuarios, cx);
    if (!v.ok) {
      return false;
    }
    // ORDEN-RONDA-17 §1.3: la marca de administrador también ve el compendio.
    if (cx.rol === 'contrataciones_supervisor') {
      return true;
    }
    const u = usuarios.find((x) => x && x.email === cx.email);
    return !!(u && u.administrador === true);
  }

  function idNuevo() {
    return 's-' + Date.now().toString(36) + '-' + crypto.randomBytes(6).toString('hex');
  }

  function contarSucesos() {
    if (!fs.existsSync(archivo)) {
      return 0;
    }
    const texto = fs.readFileSync(archivo, 'utf8');
    const lineas = texto.split(/\r?\n/);
    let contar = 0;
    for (const linea of lineas) {
      if (linea.trim() !== '') {
        contar++;
      }
    }
    return contar;
  }

  function esTexto(valor) {
    return typeof valor === 'string' && valor.trim() !== '';
  }

  // Lectura que cruza cada línea atendida con su sugerencia. Las líneas
  // corruptas se ignoran: una sugerencia ilegible no tumba el diálogo.
  function leer() {
    const sucesos = [];
    if (fs.existsSync(archivo)) {
      const texto = fs.readFileSync(archivo, 'utf8');
      for (const linea of texto.split(/\r?\n/)) {
        if (linea.trim() === '') {
          continue;
        }
        try {
          sucesos.push(JSON.parse(linea));
        } catch (ignorado) {
          // Línea corrupta: se ignora el suceso.
        }
      }
    }
    const atendidas = new Map();
    for (const suceso of sucesos) {
      if (suceso && suceso.tipo === 'atendida') {
        atendidas.set(suceso.sugerenciaId, suceso);
      }
    }
    const sugerencias = [];
    for (const suceso of sucesos) {
      if (suceso && suceso.tipo === 'sugerencia') {
        const atendida = atendidas.get(suceso.id);
        suceso.atendido = !!atendida;
        if (atendida) {
          suceso.atendidaPor = atendida.email;
          suceso.atendidaEn = atendida.timestamp;
        }
        sugerencias.push(suceso);
      }
    }
    return sugerencias;
  }

  function apiListarSugerencias(req, res, textoCuerpo) {
    const cuerpo = parsearCuerpo(textoCuerpo) || {};
    if (!esJefe(cuerpo.contexto)) {
      return responderJson(res, 403, { error: 'solo el Jefe de Contrataciones puede consultar las sugerencias del piloto' });
    }
    return responderJson(res, 200, {
      sugerencias: leer(),
      sucesos: contarSucesos(),
      completo: contarSucesos() <= TOPE_SUCESOS
    });
  }

  // Datos de origen de la sugerencia (contexto), con fuente automática. Solo
  // los campos declarados entran; lo que el navegador mande extra se ignora.
  function sucesoDeSugerencia(cuerpo) {
    if (!cuerpo || typeof cuerpo !== 'object') {
      return null;
    }
    const contenido = cuerpo.contenido;
    if (!esTexto(contenido) || contenido.length > MAX_CONTENIDO) {
      return null;
    }
    const cx = cuerpo.contexto || {};
    const email = cx.email;
    if (!esTexto(email)) {
      return null;
    }
    const suceso = {
      tipo: 'sugerencia',
      id: idNuevo(),
      timestamp: new Date().toISOString(),
      email: email,
      rol: cx.rol || null,
      equipo: cx.equipo || null,
      contenido: contenido
    };
    for (const campo of CAMPOS_SUGERENCIA) {
      if (campo === 'contenido') {
        continue;
      }
      const valor = cuerpo[campo];
      if (typeof valor === 'string' && valor !== '') {
        suceso[campo] = valor;
      }
    }
    return suceso;
  }

  function apiCrearSugerencia(req, res, textoCuerpo) {
    const cuerpo = parsearCuerpo(textoCuerpo);
    const suceso = sucesoDeSugerencia(cuerpo);
    if (!suceso) {
      return responderJson(res, 400, { error: 'sugerencia inválida: contenido (hasta 4000 caracteres) y email son obligatorios' });
    }
    if (contarSucesos() >= TOPE_SUCESOS) {
      return responderJson(res, 400, { error: 'el diálogo alcanzó su tope (' + TOPE_SUCESOS + ' sucesos); avise al Jefe de Contrataciones' });
    }
    fs.mkdirSync(datosDir, { recursive: true });
    fs.appendFileSync(archivo, JSON.stringify(suceso) + '\n', 'utf8');
    return responderJson(res, 201, { id: suceso.id });
  }

  function apiAtenderSugerencia(req, res, id, textoCuerpo) {
    const cuerpo = parsearCuerpo(textoCuerpo);
    const cx = cuerpo && cuerpo.contexto || {};
    if (!esJefe(cx)) {
      if (!cx.email) {
        return responderJson(res, 400, { error: 'el Jefe debe ir identificado (correo del padrón)' });
      }
      return responderJson(res, 403, { error: 'solo el Jefe de Contrataciones puede atender sugerencias' });
    }
    const sugerencias = leer();
    const existe = sugerencias.some(function (s) {
      return s.id === id;
    });
    if (!existe) {
      return responderJson(res, 404, { error: 'sugerencia no encontrada: ' + id });
    }
    const atendida = {
      tipo: 'atendida',
      sugerenciaId: id,
      timestamp: new Date().toISOString(),
      email: cx.email
    };
    fs.appendFileSync(archivo, JSON.stringify(atendida) + '\n', 'utf8');
    return responderJson(res, 200, { ok: true, sugerenciaId: id });
  }

  return {
    apiListarSugerencias,
    apiCrearSugerencia,
    apiAtenderSugerencia
  };
}

module.exports = {
  crearManejadoresSugerencias
};