import jwt from 'jsonwebtoken';
import { pool } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'shatir_secret_key_123';

// ---------- Middleware للتحقق من الجلسة ----------
const getUserFromReq = (req) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

// ---------- 1. إضافة منتج جديد للمخزن ----------
export const createProduct = async (req, res) => {
  const { sku, name, cost_price, selling_price, category, low_stock_threshold } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'اسم المنتج مطلوب' });
  }

  try {
    const query = `
      INSERT INTO public.products (sku, name, cost_price, selling_price, category, low_stock_threshold)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [sku, name, cost_price || 0, selling_price || 0, category || 'عام', low_stock_threshold || 5];
    const result = await pool.query(query, values);

    return res.status(201).json({ message: 'تم إضافة المنتج بنجاح', product: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') { // كود الخطأ في PostgreSQL للتكرار (Unique Constraint Violation)
      return res.status(400).json({ message: 'رمز المنتج (SKU) مستخدم بالفعل' });
    }
    return res.status(500).json({ error: error.message });
  }
};

// ---------- 2. جلب المنتجات مع حالة المخزون ----------
export const getProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.products ORDER BY updated_at DESC');
    return res.status(200).json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ---------- 3. Vercel Serverless Default Handler (المشغّل الرئيسي لـ Vercel) ----------
export default async function handler(req, res) {
  // التحقق من الحماية والجلسة
  const user = getUserFromReq(req);
  if (!user) {
    return res.status(401).json({ message: 'غير مصرح، يرجى تسجيل الدخول' });
  }

  if (req.method === 'GET') {
    return await getProducts(req, res);
  } else if (req.method === 'POST') {
    return await createProduct(req, res);
  } else {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
}
