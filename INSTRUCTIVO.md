# Instructivo de Instalación y Mantenimiento — SGC

**Sistema de Gestión de Contrataciones**
Versión: 1.0.0 | Debian 12 | Node 18+

---

## 1. Qué se necesita

- Una máquina con **Debian 12** (o superior), acceso root o sudo.
- **Node.js 18** o superior (`node --version` para verificar).
- Los archivos de la aplicación: `app/`, `server/`, `tools/`, `config/`, `instalar.sh`, `systemd/`.

## 2. Instalación

**El padrón se crea solo.** En el primer arranque el servidor crea el padrón con
un único usuario: el **administrador** (sus datos salen de la configuración del
servidor). No hay ningún paso previo de siembra (ver §7).

### 2.1 Instalar los archivos

Copiar la carpeta del repositorio a la máquina. Ejecutar desde su raíz:

```bash
sudo bash instalar.sh \
  --admin-nombre "Juana" \
  --admin-apellido "Pérez" \
  --admin-email "jperez@faa.mil.ar" \
  --admin-rol contrataciones_supervisor
```

> Los datos son **de ejemplo**: reemplazalos por los del administrador real de tu
> División. Si la terminal es interactiva y no pasás estos argumentos, el
> instalador te los pregunta uno por uno. Si no los tiene y no puede pedirlos,
> **falla** y te dice cómo pasarlos: nunca escribe una configuración incompleta
> (sin administrador, el servidor no arranca — ORDEN-RONDA-18 §1.2).

Esto crea:
- Usuario de sistema `sgc` (sin shell, sin login).
- Carpeta de datos en `/var/lib/sgc` (permiso 700, dueño: `sgc`).
- Aplicación en `/opt/sgc` (sólo lectura para el usuario `sgc`).
- Servicio de systemd `sgc.service` habilitado para arrancar con la máquina.
- Tarea de respaldo diario a las 03:00 AM.

**No pisa** la carpeta de datos si ya existe. Ejecutar dos veces es seguro.

### 2.2 Primer arranque

El primer arranque crea el padrón y **genera la clave provisoria del
administrador**, escrita **una sola vez** en la salida del servicio:

```bash
systemctl start sgc
journalctl -u sgc | grep -A 8 "SGC-SERVIDOR-ADMINISTRADOR-CLAVE-PROVISORIA"
```

Anotarla antes de seguir: ese recuadro no vuelve a aparecer.

### 2.3 Arrancar el servicio (arranques siguientes)

```bash
systemctl start sgc
systemctl status sgc
```

### Configurar puerto o carpeta de datos

Editar `/etc/sgc/servidor.json`:

```json
{
  "datos": "/var/lib/sgc",
  "puerto": 8123,
  "administrador": {
    "nombre": "Juana",
    "apellido": "Pérez",
    "email": "jperez@faa.mil.ar",
    "rol": "contrataciones_supervisor"
  }
}
```

> El bloque `administrador` es **datos de ejemplo**: usalo como forma, no tal cual.
> Sólo se usa en el primer arranque (para crear el padrón). Si el padrón ya
> existe, el servidor arranca aunque el bloque no esté: ahí manda el padrón, no
> la configuración. `sector` es opcional.

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

El padrón vive en `/var/lib/sgc/padron.json`. El servidor **lo crea en el
primer arranque** con un solo usuario: el administrador, cuyos datos salen de
la configuración. La clave provisoria se muestra **una vez** en la salida del
servidor; en disco sólo queda su hash.

**Administrar el padrón es una función de la aplicación, no de la consola.**
Desde la pantalla de administración (sólo visible para el administrador) se
hace todo: alta, importar CSV, exportar, baja, cambio de rol, reposición de
clave y levantamiento de bloqueos. **Los roles válidos son los que muestra el
desplegable de esa pantalla** — salen del código, no de este manual.

`tools/padron.js` **queda como camino de rescate**: se usa únicamente cuando
nadie puede entrar, por ejemplo si el administrador perdió la clave antes del
primer ingreso:

```bash
# Reponer la clave del administrador (provisoria, se muestra una vez)
sudo -u sgc node /opt/sgc/tools/padron.js reponer --datos /var/lib/sgc --para <email-admin>
# Listar operadores
sudo -u sgc node /opt/sgc/tools/padron.js listar --datos /var/lib/sgc
```

Al reponer, se imprime **una vez** la clave provisoria (cuatro palabras en
castellano); entregarla en papel. En disco sólo queda su hash.

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
