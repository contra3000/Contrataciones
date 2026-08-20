/*
 * servidor.js
 * Servidor mínimo del SGC (ADR-003, ORDEN-RONDA-03 §3.3).
 *
 * Node sobre node:http y node:fs, sin una sola dependencia.
 *
 * Arranque literal y obligatorio:
 *   node server/servidor.js --datos <ruta> --puerto <numero>
 *
 * - --datos es obligatorio. Si la ruta no existe o no es escribible, el
 *   servidor no arranca e imprime un mensaje claro en español explicando qué
 *   falta. Acepta una ruta local y una UNC (\\servidor\recurso\...).
 * - --puerto por defecto 8123. Con 0, el sistema asigna un puerto libre y el
 *   servidor imprime el elegido en la línea "SGC-SERVIDOR-PUERTO <n>".
 *
 * Estructura del directorio de datos:
 *   <datos>/
 *   ├── contador.json              (numeración, protegida por lock)
 *   ├── origen.log                 (origen de cada petición, JSONL)
 *   ├── idx/<id>.json              (índice fragmentado)
 *   └── <anio>/<numero>_Expediente/
 *       ├── datos.json
 *       └── hist/v<N>.json         (snapshot de la versión previa)
 *
 * Las garantías 1 a 8 se resumen en ayudantes.js y manejadores.js:
 *   1. Escritura atómica. 2. Verificación de versión aquí (fs síncrono).
 *   3. Numeración serializada (ADR-009). 4. Índice fragmentado (ADR-005).
 *   5. Origen por petición (ADR-017 medida 3). 6. Guardia de recorrido de
 *   rutas. 7. Carpeta inaccesible informada por /api/salud.
 *   8. POST /api/catalogo/validar-codigos con lista acotada.
 *   9. Transiciones por intención (ADR-021): el servidor cruza el contexto
 *   contra el padrón de usuarios (config/usuarios.ejemplo.json), ejecuta el
 *   motor con ese rol y persiste el resultado; 403 si el padrón o el motor
 *   rechazan, 409 por versión, 404 si no existe. El PUT ya no puede mover el
 *   estado (409) y la auditoría la escribe el servidor.
 *  10. POST /api/expedientes/:id/entregables guarda el entregable generado
 *   (ADR-016) y GET /entregables/<nombre> lo enlaza (ORDEN-RONDA-07 §3.3).
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const DIR_APP = path.join(RAIZ, 'app');
const DIR_CONFIG = path.join(RAIZ, 'config');
const VERSION = '1.0.0';
const PUERTO_DEFECTO = 8123;

const ayudantes = require('./ayudantes.js');
const manejadores = require('./manejadores.js');
const expedientes = require('./expedientes.js');
const archivo = require('./archivo.js');

const APP_CORE = [
  'namespaces.js',
  'config.js',
  'autorizacion.js',
  'auditoria.js',
  'migraciones.js',
  'utils.js',
  'validacion.js',
  'estados.js'
];
for (const archivo of APP_CORE) {
  require(path.join(RAIZ, 'app', 'js', 'core', archivo));
}
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.js'));

const SGC = globalThis.SGC;
const repo = SGC.adapters.repo;

// Padrón de usuarios (ADR-021): el rol que autoriza una transición no es el
// que elige el cliente, es el que corresponde al correo declarado en
// config/usuarios.ejemplo.json. Se lee una vez al cargar; se consulta antes
// de cada transición (fail closed si el archivo no existiera).
const PADRON = [];
try {
  const padron = JSON.parse(fs.readFileSync(path.join(DIR_CONFIG, 'usuarios.ejemplo.json'), 'utf8'));
  PADRON.push(...(Array.isArray(padron.usuarios) ? padron.usuarios : []));
} catch (e) {
  // Padrón vacío: verificar() rechaza todo contexto.
}

// ---------------------------------------------------------------------------
// Creación del servidor: el router, los manejadores y la infraestructura
// ---------------------------------------------------------------------------
function crearServidor(datosDir) {
  const entorno = {
    datosDir,
    repo,
    PADRON,
    VERSION,
    DIR_APP,
    DIR_CONFIG,
    ayudantes
  };
  // ORDEN-RONDA-08 §2.2: recuperación del arranque. Cierra cualquier archivo
  // interrumpido de rondas anteriores (staging abandonado, original sin marca,
  // índice huérfano) antes de servir.
  archivo.recuperarArchivados(datosDir);
  const api = Object.assign(
    manejadores.crearManejadores(entorno),
    expedientes.crearManejadoresExpedientes(entorno)
  );
  const {
    apiSalud,
    apiIndice,
    apiCrear,
    apiLeer,
    apiGuardar,
    apiAvanzar,
    apiDevolver,
    apiGuardarEntregable,
    apiLeerEntregable,
    apiGuardarPresupuesto,
    apiValidarCodigos,
    servirConfig,
    servirEstatico
  } = api;

  return http.createServer((req, res) => {
    const ruta = (req.url || '').split('?')[0];
    const peticion = { metodo: req.method, ruta };
    const esRutaApi = ruta === '/api/salud' || ruta === '/api/indice' ||
      ruta === '/api/expedientes' || ruta.startsWith('/api/');

    ayudantes.resolverOrigen(req).then((origen) => {
      try {
        // Salud e índice: sin cuerpo.
        if (req.method === 'GET' && ruta === '/api/salud') {
          ayudantes.registrarOrigen(datosDir, origen, peticion, null, null);
          return apiSalud(req, res);
        }
        if (req.method === 'GET' && ruta === '/api/indice') {
          ayudantes.registrarOrigen(datosDir, origen, peticion, null, null);
          return apiIndice(req, res);
        }

        // Archivo Histórico (ORDEN-RONDA-08 §2.2): lista el directorio, no el
        // índice fragmentado, así el histórico sobrevive a la purga del índice.
        if (req.method === 'GET' && ruta === '/api/archivo') {
          ayudantes.registrarOrigen(datosDir, origen, peticion, null, null);
          return archivo.apiArchivo(datosDir, repo)(req, res);
        }

        // Creación: se lee el cuerpo para registrar el contexto recibido.
        if (ruta === '/api/expedientes' && req.method === 'POST') {
          return ayudantes.leerCuerpo(req).then((texto) => {
            let contexto = null;
            try {
              const cuerpo = ayudantes.parsearCuerpo(texto);
              contexto = cuerpo && cuerpo.contexto ? cuerpo.contexto : null;
            } catch (e) {
              // el cuerpo inválido lo reporta apiCrear
            }
            ayudantes.registrarOrigen(datosDir, origen, peticion, null, contexto);
            return apiCrear(req, res, texto);
          }).catch((e) => {
            return ayudantes.responderJson(res, 400, { error: 'no se pudo procesar la petición: ' + e.message });
          });
        }

        // Expediente por id. Un :id que no es anio-numero (por ejemplo con
        // puntos, barras o "..") se rechaza con 400 sin tocar el disco.
        // También matchean acá los extremos de intención (ADR-021) y el de
        // entregables (§3.3): /api/expedientes/<id>/avanzar, /devolver y
        // /entregables.
        if (ruta.startsWith('/api/expedientes/')) {
          let id = ayudantes.idDeRuta(req);
          let accion = null;
          let entregable = null;
          if (id === null) {
            const desglose = ayudantes.accionDeRuta(req);
            if (desglose) {
              id = desglose.id;
              accion = desglose.accion;
            }
          }
          if (id === null) {
            const desgloseEnt = ayudantes.entregableDeRuta(req);
            if (desgloseEnt) {
              id = desgloseEnt.id;
              entregable = desgloseEnt.nombre;
            }
          }
          if (id === null) {
            ayudantes.registrarOrigen(datosDir, origen, peticion, null, null);
            return ayudantes.responderJson(res, 400, { error: 'id de expediente inválido (recorrido de rutas no permitido)' });
          }
          if (!ayudantes.estaDentro(ayudantes.rutaExpediente(datosDir, id).dir, datosDir)) {
            ayudantes.registrarOrigen(datosDir, origen, peticion, id, null);
            return ayudantes.responderJson(res, 400, { error: 'id de expediente inválido (recorrido de rutas no permitido)' });
          }
          if (entregable !== null && req.method === 'GET') {
            ayudantes.registrarOrigen(datosDir, origen, peticion, id, null);
            return apiLeerEntregable(req, res, id, entregable);
          }
          if (req.method === 'GET') {
            ayudantes.registrarOrigen(datosDir, origen, peticion, id, null);
            return apiLeer(req, res, id);
          }
          if (req.method === 'PUT') {
            return ayudantes.leerCuerpo(req).then((texto) => {
              let contexto = null;
              try {
                const cuerpo = ayudantes.parsearCuerpo(texto);
                contexto = cuerpo && cuerpo.contexto ? cuerpo.contexto : null;
              } catch (e) {
                // el cuerpo inválido lo reporta apiGuardar
              }
              ayudantes.registrarOrigen(datosDir, origen, peticion, id, contexto);
              return apiGuardar(req, res, id, texto);
            }).catch((e) => {
              return ayudantes.responderJson(res, 400, { error: 'no se pudo procesar la petición: ' + e.message });
            });
          }
          if (req.method === 'POST' && (accion === 'avanzar' || accion === 'devolver')) {
            return ayudantes.leerCuerpo(req).then((texto) => {
              let contexto = null;
              try {
                const cuerpo = ayudantes.parsearCuerpo(texto);
                contexto = cuerpo && cuerpo.contexto ? cuerpo.contexto : null;
              } catch (e) {
                // el cuerpo inválido lo reporta el manejador
              }
              ayudantes.registrarOrigen(datosDir, origen, peticion, id, contexto);
              if (accion === 'avanzar') {
                return apiAvanzar(req, res, id, texto, origen);
              }
              return apiDevolver(req, res, id, texto, origen);
            }).catch((e) => {
              return ayudantes.responderJson(res, 400, { error: 'no se pudo procesar la petición: ' + e.message });
            });
          }
          if (req.method === 'POST' && accion === 'entregables') {
            return ayudantes.leerCuerpo(req).then((texto) => {
              let contexto = null;
              try {
                const cuerpo = ayudantes.parsearCuerpo(texto);
                contexto = cuerpo && cuerpo.contexto ? cuerpo.contexto : null;
              } catch (e) {
                // el cuerpo inválido lo reporta apiGuardarEntregable
              }
              ayudantes.registrarOrigen(datosDir, origen, peticion, id, contexto);
              return apiGuardarEntregable(req, res, id, texto);
            }).catch((e) => {
              return ayudantes.responderJson(res, 400, { error: 'no se pudo procesar la petición: ' + e.message });
            });
          }
          // Presupuestos adjuntos (ORDEN-RONDA-09 §3.2).
          if (req.method === 'POST' && accion === 'presupuestos') {
            return ayudantes.leerCuerpo(req).then((texto) => {
              let contexto = null;
              try {
                const cuerpo = ayudantes.parsearCuerpo(texto);
                contexto = cuerpo && cuerpo.contexto ? cuerpo.contexto : null;
              } catch (e) {
                // el cuerpo inválido lo reporta apiGuardarPresupuesto
              }
              ayudantes.registrarOrigen(datosDir, origen, peticion, id, contexto);
              return apiGuardarPresupuesto(req, res, id, texto);
            }).catch((e) => {
              return ayudantes.responderJson(res, 400, { error: 'no se pudo procesar la petición: ' + e.message });
            });
          }
        }

        if (ruta === '/api/catalogo/validar-codigos' && req.method === 'POST') {
          return ayudantes.leerCuerpo(req).then((texto) => {
            let contexto = null;
            try {
              const cuerpo = ayudantes.parsearCuerpo(texto);
              contexto = cuerpo && cuerpo.contexto ? cuerpo.contexto : null;
            } catch (e) {
              // el cuerpo inválido lo reporta apiValidarCodigos
            }
            ayudantes.registrarOrigen(datosDir, origen, peticion, null, contexto);
            return apiValidarCodigos(req, res, texto);
          }).catch((e) => {
            return ayudantes.responderJson(res, 400, { error: 'no se pudo procesar la petición: ' + e.message });
          });
        }

        if (esRutaApi) {
          ayudantes.registrarOrigen(datosDir, origen, peticion, null, null);
          return ayudantes.responderJson(res, 404, { error: 'ruta de API no reconocida: ' + req.method + ' ' + ruta });
        }

        if (ruta.startsWith('/config/')) {
          ayudantes.registrarOrigen(datosDir, origen, peticion, null, null);
          return servirConfig(req, res);
        }

        return servirEstatico(req, res);
      } catch (e) {
        const informe = ayudantes.responderErrorEsp(500, 'error interno del servidor: ' + e.message);
        return ayudantes.responderJson(res, informe.codigoEstado, informe.cuerpo);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------
function leerArgumentos(argv) {
  const opciones = { datos: null, puerto: PUERTO_DEFECTO };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--datos' && i + 1 < argv.length) {
      opciones.datos = argv[i + 1];
      i++;
    } else if (argv[i] === '--puerto' && i + 1 < argv.length) {
      opciones.puerto = parseInt(argv[i + 1], 10);
      i++;
    }
  }
  return opciones;
}

function verificarArranque(opciones) {
  if (!opciones.datos) {
    throw new Error('falta el argumento obligatorio --datos <ruta>: la carpeta donde el servidor guarda expedientes e índice');
  }
  if (!fs.existsSync(opciones.datos)) {
    throw new Error('la carpeta de datos no existe: "' + opciones.datos + '". Creela o pase otra ruta con --datos');
  }
  if (!fs.statSync(opciones.datos).isDirectory()) {
    throw new Error('--datos debe apuntar a una carpeta, y "' + opciones.datos + '" es un archivo');
  }
  if (!Number.isInteger(opciones.puerto) || opciones.puerto < 0 || opciones.puerto > 65535) {
    throw new Error('--puerto debe ser un número entre 0 y 65535 (recibido: ' + opciones.puerto + ')');
  }
  const sonda = path.join(opciones.datos, '.arranque-' + process.pid + '.tmp');
  try {
    ayudantes.escribirAtomico(sonda, 'ok');
    fs.unlinkSync(sonda);
  } catch (e) {
    throw new Error('la carpeta de datos no es escribible: "' + opciones.datos + '". Verifique los permisos de la carpeta y su cuenta');
  }
}

function main() {
  const opciones = leerArgumentos(process.argv.slice(2));
  try {
    verificarArranque(opciones);
  } catch (e) {
    console.error('servidor: no se pudo arrancar.');
    console.error('servidor: ' + e.message);
    process.exit(1);
  }

  const servidor = crearServidor(opciones.datos);
  servidor.listen(opciones.puerto, () => {
    const puertoReal = servidor.address().port;
    console.log('SGC-SERVIDOR-PUERTO ' + puertoReal);
    console.log('SGC-SERVIDOR-DATOS ' + opciones.datos);
    console.log('SGC-SERVIDOR-LISTO');
  });
}

if (require.main === module) {
  main();
}

module.exports = Object.assign({ VERSION, crearServidor }, ayudantes);