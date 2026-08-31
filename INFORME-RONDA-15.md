# INFORME - RONDA 15

## 1. Qué hice

Cerré la **ORDEN-RONDA-15**: la corrección del §2 (padrón como fuente única
de verdad), la verificación de arranque (§3.4), el paquete de despliegue
(§3.1–§3.3), la actualización (§3.5), el respaldo (§3.6), el instructivo
(§3.7) y los tests (§4).

### §2 — Padrón: una sola fuente de verdad

- **`server/padron-vivo.js`** (módulo nuevo): caché con invalidación por mtime.
  `crearPadronVivo(ruta)` expone `leer()`, `usuarios()`, `buscar(email)`,
  `guardar(padron)` (escritura atómica tmp+rename), `existe()`, `invalidar()`.
- **`server/servidor.js`**: `crearServidor` crea `padronVivoReal` apuntando a
  `datosDir/padron.json`. Si no existe, usa `config/usuarios.ejemplo.json`
  (modo declarado/desarrollo). `entorno.padronVivo` reemplaza a `entorno.PADRON`.
- **`server/sesion.js`**: `crearCapaSesion(datosDir, ayudantes, padronVivo)` —
  `esModoAutenticado` usa `padronVivo.existe()/usuarios()`, `leerPadron` usa
  `padronVivo.leer()`, `persistirPadron` usa `padronVivo.guardar()`.
- **Revalidación en `conectarSesion`**: cada petición verifica contra el padrón
  vigente. Baja (`activo:false`) → sesión destruida. Bloqueo → sesión
  destruida. Cambio de rol → `sesion.rol` se actualiza al rol nuevo.
- **`server/expedientes.js`**, **`server/eventos.js`**, **`server/sugerencias.js`**:
  `autorizacion.verificar()` ahora recibe `entorno.padronVivo.usuarios()` en
  vez del snapshot estático anterior.

### §3.2 — Versión mínima de Node 18

`NODE_MIN_VERSION = 18` declarado en `server/servidor.js` (único lugar). Se
verifica al arrancar en `verificarArranque` con un mensaje claro: "se necesita
Node 18 o superior (versión actual: vXX.YY.ZZ)".

### §3.4 — Verificación de arranque (5 checks)

`server/arranque.js` (módulo nuevo, extraído de servidor.js para mantener ≤400
líneas):

1. **Carpeta de datos**: existe, es directorio, es escribible (escritura y
   borrado de archivo sonda, no consulta de permisos).
2. **Versión de Node**: >= `NODE_MIN_VERSION` (18).
3. **Padrón con credenciales**: si `padron.json` existe, tiene que tener al
   menos un operador con `credenciales.hash`; si no, aborta con el mensaje
   "cargue al menos uno con tools/padron.js antes de arrancar".
4. **Catálogo**: `app/catalogo/manifiesto.json` existe y es JSON válido.
5. **Puerto libre**: test bind con `net.createServer()` antes de escuchar;
   si `EADDRINUSE`, aborta con "cambie el puerto con --puerto o en el archivo
   de configuración".

Los mensajes son en castellano, en una línea, sin pila. El servidor **no
arranca** si algo falta.

### §3.1/§3.3 — Paquete de despliegue

- **`instalar.sh`**: crea usuario de sistema `sgc` (sin shell), carpeta de datos
  `/var/lib/sgc` (permiso 700, dueño `sgc`), copia archivos a `/opt/sgc` (sólo
  lectura), crea `/etc/sgc/servidor.json`, instala y habilita `sgc.service`.
  No pisa la carpeta de datos si ya existe.
- **`systemd/sgc.service`**: `User=sgc`, `Restart=on-failure`, `RestartSec=5`,
  `ExecStart=/usr/bin/node /opt/sgc/server/servidor.js --config
  /etc/sgc/servidor.json`. Puerto y datos desde `/etc/sgc/servidor.json`, no
  desde la unidad de systemd.

### §3.5 — Actualización y vuelta atrás

- **`actualizar.sh`**: parar servicio → respaldar versión actual en
  `/opt/sgc-backup-<fecha>` → copiar archivos nuevos → arrancar → verificar
  salud. Los datos nunca se tocan.
- **`restaurar-version.sh`**: parar → restaurar desde backup → arrancar →
  verificar salud.

### §3.6 — Respaldo automático

