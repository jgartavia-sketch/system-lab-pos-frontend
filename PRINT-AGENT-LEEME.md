# System Lab Print Agent 1.0

Este paquete sustituye la impresión automática basada en `window.print()` por un agente local ESC/POS. El pedido se guarda primero en el backend y después se envía a la impresora de cocina; una falla de impresión nunca elimina ni revierte el pedido.

## Instalación en la computadora del restaurante

1. Desde el POS, abrir **Mi cuenta → Preparar esta computadora** y pulsar **Descargar agente para Windows**.
2. Extraer el ZIP descargado y ejecutar `INSTALAR-PRINT-AGENT.bat`.
3. En el panel que se abre, seleccionar la impresora térmica instalada en Windows o indicar la IP si es una impresora de red.
4. Seleccionar 80 mm o 58 mm, guardar y pulsar **Imprimir prueba**.
5. Pulsar **Mostrar y copiar** en la clave de vinculación.
6. Ingresar al POS y abrir **Mi cuenta → Estación de impresión**.
7. Pegar la clave y pulsar **Guardar y probar conexión**.
8. Si Chrome solicita permiso para acceder a dispositivos o servicios de la red local, elegir **Permitir**. Es una autorización única del navegador para que el POS pueda comunicarse con el agente instalado en esa computadora.

Desde ese momento, **Guardar y enviar a cocina** imprime directamente y no abre la ventana de Chrome.

## Requisitos

- Windows 10 u 11.
- El instalador prepara automáticamente el componente de ejecución mediante Windows Package Manager cuando sea necesario.
- Impresora térmica compatible con comandos ESC/POS.
- Para USB: la impresora debe aparecer en **Configuración → Impresoras y escáneres** de Windows.
- Para red: la impresora debe aceptar conexiones RAW/TCP, normalmente en el puerto 9100.

## Seguridad y operación

- El servicio escucha únicamente en `127.0.0.1`; no queda expuesto a la red del restaurante.
- Solo acepta trabajos desde los orígenes autorizados y con la clave local.
- Los trabajos se imprimen de uno en uno y se conserva el historial de los últimos 500.
- El mismo envío automático no se imprime dos veces durante 24 horas.
- La reimpresión manual crea deliberadamente un trabajo nuevo.
- Si el agente está apagado o la impresora falla, el POS conserva la comanda y abre su vista para permitir la impresión manual.

## Desarrollo y verificación

Desde la raíz del frontend:

```powershell
npm install
npm run build
cd system-lab-print-agent
npm test
node server.js
```

Panel local: `http://127.0.0.1:18181`

## Desinstalación

Ejecutar en PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\system-lab-print-agent\scripts\uninstall.ps1
```

La desinstalación detiene el agente y lo retira del inicio automático. Conserva la configuración local para evitar borrar accidentalmente la clave y la selección de impresora.
