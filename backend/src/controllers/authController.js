import * as userModel from '../models/userModel.js';
import { v4 as uuidv4 } from 'uuid';

export async function register(req, res, next) {
  try {
    const { userName, password, email, displayName } = req.body;
    if (!userName || !password || !email || !displayName) {
      return res.status(400).json({ status: 'fail', message: 'Missing required fields' });
    }

    const existing = await userModel.findUserByUsername(userName);
    if (existing) {
      return res.status(409).json({ status: 'fail', message: 'Username already exists' });
    }

    const newUser = await userModel.createUser(userName, password, email, displayName);

    return res.status(201).json({
      status: 'success',
      data: { 
        id: newUser.id, 
        userName: newUser.username, 
        displayName: newUser.displayName, 
        role: newUser.role, 
        createdAt: new Date().toISOString() 
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { userName, password } = req.body;
    if (!userName || !password) {
      return res.status(400).json({ status: 'fail', message: 'Missing username or password' });
    }

    const user = await userModel.findUserByCredentials(userName, password);
    if (!user) {
      return res.status(401).json({ status: 'fail', message: 'Invalid credentials' });
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await userModel.createSession(user.id, token, expiresAt);

    return res.json({
      status: 'success',
      data: {
        token,
        expiresAt,
        user: { id: user.id, userName: user.username, role: user.role },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      await userModel.deleteSession(token);
    }
    return res.json({ status: 'success', message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}
