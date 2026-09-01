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
 * - --puerto por defecto 8123. Con 0, asigna un puerto libre e imprime el
 *   elegido en la línea "SGC-SERVIDOR-PUERTO <n>".
 * Estructura del directorio de datos:
 *   <datos>/contador.json, origen.log, idx/<id>.json, <anio>/<numero>_Expediente/
 *   (datos.json + hist/v<N>.json) y plantillas/plantillas.json.
 *
 * Las garantías 1 a 8 se resumen en ayudantes.js y manejadores.js (escritura
 * atómica, versión y numeración serializada ADR-009, índice fragmentado
 * ADR-005, origen por petición ADR-017, guardia de recorrido de rutas, carpeta
 * inaccesible en /api/salud, catálogo acotado, versionado). Las garantías 9 a
 * 12: transiciones por intención con el motor y el padrón (9, ADR-021),
 * entregables ADR-016 (10), reuso de base ADR-025 (11) y sugerencias del
 * piloto H19 (12, JSONL append-only con tope de 4000 sucesos).
 */
'use strict';

const http = require('node:http');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const DIR_APP = path.join(RAIZ, 'app');
const DIR_CONFIG = path.join(RAIZ, 'config');
const VERSION = '1.0.0';
const NODE_MIN_VERSION = 18;

const ayudantes = require('./ayudantes.js');
const manejadores = require('./manejadores.js');
const expedientes = require('./expedientes.js');
const presupuestos = require('./presupuestos.js');
const archivo = require('./archivo.js');
const eventos = require('./eventos.js');
const plantillas = require('./pliego-plantillas.js');
const plantillasApi = require('./pliego-plantillas-api.js');
const base = require('./base.js');
const sugerencias = require('./sugerencias.js');
const { crearPadronVivo } = require('./padron-vivo.js');
const padronInicial = require('./padron-inicial.js'); const padronAdmin = require('./padron-administracion.js');
const sesion = require('./sesion.js');
// El orden de carga importa: los core se registran en globalThis.SGC (ADR-029).
const APP_CORE = [
  'namespaces.js',
  'config.js',
  'roles.js',
  'cotas-encabezado.js',
  'autorizacion.js',
  'auditoria.js',
  'migraciones.js',
  'utils.js',
  'requerimiento.js',
  'anexo-eett.js',
  'validacion.js',
  'estados.js'
];
for (const archivo of APP_CORE) {
  require(path.join(RAIZ, 'app', 'js', 'core', archivo));
}
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.js'));

const SGC = globalThis.SGC;
const repo = SGC.adapters.repo;

