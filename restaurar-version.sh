#!/usr/bin/env bash
# restaurar-version.sh — Vuelta atrás del SGC (ORDEN-RONDA-15 §3.5)
#
# Uso:
#   sudo bash restaurar-version.sh [ruta-del-backup]
#
# Si no se indica ruta, restaura el backup más reciente en /opt/sgc-backup-*.
# Los datos nunca se tocan.
set -euo pipefail

DIR_INSTALADA="/opt/sgc"

if [ -n "${1:-}" ]; then
  DIR_BACKUP="$1"
else
  DIR_BACKUP=$(ls -dt /opt/sgc-backup-* 2>/dev/null | head -1)
  if [ -z "$DIR_BACKUP" ]; then
    echo "No se encontró ningún backup en /opt/sgc-backup-*"
    exit 1
  fi
fi

if [ ! -d "$DIR_BACKUP" ]; then
  echo "El backup no existe: ${DIR_BACKUP}"
  exit 1
fi

# --- 1. Parar servicio -------------------------------------------------------
if systemctl is-active --quiet sgc.service; then
  echo "Deteniendo servicio sgc..."
  systemctl stop sgc.service
fi

# --- 2. Restaurar archivos de la aplicación -----------------------------------
rm -rf "${DIR_INSTALADA:?}"
cp -a "$DIR_BACKUP" "$DIR_INSTALADA"
chmod -R a+rX "${DIR_INSTALADA}/app" "${DIR_INSTALADA}/server" "${DIR_INSTALADA}/config"
chmod -R a+rX "${DIR_INSTALADA}/tools"
echo "Archivos restaurados desde: ${DIR_BACKUP}"

# --- 3. Arrancar servicio ----------------------------------------------------
systemctl start sgc.service
echo "Servicio sgc iniciado."

# --- 4. Verificar salud -------------------------------------------------------
sleep 2
PUERTO=$(node -e "try{const c=require('/etc/sgc/servidor.json');process.stdout.write(String(c.puerto||8123))}catch(e){process.stdout.write('8123')}" 2>/dev/null || echo 8123)
if curl -sf "http://127.0.0.1:${PUERTO}/api/salud" >/dev/null 2>&1; then
  echo "Verificación de salud: OK"
else
  echo "ADVERTENCIA: la verificación de salud falló. Revise el registro con: journalctl -u sgc -n 20"
  exit 1
fi

echo ""
echo "=== Vuelta atrás completada ==="
echo "Restaurado desde: ${DIR_BACKUP}"
