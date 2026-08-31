# Instructivo de Instalación y Mantenimiento — SGC

**Sistema de Gestión de Contrataciones**
Versión: 1.0.0 | Debian 12 | Node 18+

---

## 1. Qué se necesita

- Una máquina con **Debian 12** (o superior), acceso root o sudo.
- **Node.js 18** o superior (`node --version` para verificar).
- Los archivos de la aplicación: `app/`, `server/`, `tools/`, `config/`, `instalar.sh`, `systemd/`.

## 2. Instalación

**Primero el padrón, después el servicio.** El servidor no arranca sin un padrón
real con credenciales (ver §7). Instalar primero los archivos y sembrar el
padrón, y recién después levantar el servicio.

### 2.1 Instalar los archivos

Copiar la carpeta del repositorio a la máquina. Ejecutar desde su raíz:

```bash
sudo bash instalar.sh
```

Esto crea:
- Usuario de sistema `sgc` (sin shell, sin login).
- Carpeta de datos en `/var/lib/sgc` (permiso 700, dueño: `sgc`).
- Aplicación en `/opt/sgc` (sólo lectura para el usuario `sgc`).
- Servicio de systemd `sgc.service` habilitado para arrancar con la máquina.
- Tarea de respaldo diario a las 03:00 AM.

**No pisa** la carpeta de datos si ya existe. Ejecutar dos veces es seguro.

### 2.2 Sembrar el padrón

El servidor **no arranca si no hay padrón**. Sembrarlo antes de arrancar el
servicio (ver §7 con el formato exacto).

### 2.3 Arrancar el servicio

```bash
systemctl start sgc
systemctl status sgc
```

### Configurar puerto o carpeta de datos

Editar `/etc/sgc/servidor.json`:

```json
{
  "datos": "/var/lib/sgc",
  "puerto": 8123
}
```

Para cambiar el puerto, editar este archivo y reiniciar: `systemctl restart sgc`.

## 3. Operación diaria

| Acción | Comando |
|---|---|
| Verificar que está corriendo | `systemctl status sgc` |
| Ver los logs | `journalctl -u sgc -f` |
| Parar el servicio | `systemctl stop sgc` |
| Arrancar el servicio | `systemctl start sgc` |
| Reiniciar (ej. tras cambio de puerto) | `systemctl restart sgc` |
| Verificar salud | `curl http://127.0.0.1:8123/api/salud` |

## 4. Actualización

1. Subir los archivos nuevos a la máquina.
2. Ejecutar:
   ```bash
   sudo bash actualizar.sh
   ```
3. Verificar salud con `curl http://127.0.0.1:8123/api/salud`.

Los datos (expedientes, padrón, eventos, sugerencias) **nunca se tocan** al actualizar.

## 5. Vuelta atrás

Si algo falla después de una actualización:

```bash
sudo bash restaurar-version.sh
```

Restaura la versión anterior desde `/opt/sgc-backup-*` y reinicia el servicio. Los datos no se modifican.

Para restaurar un backup específico:

```bash
sudo bash restaurar-version.sh /opt/sgc-backup-20260831-143000
```

## 6. Respaldo

El respaldo corre automáticamente todos los días a las 03:00 AM. Copia la carpeta de datos a `/var/backups/sgc/` y conserva los últimos 14 respaldos.

Para ejecutar un respaldo manual:

```bash
sudo -u sgc node /opt/sgc/tools/respaldo.js --datos /var/lib/sgc --destino /var/backups/sgc --retener 14
```

Para restaurar un respaldo:

```bash
sudo -u sgc node /opt/sgc/tools/restaurar.js --origen /var/backups/sgc/sgc-respaldo-XXXXXX --destino /var/lib/sgc
```

**Nota:** la restauración es destructiva. Apuntar a una carpeta vacía o descartable.

## 7. Padrón de usuarios

El padrón vive en `/var/lib/sgc/padron.json` y **es obligatorio**: el servidor
no arranca sin él (ver §2.1). Se administra con la herramienta `tools/padron.js`
usando un archivo de texto con **una línea por operador**, con el formato:

```
nombre;apellido;email;rol;[sector];[activo]
```

Los roles válidos son: `contrataciones`, `contrataciones_supervisor`,
`abastecimiento`, `abastecimiento_supervisor`, `juridica`, `generador`,
`consultor`.

Ejemplo de archivo de altas (dos renglones):

```
María;González;maria.gonzalez@faa.mil.ar;contrataciones;Abastecimiento;true
Carlos;Fernández;carlos.fernandez@faa.mil.ar;contrataciones_supervisor;;true
```

Sembrar el padrón (el primer alta es bootstrap y no pide `--quien`):

```bash
sudo -u sgc node /opt/sgc/tools/padron.js alta --datos /var/lib/sgc --archivo /tmp/altas.txt
```

Si el padrón ya existe, `alta` exige `--quien` y `--clave` del Jefe de
Contrataciones:

```bash
sudo -u sgc node /opt/sgc/tools/padron.js alta --datos /var/lib/sgc --archivo /tmp/altas.txt --quien carlos.fernandez@faa.mil.ar --clave LA-CLAVE-DEL-JEFE
```

Otras operaciones:

```bash
# Listar operadores
sudo -u sgc node /opt/sgc/tools/padron.js listar --datos /var/lib/sgc
# Dar de baja (nunca borra: activo=false)
sudo -u sgc node /opt/sgc/tools/padron.js baja --datos /var/lib/sgc --quien <jefe> --clave <clave> --para <email>
# Reponer clave provisoria
sudo -u sgc node /opt/sgc/tools/padron.js reponer --datos /var/lib/sgc --quien <jefe> --clave <clave> --para <email>
```

Al cargar, `alta` imprime **una vez** la clave provisoria de cada operador (cuatro
palabras en castellano); entregarla en papel. En disco sólo queda su hash.

## 8. Qué mirar cuando no anda

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `systemctl status sgc` dice `failed` | El servidor no arrancó | `journalctl -u sgc -n 20` — el mensaje dice qué falta |
| El servidor no arranca / transiciones dan 403 | No hay padrón real con credenciales | Sembrar el padrón con `padron.js alta` (ver §7) y reiniciar: `systemctl restart sgc` |
| El servicio no aparece | No se habilitó | `systemctl enable sgc && systemctl start sgc` |
| Puerto en uso | Otro proceso usa el puerto | Cambiar puerto en `/etc/sgc/servidor.json` y `systemctl restart sgc` |
| No responde en el puerto | Firewall o servicio parado | `systemctl status sgc` y `iptables -L -n` |
| Respaldo no corre | Cron no configurado | Verificar con `crontab -l -u root` |
| Disco lleno | Los respaldos acumularon | Reducir `retener` en la tarea de cron, o limpiar `/var/backups/sgc/` |

## 9. Archivos importantes

| Ruta | Qué es |
|---|---|
| `/etc/sgc/servidor.json` | Configuración (puerto, carpeta de datos) |
| `/var/lib/sgc/` | Carpeta de datos (expedientes, padrón, eventos) |
| `/var/lib/sgc/padron.json` | Padrón de usuarios |
| `/var/backups/sgc/` | Respaldos diarios |
| `/opt/sgc/` | Archivos de la aplicación (sólo lectura) |
| `/etc/systemd/system/sgc.service` | Unidad de systemd |
| `journalctl -u sgc` | Registro del servicio |
