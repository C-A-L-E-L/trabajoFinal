const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
const multer = require('multer');
const fs = require('fs');
const path = require('path');


const app = express();
const port = 3000;

app.use(cors());
app.use(express.urlencoded({ extended: true }));
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

// Mostrar Productos en formato de tabla HTML
app.get('/productos', async (req, res) => {
  try {
    // Ejecuta una consulta para obtener los productos
    const result = await client.query('SELECT * FROM producto');

    // Construir solo las filas de la tabla HTML sin la estructura de la tabla completa
    let tableHTML = '';
    result.rows.forEach(producto => {
      tableHTML += `<tr><td>${producto.id_pr}</td><td>${producto.nombre_pr}</td><td>${producto.precio_pr}</td></tr>`;
    });

    // Envía las filas de la tabla HTML como respuesta
    res.send(tableHTML);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    // Envia un código de estado 500 (Internal Server Error) en caso de error
    res.status(500).send('Error interno del servidor');
  }
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