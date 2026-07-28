import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'shatir_secret_key_123';

// 1. دالة إنشاء حساب جديد (Register)
export const register = async (req, res) => {
  const { full_name, email, password, role } = req.body;

  // التحقق من الحقول المطلوبة
  if (!full_name || !email || !password) {
    return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
  }

  try {
    // 1. التحقق مما إذا كان البريد الإلكتروني مستخدماً بالفعل
    const userCheck = await pool.query('SELECT * FROM public.users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'البريد الإلكتروني مسجل بالفعل' });
    }

    // 2. تشفير كلمة المرور
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. حفظ المستخدم في قاعدة البيانات
    const userRole = role || 'user'; // دور افتراضي في حال عدم تحديده
    const newUser = await pool.query(
      'INSERT INTO public.users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, full_name, email, role',
      [full_name, email, hashedPassword, userRole]
    );

    const createdUser = newUser.rows[0];

    // 4. إنشاء الـ Token لتسجيل الدخول التلقائي بعد التسجيل
    const token = jwt.sign(
      { id: createdUser.id, email: createdUser.email, role: createdUser.role, full_name: createdUser.full_name },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    // حفظ الجلسة داخل Cookie
    res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Path=/; Max-Age=43200; ${process.env.NODE_ENV === 'production' ? 'Secure;' : ''}`);

    return res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح',
      token,
      user: {
        id: createdUser.id,
        name: createdUser.full_name,
        email: createdUser.email,
        role: createdUser.role
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 2. دالة تسجيل الدخول (Login)
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
  }

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

// 3. Middleware للتحقق من الجلسة
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

// 4. Vercel Serverless Default Handler
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // التوجيه بناءً على المسار الفرعي الفرعي إذا أمكن، أو حسب الأسلوب المستخدم في مشروعك
  const { action } = req.query; // يمكنك إرسال Param مثل /api/auth?action=register أو الاعتماد على req.url

  if (action === 'register' || req.url.includes('register')) {
    return await register(req, res);
  } else if (action === 'login' || req.url.includes('login')) {
    return await login(req, res);
  } else {
    // في حال عدم التحديد، يمكنك التوجيه بحسب البيانات المستقبلة
    if (req.body.full_name) {
      return await register(req, res);
    }
    return await login(req, res);
  }
}
