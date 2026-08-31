#!/usr/bin/env bash
# instalar.sh — Instalación del SGC en Debian 12 (ORDEN-RONDA-15 §3.1)
#
# Uso:
#   sudo bash instalar.sh [--datos /ruta/datos] [--puerto 8123]
#
# Crea usuario de sistema, carpeta de datos, instala aplicación como
# servicio de systemd. No pisa la carpeta de datos si ya existe.
# Ejecutar desde la raíz del repositorio.
set -euo pipefail

USUARIO_SGC="sgc"
DIR_DATOS="/var/lib/sgc"
PUERTO=8123
DIR_APP="$(cd "$(dirname "$0")" && pwd)"
DIR_SYSTEMD="/etc/systemd/system"
DIR_CONFIG_SGC="/etc/sgc"
ARCHIVO_CONFIG="${DIR_CONFIG_SGC}/servidor.json"

while [ $# -gt 0 ]; do
  case "$1" in
    --datos) DIR_DATOS="$2"; shift 2 ;;
    --puerto) PUERTO="$2"; shift 2 ;;
    *) echo "Argumento desconocido: $1"; exit 1 ;;
  esac
done

# --- 1. Usuario de sistema ---------------------------------------------------
if ! id "$USUARIO_SGC" >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "$USUARIO_SGC"
  echo "Usuario de sistema creado: $USUARIO_SGC"
else
  echo "Usuario de sistema ya existe: $USUARIO_SGC"
fi

# --- 2. Carpeta de datos -----------------------------------------------------
if [ ! -d "$DIR_DATOS" ]; then
  mkdir -p "$DIR_DATOS"
  chown "$USUARIO_SGC":"$USUARIO_SGC" "$DIR_DATOS"
  chmod 700 "$DIR_DATOS"
  echo "Carpeta de datos creada: $DIR_DATOS (dueño: $USUARIO_SGC, permiso 700)"
else
  echo "Carpeta de datos ya existe: $DIR_DATOS (no se modifica)"
fi

# --- 3. Archivos de la aplicación (sólo lectura) -----------------------------
# Copia los directorios necesarios si no están en su lugar.
for carpeta in app server tools config; do
  destino="/opt/sgc/${carpeta}"
  if [ ! -d "$destino" ]; then
    mkdir -p "$destino"
  fi
  cp -a "${DIR_APP}/${carpeta}/." "${destino}/"
done
# tools/respaldo.js y tools/restaurar.js necesitan ser ejecutables.
chmod -R a+rX /opt/sgc/app /opt/sgc/server /opt/sgc/config
chmod -R a+rX /opt/sgc/tools
echo "Archivos de la aplicación instalados en /opt/sgc/"

# --- 4. Archivo de configuración del servicio ---------------------------------
mkdir -p "$DIR_CONFIG_SGC"
if [ ! -f "$ARCHIVO_CONFIG" ]; then
  cat > "$ARCHIVO_CONFIG" <<EOF
{
  "datos": "${DIR_DATOS}",
  "puerto": ${PUERTO}
}
EOF
  echo "Configuración del servicio creada: ${ARCHIVO_CONFIG}"
else
  echo "Configuración del servicio ya existe: ${ARCHIVO_CONFIG} (no se modifica)"
fi

# --- 5. Servicio de systemd ---------------------------------------------------
cp "${DIR_APP}/systemd/sgc.service" "${DIR_SYSTEMD}/sgc.service"
systemctl daemon-reload
systemctl enable sgc.service
echo "Servicio de systemd instalado y habilitado."

# --- 6. Tarea de respaldo diario (cron) ---------------------------------------
CRON_LINE="0 3 * * * /usr/bin/node /opt/sgc/tools/respaldo.js --datos ${DIR_DATOS} --destino /var/backups/sgc --retener 14"
if ! crontab -l 2>/dev/null | grep -qF "respaldo.js"; then
  (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
  echo "Tarea de respaldo diario configurada (03:00 AM)."
else
  echo "Tarea de respaldo diario ya existe."
fi

echo ""
echo "=== Instalación completada ==="
echo "Para iniciar el servicio:  systemctl start sgc"
echo "Para ver el registro:      journalctl -u sgc -f"
echo "Para verificar salud:      curl http://127.0.0.1:${PUERTO}/api/salud"
