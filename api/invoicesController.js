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

// ---------- 1. إنشاء فاتورة جديدة ----------
export const createInvoice = async (req, res, user) => {
  // Client يرسل: type ('PURCHASE' أو 'SALE') وعناصر الفاتورة items
  const { type, tax_amount = 0, items } = req.body;
  const userId = user.id;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'الفاتورة يجب أن تحتوي على منتج واحد على الأقل' });
  }

  // استخدام Transaction لضمان حفظ/إلغاء البيانات ككتلة واحدة
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. حساب المجموع الإجمالي للعناصر
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    // 2. إنشاء الفاتورة (الـ Trigger سيتولى إنتاج invoice_number تلقائياً)
    const invoiceQuery = `
      INSERT INTO public.invoices (type, total_amount, tax_amount, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const invoiceRes = await client.query(invoiceQuery, [type, totalAmount + Number(tax_amount), tax_amount, userId]);
    const newInvoice = invoiceRes.rows[0];

    // 3. إدراج عناصر الفاتورة
    // (الـ Trigger update_stock_on_invoice_item سيتولى تعديل المخزون وفحص الصلاحية)
    for (const item of items) {
      const itemSubtotal = item.quantity * item.unit_price;
      const itemQuery = `
        INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price, subtotal)
        VALUES ($1, $2, $3, $4, $5);
      `;
      await client.query(itemQuery, [newInvoice.id, item.product_id, item.quantity, item.unit_price, itemSubtotal]);
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'تم حفظ الفاتورة وتحديث المخزون بنجاح',
      invoice: newInvoice
    });

  } catch (error) {
    await client.query('ROLLBACK'); // إرجاع المعاملة في حال حدوث خطأ

    // إذا كان الخطأ صادراً من التريجر (مثل عدم توفر الكمية)
    if (error.message.includes('الكمية المطلوبة غير متوفرة')) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

// ---------- 2. جلب الفواتير (إضافية لخدمة الواجهة) ----------
export const getInvoices = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.invoices ORDER BY created_at DESC');
    return res.status(200).json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ---------- 3. Vercel Serverless Default Handler (المطلوب لـ Vercel) ----------
export default async function handler(req, res) {
  // التحقق من الحماية والجلسة
  const user = getUserFromReq(req);
  if (!user) {
    return res.status(401).json({ message: 'غير مصرح، يرجى تسجيل الدخول' });
  }

  if (req.method === 'POST') {
    return await createInvoice(req, res, user);
  } else if (req.method === 'GET') {
    return await getInvoices(req, res);
  } else {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
}
