// Calcula ingresos, cantidad de ventas y productos más vendidos a partir de los pedidos
// (diagrama de clases vigente, Entrega 8; secuencia del CU-17). No se persiste.
// Los importes salen de los precios históricos de cada línea del pedido (RN-03); representan
// pedidos registrados, no pagos bancarios verificados.
export class Estadisticas {
  constructor(pedidos) {
    this.pedidos = pedidos;
  }

  // Pedidos con fecha en [desde, hasta).
  pedidosEntre(desde, hasta) {
    return this.pedidos.filter((pedido) => {
      const fecha = new Date(pedido.fecha);
      return fecha >= desde && fecha < hasta;
    });
  }

  // Mensaje 1.2 (con 1.2.1: calcularTotal() de cada pedido del período).
  calcularIngresos(desde, hasta) {
    return this.pedidosEntre(desde, hasta).reduce((suma, pedido) => suma + pedido.calcularTotal(), 0);
  }

  // Mensaje 1.3.
  cantidadVentas(desde, hasta) {
    return this.pedidosEntre(desde, hasta).length;
  }

  // Mensaje 1.4.
  productosMasVendidos(desde, hasta, cantidad = 5) {
    const acumulado = new Map();
    for (const pedido of this.pedidosEntre(desde, hasta)) {
      for (const linea of pedido.lineas) {
        const actual = acumulado.get(linea.producto.id) || { productoId: linea.producto.id, nombre: linea.producto.nombre, unidades: 0, importe: 0 };
        actual.unidades += linea.cantidad;
        actual.importe += linea.subtotal();
        acumulado.set(linea.producto.id, actual);
      }
    }
    return [...acumulado.values()]
      .sort((a, b) => b.unidades - a.unidades || b.importe - a.importe || a.nombre.localeCompare(b.nombre, 'es'))
      .slice(0, cantidad);
  }

  aJSON(desde, hasta) {
    const ventas = this.cantidadVentas(desde, hasta);
    const ingresos = this.calcularIngresos(desde, hasta);
    return {
      importeTotal: ingresos,
      cantidadVentas: ventas,
      ticketPromedio: ventas ? Math.round(ingresos / ventas) : 0,
      productosMasVendidos: this.productosMasVendidos(desde, hasta, 5),
    };
  }
}
