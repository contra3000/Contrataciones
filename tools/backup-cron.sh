#!/usr/bin/env bash
# backup-cron.sh — Respaldo diario del SGC (ORDEN-RONDA-15 §3.6)
#
# Lee la configuración de /etc/sgc/respaldo.json:
#   { "destino": "/ruta/del/respaldo", "retener": 14 }
#
# Si el destino no está disponible, avisa y no borra el anterior.
# Diseñado para cron: toda la salida va a stderr para que cron la envíe
# por correo al administrador.
set -euo pipefail

CONFIG="/etc/sgc/respaldo.json"
USUARIO_SGC="sgc"
LOG_TAG="sgc-respaldo"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') [sgc-respaldo] $1" >&2
}

# Leer configuración.
if [ ! -f "$CONFIG" ]; then
  log "ERROR: no existe el archivo de configuración ${CONFIG}"
  exit 1
fi

DESTINO=""
RETENER=14
if command -v node >/dev/null 2>&1; then
  DESTINO=$(node -e "const c=require('${CONFIG}');process.stdout.write(c.destino||'')")
  RETENER=$(node -e "const c=require('${CONFIG}');process.stdout.write(String(c.retener||14))")
fi

if [ -z "$DESTINO" ]; then
  log "ERROR: el campo 'destino' no está configurado en ${CONFIG}"
  exit 1
fi

# Verificar que el destino está disponible.
if [ ! -d "$DESTINO" ]; then
  # Intentar crear si no existe (ejemplo: un disco que se conecta al inicio).
  if ! mkdir -p "$DESTINO" 2>/dev/null; then
    log "ERROR: el destino de respaldo no está disponible: ${DESTINO}"
    log "El respaldo anterior NO se borra. Verifique la ruta o el montaje del disco."
    exit 1
  fi
fi

# Verificar que la carpeta de datos existe.
DIR_DATOS="/var/lib/sgc"
if [ ! -d "$DIR_DATOS" ]; then
  log "ERROR: la carpeta de datos no existe: ${DIR_DATOS}"
  exit 1
fi

# Ejecutar respaldo como el usuario del servicio.
log "Iniciando respaldo de ${DIR_DATOS} a ${DESTINO} (retener: ${RETENER})"
if su -s /bin/bash "$USUARIO_SGC" -c "node /opt/sgc/tools/respaldo.js --datos ${DIR_DATOS} --destino ${DESTINO} --retener ${RETENER}" 2>&1; then
  log "Respaldo completado exitosamente."
else
  log "ERROR: el respaldo falló. Verifique los permisos y el espacio en disco."
  exit 1
fi
