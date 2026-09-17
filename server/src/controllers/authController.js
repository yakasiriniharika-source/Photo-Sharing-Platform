const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const { signToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

async function register(req, res, next) {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name || !role) {
      throw new AppError('email, password, name, and role are required', 400);
    }
    if (!['ADMIN', 'MEMBER'].includes(role)) {
      throw new AppError('role must be ADMIN or MEMBER', 400);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('Email already registered', 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role },
    });

    const token = signToken({ userId: user.id, role: user.role });
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError('email and password are required', 400);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid credentials', 401);
    }

    const token = signToken({ userId: user.id, role: user.role });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login };