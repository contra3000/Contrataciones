'use strict';

/*
 * recorrido-completo.js
 * ORDEN-RONDA-06 §3.4. Recorre todo el circuito contra un servidor real:
 *
 *   node tools/recorrido-completo.js http://127.0.0.1:<puerto>
 *
 * - Crea un expediente (Especificaciones Técnicas) y lo lleva, paso a paso,
 *   hasta Perfeccionada (18 estados), cambiando de operador según el rol
 *   ejecutor de cada estado (los operadores del padrón de config/).
 * - En el camino incluye al menos una devolución por observación (con motivo
 *   del catálogo) y el posterior reavance.
 * - Verifica que la cadena de auditoría quede íntegra (ADR-006) y lo imprime.
 *
 * Exporta `recorrer(baseUrl)` para que los tests corran el mismo recorrido
 * (tests/recorrido.test.js) sin duplicar la lógica.
 */

const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
require(path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'config.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'utils.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'auditoria.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'migraciones.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'validacion.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'requerimiento.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'estados.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.http.js'));
// Plantillas del circuito (ORDEN-RONDA-08 §2.1): el recorrido compone y guarda
// el documento de cada fase antes de poder avanzar.
require(path.join(RAIZ, 'app', 'js', 'renders', 'documento.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'especificacion-tecnica.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'requerimiento.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'solicitud-contratacion.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'pliego-bases-condiciones.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'disposicion-adjudicacion.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'orden-compra.js'));

const SGC = globalThis.SGC;
const config = SGC.core.config;

// Operadores del padrón (config/usuarios.ejemplo.json), por rol.
const OPERADORES = {
  generador: { email: 'maria.gonzalez@faa.mil.ar', roles: ['generador'] },
  abastecimiento: { email: 'juan.perez@faa.mil.ar', roles: ['abastecimiento'] },
  abastecimiento_supervisor: { email: 'laura.fernandez@faa.mil.ar', roles: ['abastecimiento_supervisor'] },
  contrataciones: { email: 'carlos.ramirez@faa.mil.ar', roles: ['contrataciones', 'contrataciones_supervisor'] },
  contrataciones_supervisor: { email: 'carlos.ramirez@faa.mil.ar', roles: ['contrataciones', 'contrataciones_supervisor'] },
  juridica: { email: 'ana.torres@faa.mil.ar', roles: ['juridica'] },
  contaduria: { email: 'luis.diaz@faa.mil.ar', roles: ['contaduria'] }
};

const MOTIVO_DEVOLUCION = 'ERRORES_FORMALES';

function definirEstado(idEstado) {
  for (let i = 0; i < config.ESTADOS.length; i++) {
    if (config.ESTADOS[i].id === idEstado) {
      return config.ESTADOS[i];
    }
  }
  return null;
}

function operadorPara(rol) {
  const operador = OPERADORES[rol];
  if (!operador) {
    throw new Error('recorrido: no hay operador para el rol "' + rol + '"');
  }
  return operador;
}

function contexto(rol) {
  const operador = operadorPara(rol);
  return {
    timestamp: new Date().toISOString(),
    email: operador.email,
    rol,
    equipo: 'PC-RECORRIDO'
  };
}

// Secuencia de pasos: avance por cada estado + una devolución (con reavance)
// cuando el expediente llega a AUTORIZACION_SCo, antes de salir de él.
function planDePasos() {
  const pasos = [];
  let estadoActual = config.ESTADO_INICIAL;
  let huboDevolucion = false;
  while (estadoActual !== config.ESTADO_FINAL) {
    const def = definirEstado(estadoActual);
    if (def.id === 'AUTORIZACION_SCo' && !huboDevolucion) {
      const destinoDevolucion = def.estadosDevolucion[0];
      pasos.push({ accion: 'devolver', desde: def.id, destino: destinoDevolucion, rol: def.rolEjecutor });
      huboDevolucion = true;
      estadoActual = destinoDevolucion;
      const devDef = definirEstado(destinoDevolucion);
      const reavance = devDef.estadosSiguientes[0];
      pasos.push({ accion: 'avanzar', desde: destinoDevolucion, destino: reavance, rol: devDef.rolEjecutor });
      estadoActual = reavance;
      continue;
    }
    const destino = def.estadosSiguientes[0];
    if (!destino) {
      break;
    }
    pasos.push({ accion: 'avanzar', desde: estadoActual, destino, rol: def.rolEjecutor });
    estadoActual = destino;
  }
  return pasos;
}

