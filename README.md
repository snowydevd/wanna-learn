# want-to-learn

Plugin de Claude Code para aprender mientras construís. En lugar de hacer los cambios, Claude arma una guía paso a paso y vos escribís el código.

## Comandos

| Comando | Qué hace |
|---|---|
| `/want-to-learn <pedido>` | Lee el proyecto, arma la guía y te muestra el paso 1 (archivo, dónde, objetivo, conceptos nuevos con link a docs). |
| `/hint` | Pista del paso actual. Cada vez que lo pedís es un poco más concreta (3 niveles). Nunca da la solución. |
| `/check` | Revisa tu código. Si está bien, avanza al siguiente paso; si no, te explica qué corregir sin reescribirlo. |

Si choca con otro comando del mismo nombre, usá la forma con prefijo: `/want-to-learn:hint`, `/want-to-learn:check`.

El progreso se guarda en `.want-to-learn/guia.md` dentro del proyecto donde corrés Claude, así podés retomar en otra sesión.

## Instalación local

```bash
claude plugin marketplace add ~/Documents/Projects/want-to-learn
claude plugin install want-to-learn@want-to-learn-local
```

Después de editar los skills: `claude plugin marketplace update want-to-learn-local` y reiniciá la sesión.

## Próximo

- Extensión de VS Code/Cursor con panel: paso actual, botón de pista y "revisar mi código", resaltado de dónde escribir. Leería `.want-to-learn/guia.md`.
- Si Claude se saltea la regla de no editar código, agregar un hook `PreToolUse` que bloquee Edit/Write fuera de `.want-to-learn/` mientras haya una guía activa.
