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

// Reproduce views/pliego-yaml.js para construir el YAML de un expediente de
// ejemplo. Se fuerza tipo_contrato/tipo_documento derivados (§3.7).
function construirDatosEjemplo(tipoContrato) {
  const especiesServicios = tipoContrato === 'servicios';
  const organismos = [{
    nombre: 'División Abastecimiento', domicilio: 'Domicilio de prueba',
    telefono: '011-0000-0000', correo: 'abastecimiento@faa.mil.ar',
    horario: '09:00 a 13:00', frecuencia_provision: 'mensualmente'
  }];
  if (!especiesServicios) {
    organismos[0].plazo_entrega = 'diez (10) días';
  }
  const datos = {
    tipo_documento: 'proyecto',
    tipo_contrato: especiesServicios ? 'servicios' : 'bienes',
    version: '1.0',
    tipo_procedimiento: 'Licitación Privada',
    nro_procedimiento: '2026-999',
    ejercicio: '2026',
    clase_modalidad: 'CCM',
    tipo_oc: 'OCA',
    nro_expediente_gde: 'EX-2026-99999999- -APN-VBAM#FAA',
    rubros: '"Adquisición de insumos"',
    nombre_proceso: 'Prueba de plantilla',
    objeto: 'Prueba de generación de pliego',
    organismos_requirentes: organismos,
    ofertas_parciales: 'no',
    ofertas_alternativas: 'no',
    duracion_contrato: 'doce (12) meses'
  };
  if (especiesServicios) {
    datos.plazo_entrega_servicio = 'quince (15) días desde la notificación de la Orden de Compra';
    datos.garantia_servicio = 'garantía de mantenimiento de oferta';
  }
  return datos;
}

function emitirYaml(datos) {
  const escalar = (v) => {
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return String(v);
    const s = String(v == null ? '' : v);
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  };
  const lineas = [];
  for (const clave of Object.keys(datos)) {
    const valor = datos[clave];
    if (Array.isArray(valor)) {
      lineas.push(clave + ':');
      for (const item of valor) {
        lineas.push('  -');
        for (const k of Object.keys(item)) {
          lineas.push('    ' + k + ': ' + escalar(item[k]));
        }
      }
    } else {
      lineas.push(clave + ': ' + escalar(valor));
    }
  }
  return lineas.join('\n') + '\n';
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
        rechazar(new Error('el generador de pliego falló (código ' + codigo + '): ' + salida.trim()));
      }
    });
    hijo.on('error', (e) => rechazar(new Error('no se pudo ejecutar el generador: ' + e.message)));
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
    throw new Error('no se encontró el generador de pliegos en: ' + generador);
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
    return responderJson(res, 200, {
      ok: true,
      pliegoProbado: true,
      marcadores: validacion.marcadores,
      sinUsar: validacion.sinUsar,
      id
    });
  }).catch((e) => {
    return responderJson(res, 422, { ok: false, error: e.message });
  });
}

module.exports = {
  construirDatosEjemplo,
  emitirYaml,
  generarPliegoPrueba,
  probar,
  rutaGenerador
};
