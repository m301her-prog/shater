import { pool } from './db.js';

export const createInvoice = async (req, res) => {
  // Client يرسل: type ('PURCHASE' أو 'SALE') وعناصر الفاتورة items
  const { type, tax_amount = 0, items } = req.body; 
  const userId = req.user.id; // تم جلب ID المستخدم من الجلسة (Middleware)

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'الفاتورة يجب أن تحتوي على منتج واحد على الأقل' });
  }

  // استخدام Transaction لضمان أن الفاتورة وعناصرها يُحفظان معاً أو يُلغيان معاً
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. إحساب المجموع الإجمالي للعناصر
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    // 2. إنشاء الفاتورة (الـ Trigger سيتولى إنتاج invoice_number تلقائياً)
    const invoiceQuery = `
      INSERT INTO public.invoices (type, total_amount, tax_amount, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const invoiceRes = await client.query(invoiceQuery, [type, totalAmount + tax_amount, tax_amount, userId]);
    const newInvoice = invoiceRes.rows[0];

    // 3. إدراج عناصر الفاتورة
    // (الـ Trigger update_stock_on_invoice_item سيتولى زيادة أو إنقاص المخزون وفحص الصلاحية)
    for (const item of items) {
      const itemSubtotal = item.quantity * item.unit_price;
      const itemQuery = `
        INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price, subtotal)
        VALUES ($1, $2, $3, $4, $5);
      `;
      await client.query(itemQuery, [newInvoice.id, item.product_id, item.quantity, item.unit_price, itemSubtotal]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'تم حفظ الفاتورة وتحديث المخزون بنجاح',
      invoice: newInvoice
    });

  } catch (error) {
    await client.query('ROLLBACK'); // إرجاع البيانات في حال حدوث أي خطأ (مثل عدم توفر كمية بالمخزن)

    // إذا كان الخطأ صادراً من التريجر (الكمية غير متوفرة)
    if (error.message.includes('الكمية المطلوبة غير متوفرة')) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};
