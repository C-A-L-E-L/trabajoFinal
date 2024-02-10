const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Client } = require('pg');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());

const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'panaderia',
  password: '1234',
  port: 5432,
});

// Obtiene el directorio actual del script
const currentDirectory = __dirname;
// Crea la ruta absoluta al directorio 'uploads'
const uploadDirectory = path.join(__dirname, 'uploads');
// Crear directorio 'uploads' si no existe
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory);
}

// Configuración de Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix);
  }
});

const upload = multer({ storage: storage });

// Comprobar conexión a la BBDD
client.connect()
  .then(() => {
    console.log('Conectado a la base de datos');
  })
  .catch(error => console.error('Error al conectar a la base de datos:', error));

// Agrega productos
app.post('/backend/agregarProducto', upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file) {
      throw new Error('No se ha subido ninguna imagen');
    }

    const { nombre, precio, stock } = req.body;
    const imagePath = req.file.path;

    // Lee la imagen como datos binarios
    const imageBuffer = fs.readFileSync(imagePath);

    // Ejecuta la consulta para agregar un nuevo producto
    const result = await client.query('INSERT INTO producto (nombre_pr, precio_pr, stock_pr, img_pr) VALUES ($1, $2, $3, $4) RETURNING *', [nombre, precio, stock, imageBuffer]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al agregar producto:', error.message);
    res.status(500).send('Error interno del servidor');
  }
});

// Mostrar Productos en formato de tabla HTML con imágenes
app.get('/productos', async (req, res) => {
  try {
    // Ejecuta una consulta para obtener los productos
    const result = await client.query('SELECT * FROM producto');

    // Construir las filas de la tabla HTML con imágenes
    let tableHTML = '<table><tr><th>ID</th><th>Nombre</th><th>Precio</th><th>Disponibles</th><th>Imagen</th></tr>';
    result.rows.forEach(producto => {
      // Codificar la imagen como una URL de datos
      const imageSrc = `data:image/jpeg;base64,${producto.img_pr.toString('base64')}`;
      tableHTML += `<tr><td>${producto.id_pr}</td><td>${producto.nombre_pr}</td><td>${producto.precio_pr}</td><td>${producto.stock_pr}</td><td><img src="${imageSrc}" alt="${producto.nombre_pr}" style="max-width:80px; max-height:80px;"></td></tr>`;
    });
    tableHTML += '</table>';

    // Envía la tabla HTML como respuesta
    res.send(tableHTML);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    // Envia un código de estado 500 (Internal Server Error) en caso de error
    res.status(500).send('Error interno del servidor');
  }
});

// Mostrar Productos con stock mayor o igual a 1
app.get('/productos-con-stock', async (req, res) => {
  try {
    // Ejecuta una consulta para obtener los nombres de los productos con stock mayor o igual a 1
    const result = await client.query('SELECT nombre_pr FROM producto WHERE stock_pr >= 1');

    // Construir un array de nombres de productos
    const nombresProductos = result.rows.map(producto => producto.nombre_pr);

    // Envía el array como respuesta dentro de un objeto JSON
    res.json({ productos: nombresProductos });
  } catch (error) {
    console.error('Error al obtener productos con stock:', error);
    // Envia un código de estado 500 (Internal Server Error) en caso de error
    res.status(500).send('Error interno del servidor');
  }
});

