SYSTEM LAB POS — FRONTEND INTEGRADO PARA PRUEBAS
Base revisada: main 04714a03f248b79cb4c4b56aa65d491660b5bb0f.

PRIMERO desplegar el ZIP backend y esperar a que Render termine su migración.

1. Guardar system-lab-pos-frontend-full.zip en la carpeta del repositorio system-lab-pos-frontend.
2. Abrir la terminal PowerShell en esa carpeta:

Expand-Archive ".\system-lab-pos-frontend-full.zip" "." -Force
npm run build
if ($LASTEXITCODE -ne 0) { throw "La compilación falló; no publicar." }
git add src/app/app.routes.ts src/app/pages/landing/landing.html src/app/pages/pos-hub vercel.json README-POS-FRONTEND.txt
git commit -m "Habilita POS publico y operacion privada por negocio"
git push origin main

3. Esperar a que Vercel termine el despliegue.
4. Abrir https://systemlabcr.com/pos/restaurante
   Correo: jgartavia@gmail.com
   Contraseña: la solicitada en esta conversación (se configura desde la migración del backend).
5. Entrar a "Restaurante de prueba · System Lab".

PRIMER RECORRIDO
- Caja: abrir con un fondo de 5000.
- Resumen: seleccionar Mesa 1.
- Elegir 1 Café demo (precio de ejemplo 1000 antes de impuesto, 13%).
- Guardar pedido; en Pedidos, enviar a cocina.
- Cocina: Preparar y luego Marcar listo.
- Pedidos: Cobrar; efectivo recibido 2000. Total esperado 1130, vuelto 870.
- Abrir/Imprimir comprobante interno.
- Reportes: consultar hoy. Venta 1130, un ticket; inventario del Café demo pasa de 20 a 19.
- Caja: contar 6130 y cerrar; diferencia esperada cero si no hubo otros movimientos.
- Mi cuenta: cambiar contraseña.

ADMINISTRACIÓN CEO
El botón "Administración CEO" está en la barra superior cuando se inicia sesión con la cuenta CEO.
Crear negocio -> elegir modalidad -> crear cuenta o editar una existente -> marcar negocios autorizados.
Para habilitar heladería a la misma cuenta de prueba, crear el negocio de heladería y marcarlo en el acceso de jgartavia@gmail.com.
Al guardar permisos se cierran las sesiones anteriores de esa cuenta; volver a ingresar.
También permite suspender/reactivar cuentas o negocios y restablecer contraseñas.
No hay registro público. Cada cliente solo ve los negocios asignados a su cuenta.

PANTALLAS
Resumen, nueva venta, pedidos, cocina (restaurante/heladería), productos, inventario, clientes, caja, reportes, agenda y cuenta.
El navbar de la landing tiene POS y la tarjeta deja de decir Próximamente. El selector ofrece las cinco modalidades.
/pos-internal redirige al selector. vercel.json mantiene el acceso directo a /pos y sus subrutas.
Referencia de configuración: https://vercel.com/docs/routing/rewrites

ESTADO Y LÍMITES
Frontend Angular compilado correctamente. Queda una advertencia no bloqueante del presupuesto inicial de 500 kB; el módulo POS se carga por separado.
Flujo de restaurante y pantallas CEO probados en Chromium con backend local real. Vista móvil de 390 px verificada.
No se publicó desde esta sesión. La validación final en Render/Vercel se hace después de tus pushes.
Esta entrega conecta el núcleo común de las cinco modalidades; no equivale a tener todas las especializaciones de cada industria terminadas.
No incluye facturación electrónica, cobro bancario automático, offline, recetas/ingredientes, pagos divididos, citas por empleado ni módulos avanzados de taller. Ver README-POS-BACKEND.txt para alcance técnico completo.
El comprobante es interno y los pagos con tarjeta/SINPE se registran luego de confirmarlos externamente.

El ZIP contiene los archivos completos que se agregan/reemplazan; conserva las demás carpetas del repositorio.
