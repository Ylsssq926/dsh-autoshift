![Model Autoshift](docs/banner.png)

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Ylsssq926/dsh-autoshift/actions/workflows/ci.yml/badge.svg)](https://github.com/Ylsssq926/dsh-autoshift/actions/workflows/ci.yml)
[![Node ≥ 22](https://img.shields.io/badge/node-%3E%3D22-339933.svg?logo=node.js&logoColor=white)](package.json)
[![DSH 0.2.2-rc.1](https://img.shields.io/badge/DSH-0.2.2--rc.1-6d5ce7.svg)](https://github.com/Ylsssq926/dsh-autoshift)
[![i18n: 8 languages](https://img.shields.io/badge/i18n-8%20languages-2db7a3.svg)](README.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-6d5ce7.svg)](CONTRIBUTING.md)

# Model Autoshift (模型自动挡)

> ¿Sigues eligiendo modelos en manual? Pasa a automático.

¿Acumulaste un montón de modelos de relais y todavía eliges uno a mano para cada tarea? Model Autoshift añade una marcha **Auto** al selector de modelos de DSH: suelta una tarea y elige el mejor modelo entre los que ya configuraste — los modelos económicos para las tareas menores, los flagship para los huesos duros. Una ruta fijada para toda la sesión, sin deriva tras un reinicio, cero llamadas adicionales al modelo.

Tú traes la tarea. Auto elige el modelo.

[中文](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · **Español** · [Deutsch](README.de.md) · [Русский](README.ru.md)

![Resumen de uso](docs/flow.en.png)

## Por qué Auto

- **Cero configuración**: instala, elige Auto, listo. Sin pool que llenar, sin YAML. Cada modelo que configuraste en DSH — oficial o relay — se reconoce, incluidos los ID desconocidos.
- **Cambia de marcha según la tarea**: ingeniería, creativo, redacción, investigación, arquitectura y charla cotidiana — seis tipos de tarea emparejados automáticamente, modelos económicos para lo menor, flagships para lo difícil.
- **Una sesión, una ruta**: el primer modelo elegido queda fijado para toda la sesión. La compactación del contexto y los reinicios del escritorio recuperan la ruta en lugar de reelegirla, manteniendo estables el contexto y la caché del proveedor.
- **Cero llamadas extra**: cada solicitud se reenvía a un solo modelo — sin «modelo enrutador» que queme una segunda llamada, sin votación, sin precalentamiento, sin reintentos por defecto. El usage pasa intacto; la factura sigue igual.
- **Cada turno de un vistazo**: una línea de recibo al final de cada respuesta — `Auto · model · tier · role` — muestra quién corrió, qué nivel y si se usó un respaldo.

## Para quién

- **Usuarios intensivos de relay**: decenas o cientos de modelos, sin cambio manual por tarea;
- **Usuarios multiproveedor**: DeepSeek, OpenAI, Gemini, Claude mezclados, despachados por tarea;
- **Principiantes**: sáltate la investigación de modelos, elige Auto, empieza.

## Instalación

```bash
dsh plugin --profile web add -w link:/path/to/model-aware-auto-plugin
```

Reinicia DSH y activa el plugin. Las sesiones nuevas muestran **Model Autoshift → Auto** en el selector de modelos. Usa `--profile desktop` para la app de escritorio.

## Inicio rápido

1. Configura al menos un modelo de texto en los ajustes de DSH (oficial o relay);
2. Sesión nueva, elige **Auto**;
3. Asigna la tarea.

Eso es todo.

<img src="docs/entry.en.png" alt="Punto de entrada: el modo Auto en el selector de modelos" width="440">

## Tres modos

| Modo | Comportamiento |
|---|---|
| `economy` | Lo menor va a modelos económicos; el costo pesa más |
| `balanced` (predeterminado) | Primero el ajuste a la tarea, se considera el costo |
| `quality` | Solo el ajuste a la tarea, se ignora el costo |

```yaml
mode: economy
```

## Tareas de ejemplo

| Rol | Lo que sueltas |
|---|---|
| Ingeniería | Arreglar un stack trace, refactorizar una función, escribir un script, desplegar una API, correr tests |
| Creativo | Escribir un poema, inventar una historia, roleplay, redactar un copy |
| Redacción | Pulir un correo, resumir un artículo, traducir, escribir un informe semanal |
| Investigación | Revisar la literatura, comparar opciones, correr un benchmark |
| Arquitectura | Diseño de sistemas, selección de tecnología, dividir microservicios |
| Cotidiano | Charla, preguntas y respuestas, tareas varias |

Sea cual sea el rol que lee la tarea, Auto elige un modelo para ese rol de tu pool — lo menor en economy, los huesos duros en flagship.

## Modelos relay reconocidos sin configuración

Los pools relay están llenos de ID desconocidos. Auto los clasifica por nombre y despacha:

- **Economy**: `mini / flash / lite / haiku / free / turbo`, más modelos open-weight pequeños como `7b / 8b`;
- **Flagship**: `pro / opus / ultra / max`, más modelos de razonamiento como `r1 / o3 / reasoner / thinking`;
- **Inclinación ingeniería**: `coder / code / dev`, familia deepseek / claude; **inclinación creativa**: familia gemini.

Una variante económica de una familia flagship (`pro-flash`) sigue contando como economy. El reenvío siempre usa el ID exacto del catálogo. Para afinar costo o roles, sobrescribe con `economics` en `preferences` / `routes`.

## Fijado para la sesión, sin deriva al reiniciar

La primera ruta exitosa vincula toda la sesión. Tras una compactación del contexto o un reinicio del escritorio, el vínculo se recupera de los eventos de sesión, nunca se reelige; el contexto nunca se mezcla entre modelos, y el prefijo estable es amigo de la caché del proveedor. Si el modelo fijado se desmonta, Auto te indica el siguiente paso en lugar de cambiar de modelo en silencio a media conversación.

## Recibo de ruta

Una línea pequeña al final de cada turno: `Auto · model · tier · role`, más `fallback×N` cuando se usó un respaldo. Lee los metadatos de ruta que ya están en la sesión — cero solicitudes extra; los turnos que no son Auto no muestran nada.

## Reparto de subagentes (opcional)

Cuando la herramienta subagent nativa de DSH activa la selección de modelo y la sesión tiene una política de hijos, Auto hace un emparejamiento de rol local más un breve traspaso para las subtareas **sin modelo explícito**. Los modelos subagent elegidos explícitamente siempre ganan; el inicio, la cancelación, los permisos y el reciclaje siguen siendo nativos de DSH.

## Permisos y datos

Auto solo lee tus catálogos de modelos montados y los eventos de la sesión actual, y solo reenvía a los proveedores que configuraste. Nunca toca archivos del espacio de trabajo ni sube telemetría; toda la configuración queda local.

## Configuración (todo opcional)

### Preferencias ligeras

```yaml
preferences:
  - provider: your-provider-id
    model: exact-model-id
    roles: [engineering]
```

Las preferencias solo ajustan el orden; los demás modelos montados siguen participando.

### Control de alcance

```yaml
scope:
  providers: [provider-a, provider-b]   # lista de permitidos, vacío = todo
  excludeProviders: [provider-c]
  excludeModels: [some-model]
```

### Perfiles avanzados

Una lista `routes` completa reemplaza el descubrimiento automático para flujos de equipo fijos o ajuste a largo plazo: `roles`, `tools`, `behavior`, `dimensions`, `economics`, `contextWindow`, `maxOutputTokens`, `routeRevision`. Usa los ID reales de provider/model de DSH; sin claves API en la configuración.

## Conviene saber

- Solo tareas de texto; las modalidades de imagen están fuera del catálogo de Auto;
- Las sesiones viejas iniciadas con otro modelo no pueden cambiar a Auto a mitad — inicia una sesión nueva;
- Las solicitudes auxiliares (títulos, resúmenes) siguen la ruta fijada de la sesión.

## Compatibilidad

DSH `0.2.2-rc.1` · Node.js 22+.

## Arquitectura

![Architecture](docs/architecture.png)

## Desarrollo

```bash
node --test
```