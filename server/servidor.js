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
 *  11. Reuso de base (ADR-025): GET /api/archivo/<id>/base lee la lista
 *   blanca de un perfeccionado y POST /api/expedientes/base crea el nuevo.
 *  12. Sugerencias del piloto (H19): JSONL append-only con tope de 4000
 *   sucesos; atender agrega una línea, nunca edita ni borra.
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
const base = require('./base.js');
const sugerencias = require('./sugerencias.js');
const { crearPadronVivo } = require('./padron-vivo.js');
const sesion = require('./sesion.js');
// El orden de carga importa: cada módulo puede exigir que el anterior ya esté
// registrado en globalThis.SGC. No reordenar sin verificar dependencias (ADR-029).
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

// ---------------------------------------------------------------------------
// Creación del servidor: el router, los manejadores y la infraestructura
// ---------------------------------------------------------------------------
function crearServidor(datosDir) {
  const rutaPadronReal = path.join(datosDir, 'padron.json');
  const padronVivoReal = crearPadronVivo(rutaPadronReal);
  const tienePadronReal = padronVivoReal.existe();

  // Sin padrón real: el padrón de ejemplo es la fuente de verdad (desarrollo y
  // tests). Con padrón real: ESE es el padrón vivo.
  let padronVivo;
  if (tienePadronReal) {
    padronVivo = padronVivoReal;
  } else {
    padronVivo = crearPadronVivo(path.join(DIR_CONFIG, 'usuarios.ejemplo.json'));
  }

  // Capa de sesión (ORDEN-RONDA-14 §3.4): el modo depende de que exista un
  // padrón con credenciales; con padrón real, la verificación usa ESE padrón.
  const capaSesion = sesion.crearCapaSesion(datosDir, ayudantes, padronVivo);
  const entorno = {
    datosDir,
    repo,
    padronVivo,
    tienePadronReal,
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
  const api = Object.assign(
    manejadoresApi,
    expedientes.crearManejadoresExpedientes(entorno),
    presupuestos.crearManejadoresPresupuestos(entorno),
    base.crearManejadoresBase(entorno),
    sugerencias.crearManejadoresSugerencias(entorno),
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
      // sesión provisoria sólo cambia la clave, sale y se ve.
      const acceso = capaSesion.protegerRuta(ruta, req.method, req);
      if (!acceso.permitido) {
        ayudantes.registrarOrigen(datosDir, origen, peticion, null, null);
        return ayudantes.responderJson(res, acceso.estado, { error: acceso.error });
      }
      const sesionDePeticion = acceso.sesion;
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
        const informe = ayudantes.responderErrorEsp(500, 'error interno del servidor: ' + e.message);
        return ayudantes.responderJson(res, informe.codigoEstado, informe.cuerpo);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------
const { leerArgumentos, cargarConfig, verificarArranque, verificarPuerto } = require('./arranque.js');

async function main() {
  const opciones = leerArgumentos(process.argv.slice(2));
  try {
    cargarConfig(opciones);
    verificarArranque(opciones, NODE_MIN_VERSION, ayudantes);
    await verificarPuerto(opciones.puerto);
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

module.exports = Object.assign({ VERSION, crearServidor, APP_CORE }, ayudantes);