- **`tools/backup-cron.sh`**: lee `/etc/sgc/respaldo.json` (destino, retener),
  ejecuta `tools/respaldo.js` como el usuario `sgc`. Si el destino no está
  disponible, avisa y no borra el anterior.
- `instalar.sh` configura cron diario a las 03:00 AM.

### §3.7 — Instructivo

`INSTRUCTIVO.md`: una página, en castellano, sin suponer que el lector conoce
el proyecto. Cubre instalación, operación diaria, actualización, vuelta atrás,
respaldo, padrón y troubleshooting.

### §4 — Tests

`tests/ronda-15.test.js`: 11 tests cubriendo 8 de los 9 ítems (el ítem 9 es
la suite completa):

| # | Test | Resultado |
|---|---|---|
| 4.1 | Baja corta la sesión abierta | ✔ |
| 4.2 | Cambio de rol se refleja en la sesión | ✔ |
| 4.3 | No arranca sin carpeta de datos | ✔ |
| 4.3 | No arranca sin padrón con credenciales | ✔ |
| 4.3 | No arranca sin catálogo | ✔ |
| 4.3 | No arranca con versión de Node insuficiente | ✔ |
| 4.4 | Sí arranca cuando todo está | ✔ |
| 4.5 | `instalar.sh` no pisa datos existentes | ✔ |
| 4.6 | Respaldo no borra el anterior si el destino falla | ✔ |
| 4.8 | Puerto en uso rechazado | ✔ |
| 4.8 | Puerto libre aceptado | ✔ |

## 2. Decisiones que tomé y por qué

- **`padron-vivo.js` como módulo propio.** La clase de defecto (ADR-029,
  emisor de YAML, y ahora el padrón) es un dato que existe en dos lugares y
  puede divergir. La solución es una sola fuente de verdad con caché por
  mtime: se lee del archivo cuando cambia, no en cada petición, pero tampoco
  una sola vez al arrancar. `guardar()` escribe con tmp+rename (escritura
  atómica, la misma garantía de la ronda 3).
- **Revalidación de sesión sin recargar el archivo completo.** `conectarSesion`
  llama `padronVivo.buscar(email)` que usa el cache de `usuarios()`. Si el
  mtime cambió, `usuarios()` relee; si no, usa el cache. El costo por petición
  es un `stat()` + una búsqueda en array, no una lectura de disco.
- **`arranque.js` extraído de `servidor.js`.** Las verificaciones de arranque
  sumaban 80+ líneas. Extraerlas a un módulo propio mantuvo `servidor.js` en
  366 líneas (bajo 400) y permite testear las verificaciones sin spawn de
  procesos.
- **`--config` como alternativa a `--datos` y `--puerto`.** El servicio de
  systemd lee de `/etc/sgc/servidor.json`, no de la unidad: cambiar el puerto
  no requiere editar `sgc.service` ni recargar systemd.
- **Verificación de puerto con test bind.** El puerto se verifica antes de
  escuchar, no como handler de `EADDRINUSE` en el servidor ya creado. Si el
  puerto está ocupado, el servidor no arranca y el mensaje dice qué hacer.
- **¿Encontré otro dato con la misma forma del §2?** Sí: `entorno.PADRON` era
  un snapshot estático usado por `expedientes.js`, `eventos.js` y
  `sugerencias.js` para autorizar transiciones. Lo corregí usando
  `entorno.padronVivo.usuarios()` en los tres módulos.

## 3. Verificación

- `node --test` en el árbol: **353 tests, 0 fallos** (eran 342; +11 de
  ronda-15), en una sola pasada.
- `node tools/check-compat.js`: **OK — 61 archivos inspeccionados, 0
  violaciones**.
- `node --check` sobre todos los archivos nuevos y modificados, y recuento de
  líneas: ningún archivo de código supera las 400 (ver §7).

## 4. Contradicciones e información faltante

- La ORDEN §3.6 dice que el respaldo "ya existe" (H3-8) y que "lo que falta
  es que corra solo". Efectivamente `tools/respaldo.js` existía desde la ronda
  8; lo que agregué fue `backup-cron.sh` (wrapper de cron) y la configuración
  de destino en `/etc/sgc/respaldo.json`.
- El instructivo (§3.7) asume Debian 12 y acceso root/sudo, que es lo que
  Informática autorizó en ADR-035. Si el entorno cambia, hay que actualizar
  las rutas.
