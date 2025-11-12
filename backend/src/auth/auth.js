/**
 * Authentication System with Role-Based Access Control (RBAC)
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';

const SALT_ROUNDS = 10;

// User roles with permissions
export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest'
};

export const PERMISSIONS = {
  [ROLES.ADMIN]: [
    'device.*',
    'automation.*',
    'user.*',
    'system.*',
    'ai.*',
    'voice.*'
  ],
  [ROLES.USER]: [
    'device.read',
    'device.control',
    'automation.read',
    'automation.create',
    'automation.update.own',
    'automation.delete.own',
    'scene.*',
    'ai.interact',
    'voice.use'
  ],
  [ROLES.GUEST]: [
    'device.read',
    'device.control',
    'scene.execute'
  ]
};

/**
 * Hash password
 */
export async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify password
 */
export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
export function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Create a new user
 */
export async function createUser({ username, email, password, role = ROLES.USER, fullName = null }) {
  const db = getDatabase();

  // Check if user already exists
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existingUser) {
    throw new Error('User with this username or email already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const userId = uuidv4();
  const now = Date.now();

  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, role, full_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, username, email, passwordHash, role, fullName, now, now);

  return {
    id: userId,
    username,
    email,
    role,
    fullName,
    createdAt: now
  };
}

/**
 * Authenticate user
 */
export async function authenticateUser(usernameOrEmail, password) {
  const db = getDatabase();

  // Find user
  const user = db.prepare(`
    SELECT id, username, email, password_hash, role, full_name, is_active
    FROM users
    WHERE (username = ? OR email = ?) AND is_active = 1
  `).get(usernameOrEmail, usernameOrEmail);

  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  // Update last login
  db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(Date.now(), user.id);

  // Generate token
  const token = generateToken(user);

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.full_name
    },
    token
  };
}

/**
 * Get user by ID
 */
export function getUserById(userId) {
  const db = getDatabase();
  const user = db.prepare(`
    SELECT id, username, email, role, full_name, created_at, last_login, is_active
    FROM users
    WHERE id = ?
  `).get(userId);

  return user;
}

/**
 * Update user
 */
export async function updateUser(userId, updates) {
  const db = getDatabase();
  const allowedFields = ['email', 'full_name', 'role'];
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (updates.password) {
    fields.push('password_hash = ?');
    values.push(await hashPassword(updates.password));
  }

  if (fields.length === 0) {
    throw new Error('No valid fields to update');
  }

  fields.push('updated_at = ?');
  values.push(Date.now());
  values.push(userId);

  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getUserById(userId);
}

/**
 * Delete user
 */
export function deleteUser(userId) {
  const db = getDatabase();
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

/**
 * List all users
 */
export function listUsers() {
  const db = getDatabase();
  return db.prepare(`
    SELECT id, username, email, role, full_name, created_at, last_login, is_active
    FROM users
    ORDER BY created_at DESC
  `).all();
}

/**
 * Check if user has permission
 */
export function hasPermission(userRole, permission) {
  const rolePermissions = PERMISSIONS[userRole] || [];

  return rolePermissions.some(p => {
    if (p === permission) return true;
    if (p.endsWith('.*')) {
      const prefix = p.slice(0, -2);
      return permission.startsWith(prefix);
    }
    return false;
  });
}

/**
 * Require permission middleware
 */
export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
}

/**
 * Authentication middleware
 */
export function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    // Attach user to request
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export default {
  ROLES,
  PERMISSIONS,
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  createUser,
  authenticateUser,
  getUserById,
  updateUser,
  deleteUser,
  listUsers,
  hasPermission,
  requirePermission,
  authenticate
};
