import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'shatir_secret_key_123';

// 1. دالة تسجيل الدخول
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM public.users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    const user = result.rows[0];
    
    // التحقق من كلمة المرور
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    // إنشاء الـ Token للجلسة
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    // حفظ الجلسة داخل Cookie
    res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Path=/; Max-Age=43200; ${process.env.NODE_ENV === 'production' ? 'Secure;' : ''}`);

    return res.status(200).json({
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: { id: user.id, name: user.full_name, email: user.email, role: user.role }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 2. Middleware للتحقق من الجلسة
export const authenticate = (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'غير مصرح، يرجى تسجيل الدخول' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'الجلسة منتهية، يرجى إعادة تسجيل الدخول' });
  }
};

// 3. Vercel Serverless Default Handler (المشغّل الرئيسي المطلوب لـ Vercel)
export default async function handler(req, res) {
  if (req.method === 'POST') {
    return await login(req, res);
  } else {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
}