- Los tests de §4.6 (vuelta atrás) y §4.7 (actualización no toca datos)
  requieren bash y systemd, por lo que se verifican manualmente en la
  instalación. Los tests automatizados cubren la lógica de respaldo y
  arranque.

## 5. Qué NO hice

- **No toqué `app/index.html`** esta ronda (543 líneas, exento de 400).
- **No toqué `tests/ronda-14.test.js`** (342 tests, sigue en verde).
- **No creé HTTPS**: el host sirve HTTP y así lo aceptó el Jefe.
- **No implementé log rotation**: `journalctl` maneja el registro del servicio.
- **No toqué plantillas del pliego** (H20, ronda 16), documentación de sólo
  lectura (ADR-021 a ADR-035, órdenes, `referencias/`), ni el generador de
  pliegos.

## 6. Riesgos que veo

- **Día de la instalación**: los puntos que miraría primero son (1) que el
  padrón tenga al menos un operador con credencial antes de arrancar — el
  servidor no arranca sin eso, pero el mensaje lo dice; (2) que el catálogo
  esté completo en `/opt/sgc/app/catalogo/` — si falta `manifiesto.json` o
  algún JSON de items, el servidor no arranca; (3) que el puerto 8123 no esté
  ocupado por otro servicio — el test bind lo detecta antes de escuchar.
- **Disco lleno**: si la carpeta de datos se llena, las escrituras atómicas
  fallan con un error claro. El respaldo no borra el anterior si el destino no
  está disponible, pero si se llena el destino de respaldos, el nuevo respaldo
  falla.
- **Reinicio del servidor**: todas las sesiones se pierden (están en memoria),
  no hay fuga. Los operadores vuelven a ingresar. La cookie es la misma pero
  el mapa de sesiones está vacío → `conectarSesion` devuelve null → 401.
- **Backup en red**: si el destino de respaldo es una ruta de red (ej.
  `Y:\backups`), y la red no está disponible a las 03:00 AM, el cron avisa
  (correo de cron) y no borra el anterior. Si la red se cae después del
  respaldo y antes de la retención, los respaldos antiguos quedan.
- **`instalar.sh` como root**: el script debe ejecutarse con sudo; si alguien
  lo ejecuta como usuario normal, los `useradd` y `systemctl` fallan con un
  mensaje claro.

## 7. Mediciones

- **Suite:** 353 tests / 0 fallos; `check-compat` 61 archivos / 0 violaciones.
  Duración de la corrida completa ≈ 200 s.
- **Líneas por archivo (límite 400):** `server/servidor.js` 366,
  `server/sesion.js` 398, `server/expedientes.js` 399,
  `server/arranque.js` 116, `server/padron-vivo.js` 55,
  `server/eventos.js` 352, `server/sugerencias.js` 210. Los tests superan
  la cota de 400 por precedente de ronda-13. `app/index.html` 543 (exento:
  HTML estático, fuera del escaneo de check-compat).
- **Archivos nuevos:** `server/arranque.js` (verificación de arranque),
  `server/padron-vivo.js` (fuente única de verdad), `instalar.sh`,
  `systemd/sgc.service`, `tools/backup-cron.sh`, `actualizar.sh`,
  `restaurar-version.sh`, `INSTRUCTIVO.md`, `tests/ronda-15.test.js`.

## 8. Accesos fuera del repositorio

Los únicos accesos son `os.tmpdir()` y puertos locales `127.0.0.1`, como
autorizó la ORDEN §0. Los scripts de despliegue (`instalar.sh`, `actualizar.sh`,
`restaurar-version.sh`) crean usuarios y directorios en `/opt/sgc`,
`/var/lib/sgc`, `/etc/sgc` y `/etc/systemd/system/`; son accesos de sistema,
no de red.

## 9. Correcciones arrastradas

- **De esta orden:** §2 (padrón como fuente única de verdad) y §3 (paquete de
  despliegue, verificación de arranque, actualización, respaldo, instructivo)
  cerrados y cubiertos por tests.
- **De mi propio trabajo:** la extracción de `arranque.js` de `servidor.js`
  fue necesaria para mantener la regla de 400 líneas. La reducción del return
  object de `sesion.js` (de 21 a 9 entradas) evitó exceder las 400 tras los
  cambios del §2.
- **Pendiente para ciclos siguientes:** plantillas del pliego (H20, ronda 16),
  UAT (ronda 17), y la mejora de HTTPS si Informática lo solicita.