// Creación del servidor: el router, los manejadores y la infraestructura.
function crearServidor(datosDir, configuracion) {
  const rutaPadronReal = path.join(datosDir, 'padron.json');
  const padronVivoReal = crearPadronVivo(rutaPadronReal);
  const padronEjemplo = crearPadronVivo(path.join(DIR_CONFIG, 'usuarios.ejemplo.json'));
  let modoDeclarado = !!(configuracion && configuracion.declarado);

  // ORDEN-RONDA-17 §1.1/§1.2 (H21): sin padrón, crea el administrador (clave única).
  if (!modoDeclarado && !padronVivoReal.existe()) {
    const siembra = padronInicial.sembrarAdministrador(datosDir, configuracion);
    if (siembra) {
      console.log('SGC-SERVIDOR-ADMINISTRADOR-CREADO');
      console.log('SGC-SERVIDOR-ADMINISTRADOR-CORREO ' + siembra.email);
      console.log('SGC-SERVIDOR-ADMINISTRADOR-CLAVE-PROVISORIA ' + siembra.clave);
      console.log('SGC-SERVIDOR-ADMINISTRADOR-TEXTO La clave se muestra una sola vez. Si no la anotás, se repone desde la aplicación con la cuenta del administrador.');
    }
  }

  // ADR-036 (§2.1): la elección de fuente se resuelve EN CADA USO. Si el
  // padrón real aparece más tarde, el proceso lo toma sin reiniciar; --declarado
  // sólo actúa si se pide y no hay padrón real en ese momento.
  function fuente() {
    if (padronVivoReal.existe()) {
      return { real: true, vivo: padronVivoReal };
    }
    if (modoDeclarado) {
      return { real: false, vivo: padronEjemplo };
    }
    return { real: false, vivo: null };
  }

  // Capa de sesión (ORDEN-RONDA-14 §3.4): el modo depende de que exista un
  // padrón con credenciales; con padrón real, la verificación usa ESE padrón.
  const adaptadorPadron = {
    existe() {
      if (padronVivoReal.existe()) return true;
      return modoDeclarado && padronEjemplo.existe();
    },
    usuarios() {
      const f = fuente();
      return f.vivo ? f.vivo.usuarios() : [];
    },
    buscar(email) {
      const f = fuente();
      return f.vivo ? f.vivo.buscar(email) : null;
    },
    leer() {
      const f = fuente();
      return f.vivo ? f.vivo.leer() : null;
    },
    guardar(p) {
      const f = fuente();
      if (f.vivo) {
        f.vivo.guardar(p);
      }
    }
  };
  const capaSesion = sesion.crearCapaSesion(datosDir, ayudantes, adaptadorPadron);
  const entorno = {
    datosDir,
    repo,
    padronVivo: adaptadorPadron,
    tienePadronReal: () => padronVivoReal.existe(),
    VERSION,
    DIR_APP,
    DIR_CONFIG,
    ayudantes,
    eventos,
    capaSesion
  };
  // ORDEN-RONDA-08 §2.2: recuperación del arranque. Cierra cualquier archivo
  // interrumpido de rondas anteriores (staging abandonado, original sin marca,
  // índice huérfano) antes de servir.
  archivo.recuperarArchivados(datosDir);
  const manejadoresApi = manejadores.crearManejadores(entorno);
  entorno.cargarCatalogo = manejadoresApi.cargarCatalogo;
  const eventosApi = eventos.crearManejadoresEventos(entorno);
  const plantillasApiMod = plantillasApi.crearManejadoresPlantillas(entorno);
  const padronAdminMod = padronAdmin.crearManejadoresPadron(entorno);
  const api = Object.assign(
    manejadoresApi,
    expedientes.crearManejadoresExpedientes(entorno),
    presupuestos.crearManejadoresPresupuestos(entorno),
    base.crearManejadoresBase(entorno),
    sugerencias.crearManejadoresSugerencias(entorno),
    plantillasApiMod,
    padronAdminMod,
    { apiEventos: eventosApi.apiEventos }
  );
  const {
    apiSalud,
    apiIndice,
    apiCrear,
    apiCrearBase,
    apiLeer,
    apiLeerBase,
    apiGuardar,
    apiAvanzar,
    apiDevolver,
    apiGuardarEntregable,
    apiLeerEntregable,
    apiGuardarPresupuesto,
    apiValidarCodigos,
    apiListarSugerencias,
    apiCrearSugerencia,
    apiAtenderSugerencia,
    apiEventos,
    servirConfig,
    servirEstatico
  } = api;

  // Despachar con cuerpo. En modo autenticado el contexto del cuerpo se
  // reemplaza por el de la sesión (el rol no lo elige el cliente, ADR-033).
  return http.createServer((req, res) => {
    const ruta = (req.url || '').split('?')[0];
    const peticion = { metodo: req.method, ruta };
    const esRutaApi = ruta === '/api/salud' || ruta === '/api/indice' ||
      ruta === '/api/expedientes' || ruta.startsWith('/api/');

    ayudantes.resolverOrigen(req).then((origen) => {
      // ORDEN-RONDA-14 §3.4: en modo autenticado toda la API exige sesión; una
      // provisoria sólo cambia la clave, sale y se ve.
      const acceso = capaSesion.protegerRuta(ruta, req.method, req);
      if (!acceso.permitido) {
        ayudantes.registrarOrigen(datosDir, origen, peticion, null, null);
        return ayudantes.responderJson(res, acceso.estado, { error: acceso.error });
      }
      const sesionDePeticion = acceso.sesion;
      req.sgcSesion = sesionDePeticion || null;
      try {
        function conCuerpo(fn, contratoId) {
          return ayudantes.leerCuerpo(req).then((texto) => {
            const textoFinal = sesionDePeticion
              ? capaSesion.inyectarContextoEn(texto, sesionDePeticion)
              : texto;
            ayudantes.registrarOrigen(datosDir, origen, peticion, contratoId || null,
              capaSesion.contextoDelCuerpo(textoFinal));
            return fn(req, res, textoFinal);
          }).catch((e) => {
            return ayudantes.responderErrorPeticion(res, e);
          });
        }

        // Salud e índice: sin cuerpo.
        if (req.method === 'GET' && ruta === '/api/salud') {
          ayudantes.registrarOrigen(datosDir, origen, peticion, null, null);
          return apiSalud(req, res);
        }
        if (req.method === 'GET' && ruta === '/api/indice') {
          ayudantes.registrarOrigen(datosDir, origen, peticion, null, null);
          return apiIndice(req, res);
        }

        // Sesión (ORDEN-RONDA-14 §3.4) y compendio del Jefe (§2.2).
        const atendida = capaSesion.enrutarSesion(req, res, ruta, sesionDePeticion, conCuerpo, origen, peticion);
        if (atendida !== null) {
          return atendida;
        }
        if (req.method === 'GET' && ruta === '/api/eventos') {
          return conCuerpo((r, s, texto) => apiEventos(r, s, texto));
        }

        // Archivo Histórico (ORDEN-RONDA-08 §2.2): lista el directorio, no el
        // índice fragmentado, así el histórico sobrevive a la purga del índice.
        if (req.method === 'GET' && ruta === '/api/archivo') {
          ayudantes.registrarOrigen(datosDir, origen, peticion, null, null);
          return archivo.apiArchivo(datosDir, repo)(req, res);
        }

        // Creación: se lee el cuerpo para registrar el contexto recibido.
        if (ruta === '/api/expedientes' && req.method === 'POST') {
          return conCuerpo((r, s, texto) => apiCrear(r, s, texto));
        }

        // Base de un expediente del archivo (ADR-025): crear un expediente
        // nuevo a partir de uno perfeccionado. Antes que el bloque genérico
        // /api/expedientes/<id> para que "base" no se tome como id.
        if (ruta === '/api/expedientes/base' && req.method === 'POST') {
          return conCuerpo((r, s, texto) => apiCrearBase(r, s, texto));
        }

        // Base de un expediente del archivo (ADR-025): leer la propuesta de
        // campos reutilizables. GET /api/archivo/<id>/base.
        if (req.method === 'GET' && ruta.startsWith('/api/archivo/')) {
          const baseId = ayudantes.archivoBaseDeRuta(req);
          if (baseId === null ||
              !ayudantes.estaDentro(ayudantes.rutaExpediente(datosDir, baseId).dir, datosDir)) {
            ayudantes.registrarOrigen(datosDir, origen, peticion, null, null);
            return ayudantes.responderJson(res, 400, { error: 'id de expediente inválido (recorrido de rutas no permitido)' });
          }
          ayudantes.registrarOrigen(datosDir, origen, peticion, baseId, null);
          return apiLeerBase(req, res, baseId);
        }

        // Plantillas del pliego (ORDEN-RONDA-16 §3), estampa §3.5 y padrón (H21).
        const enrutado = plantillasApiMod.enrutar(req, res, conCuerpo, api);
        if (enrutado) {
          return enrutado;
        }
        const enrutadoPadron = padronAdminMod.enrutar(req, res, conCuerpo, api);
        if (enrutadoPadron) {
          return enrutadoPadron;
        }

        // Expediente por id. Un :id que no es anio-numero (por ejemplo con
        // puntos, barras o "..") se rechaza con 400 sin tocar el disco.
        // Matchean acá los extremos de intención (ADR-021) y el de entregables.
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
            return conCuerpo((r, s, texto) => apiGuardar(r, s, id, texto), id);
          }
          if (req.method === 'POST' && (accion === 'avanzar' || accion === 'devolver')) {
            return conCuerpo((r, s, texto) => {
              if (accion === 'avanzar') {
                return apiAvanzar(r, s, id, texto, origen);
              }
              return apiDevolver(r, s, id, texto, origen);
            }, id);
          }
          if (req.method === 'POST' && accion === 'entregables') {
            return conCuerpo((r, s, texto) => apiGuardarEntregable(r, s, id, texto), id);
          }
          // Presupuestos adjuntos (ORDEN-RONDA-09 §3.2).
          if (req.method === 'POST' && accion === 'presupuestos') {
            return conCuerpo((r, s, texto) => apiGuardarPresupuesto(r, s, id, texto), id);
          }
        }

        if (ruta === '/api/catalogo/validar-codigos' && req.method === 'POST') {
          return conCuerpo((r, s, texto) => apiValidarCodigos(r, s, texto));
        }

        // Sugerencias del piloto (H19): GET lista (del Jefe, con cuerpo para el
        // contexto), POST crea, POST /atender marca como atendida.
        if (req.method === 'GET' && ruta === '/api/sugerencias') {
          return conCuerpo((r, s, texto) => apiListarSugerencias(r, s, texto));
        }
        if (req.method === 'POST' && ruta === '/api/sugerencias') {
          return conCuerpo((r, s, texto) => apiCrearSugerencia(r, s, texto));
        }
        if (ruta.startsWith('/api/sugerencias/') && req.method === 'POST') {
          const desglose = ayudantes.sugerenciaDeRuta(req);
          if (desglose !== null) {
            return conCuerpo((r, s, texto) => apiAtenderSugerencia(r, s, desglose.id, texto), desglose.id);
          }
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
        const informe = ayudantes.responderErrorEsp(500, 'error interno del servidor (' + (e.constructor ? e.constructor.name : 'Error') + ')');
        return ayudantes.responderJson(res, informe.codigoEstado, informe.cuerpo);
      }
    });
  });
}

const { leerArgumentos, cargarConfig, verificarArranque, verificarPuerto } = require('./arranque.js');

async function main() {
  const opciones = leerArgumentos(process.argv.slice(2));
  try {
    cargarConfig(opciones);
    verificarArranque(opciones, NODE_MIN_VERSION, ayudantes);
    await verificarPuerto(opciones.puerto);
  } catch (e) {
    console.error('servidor: no se pudo arrancar.');
    console.error('servidor: ' + e.constructor.name + ': ' + e.message);
    process.exit(1);
  }

  const servidor = crearServidor(opciones.datos, { declarado: opciones.declarado, administrador: opciones.administrador });
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

module.exports = Object.assign({ VERSION, crearServidor, APP_CORE }, ayudantes);