# want-to-learn

Plugin de Claude Code para aprender mientras construís. En lugar de hacer los cambios, Claude arma una guía paso a paso y vos escribís el código.

## Comandos

| Comando | Qué hace |
|---|---|
| `/want-to-learn <pedido>` | Lee el proyecto, arma la guía y te muestra el paso 1 (archivo, dónde, objetivo, conceptos nuevos con link a docs). |
| `/hint` | Pista del paso actual. Cada vez que lo pedís es un poco más concreta (3 niveles). Nunca da la solución. |
| `/check` | Revisa tu código. Si está bien, avanza al siguiente paso; si no, te explica qué corregir sin reescribirlo. |

Si choca con otro comando del mismo nombre, usá la forma con prefijo: `/want-to-learn:hint`, `/want-to-learn:check`.

El progreso se guarda en `.want-to-learn/guia.json` dentro del proyecto donde corrés Claude, así podés retomar en otra sesión. La extensión de VS Code usa el mismo archivo.

## Instalación local

```bash
claude plugin marketplace add ~/Documents/Projects/want-to-learn
claude plugin install want-to-learn@want-to-learn-local
```

Después de editar los skills: `claude plugin marketplace update want-to-learn-local` y reiniciá la sesión.

## Extensión de VS Code / Cursor

Panel lateral "Want to learn" (ícono del birrete en la barra lateral): escribís el pedido, Claude arma la guía y ves los pasos como un timeline. El paso actual muestra dónde escribir, el objetivo y los conceptos nuevos, con botones **💡 Pista**, **✓ Revisar mi código** y **📄 Crear archivo**. En el editor se resalta la línea donde escribir.

La extensión usa tu Claude Code instalado (`claude -p`, tu misma cuenta) con herramientas de solo lectura: Claude nunca edita tu código, solo la extensión escribe `guia.json`.

```bash
cd extension
npm install
npm test               # tests
npm run package        # genera want-to-learn-<versión>.vsix
code --install-extension want-to-learn-0.1.0.vsix --force
cursor --install-extension want-to-learn-0.1.0.vsix --force
```

Settings: `wantToLearn.claudePath` (default `claude`), `wantToLearn.model` (vacío = default del CLI), `wantToLearn.timeoutSeconds` (default 300).

La guía va en la primera carpeta del workspace. Agregá `.want-to-learn/` al `.gitignore` del proyecto.

## Próximo

- Si Claude se saltea la regla de no editar código en la terminal, agregar un hook `PreToolUse` que bloquee Edit/Write fuera de `.want-to-learn/` mientras haya una guía activa.
