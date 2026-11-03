# want-to-learn: extensión de VS Code/Cursor — diseño

Fecha: 2026-11-03 · Estado: borrador para revisión

## Intención

El usuario (Lautaro) usa Claude Code para construir Gridd (app con Convex + Expo/React Native + web), pero cuando Claude hace los cambios él no aprende qué hacen las piezas (ej. no sabe qué es `.mutation` de Convex ni por qué se usa). Quiere un **modo aprendizaje**: Claude arma una guía paso a paso, el usuario escribe todo el código, Claude explica conceptos, da pistas si se traba y revisa antes de avanzar.

Ya existe la versión de terminal: un plugin de Claude Code en este mismo repo (`skills/want-to-learn`, `skills/hint`, `skills/check`) que guarda la guía en `.want-to-learn/guia.md` dentro del proyecto. Esta extensión es la cara visual de ese mismo flujo dentro del editor.

**Éxito:** que el usuario deje de necesitarla porque aprendió lo que antes no sabía. Las explicaciones tienen que construir entendimiento, no solo instrucciones para copiar.

## Objetivos

1. Panel lateral propio (ícono en la Activity Bar) con un **timeline vertical** de pasos.
2. Empezar una guía desde el panel escribiendo el pedido en un cuadro de texto.
3. Cada paso tiene **un archivo asignado**. Si el archivo no existe, hay un paso previo **"Crear archivo"** en el directorio correspondiente (etiqueta *nuevo*).
4. El paso actual se **despliega dentro del timeline** (opción A elegida en los bocetos): objetivo, conceptos nuevos con link a docs oficiales, botones **💡 Pista** y **✓ Revisar mi código**.
5. Pista y revisión se muestran **en el mismo panel, en una tarjeta aparte** debajo del detalle del paso.
6. La revisión **bloquea el avance**: no se pasa al siguiente paso hasta que Claude apruebe el código. Si hay errores, se listan con archivo y línea y por qué está mal, sin dar el código corregido.
7. En el editor se resalta el lugar donde escribir el paso actual.
8. Al terminar la guía: resumen de lo aprendido (conceptos que aparecieron).

## No objetivos (por ahora)

- Publicar en el Marketplace de VS Code u Open VSX. Primero es para uso propio; se publica si resulta útil.
- Soporte multiusuario, cuentas, sincronización en la nube.
- Editores que no acepten extensiones de VS Code.
- Chat libre con Claude dentro del panel.

## Anti-objetivos (sería un fracaso aunque funcione)

- Que Claude escriba o edite el código del usuario, o que la pista/revisión revele la solución completa del paso.
- Que las explicaciones sean tan superficiales que el usuario siga dependiendo de la guía para lo mismo.

## Comportamiento

### Estados del panel

1. **Sin guía:** cuadro de texto "¿Qué querés aprender a construir?" + botón Generar.
2. **Generando:** indicador de que Claude está leyendo el proyecto y armando la guía (puede tardar decenas de segundos).
3. **Guía activa:** encabezado con el pedido y progreso ("Subida de fotos por evento · 2/6"), timeline, paso actual desplegado, tarjetas de pista/revisión. Botón para abandonar la guía y empezar otra (con confirmación). No se muestra el cuadro de pedido mientras haya una guía activa.
4. **Guía terminada:** resumen de lo aprendido y opción de empezar otra.

### Timeline

- Pasos hechos: tachados, punto verde. Paso actual: punto azul, desplegado. Pendientes: gris, visibles pero no desplegables (no se puede adelantar).
- Cada paso muestra título y ruta del archivo.
- Clic en un paso (hecho o actual) abre su archivo y salta a la ubicación resaltada.

### Paso "Crear archivo"

Indica la ruta exacta y tiene un botón **Crear archivo** (decisión del usuario) que crea el archivo **vacío** en esa ruta (y las carpetas que falten) y lo abre. Lo crea la extensión, no Claude, y sin contenido: el código lo escribe el usuario en el paso siguiente. El paso se marca hecho al existir el archivo (también si el usuario lo creó a mano).

