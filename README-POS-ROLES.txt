SYSTEM LAB POS — EQUIPO Y OPERACIÓN MÓVIL
Actualización 7 septiembre 2026. Aplicar después del backend de equipos.
Reemplaza los tres archivos completos de pos-hub. Conserva landing, rutas y otras secciones del sitio.

PowerShell dentro de system-lab-pos-frontend:
Expand-Archive ".\system-lab-pos-frontend-equipos.zip" "." -Force
npm run build
Si la compilación termina correctamente:
git add src/app/pages/pos-hub/pos-hub.ts src/app/pages/pos-hub/pos-hub.html src/app/pages/pos-hub/pos-hub.scss README-POS-ROLES.txt
git commit -m "Integra equipos y comandas moviles con autorizacion de precios"
git push origin main

ACCESO
https://systemlabcr.com/pos/restaurante
La cuenta jgartavia@gmail.com conserva su contraseña. Tiene Panel System Lab y rol Dueño en su restaurante de prueba.
Panel System Lab es exclusivo del proveedor. Los dueños reciben su propia cuenta y no ven ese botón.
Desde Panel System Lab se crean locales; una cuenta de dueño puede tener dos o más restaurantes. Desde cada local -> Mi equipo, el dueño crea sus empleados.
Cambiar local abre el selector de la modalidad actual. Modalidades permite ir a otra modalidad con la misma sesión.

PRIMERA PRUEBA
1. Mi cuenta -> configurar código personal de 6-12 dígitos. No viene un código compartido predeterminado.
2. Mi equipo -> crear empleado como Salonero y activar Permitir cobros.
3. Caja -> abrir con 5000 (si la caja ya está abierta, continuar).
4. Desde el celular o una ventana privada, entrar con la cuenta del salonero.
5. Elegir mesa; agregar Café demo. Si conserva el precio demo original, proponer 900 e indicar motivo.
6. El dueño ingresa su correo y código. Guardar y enviar a cocina.
7. Ver comanda; Cobrar con 2000. Con precio 900 e impuesto 13%, total 1017, vuelto 983.
8. Cocina debe conservar el pedido pagado. Preparar -> Marcar listo -> Marcar entregado.
9. Dueño -> Autorizaciones: verificar solicitante y responsable. Caja: 6017 esperado si fue el único movimiento desde apertura con 5000.
Los movimientos de esta prueba se guardan como operaciones del restaurante de prueba. No ejecutarlos en un negocio con operaciones reales.

MÓVIL
Menú desplegable, nombre del local y botón Cambiar local visibles; entradas de 16px y botones táctiles; acceso al pedido desde catálogo, formularios adaptados y comanda imprimible.
Probado con Chromium y backend real local. Validaciones de servidor también se aplican a llamadas directas fuera del navegador.
Imprimir usa el diálogo del dispositivo: una impresora física requiere configuración compatible. No hay impresión silenciosa ni integración Bluetooth/ESC-POS en este paquete.
Requiere conexión a internet. Cocina se actualiza cada 5 segundos mientras está abierta. Recargar las pestañas luego de publicar.
Compilación aprobada; advertencia no bloqueante del bundle inicial existente: aproximadamente 543 kB frente al presupuesto de 500 kB.

Ambos ZIPs son archivos completos de actualización para los repositorios existentes, no repositorios nuevos ni reemplazos de la base de datos.
