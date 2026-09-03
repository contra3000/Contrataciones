#!/usr/bin/env bash
# instalar.sh — Instalación del SGC en Debian 12 (ORDEN-RONDA-15 §3.1)
#
# Uso:
#   sudo bash instalar.sh [--datos /ruta/datos] [--puerto 8123] \
#       [--admin-nombre "X"] [--admin-apellido "Y"] [--admin-email "z@dominio"] [--admin-rol r]
#
# ORDEN-RONDA-18 §1.2 (ADR-038): el primer arranque necesita el bloque
# `administrador`. El instalador lo recibe por argumentos, o lo pregunta si la
# terminal es interactiva; si no puede conseguirlo, FALLA y dice cómo pasarlo.
# Nunca escribe un servidor.json sin el bloque.
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

ADMIN_NOMBRE=""
ADMIN_APELLIDO=""
ADMIN_EMAIL=""
ADMIN_ROL=""

while [ $# -gt 0 ]; do
  case "$1" in
    --datos) DIR_DATOS="$2"; shift 2 ;;
    --puerto) PUERTO="$2"; shift 2 ;;
    --admin-nombre) ADMIN_NOMBRE="$2"; shift 2 ;;
    --admin-apellido) ADMIN_APELLIDO="$2"; shift 2 ;;
    --admin-email) ADMIN_EMAIL="$2"; shift 2 ;;
    --admin-rol) ADMIN_ROL="$2"; shift 2 ;;
    *) echo "Argumento desconocido: $1"; exit 1 ;;
  esac
done

se_pregunta() {  # ¿la terminal es interactiva?
  [ -t 0 ] && [ -t 1 ]
}

# ORDEN-RONDA-18 §1.2: junta el bloque `administrador`, pidiéndolo si falta y
# la terminal es interactiva, o fallando con las instrucciones si no.
recolectar_administrador() {
  if [ -z "$ADMIN_NOMBRE" ] && se_pregunta; then
    read -r -p "Nombre del administrador inicial: " ADMIN_NOMBRE
  fi
  if [ -z "$ADMIN_APELLIDO" ] && se_pregunta; then
    read -r -p "Apellido del administrador inicial: " ADMIN_APELLIDO
  fi
  if [ -z "$ADMIN_EMAIL" ] && se_pregunta; then
    read -r -p "Correo del administrador inicial: " ADMIN_EMAIL
  fi
  if [ -z "$ADMIN_ROL" ] && se_pregunta; then
    read -r -p "Rol del administrador inicial (ej. contrataciones_supervisor): " ADMIN_ROL
  fi
  if [ -z "$ADMIN_NOMBRE" ] || [ -z "$ADMIN_APELLIDO" ] || [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_ROL" ]; then
    echo "Error: falta el bloque administrador del primer arranque." >&2
    echo "Pasalo por argumentos o dejalo responder en una terminal interactiva:" >&2
    echo "  sudo bash instalar.sh --admin-nombre 'X' --admin-apellido 'Y' \ " >&2
    echo "       --admin-email 'x@dominio.gob.ar' --admin-rol contrataciones_supervisor" >&2
    echo "No se escribe un servidor.json incompleto: sin administrador, el servidor no arranca." >&2
    exit 1
  fi
}

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
  recolectar_administrador
  cat > "$ARCHIVO_CONFIG" <<EOF
{
  "datos": "${DIR_DATOS}",
  "puerto": ${PUERTO},
  "administrador": {
    "nombre": "${ADMIN_NOMBRE}",
    "apellido": "${ADMIN_APELLIDO}",
    "email": "${ADMIN_EMAIL}",
    "rol": "${ADMIN_ROL}"
  }
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