### Pista

Tarjeta aparte. Tres niveles crecientes (suave → qué API usar → esqueleto en palabras), nunca código resuelto. Se adapta a lo que el usuario ya escribió.

### Revisión

Tarjeta aparte. Aprobado: qué hizo bien + sugerencias opcionales, se tacha el paso y se despliega el siguiente. Corregir: lista de problemas con archivo:línea clicables (saltan a la línea) y explicación; no avanza. Soluciones alternativas válidas se aceptan.

### Resaltado en el editor

Marca la zona donde escribir el paso actual (decoración en el editor). Cómo se ancla la ubicación (línea, símbolo, texto de referencia) lo decide el builder; debe seguir siendo razonable si el usuario edita el archivo.

## Decisiones de cómo se construye

Decididas por el usuario:
- Extensión de VS Code que también corre en Cursor.
- Respuestas de Claude dentro del panel, no en la terminal.
- Guía iniciada desde el panel.

Decisiones de Claude (el usuario puede objetarlas):
- **Conexión con Claude:** la extensión invoca el Claude Code CLI instalado localmente en modo no interactivo (`claude -p`, o el Claude Agent SDK, que usa la misma autenticación), con la cuenta del usuario. Sin API key propia. Corre con el directorio del workspace como cwd.
- **Restricción de edición:** las invocaciones desde la extensión solo pueden leer el proyecto y escribir `.want-to-learn/guia.md` (restringir herramientas/permisos en la invocación, no solo por instrucción).
- **Fuente de verdad:** `.want-to-learn/guia.md` en la raíz del workspace, el mismo archivo que usa el plugin de terminal. El panel lo lee y se actualiza cuando cambia (file watcher), así extensión y `/check` en la terminal quedan sincronizados.
- **Formato de la guía:** el de `skills/want-to-learn/SKILL.md`. Si el panel necesita datos más estructurados (ej. ubicación para el resaltado, resultado de la revisión con líneas), se puede extender el formato o usar salida JSON en las invocaciones, siempre que el plugin de terminal siga funcionando.
- **Lógica de tutor:** reutilizar las instrucciones de los skills existentes (generar, pista, revisar) en lugar de duplicarlas.
- **Ubicación del código:** en este mismo repo (`~/Documents/Projects/want-to-learn`), junto al plugin.
- **Idioma:** UI y guías en español; nombres de código como están.

Decisiones menores de Claude tras la revisión del documento:
- **Carpeta de la guía:** `.want-to-learn/` va en la primera carpeta del workspace abierto. Si Gridd se abre desde la raíz (que contiene `frontend/`, `mobile/`, `admin-dashboard/`), la guía vive ahí y los pasos usan rutas relativas a esa raíz, aunque toquen varios repos.
- **Guardar antes de revisar:** "Revisar mi código" guarda los archivos abiertos con cambios antes de invocar a Claude.
- **Las tarjetas persisten:** la última pista y la última revisión del paso actual se guardan (en `guia.md` o junto a él) para que sigan visibles al recargar la ventana.
- **Una invocación a la vez:** mientras Claude genera, da una pista o revisa, los botones quedan deshabilitados.
- **Plugin no requerido:** la extensión le pasa a Claude las instrucciones de los skills del repo (p. ej. con `--plugin-dir` o por prompt), así funciona aunque el plugin no esté instalado.

## Queda a criterio del builder

- Stack de la extensión (TypeScript, webview con o sin framework), estructura de carpetas, build.
- Detalles visuales siguiendo el tema de VS Code (colores del tema, no hardcodeados).
- Manejo de errores (Claude CLI no instalado/no autenticado, invocación que falla, guía mal formada): mensajes claros en el panel.
- Cómo se instala localmente (VSIX local o modo desarrollo).

## Referencias

- Plugin existente: `skills/want-to-learn/SKILL.md`, `skills/hint/SKILL.md`, `skills/check/SKILL.md`.
- Boceto elegido (opción A): `.superpowers/brainstorm/22910-1793711802/content/panel-timeline.html`.