// Obtener precio del producto por nombre
app.get('/precio-producto', async (req, res) => {
  try {
    const nombreProducto = req.query.nombre;

    // Ejecutar una consulta para obtener el precio del producto por nombre
    const result = await client.query('SELECT precio_pr FROM producto WHERE nombre_pr = $1', [nombreProducto]);

    if (result.rows.length > 0) {
      const precioProducto = result.rows[0].precio_pr;
      res.json({ precio: precioProducto });
    } else {
      res.status(404).json({ error: 'Producto no encontrado' });
    }
  } catch (error) {
    console.error('Error al obtener el precio del producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Guardar compra
app.post('/backend/guardar-compra', async (req, res) => {
  try {
    const { fnombre, fnumero, producto, cantidad, horaEntrega, pago } = req.body;

    // Obtener el precio y stock del producto desde la base de datos
    const productResult = await client.query('SELECT precio_pr, stock_pr FROM producto WHERE nombre_pr = $1', [producto]);
    if (productResult.rows.length === 0) {
      throw new Error('Producto no encontrado');
    }
    const precioProducto = productResult.rows[0].precio_pr;
    const stockProducto = productResult.rows[0].stock_pr;

    // Verificar si hay suficiente stock disponible
    if (stockProducto < cantidad) {
      throw new Error('No hay suficiente stock disponible para la compra');
    }

    // Calcular el monto total de la compra
    const montoTotal = precioProducto * cantidad;

    // Iniciar una transacción
    await client.query('BEGIN');

    // Insertar la compra en la tabla "compra"
    await client.query('INSERT INTO compra (cliente_c, numcliente_c, producto_c, cantidad_c, hora_c, pago_c) VALUES ($1, $2, $3, $4, $5, $6)', [fnombre, fnumero, producto, cantidad, horaEntrega, pago]);

    // Actualizar el stock del producto
    const updatedStock = stockProducto - cantidad;
    await client.query('UPDATE producto SET stock_pr = $1 WHERE nombre_pr = $2', [updatedStock, producto]);

    // Confirmar la transacción
    await client.query('COMMIT');

    res.status(200).json({ mensaje: 'Compra guardada correctamente', montoTotal });
  } catch (error) {
    if (error.message === 'No hay suficiente stock disponible para la compra') {
      res.status(400).json({ error: 'No hay suficiente stock disponible para la compra' });
    } else {
      console.error('Error al guardar compra:', error.message);
      res.status(500).json({ error: 'Error interno del servidor al guardar la compra' });
    }
  }
});

// Guardar Pedido
app.post('/backend/guardar-pedido', upload.none(), (req, res) => {
  // Obtiene los datos del formulario
  const nombreCliente = req.body.pnombre;
  const numeroCelular = req.body.pnumero;
  const fechaEntrega = req.body.pfecha;
  const horaEntrega = req.body.phoraEntrega;
  const descripcionPedido = req.body.descripcion_pedido;
  const pago = req.body.pagop;
  const entrega = req.body.entregap

  // Construye la consulta SQL para insertar los datos en la tabla "pedido"
  const sql = `INSERT INTO pedido (cliente_p, celular_p, fecha_p, hora_p, descripcion_p, pago_p, entrega_p) VALUES ($1, $2, $3, $4, $5, $6, $7)`;

  // Ejecuta la consulta SQL con los datos del formulario
  client.query(sql, [nombreCliente, numeroCelular, fechaEntrega, horaEntrega, descripcionPedido, pago, entrega], (err, result) => {
    if (err) {
      // Maneja cualquier error que ocurra durante la inserción de datos
      console.error('Error al insertar datos:', err);
      return res.status(500).send('Error interno del servidor');
    }
    // Envía una respuesta exitosa si los datos se insertaron correctamente
    //return res.status(200).send('Datos del pedido guardados correctamente');
    res.status(200).json({ message: 'Datos del pedido guardados correctamente' })
  });
});

// Obtener todos los pedidos
app.get('/backend/pedidos', (req, res) => {
  // Consulta SQL para seleccionar todos los pedidos
  const sql = 'SELECT * FROM pedido';

  // Ejecuta la consulta SQL
  client.query(sql, (err, result) => {
    if (err) {
      // Maneja cualquier error que ocurra durante la consulta
      console.error('Error al consultar pedidos:', err);
      res.status(500).send('Error interno del servidor');
      return;
    }

    // Construir la tabla HTML con los resultados de la consulta
    let tableHTML = '<table><tr><th>ID</th><th>Nombre Cliente</th><th>Número Celular</th><th>Fecha Entrega</th><th>Hora Entrega</th><th>Descripción Pedido</th><th>F. Pago</th><th>Entrega</th></tr>';
    result.rows.forEach(pedido => {
      tableHTML += `<tr><td>${pedido.id_p}</td><td>${pedido.cliente_p}</td><td>${pedido.celular_p}</td><td>${pedido.fecha_p}</td><td>${pedido.hora_p}</td><td>${pedido.descripcion_p}</td><td>${pedido.pago_p}</td><td>${pedido.entrega_p}</td></tr>`;


    });
    tableHTML += '</table>';

    // Envía la tabla HTML como respuesta
    res.status(200).send(tableHTML);
  });
});

// Manejar cierre de la aplicación
process.on('SIGINT', () => {
  client.end()
    .then(() => {
      console.log('Conexión cerrada');
      process.exit(0);
    })
    .catch(error => {
      console.error('Error al cerrar la conexión:', error);
      process.exit(1);
    });
});

// Inicia el servidor en el puerto 3000 después de conectar a la base de datos
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});