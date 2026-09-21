/*
 * presupuestos.js
 * Manejador de presupuestos adjuntos (ORDEN-RONDA-09 §3.2), separado de
 * expedientes.js por responsabilidad (misma partición que ORDEN-RONDA-07
 * §2.2): la subida de archivos es un tema propio y el archivo estaba
 * quedando grande para el límite de 400 líneas.
 *
 * ORDEN-RONDA-23 §3: el presupuesto ya no viaja como base64 dentro de un JSON
 * (que inflaba el cuerpo y obligaba a juntar el archivo entero en memoria): se
 * sube el archivo tal cual. El tipo viaja en la cabecera Content-Type, el
 * nombre original en X-SGC-Nombre-Original y el contexto (sólo en modo
 * declarado) en X-SGC-Contexto. El cuerpo se escribe directo a un temporal y
 * al final se renombra a `presupuesto-<n>.<ext>`: nunca se arma el archivo
 * completo en un buffer. El nombre en disco lo decide el servidor.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

// El nombre del archivo en disco lo decide el servidor (`presupuesto-<n>.<ext>`),
// nunca el cliente: un nombre que venga del usuario es una vía de recorrido de
// rutas. Cada presupuesto lleva un id estable porque los valores de referencia
// lo citan; la escritura es atómica y versionada.
const TIPOS_PRESUPUESTO = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg'
};

// Firma (magic bytes) de cada tipo admitido: un archivo con el Content-Type
// correcto pero sin la firma no es lo que dice ser.
const FIRMAS = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/jpeg': [0xff, 0xd8, 0xff]
};

function borrarSilencioso(rutaArchivo) {
  try {
    fs.unlinkSync(rutaArchivo);
  } catch (e) {
    // mejor esfuerzo: si el temporal ya no está, no hay nada que borrar
  }
}

function tipoDe(req) {
  return String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
}

function nombreOriginalDe(req) {
  const crudo = req.headers['x-sgc-nombre-original'];
  if (typeof crudo !== 'string' || crudo.trim() === '') {
    return null;
  }
  let nombre = crudo;
  try {
    nombre = decodeURIComponent(crudo);
  } catch (e) {
    nombre = crudo;
  }
  return nombre.slice(0, 200);
}

// Contexto de la petición: en modo autenticado manda la sesión (el rol no lo
// elige el cliente, ADR-033); en modo declarado viene de la cabecera.
function contextoDePeticion(req) {
  const sesion = req.sgcSesion;
  if (sesion) {
    return {
      timestamp: new Date().toISOString(),
      email: sesion.email,
      rol: sesion.rol,
      nombre: sesion.nombre,
      equipo: sesion.equipo
    };
  }
  const crudo = req.headers['x-sgc-contexto'];
  if (typeof crudo !== 'string' || crudo.length === 0) {
    return {};
  }
  try {
    const contexto = JSON.parse(decodeURIComponent(crudo));
    return contexto && typeof contexto === 'object' && !Array.isArray(contexto) ? contexto : {};
  } catch (e) {
    return {};
  }
}

function firmaValida(rutaArchivo, tipo) {
  const esperada = FIRMAS[tipo];
  if (!esperada) {
    return false;
  }
  let fd = null;
  try {
    fd = fs.openSync(rutaArchivo, 'r');
    const cabecera = Buffer.alloc(esperada.length);
    const leidos = fs.readSync(fd, cabecera, 0, esperada.length, 0);
    if (leidos < esperada.length) {
      return false;
    }
    for (let i = 0; i < esperada.length; i++) {
      if (cabecera[i] !== esperada[i]) {
        return false;
      }
    }
    return true;
  } catch (e) {
    return false;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch (e) {
        // ya estaba cerrado
      }
    }
  }
}

function crearManejadoresPresupuestos(entorno) {
  const { datosDir, repo, ayudantes, padronVivo } = entorno;
  const {
    escribirAtomico,
    reemplazarTemporal,
    estaDentro,
    rutaExpediente,
    recibirEnArchivo,
    responderJson
  } = ayudantes;
  const SGC = globalThis.SGC;

  // Cola por expediente: dos subidas al mismo expediente no se pisan el número
  // ni la versión. La lectura de datos.json y la escritura se hacen EN FILA,
  // porque el transporte binario (ORDEN-RONDA-23 §3) deja el archivo en disco
  // entre medio y dos peticiones simultáneas leerían la misma versión.
  const colas = new Map();
  function enFila(id, tarea) {
    const anterior = colas.get(id) || Promise.resolve();
    const siguiente = anterior.then(tarea, tarea);
    colas.set(id, siguiente.then(() => {}, () => {}));
    return siguiente;
  }

  function apiGuardarPresupuestoBinario(req, res, id, registrar) {
    const tipo = tipoDe(req);
    const extension = TIPOS_PRESUPUESTO[tipo];
    if (!extension) {
      return Promise.resolve(responderJson(res, 400, { error: 'tipo de archivo no permitido: "' + tipo + '". Se admiten PDF e imágenes (application/pdf, image/png, image/jpeg)' }));
    }
    const nombreOriginal = nombreOriginalDe(req);
    if (nombreOriginal === null) {
      return Promise.resolve(responderJson(res, 400, { error: 'falta el nombre original del archivo (cabecera X-SGC-Nombre-Original)' }));
    }
    const contexto = contextoDePeticion(req);
    const exp = rutaExpediente(datosDir, id);
    if (!fs.existsSync(exp.datos)) {
      return Promise.resolve(responderJson(res, 404, { error: 'expediente no encontrado: ' + id }));
    }

    return enFila(id, () => {
      let actual;
      try {
        actual = JSON.parse(fs.readFileSync(exp.datos, 'utf8'));
      } catch (e) {
        return responderJson(res, 500, { error: 'no se pudo leer el expediente' });
      }
      // ORDEN-RONDA-23 §2: adjuntar un presupuesto es una operación del estado
      // en curso; la exige quien ejecuta ese estado, no cualquier usuario.
      const autorizacionDelEstado = SGC.core.autorizacion.autorizarRolDelEstado(
        padronVivo.usuarios(), contexto, actual.estado ? actual.estado.id : null);
      if (!autorizacionDelEstado.ok) {
        return responderJson(res, 403, { error: autorizacionDelEstado.error });
      }
      const numero = (Array.isArray(actual.presupuestos) ? actual.presupuestos : []).length + 1;
      const archivo = 'presupuesto-' + numero + '.' + extension;
      const ruta = path.join(exp.dir, 'presupuestos', archivo);
      if (!estaDentro(ruta, exp.dir)) {
        return responderJson(res, 400, { error: 'recorrido de rutas no permitido' });
      }
      if (typeof registrar === 'function') {
        registrar(contexto);
      }
      const carpeta = path.join(exp.dir, 'presupuestos');
      fs.mkdirSync(carpeta, { recursive: true });
      const temporal = path.join(carpeta, '.' + archivo + '.' + process.pid + '.tmp');
      const nuevaVersion = actual.version + 1;

      return recibirEnArchivo(req, temporal, SGC.core.limites.LIMITE_PRESUPUESTO_BYTES).then((recibido) => {
        if (recibido.bytes === 0) {
          borrarSilencioso(temporal);
          return responderJson(res, 400, { error: 'el contenido del presupuesto está vacío' });
        }
        if (!firmaValida(temporal, tipo)) {
          borrarSilencioso(temporal);
          return responderJson(res, 400, { error: 'el archivo no tiene la firma de un ' + tipo + ' (el tipo declarado no coincide con su contenido)' });
        }
        fs.mkdirSync(path.join(exp.dir, 'hist'), { recursive: true });
        escribirAtomico(path.join(exp.dir, 'hist', 'v' + actual.version + '.json'), JSON.stringify(actual, null, 2));
        reemplazarTemporal(temporal, ruta);
        const actualizado = JSON.parse(JSON.stringify(actual));
        actualizado.version = nuevaVersion;
        if (!Array.isArray(actualizado.presupuestos)) {
          actualizado.presupuestos = [];
        }
        actualizado.presupuestos.push({
          id: 'presupuesto-' + numero,
          nombreOriginal: nombreOriginal,
          archivo: archivo,
          ruta: 'presupuestos/' + archivo,
          tipo: tipo,
          peso: recibido.bytes,
          subido: typeof contexto.timestamp === 'string' ? contexto.timestamp : null,
          email: typeof contexto.email === 'string' ? contexto.email : null,
          equipo: typeof contexto.equipo === 'string' ? contexto.equipo : null
        });
        if (typeof contexto.timestamp === 'string') {
          if (typeof actualizado.actualizado === 'string') { actualizado.actualizado = contexto.timestamp; }
          if (typeof actualizado.ultimaModificacion === 'string') { actualizado.ultimaModificacion = contexto.timestamp; }
        }
        if (typeof contexto.email === 'string' && typeof actualizado.ultimoUsuario === 'string') {
          actualizado.ultimoUsuario = contexto.email;
        }
        escribirAtomico(exp.datos, JSON.stringify(actualizado, null, 2));
        const entrada = repo.entradaIndice(id, actualizado, contexto);
        fs.mkdirSync(path.join(datosDir, 'idx'), { recursive: true });
        escribirAtomico(path.join(datosDir, 'idx', id + '.json'), JSON.stringify(entrada, null, 2));
        return responderJson(res, 201, {
          id: 'presupuesto-' + numero,
          archivo: archivo,
          ruta: 'presupuestos/' + archivo,
          peso: recibido.bytes,
          version: nuevaVersion
        });
      }).catch((e) => {
        // El límite del presupuesto responde su propio mensaje (con lo recibido
        // y el máximo), armado desde el único lugar donde se declara el número
        // (core/limites.js, ORDEN-RONDA-23 §4); el resto sigue el camino
        // general. El motivo sale de `recibidos` (un número nuestro), nunca del
        // error de la máquina.
        if (e && e.codigoEstado === 413 && typeof e.recibidos === 'number') {
          // Si el cliente declaró el tamaño total, se informa ése (el real); si
          // no, lo que alcanzó a llegar antes del corte.
          const tamano = typeof e.tamanoDeclarado === 'number' && e.tamanoDeclarado > 0
            ? e.tamanoDeclarado : e.recibidos;
          res.writeHead(413, {
            'Content-Type': 'application/json; charset=utf-8',
            'Connection': 'close'
          });
          res.end(JSON.stringify({ error: SGC.core.limites.mensajeLimite(tamano) }));
          return;
        }
        throw e;
      });
    });
  }

  return {
    apiGuardarPresupuestoBinario
  };
}

module.exports = {
  crearManejadoresPresupuestos
};
