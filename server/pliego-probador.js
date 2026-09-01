'use strict';

/*
 * pliego-probador.js
 * ORDEN-RONDA-16 §3.3 y §3.6. "Probar ahora": corre el generador real de la
 * UOC contra un expediente de ejemplo y reporta si el pliego de prueba sale.
 *
 * El generador vive con acceso sólo lectura en
 *   EjemplosProcesoActual/DocUOC/Generador de Pliegos/
 * Los scripts y las plantillas se copian a una carpeta temporal con la
 * estructura que el script espera (scripts/, plantillas/, datos/, salidas/) y
 * se ejecuta ahí, sin escribir jamás en el original (ORDEN-RONDA-16 §0).
 *
 * El YAML de prueba se construye acá (reproducción server-side de lo que emite
 * app/js/views/pliego-yaml.js) para no depender del DOM.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

// Ruta default del generador, sobreescribible con SGC_GENERADOR_PLIEGOS.
const RAIZ = path.resolve(__dirname, '..');
const GENERADOR_DEFAULT = path.join(
  RAIZ, '..', 'EjemplosProcesoActual', 'DocUOC', 'Generador de Pliegos'
);

function rutaGenerador() {
  return process.env.SGC_GENERADOR_PLIEGOS || GENERADOR_DEFAULT;
}

// ORDEN-RONDA-17 §3: el probador usa LA MISMA función de exportación del flujo
// real (core → export/pliego-yaml.js → views/pliego-yaml.js), no una copia.
// Se cargan contra globalThis.SGC igual que en servidor.js (ADR-029).
function flujoReal() {
  const core = [
    'namespaces.js', 'config.js', 'roles.js', 'cotas-encabezado.js',
    'autorizacion.js', 'auditoria.js', 'migraciones.js', 'utils.js',
    'requerimiento.js', 'anexo-eett.js', 'validacion.js', 'estados.js'
  ];
  for (const f of core) {
    require(path.join(RAIZ, 'app', 'js', 'core', f));
  }
  require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.js'));
  require(path.join(RAIZ, 'app', 'js', 'export', 'pliego-yaml.js'));
  require(path.join(RAIZ, 'app', 'js', 'views', 'pliego-yaml.js'));
  return globalThis.SGC;
}

// Expediente de ejemplo a juego con lo que el formulario produce: la vista
// lee datos.anexo1 (a1), datos.requerimiento (rq) y el id del expediente.
function expedienteEjemplo(tipoContrato) {
  const esServicio = tipoContrato === 'servicios';
  const a1 = {
    unidadResponsable: 'División Abastecimiento',
    unidadDireccion: 'Domicilio de prueba',
    unidadTelefono: '011-0000-0000',
    unidadCorreo: 'abastecimiento@faa.mil.ar',
    horarioAtencion: '09:00 a 13:00',
    frecuenciaProvision: 'mensualmente',
    tipoOc: 'OCA',
    nroExpedienteGde: 'EX-2026-99999999- -APN-VBAM#FAA',
    ofertasParciales: 'no',
    ofertasAlternativas: 'no',
    duracionContrato: 'doce (12) meses',
    tipoContrato: esServicio ? 'servicios' : 'bienes'
  };
  if (esServicio) {
    a1.plazoEntregaServicio = 'quince (15) días desde la notificación de la Orden de Compra';
    a1.garantiaServicio = 'garantía de mantenimiento de oferta';
  } else {
    a1.plazoEntrega = 'diez (10) días';
  }
  const requerimiento = {
    rubro: 'Adquisición de insumos',
    nombreProceso: 'Prueba de plantilla',
    objeto: 'Prueba de generación de pliego',
    tipoContrato: esServicio ? 'servicios' : 'bienes',
    tipoDocumento: 'proyecto',
    tipoProcedimiento: 'Licitación Privada',
    claseModalidad: 'CCM',
    dependencia: 'División Abastecimiento',
    procedimientoSeleccion: 'Licitación Privada',
    modalidadCompra: 'OCA'
  };
  return {
    expedienteId: '2026-999',
    titulo: 'Prueba de plantilla',
    datos: { anexo1: a1, requerimiento }
  };
}

function construirDatosEjemplo(tipoContrato) {
  const SGC = flujoReal();
  // La vista deriva tipo_contrato y campos como en el flujo real.
  const datos = SGC.views.pliegoYaml.construirDatos(expedienteEjemplo(tipoContrato));
  // El formulario completa el ejercicio desde el expediente; acá lo fijamos
  // para que el generador corra (igual valor que antes del flujo real).
  if (!datos.ejercicio) {
    datos.ejercicio = '2026';
  }
  return datos;
}

function emitirYaml(datos) {
  const SGC = flujoReal();
  return SGC.descargas.pliegoYaml.emitir(datos);
}

function ejecutarPython(script, yamlPath, tempDir) {
  return new Promise((resolver, rechazar) => {
    const args = ['"' + script + '"', '"' + yamlPath + '"'];
    const cmd = 'python ' + args.join(' ');
    const hijo = spawn('python', [script, yamlPath], { cwd: tempDir });
    let salida = '';
    hijo.stdout.on('data', (d) => { salida += d.toString(); });
    hijo.stderr.on('data', (d) => { salida += d.toString(); });
    hijo.on('close', (codigo) => {
      if (codigo === 0) {
        resolver(salida);
      } else {
        const e = new Error('el generador de pliego falló (código ' + codigo + '): ' + salida.trim().slice(0, 800));
        e.mensajeSeguro = true;
        rechazar(e);
      }
    });
    // Nada del error de la máquina llega al usuario: se detecta el caso
    // común (python no está) y se dice en claro (RONDA-17 §5).
    hijo.on('error', (e) => {
      if (e && e.code === 'ENOENT') {
        const falta = new Error('no se encontró "python" en el sistema: instalelo o póngalo en el PATH para poder probar el pliego');
        falta.mensajeSeguro = true;
        return rechazar(falta);
      }
      const otror = new Error('no se pudo ejecutar el generador (' + (e && e.constructor ? e.constructor.name : 'Error') + ')');
      otror.mensajeSeguro = true;
      rechazar(otror);
    });
  });
}

function copiarRecursivo(origen, destino) {
  fs.mkdirSync(destino, { recursive: true });
  const entradas = fs.readdirSync(origen, { withFileTypes: true });
  for (const entrada of entradas) {
    const desde = path.join(origen, entrada.name);
    const hasta = path.join(destino, entrada.name);
    if (entrada.isDirectory()) {
      copiarRecursivo(desde, hasta);
    } else if (entrada.isFile()) {
      fs.copyFileSync(desde, hasta);
    }
  }
}

// Genera el pliego de prueba y devuelve { ok, salida } o lanza.
function generarPliegoPrueba(tipoContrato) {
  const generador = rutaGenerador();
  if (!fs.existsSync(path.join(generador, 'scripts', 'generar_pliego.py'))) {
    const e = new Error('no se encontró el generador de pliegos en: ' + generador);
    e.mensajeSeguro = true;
    throw e;
  }
  const datos = construirDatosEjemplo(tipoContrato);
  const yaml = emitirYaml(datos);

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-pliego-prueba-'));
  try {
    const scripts = path.join(temp, 'scripts');
    const plantillas = path.join(temp, 'plantillas');
    const datosDir = path.join(temp, 'datos');
    fs.mkdirSync(scripts, { recursive: true });
    fs.mkdirSync(datosDir, { recursive: true });
    fs.mkdirSync(path.join(temp, 'salidas'), { recursive: true });
    copiarRecursivo(path.join(generador, 'plantillas'), plantillas);
    fs.copyFileSync(path.join(generador, 'scripts', 'generar_pliego.py'),
      path.join(scripts, 'generar_pliego.py'));
    const yamlPath = path.join(datosDir, 'prueba.yaml');
    fs.writeFileSync(yamlPath, yaml, 'utf8');
    const script = path.join(scripts, 'generar_pliego.py');
    return ejecutarPython(script, yamlPath, temp).then((salida) => {
      fs.rmSync(temp, { recursive: true, force: true });
      return { ok: true, salida, yaml };
    });
  } catch (e) {
    try { fs.rmSync(temp, { recursive: true, force: true }); } catch (e2) { /* ignorar */ }
    throw e;
  }
}