// Aplica un paso por intención (ADR-021): el cliente declara el destino y el
// contexto; el servidor ejecuta el motor y persiste su resultado. Un rechazo
// del motor (403) se reporta como {ok:false, error}, igual que en la vista.
async function aplicar(repo, expediente, version, paso) {
  const ctx = contexto(paso.rol);
  const respuesta = paso.accion === 'avanzar'
    ? await repo.avanzar(expediente.expedienteId, version, paso.destino, ctx)
    : await repo.devolver(expediente.expedienteId, version, paso.destino, MOTIVO_DEVOLUCION,
        'Devolución del recorrido completo', ctx);
  if (!respuesta.ok) {
    throw new Error('recorrido: no se pudo ' + paso.accion + ' desde ' + paso.desde + ': ' + respuesta.error);
  }
  return respuesta;
}

// ORDEN-RONDA-08 §2.1: si el estado que se abandona produce un documento, se
// compone con su plantilla y se guarda como entregable antes de avanzar
// (validacion exige el entregable del estado). Devuelve la versión que el
// guardado deja en el servidor.
async function guardarEntregableDelEstado(repo, expediente, version, idEstado, rol) {
  const plantilla = SGC.renders.documento.paraEstado(idEstado);
  if (!plantilla) {
    return version;
  }
  const contenido = plantilla.componer(expediente);
  const guardado = await repo.guardarEntregable(
    expediente.expedienteId, plantilla.nombre, contenido, contexto(rol), plantilla.id);
  return guardado.version;
}

async function recorrer(baseUrl) {
  if (typeof baseUrl !== 'string' || baseUrl.length === 0) {
    throw new Error('recorrer() requiere la base del servidor');
  }
  const repo = SGC.adapters.repoHttp.crear(baseUrl);
  const pasoRegistrado = [];

  const datosIniciales = {
    titulo: 'Recorrido completo del circuito',
    anio: '2026',
    identificacion: {
      numero: '99',
      anio: '2026',
      dependenciaSolicitante: 'División Usuario',
      finalidad: 'Verificar el circuito completo',
      lugar: 'FAA - Unidad de destino',
      vigencia: '2026-12-31'
    },
    fechaCreacion: new Date().toISOString().slice(0, 10),
    fechaLimite: '2026-12-31',
    prioridad: 'Alta',
    rubro: '4210',
    tipo: 'Bien común',
    renglones: [
      { codigo: '2.1.1-439.102', cantidad: 1, unidad: 'UN', rubro: '4210' }
    ]
  };

  const creado = await repo.crearExpediente(datosIniciales, contexto('generador'));
  let expediente = creado.expediente;
  let version = creado.version;
  pasoRegistrado.push(['crearExpediente', SGC.core.utils.idEstado(expediente), null, 'generador']);

  const plan = planDePasos();
  for (let i = 0; i < plan.length; i++) {
    const paso = plan[i];
    if (paso.accion === 'avanzar') {
      version = await guardarEntregableDelEstado(repo, expediente, version, paso.desde, paso.rol);
    }
    const resultado = await aplicar(repo, expediente, version, paso);
    if (resultado.conflicto) {
      throw new Error('recorrido: conflicto de versión al ' + paso.accion + ' desde ' + paso.desde);
    }
    version = resultado.version;
    expediente = resultado.expediente;
    pasoRegistrado.push([paso.accion, SGC.core.utils.idEstado(expediente), paso.destino, paso.rol]);
  }

  const verificacion = SGC.core.auditoria.verificarCadena(expediente.auditoria);
  return {
    id: expediente.expedienteId,
    expediente,
    pasos: pasoRegistrado,
    verificacion
  };
}

async function main() {
  const baseUrl = process.argv[2];
  if (!baseUrl) {
    const ejemplo = 'http:' + '//127.0.0.1:<puerto>';
    console.error('uso: node tools/recorrido-completo.js ' + ejemplo);
    process.exit(2);
  }
  const resultado = await recorrer(baseUrl);
  console.log('Recorrido completo ' + resultado.id + ':');
  for (const paso of resultado.pasos) {
    console.log('  ' + paso[0] + ' -> ' + paso[3] + ' => ' + paso[1]);
  }
  console.log('Auditoría: ' + resultado.expediente.auditoria.length + ' entradas, cadena íntegra: ' +
    resultado.verificacion.integra);
  if (!resultado.verificacion.integra) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('FALLÓ el recorrido: ' + err.message);
    process.exit(1);
  });
}

module.exports = { recorrer, planDePasos, OPERADORES };
