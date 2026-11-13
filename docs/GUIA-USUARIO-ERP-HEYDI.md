# Guía de usuario
## Sistema ERP de Producción — Repostería Heydi

## 1. Acceso al sistema

Al abrir la aplicación se muestra la pantalla de inicio de sesión. La ventana contiene una imagen alusiva a Repostería Heydi, campos de usuario y contraseña y el botón **Iniciar sesión**.

Al presionar el botón, el sistema dirige a la vista principal del ERP, donde se encuentra el dashboard y el menú lateral de navegación.

## 2. Dashboard

El dashboard es el resumen general de la operación. Muestra:

- Cantidad de ventas y despachos registrados e ingresos acumulados por venta.
- Órdenes de producción activas.
- Productos con stock bajo.
- Producción pendiente.
- Actividad reciente.
- Accesos rápidos a productos, materias primas y órdenes de producción.

Los accesos rápidos llevan directamente al módulo correspondiente.

## 3. Navegación

El menú lateral agrupa las funciones por áreas:

- **Inicio:** vuelve al dashboard.
- **Datos maestros:** productos, materias primas, recetas/BOM, rutas, almacenes, proveedores y clientes.
- **Inventario:** existencias, entradas, salidas y movimientos.
- **Ventas:** consulta de ingresos derivados de las ventas registradas.
- **Producción:** órdenes de producción, disponibilidad de materiales, consumo de materias primas y productos terminados.
- **Reportes:** reportes de gestión.
- **Administración:** usuarios y roles.

En escritorio, el menú permanece visible. En pantallas pequeñas se utiliza el botón de menú para abrirlo.

## 4. Funcionamiento común de los módulos

### Crear un registro

1. Abrir el módulo desde el menú lateral.
2. Presionar el botón **Nuevo producto** o **Nuevo registro**, según el módulo.
3. Completar los campos del formulario.
4. Presionar **Guardar registro**.
5. El nuevo registro aparece en la tabla del módulo.

### Buscar

Utilizar el campo de búsqueda ubicado sobre la tabla. La lista se filtra mientras se escribe.

### Editar

Presionar el icono de lápiz en la fila que se desea modificar. Se abre el formulario con los datos existentes. Modificar la información y guardar los cambios.

### Eliminar

Presionar el icono de papelera. El sistema solicita confirmación antes de eliminar el registro.

### Ver detalles

En proveedores y clientes, seleccionar el nombre del registro para abrir una ventana con toda la información almacenada.

## 5. Datos maestros

### Productos

Permite registrar los productos fabricados y vendidos por la panadería.

Campos del formulario:

- Nombre de producto.
- Código de producto.
- Tipo de pan.
- Unidades.
- Precio.

Los productos pueden ser utilizados en órdenes de producción, productos terminados, ventas e inventario.

### Materias primas

Registra los ingredientes y materiales necesarios para fabricar los productos.

Campos del formulario:

- Nombre de materia prima.
- Código.
- Stock.
- Unidades disponibles.

La disponibilidad de materias primas se utiliza para determinar si una orden de producción puede iniciar.

### Recetas / BOM

Una receta o BOM define los materiales y cantidades requeridas para fabricar un producto.

Campos del formulario:

- Nombre de receta.
- Código.
- Unidades de BOM.
- Descripción de la receta.

La descripción queda visible en el módulo para consultar rápidamente la composición o instrucciones de la receta.

### Rutas de producción

Define el recorrido y las etapas necesarias para fabricar un producto.

Campos recomendados:

- Nombre de la ruta.
- Código.
- Operaciones o etapas.
- Duración estimada.
- Estado.

Las rutas ayudan a organizar el flujo de trabajo de producción.

### Almacenes

Permite administrar los lugares donde se almacenan productos y materias primas.

Campos recomendados:

- Nombre del almacén.
- Código.
- Tipo de almacén.
- Ubicación.
- Estado.

### Proveedores

Registra las empresas o personas que suministran materias primas.

Campos del formulario:

- Nombre.
- Apellidos.
- Cédula de identidad.
- Número de teléfono.
- Correo electrónico.

Al seleccionar el nombre de un proveedor se muestra su ficha completa.

### Clientes

Registra los clientes de la repostería.

Campos del formulario:

- Nombre del cliente.
- Teléfono.
- Dirección.
- Correo electrónico.
- Código.

Al seleccionar el nombre de un cliente se muestra toda su información registrada.

## 6. Inventario

### Existencias

Muestra las cantidades disponibles de productos y materias primas. La información se relaciona con entradas, salidas, producción y ajustes.

### Entradas

