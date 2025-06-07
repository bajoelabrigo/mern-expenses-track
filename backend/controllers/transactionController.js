const ExcelJS = require("exceljs");
const asyncHandler = require("express-async-handler");
const Category = require("../model/Category");
const Transaction = require("../model/Transaccion");

const transactionController = {
  //! Crear una o varias transacciones (si es recurrente)
  create: asyncHandler(async (req, res) => {
    // 🔽 1. Extraer datos del cuerpo de la solicitud
    const {
      type, // tipo de transacción: 'income' o 'expense'
      category, // categoría de la transacción (ej: 'comida', 'salario')
      amount, // monto de dinero
      date, // fecha base
      description = "", // descripción opcional
      icon = "", // emoji o ícono
      recurrent = false, // si la transacción se repite
      recurrenceType, // tipo de recurrencia: 'daily', 'weekly', etc.
      recurrenceCount = 1, // cuántas veces se repite
    } = req.body;

    // 🔽 2. Validar campos obligatorios
    if (!type || !amount || !date) {
      return res
        .status(400)
        .json({ message: "Tipo, monto y fecha son obligatorios" });
    }

    // 🔽 3. Validar que el tipo sea válido
    if (!["income", "expense"].includes(type)) {
      return res
        .status(400)
        .json({ message: "El tipo debe ser 'income' o 'expense'" });
    }

    // 🔽 4. Validar y convertir el monto a número positivo
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res
        .status(400)
        .json({ message: "El monto debe ser un número positivo" });
    }

    // 🔽 5. Validar que la fecha sea válida
    const baseDate = new Date(date);
    if (isNaN(baseDate.getTime())) {
      return res.status(400).json({ message: "Fecha inválida" });
    }

    // 🔽 6. Definir cuántos días representa cada tipo de recurrencia
    const recurrenceIntervals = {
      daily: 1,
      weekly: 7,
      monthly: 30, // solo se usa para fallback
      yearly: 365,
    };

    // 🔽 7. Determinar cuántas transacciones se deben crear
    const totalCount = recurrent && recurrenceCount > 0 ? recurrenceCount : 1;

    // 🔽 8. Crear un arreglo para almacenar las transacciones
    const transactions = [];

    // 🔁 9. Generar cada transacción (una o más si es recurrente)
    for (let i = 0; i < totalCount; i++) {
      // ✅ Copiar la fecha base para no modificarla directamente
      const txDate = new Date(baseDate);

      // 🔁 Si es la segunda transacción o más, calcular la nueva fecha
      if (i > 0 && recurrent && recurrenceType) {
        switch (recurrenceType) {
          case "daily":
            txDate.setDate(txDate.getDate() + i * recurrenceIntervals.daily);
            break;
          case "weekly":
            txDate.setDate(txDate.getDate() + i * recurrenceIntervals.weekly);
            break;
          case "monthly":
            txDate.setMonth(txDate.getMonth() + i); // sumar i meses
            break;
          case "yearly":
            txDate.setFullYear(txDate.getFullYear() + i); // sumar i años
            break;
          default:
            return res
              .status(400)
              .json({ message: "Tipo de recurrencia inválido" });
        }
      }

      // 🧾 Crear el objeto de transacción
      transactions.push({
        user: req.user._id, // ID del usuario autenticado
        type,
        category,
        amount: parsedAmount,
        description,
        icon,
        date: txDate,
        recurrent: Boolean(recurrent),
        recurrenceType: recurrent ? recurrenceType : null,
        recurrenceCount: recurrent ? recurrenceCount : 0,
      });
    }

    // 💾 10. Insertar todas las transacciones en la base de datos
    const created = await Transaction.insertMany(transactions);

    // 📤 11. Devolver las transacciones creadas al frontend
    res.status(201).json(created);
  }),

  //! Listar transacciones con filtros (fechas, tipo y categoría)
  getFilteredTransactions: asyncHandler(async (req, res) => {
    // 🔽 1. Extraer filtros desde los parámetros de consulta (query string)
    const {
      startDate,
      endDate,
      type,
      category,
      page = 1,
      limit = 10,
    } = req.query;

    // 🔽 2. Iniciar filtros con el ID del usuario autenticado
    let filters = { user: req.user._id };

    // 🔍 3. Filtrar por rango de fechas (si se especifica)
    if (startDate) {
      const parsedStart = new Date(startDate);
      if (!isNaN(parsedStart)) {
        filters.date = { ...filters.date, $gte: parsedStart };
      } else {
        return res.status(400).json({ message: "Fecha de inicio inválida" });
      }
    }

    if (endDate) {
      const parsedEnd = new Date(endDate);
      if (!isNaN(parsedEnd)) {
        filters.date = { ...filters.date, $lte: parsedEnd };
      } else {
        return res.status(400).json({ message: "Fecha de fin inválida" });
      }
    }

    // 🔍 4. Filtrar por tipo de transacción ('income' o 'expense')
    if (type) {
      if (["income", "expense"].includes(type)) {
        filters.type = type;
      } else {
        return res
          .status(400)
          .json({ message: "Tipo de transacción inválido" });
      }
    }

    // 🔍 5. Filtrar por categoría (opcional)
    if (category && category !== "All") {
      filters.category = category;
    }

    const skip = (Number(page) - 1) * Number(limit); // calcular qué registros omitir
    // 🔽 Obtener total de resultados para calcular el total de páginas
    const total = await Transaction.countDocuments(filters);

    // 📤 6. Obtener transacciones paginadas y ordenadas
    const transactions = await Transaction.find(filters)
      .sort({ date: -1 })
      .skip(skip)
      .limit(Number(limit));

    // ✅ 7. Responder con la lista filtrada
    res.status(200).json({
      total, // Total de registros
      currentPage: Number(page), // Página actual
      totalPages: Math.ceil(total / Number(limit)), // Total de páginas
      limit: Number(limit), // Cantidad por página
      transactions, // Array de resultados
    });
  }),

  //! Obtener una sola transacción por ID (solo si pertenece al usuario autenticado)
  getOne: asyncHandler(async (req, res) => {
    const { id } = req.params; // 🔽 1. Extraer el ID de la transacción desde los parámetros de la URL

    // 🔍 2. Validar que el ID tenga formato válido (MongoDB ObjectId)
    if (!id || id.length !== 24) {
      return res.status(400).json({ message: "ID de transacción inválido" });
    }

    // 🔐 3. Buscar la transacción que coincida con el ID y que pertenezca al usuario autenticado
    const transaction = await Transaction.findOne({
      _id: id,
      user: req.user._id,
    });

    // ❌ 4. Si no se encuentra, devolver error 404
    if (!transaction) {
      return res.status(404).json({ message: "Transacción no encontrada" });
    }

    // ✅ 5. Devolver la transacción encontrada
    res.status(200).json(transaction);
  }),

  //! Actualizar una transacción (solo si pertenece al usuario autenticado)
  update: asyncHandler(async (req, res) => {
    const { id } = req.params; // 🔽 1. Extraer el ID de la transacción desde los parámetros

    // 🔍 2. Validar que el ID tenga formato de ObjectId (24 caracteres)
    if (!id || id.length !== 24) {
      return res.status(400).json({ message: "ID de transacción inválido" });
    }

    // 🔐 3. Buscar la transacción por ID
    const transaction = await Transaction.findById(id);

    // ❌ 4. Si no existe, devolver error 404
    if (!transaction) {
      return res.status(404).json({ message: "Transacción no encontrada" });
    }

    // 🔐 5. Verificar que la transacción le pertenezca al usuario autenticado
    if (transaction.user.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "No autorizado para modificar esta transacción" });
    }

    // ✅ 6. Validar y asignar nuevos valores (solo si fueron enviados)
    if (req.body.type && !["income", "expense"].includes(req.body.type)) {
      return res.status(400).json({ message: "Tipo de transacción inválido" });
    }

    if (
      req.body.amount &&
      (isNaN(req.body.amount) || Number(req.body.amount) <= 0)
    ) {
      return res
        .status(400)
        .json({ message: "El monto debe ser un número positivo" });
    }

    if (req.body.date && isNaN(new Date(req.body.date).getTime())) {
      return res.status(400).json({ message: "Fecha inválida" });
    }

    // 📝 7. Actualizar campos (usando nullish coalescing)
    transaction.type = req.body.type ?? transaction.type;
    transaction.category = req.body.category ?? transaction.category;
    transaction.amount = req.body.amount ?? transaction.amount;
    transaction.date = req.body.date ?? transaction.date;
    transaction.description = req.body.description ?? transaction.description;
    transaction.icon = req.body.icon ?? transaction.icon;

    // 💾 8. Guardar la transacción actualizada
    const updatedTransaction = await transaction.save();

    // 📤 9. Enviar la respuesta
    res.status(200).json(updatedTransaction);
  }),

  //! Eliminar una transacción (solo si pertenece al usuario autenticado)
  delete: asyncHandler(async (req, res) => {
    const { id } = req.params; // 🔽 1. Extraer el ID de la transacción desde los parámetros

    // 🔍 2. Validar formato del ID (ObjectId de 24 caracteres)
    if (!id || id.length !== 24) {
      return res.status(400).json({ message: "ID de transacción inválido" });
    }

    // 🔐 3. Buscar la transacción en la base de datos
    const transaction = await Transaction.findById(id);

    // ❌ 4. Si no existe, devolver error 404
    if (!transaction) {
      return res.status(404).json({ message: "Transacción no encontrada" });
    }

    // 🔒 5. Verificar que la transacción pertenezca al usuario autenticado
    if (transaction.user.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "No autorizado para eliminar esta transacción" });
    }

    // 🗑️ 6. Eliminar la transacción
    await transaction.deleteOne();

    // ✅ 7. Enviar confirmación
    res.status(200).json({ message: "Transacción eliminada exitosamente" });
  }),

  //! Obtener transacciones por período (mensual, bimestral, etc.)
  getByPeriod: asyncHandler(async (req, res) => {
    // 🔽 1. Obtener filtros desde los parámetros de consulta (query string)
    const { period, type, startDate, endDate } = req.query;

    // 📅 Fecha actual del sistema (hoy)
    const today = new Date();

    // 🧱 Inicializamos variables para las fechas reales de filtrado
    let finalStartDate = null;
    let finalEndDate = null;

    // 🗓️ 2. Si el frontend envía una fecha de inicio válida, la usamos
    if (startDate) {
      const parsedStart = new Date(startDate);
      if (isNaN(parsedStart)) {
        // ❌ Si la fecha es inválida, respondemos con error
        return res.status(400).json({ message: "Fecha de inicio inválida" });
      }
      finalStartDate = parsedStart;
    }

    // 🗓️ 3. Si el frontend envía una fecha de fin válida, la usamos
    if (endDate) {
      const parsedEnd = new Date(endDate);
      if (isNaN(parsedEnd)) {
        // ❌ Si la fecha es inválida, respondemos con error
        return res.status(400).json({ message: "Fecha de fin inválida" });
      }
      finalEndDate = parsedEnd;
    }

    // 🔁 4. Si no se especificaron fechas personalizadas, aplicamos la lógica según el período
    if (!finalStartDate || !finalEndDate) {
      switch (period) {
        case "monthly":
          // 🟦 Desde el inicio del mes actual hasta hoy
          finalStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
          finalEndDate = today;
          break;
        case "bimonthly":
          // 🟦 Desde el inicio del mes anterior hasta hoy
          finalStartDate = new Date(
            today.getFullYear(),
            today.getMonth() - 1,
            1
          );
          finalEndDate = today;
          break;
        case "quarterly":
          // 🟦 Desde hace dos meses hasta hoy
          finalStartDate = new Date(
            today.getFullYear(),
            today.getMonth() - 2,
            1
          );
          finalEndDate = today;
          break;
        case "semiannual":
          // 🟦 Desde hace cinco meses hasta hoy
          finalStartDate = new Date(
            today.getFullYear(),
            today.getMonth() - 5,
            1
          );
          finalEndDate = today;
          break;
        case "annual":
          // 🟦 Desde hace un año exacto hasta hoy
          finalStartDate = new Date(
            today.getFullYear() - 1,
            today.getMonth(),
            1
          );
          finalEndDate = today;
          break;
        default:
          // ❌ Si el período no es válido y no se enviaron fechas, respondemos con error
          return res.status(400).json({
            message:
              "Período inválido. Usa: monthly, bimonthly, quarterly, semiannual, annual",
          });
      }
    }

    // 🔍 5. Construimos los filtros para la consulta en MongoDB
    const filters = {
      user: req.user._id, // Solo obtener las transacciones del usuario autenticado
      date: { $gte: finalStartDate, $lte: finalEndDate }, // Dentro del rango de fechas determinado
    };

    // 🎯 6. Validamos y aplicamos el filtro por tipo (si se especifica)
    if (type) {
      if (!["income", "expense"].includes(type)) {
        // ❌ Si el tipo no es válido, respondemos con error
        return res
          .status(400)
          .json({ message: "Tipo inválido. Usa 'income' o 'expense'" });
      }
      filters.type = type; // ✅ Filtro por tipo aplicado
    }

    // 🧾 7. Realizamos la consulta a la base de datos con los filtros definidos y ordenamos por fecha descendente
    const transactions = await Transaction.find(filters).sort({ date: -1 });

    // 📤 8. Respondemos con las transacciones encontradas
    res.status(200).json(transactions);
  }),

  //! Balance general del usuario
  getBalance: asyncHandler(async (req, res) => {
    // 1️⃣  Obtener filtros opcionales de fecha desde la URL
    const { startDate, endDate } = req.query;

    // 2️⃣  Construir el objeto $match (siempre incluye el ID del usuario)
    const match = { user: req.user._id };

    // ── Validacion de fecha de inicio ────────────────────────────────────────────
    if (startDate) {
      const parsedStart = new Date(startDate);
      if (isNaN(parsedStart)) {
        return res.status(400).json({ message: "Fecha inicio invalida" });
      }
      match.date = { ...match.date, $gte: parsedStart };
    }

    // ── Validacion de fecha de fin ───────────────────────────────────────────────
    if (endDate) {
      const parsedEnd = new Date(endDate);
      if (isNaN(parsedEnd)) {
        return res.status(400).json({ message: "Fecha fin invalida" });
      }
      match.date = { ...match.date, $lte: parsedEnd };
    }

    // 3️⃣  Pipeline de agregacion: sumar ingresos y egresos
    const summary = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalIncome: {
            $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
          },
          totalExpense: {
            $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
          },
        },
      },
    ]);

    // 4️⃣  Si no hay resultados, usar 0 por defecto
    const { totalIncome = 0, totalExpense = 0 } = summary[0] || {};

    // 5️⃣  Enviar respuesta
    res.status(200).json({
      income: totalIncome, // total de ingresos
      expense: totalExpense, // total de egresos
      balance: totalIncome - totalExpense, // saldo neto
    });
  }),

  //! Exportar transacciones del usuario autenticado a un archivo Excel
  generateExcelReport: asyncHandler(async (req, res) => {
    // 1️⃣ Obtener todas las transacciones del usuario, ordenadas por fecha descendente
    const transactions = await Transaction.find({ user: req.user._id }).sort({
      date: -1,
    });

    // 2️⃣ Crear un nuevo libro de Excel y una hoja llamada "Transactions"
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Transacciones");

    // 3️⃣ Definir las columnas con encabezados y claves
    sheet.columns = [
      { header: "Fecha", key: "date", width: 15 },
      { header: "Tipo", key: "type", width: 10 },
      { header: "Categoría", key: "category", width: 20 },
      { header: "Descripción", key: "description", width: 30 },
      { header: "Monto", key: "amount", width: 12 },
      { header: "Ícono", key: "icon", width: 10 },
    ];

    // 4️⃣ Agregar una fila por cada transacción
    transactions.forEach((tx) => {
      sheet.addRow({
        date: new Date(tx.date).toLocaleDateString("es-PE"), // formato local
        type: tx.type === "income" ? "Ingreso" : "Gasto", // traducido
        category: tx.category || "Sin categoría",
        description: tx.description || "",
        amount: tx.amount,
        icon: tx.icon || "",
      });
    });

    // 5️⃣ Configurar los encabezados HTTP para descarga del archivo
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=transacciones.xlsx"
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // 6️⃣ Escribir el archivo Excel directamente en la respuesta
    await workbook.xlsx.write(res);

    // 7️⃣ Finalizar la respuesta
    res.end();
  }),

  getMonthlySummary: asyncHandler(async (req, res) => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const match = {
      user: req.user._id,
      date: { $gte: startOfMonth, $lte: today },
    };

    const summary = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
        },
      },
    ]);

    const result = {
      income: summary.find((s) => s._id === "income")?.total || 0,
      expense: summary.find((s) => s._id === "expense")?.total || 0,
    };

    res.status(200).json(result);
  }),
};

module.exports = transactionController;
