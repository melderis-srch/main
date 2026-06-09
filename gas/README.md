# Surcherie - Instrucciones para deployar Google Apps Script

## 1. Crear el proyecto en Google Apps Script

1. Ir a [script.google.com](https://script.google.com)
2. Hacer clic en **"Nuevo proyecto"**
3. Renombrar el proyecto a **"Surcherie Backend"** (clic en "Proyecto sin título" arriba)

## 2. Pegar el código

1. Borrar todo el contenido del editor (el `function myFunction() {}` por defecto)
2. Copiar todo el contenido de `gas/Code.gs` de este repositorio
3. Pegarlo en el editor
4. Guardar con **Ctrl+S** (o Cmd+S en Mac)

## 3. Configurar los IDs de los Sheets

Los IDs ya están en el código. Verificar que corresponden a tus Sheets:

```javascript
var CIRUCIAS_SHEET_ID = '1ZMNbsQRzzJScaIP2JB7tJmy8cEafVqHuCDgZGOiFq-M';
var FINANCIERO_SHEET_ID = '1Qy7ylSFMy8-zOCMuGS7B6JUQ8K2BisuDX1WFB5bO-9E';
```

## 4. Deployar como Web App

1. En el menú superior, hacer clic en **"Implementar"** → **"Nueva implementación"**
2. Hacer clic en el engranaje ⚙️ junto a "Seleccionar tipo" → elegir **"Aplicación web"**
3. Configurar:
   - **Descripción:** `Surcherie API v1`
   - **Ejecutar como:** `Yo (tu-email@gmail.com)`
   - **Quién tiene acceso:** `Cualquier persona` (Anyone)
4. Hacer clic en **"Implementar"**
5. Autorizar los permisos cuando aparezca el popup de Google
6. **Copiar la URL** que aparece (termina en `/exec`)

La URL tiene este formato:
```
https://script.google.com/macros/s/AKfycby.../exec
```

## 5. Configurar la variable de entorno en el proyecto React

1. En la raíz del proyecto React, editar (o crear) el archivo `.env`:

```
VITE_GAS_URL=https://script.google.com/macros/s/TU_SCRIPT_ID/exec
```

Reemplazar `TU_SCRIPT_ID` con el ID real de tu deployment.

2. Para desarrollo local: copiar `.env.example` a `.env` y completar la URL.

3. Para Vercel: ir a Settings → Environment Variables y agregar `VITE_GAS_URL` con la URL.

## 6. Cómo hacer redeploy cuando se modifica el script

Cada vez que modifiques `Code.gs`:

1. Guardar los cambios en el editor de Apps Script
2. Ir a **"Implementar"** → **"Administrar implementaciones"**
3. En la implementación existente, hacer clic en el lápiz ✏️ (editar)
4. En "Versión", seleccionar **"Nueva versión"**
5. Hacer clic en **"Implementar"**

> ⚠️ IMPORTANTE: La URL del `/exec` NO cambia al hacer redeploy. Solo cambia si creas una nueva implementación desde cero.

## 7. Probar que funciona

Abrir en el navegador:
```
https://script.google.com/macros/s/TU_SCRIPT_ID/exec?action=getCirugias
```

Debe retornar un JSON con `{ "success": true, "data": [...] }`.

## Troubleshooting

- **Error 401 / permisos**: Verificar que el acceso esté en "Cualquier persona" (no "Cualquier persona con cuenta Google")
- **Array vacío**: Verificar que los nombres de las hojas coincidan exactamente: `Cirugías`, `Consolidado`, `VENTASCOBROS`, `GASTOSPAGOS`
- **Error de CORS en el navegador**: Asegurarse de usar la URL que termina en `/exec` (no `/dev`)
- **Fechas incorrectas**: El script usa la zona horaria del proyecto. Ir a Configuración del proyecto → zona horaria → seleccionar `America/Argentina/Buenos_Aires`