Permite registrar mercancía que ingresa al inventario, por ejemplo:

- Compra a un proveedor.
- Recepción de materia prima.
- Ingreso de producto terminado.
- Ajuste positivo.

Al guardar una entrada se incrementa la existencia relacionada.

### Salidas

Permite registrar una venta o un despacho de producto terminado:

- La venta requiere cliente, productos y precios; valida las existencias, descuenta el producto terminado y queda disponible en **Ingresos por venta**.
- El despacho también descuenta existencias y se registra en movimientos, pero no se contabiliza como ingreso.

### Ingresos por venta

Resume los ingresos brutos de documentos de tipo **Venta**. Permite consultar todo el historial, las ventas de hoy o las del mes actual; muestra totales por cliente y producto, el ticket promedio y el detalle de cada documento. El botón **Exportar CSV** descarga las ventas del periodo seleccionado.

Los ingresos se calculan desde las ventas registradas en **Salidas**, de modo que no se duplica ni se vuelve a capturar la información. Los mismos documentos alimentan el dashboard y los reportes de gestión. Los datos operativos de estos módulos se guardan en el almacenamiento local del navegador.

Al guardar una salida se descuenta la cantidad correspondiente.

### Movimientos

Presenta un resumen cronológico de entradas, salidas, ajustes y movimientos generados por producción. Cada movimiento debe indicar tipo, cantidad, referencia y fecha.

## 7. Producción

### Órdenes de producción

Permite planificar y controlar la fabricación.

Para crear una orden, presionar **Nueva orden** y completar:

- Orden.
- Producto.
- Planificado.
- Producido.
- Estado.

Estados disponibles:

- **Pendiente:** la orden fue creada, pero aún no ha comenzado.
- **En proceso:** la fabricación está en curso.
- **Finalizada:** se completó la cantidad producida.
- **Cancelada:** la orden no continuará.

Las acciones de la tabla permiten iniciar, finalizar o cancelar una orden. Los contadores del resumen se actualizan según el estado de cada orden.

### Disponibilidad de materiales

Compara los materiales requeridos por la receta con las existencias disponibles.

- Si todos los materiales están disponibles, la orden puede iniciar.
- Si falta algún material, el sistema muestra una alerta y bloquea o advierte que no se puede iniciar.
- Al consumir materiales, la disponibilidad se recalcula.

### Consumo de materias primas

Registra el consumo de ingredientes utilizado en una orden. Al confirmar el consumo:

1. Se descuenta la materia prima.
2. Se genera automáticamente una salida de inventario.
3. El movimiento queda registrado.
4. Se actualiza la disponibilidad de materiales.

### Productos terminados

Muestra los productos terminados provenientes de la producción.

La opción **Registrar ingreso** permite indicar el producto, cantidad, almacén y referencia. Al confirmar, la cantidad aparece automáticamente en existencias y se genera una entrada de inventario.

## 8. Reportes de gestión

Resume la operación del sistema:

- Existencias actuales.
- Entradas y salidas.
- Consumo de materias primas.
- Producción planificada y producida.
- Órdenes por estado.
- Movimientos por período.

Los filtros de fecha, módulo o tipo de movimiento permiten consultar información específica. El reporte puede exportarse en PDF o Excel desde los botones de exportación.

## 9. Usuarios y roles

### Registrar usuario

El administrador puede crear usuarios con estos datos:

- Nombre completo.
- Nombre de usuario.
- Código.
- Teléfono.
- Correo electrónico.
- Rol.

Roles:

- **Administrador:** acceso a todos los módulos, configuración, usuarios y reportes.
- **Usuario:** acceso limitado a dashboard, inventario y producción.

Los permisos deben validarse también en el servidor; ocultar una opción del menú no sustituye el control de autorización.

## 10. Recomendación de flujo operativo

1. Crear productos, materias primas y almacenes.
2. Registrar proveedores y clientes.
3. Crear recetas/BOM y rutas de producción.
4. Registrar las entradas de materias primas.
5. Crear una orden de producción.
6. Revisar la disponibilidad de materiales.
7. Iniciar la orden y confirmar el consumo.
8. Registrar el ingreso de productos terminados.
9. Revisar existencias y movimientos.
10. Consultar o exportar el reporte de gestión.

## 11. Convenciones de uso

- Utilizar códigos únicos para productos, materias primas, recetas, rutas, almacenes y clientes.
- Registrar entradas y salidas con una referencia clara.
- No eliminar un registro que tenga movimientos relacionados; preferir desactivarlo.
- Completar primero los datos maestros antes de crear órdenes de producción.
- Revisar existencias antes de confirmar consumos o salidas.
