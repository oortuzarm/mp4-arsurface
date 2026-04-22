# AR Video Surface Builder — Lookiar
## Instrucciones de uso, desarrollo y deployment

---

## Estructura de archivos

```
mp4-arsurface/
├── index.html          ← Herramienta principal (interfaz)
├── style.css           ← Estilos de la herramienta
├── app.js              ← Controlador principal (ES module)
├── src/
│   ├── ui.js           ← Helpers de UI y DOM
│   └── exporter.js     ← Generador de HTML AR y ZIP
├── vercel.json         ← Configuración de headers para Vercel
└── INSTRUCCIONES.md    ← Este archivo
```

---

## Correr localmente

**Requisito:** necesitas un servidor HTTP local (no funciona abriendo index.html
directamente con `file://` porque los módulos ES y la cámara requieren un servidor).

### Opción A: Live Server (VS Code)
1. Instala la extensión "Live Server" en VS Code
2. Click derecho en `index.html` → "Open with Live Server"
3. Abre `http://localhost:5500`

### Opción B: npx serve
```bash
npx serve .
```
Abre `http://localhost:3000`

### Opción C: Python
```bash
python -m http.server 8080
```
Abre `http://localhost:8080`

---

## Deploy en Vercel

```bash
# 1. Instalar Vercel CLI (si no lo tienes)
npm i -g vercel

# 2. Desde la carpeta del proyecto
cd mp4-arsurface
vercel

# 3. Seguir las instrucciones del CLI
# 4. Tu URL pública será algo como: https://ar-video-surface-builder.vercel.app
```

El archivo `vercel.json` incluye los headers necesarios para que:
- La cámara funcione (Permissions-Policy)
- WebXR funcione en contextos seguros

**Importante:** WebXR solo funciona en HTTPS. Vercel despliega con HTTPS automáticamente.

---

## Compatibilidad WebXR

| Navegador           | Soporte    | Notas                          |
|---------------------|------------|--------------------------------|
| Chrome Android 81+  | ✅ Completo | Recomendado                    |
| Samsung Internet 11+| ✅ Completo | Alternativa en Android         |
| Firefox Android     | ⚠️ Parcial  | Sin hit-test                   |
| Safari iOS 16+      | ❌ Sin XR   | Muestra fallback automático    |
| Chrome Desktop      | ⚠️ Limitado | Sin cámara AR real             |

---

## Cómo funciona la demo AR

1. El usuario carga su `.mp4` en la herramienta
2. Configura aspectos, tamaño y reproducción
3. Hace clic en "Generar experiencia"
4. La herramienta genera un `index.html` autocontenido usando Three.js + WebXR
5. El video se referencia como Blob URL (vista previa) o `assets/video.mp4` (ZIP)
6. El demo AR usa `hit-test` para detectar superficies planas
7. Al tocar la pantalla, se coloca un plano Three.js con el video como textura

---

## Notas técnicas

- Sin backend: todo el procesamiento es local en el navegador
- JSZip se carga desde CDN para la exportación del ZIP
- Three.js se carga desde CDN dentro del HTML generado
- El video en el ZIP se incluye como archivo binario separado
- La captura del primer frame (poster) usa un `<canvas>` temporal
- El fallback para dispositivos sin WebXR muestra el video centrado con estilo pseudo-AR

---

© 2025 Lookiar · tools.lookiar.com/ar-video-surface-builder
