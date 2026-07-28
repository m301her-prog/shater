import { pool } from './db.js';

// إضافة منتج جديد للمخزن
export const createProduct = async (req, res) => {
  const { sku, name, cost_price, selling_price, category, low_stock_threshold } = req.body;

  try {
    const query = `
      INSERT INTO public.products (sku, name, cost_price, selling_price, category, low_stock_threshold)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [sku, name, cost_price, selling_price, category || 'عام', low_stock_threshold || 5];
    const result = await pool.query(query, values);

    res.status(201).json({ message: 'تم إضافة المنتج بنجاح', product: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// جلب المنتجات مع حالة المخزون
export const getProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.products ORDER BY updated_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