// Manejador HTTP de "Probar ahora". Lee el id y el tipo de contrato del cuerpo,
// valida marcadores y lanza el generador; nunca publica.
function probar(req, res, textoCuerpo, id, entorno) {
  const { responderJson, parsearCuerpo } = entorno.ayudantes;
  const nucleo = require('./pliego-plantillas.js');
  const cuerpo = parsearCuerpo(textoCuerpo) || {};
  const contenido = typeof cuerpo.contenido === 'string' ? cuerpo.contenido : '';
  const tipoContrato = cuerpo.tipoContrato === 'servicios' ? 'servicios' : 'bienes';

  const validacion = nucleo.validarMarcadores(contenido);
  if (validacion.desconocidos.length > 0) {
    return Promise.resolve(responderJson(res, 422, {
      ok: false,
      error: 'la plantilla usa marcadores que la aplicación no sabe emitir: ' +
        validacion.desconocidos.join(', '),
      desconocidos: validacion.desconocidos
    }));
  }
  return generarPliegoPrueba(tipoContrato).then((resultado) => {
    // ORDEN-RONDA-17 §2: la prueba queda registrada atada a LA HUELlla de este
    // contenido exacto; publicar la verifica al revés (estaProbada).
    nucleo.marcarProbada(contenido);
    return responderJson(res, 200, {
      ok: true,
      pliegoProbado: true,
      marcadores: validacion.marcadores,
      sinUsar: validacion.sinUsar,
      id
    });
  }).catch((e) => {
    // Ningún mensaje de error de la máquina llega al usuario: solo los
    // mensajes marcados como seguros (nuestros, en castellano) o la clase.
    if (e && e.mensajeSeguro === true && e.message) {
      return responderJson(res, 422, { ok: false, error: e.message });
    }
    const clase = e && e.constructor && e.constructor.name ? e.constructor.name : 'Error';
    return responderJson(res, 422, { ok: false, error: clase });
  });
}

module.exports = {
  construirDatosEjemplo,
  emitirYaml,
  generarPliegoPrueba,
  probar,
  rutaGenerador
};
