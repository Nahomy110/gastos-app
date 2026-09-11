const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Servirá la carpeta pública (frontend)

// Configuración de conexión MySQL
const dbPool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gastos_familiares',
  waitForConnections: true,
  connectionLimit: 10
});

// Login sencillo (Para producción se recomienda usar bcrypt y JWT)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await dbPool.execute(
      'SELECT id_usuario, nombre, email, rol FROM usuarios WHERE email = ? AND password = ?',
      [email, password]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener categorías
app.get('/api/categorias', async (req, res) => {
  try {
    const [rows] = await dbPool.execute('SELECT * FROM categorias');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registrar gasto
app.post('/api/gastos', async (req, res) => {
  const { id_usuario, id_categoria, monto, descripcion } = req.body;
  try {
    await dbPool.execute(
      'INSERT INTO gastos (id_usuario, id_categoria, monto, descripcion) VALUES (?, ?, ?, ?)',
      [id_usuario, id_categoria, monto, descripcion]
    );
    res.json({ ok: true, message: 'Gasto registrado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registrar solicitud de préstamo
app.post('/api/prestamos', async (req, res) => {
  const { id_usuario, monto, motivo } = req.body;
  try {
    await dbPool.execute(
      'INSERT INTO prestamos (id_usuario, monto, motivo) VALUES (?, ?, ?)',
      [id_usuario, monto, motivo]
    );
    res.json({ ok: true, message: 'Solicitud enviada a Mamá' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ver actividad individual
app.get('/api/actividad/:id_usuario', async (req, res) => {
  try {
    const [gastos] = await dbPool.execute(
      `SELECT g.id_gasto, g.monto, g.descripcion, g.fecha_gasto, c.nombre AS categoria 
       FROM gastos g 
       JOIN categorias c ON g.id_categoria = c.id_categoria 
       WHERE g.id_usuario = ? 
       ORDER BY g.fecha_gasto DESC LIMIT 10`,
      [req.params.id_usuario]
    );

    const [prestamos] = await dbPool.execute(
      `SELECT id_prestamo, monto, motivo, estado, fecha_solicitud 
       FROM prestamos 
       WHERE id_usuario = ? 
       ORDER BY fecha_solicitud DESC LIMIT 10`,
      [req.params.id_usuario]
    );

    res.json({ gastos, prestamos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- RUTA EXCLUSIVA PARA LA ADMINISTRADORA (MAMÁ) ---

// Reportes globales y solicitudes pendientes
app.get('/api/admin/dashboard', async (req, res) => {
  try {
    // Total global del mes
    const [totalRes] = await dbPool.execute(
      `SELECT COALESCE(SUM(monto), 0) AS total 
       FROM gastos 
       WHERE MONTH(fecha_gasto) = MONTH(CURRENT_DATE()) AND YEAR(fecha_gasto) = YEAR(CURRENT_DATE())`
    );

    // Total por integrante en el mes
    const [porIntegrante] = await dbPool.execute(
      `SELECT u.nombre, COALESCE(SUM(g.monto), 0) AS total 
       FROM usuarios u 
       LEFT JOIN gastos g ON u.id_usuario = g.id_usuario 
       AND MONTH(g.fecha_gasto) = MONTH(CURRENT_DATE()) AND YEAR(g.fecha_gasto) = YEAR(CURRENT_DATE())
       WHERE u.rol = 'miembro'
       GROUP BY u.id_usuario`
    );

    // Solicitudes de préstamo pendientes
    const [pendientes] = await dbPool.execute(
      `SELECT p.id_prestamo, p.monto, p.motivo, p.fecha_solicitud, u.nombre 
       FROM prestamos p 
       JOIN usuarios u ON p.id_usuario = u.id_usuario 
       WHERE p.estado = 'pendiente' 
       ORDER BY p.fecha_solicitud ASC`
    );

    res.json({
      totalMes: totalRes[0].total,
      porIntegrante,
      prestamosPendientes: pendientes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Aprobar o rechazar préstamo
app.put('/api/admin/prestamos/:id_prestamo', async (req, res) => {
  const { estado } = req.body; // 'aprobado' o 'rechazado'
  try {
    await dbPool.execute(
      'UPDATE prestamos SET estado = ?, fecha_respuesta = CURRENT_TIMESTAMP WHERE id_prestamo = ?',
      [estado, req.params.id_prestamo]
    );
    res.json({ ok: true, message: `Préstamo ${estado}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('Servidor corriendo en el puerto 3000'));