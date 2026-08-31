#!/usr/bin/env bash
# actualizar.sh — Actualización del SGC (ORDEN-RONDA-15 §3.5)
#
# Uso:
#   sudo bash actualizar.sh [--puerto 8123]
#
# Procedimiento:
#   1. Parar el servicio.
#   2. Respaldar la versión actual en /opt/sgc-backup-<fecha>.
#   3. Copiar los archivos nuevos de la aplicación.
#   4. Arrancar el servicio.
#   5. Verificar salud.
#
# Los datos NUNCA se tocan.
#
# Vuelta atrás:
#   sudo bash restaurar-version.sh [ruta-del-backup]
set -euo pipefail

DIR_APP="$(cd "$(dirname "$0")" && pwd)"
DIR_INSTALADA="/opt/sgc"
FECHA=$(date '+%Y%m%d-%H%M%S')
DIR_BACKUP="/opt/sgc-backup-${FECHA}"

while [ $# -gt 0 ]; do
  case "$1" in
    --puerto) shift 2 ;;
    *) echo "Argumento desconocido: $1"; exit 1 ;;
  esac
done

# --- 1. Parar servicio -------------------------------------------------------
if systemctl is-active --quiet sgc.service; then
  echo "Deteniendo servicio sgc..."
  systemctl stop sgc.service
  echo "Servicio detenido."
else
  echo "El servicio sgc no está activo."
fi

# --- 2. Respaldar versión actual ----------------------------------------------
if [ -d "$DIR_INSTALADA" ]; then
  cp -a "$DIR_INSTALADA" "$DIR_BACKUP"
  echo "Versión actual respaldada en: ${DIR_BACKUP}"
fi

# --- 3. Copiar archivos nuevos ------------------------------------------------
for carpeta in app server tools config; do
  if [ -d "${DIR_APP}/${carpeta}" ]; then
    rm -rf "${DIR_INSTALADA:?}/${carpeta}"
    cp -a "${DIR_APP}/${carpeta}" "${DIR_INSTALADA}/${carpeta}"
  fi
done
chmod -R a+rX "${DIR_INSTALADA}/app" "${DIR_INSTALADA}/server" "${DIR_INSTALADA}/config"
chmod -R a+rX "${DIR_INSTALADA}/tools"
echo "Archivos de la aplicación actualizados."

# --- 4. Arrancar servicio ----------------------------------------------------
systemctl start sgc.service
echo "Servicio sgc iniciado."

# --- 5. Verificar salud -------------------------------------------------------
sleep 2
PUERTO=$(node -e "try{const c=require('/etc/sgc/servidor.json');process.stdout.write(String(c.puerto||8123))}catch(e){process.stdout.write('8123')}" 2>/dev/null || echo 8123)
if curl -sf "http://127.0.0.1:${PUERTO}/api/salud" >/dev/null 2>&1; then
  echo "Verificación de salud: OK"
else
  echo "ADVERTENCIA: la verificación de salud falló. Revise el registro con: journalctl -u sgc -n 20"
  echo "Para volver a la versión anterior: sudo bash restaurar-version.sh ${DIR_BACKUP}"
  exit 1
fi

echo ""
echo "=== Actualización completada ==="
echo "Versión anterior respaldada en: ${DIR_BACKUP}"
echo "Para volver atrás: sudo bash restaurar-version.sh ${DIR_BACKUP}"
