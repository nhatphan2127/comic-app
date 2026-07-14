
import getValidSession from "../helpers/dbhelper.js";
export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ status: 'fail', message: 'Missing Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const session = await getValidSession(token);

    if (!session) {
      return res.status(401).json({ status: 'fail', message: 'Invalid or expired session token' });
    }

    // Gán thông tin vào request
    req.user = {
      id: session.userId,
      username: session.username,
      displayName: session.displayName,
      email: session.email,
      avatar: session.avatar,
      role: session.role,
    };
    req.session = session;
    next();
  } catch (error) {
    next(error); // Chuyển lỗi hệ thống tới Express error handler
  }
}

/**
 * Middleware: Token không bắt buộc (Optional)
 */
export async function authenticateTokenOptional(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    // Trường hợp không gửi token -> Đi tiếp với tư cách khách (guest)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const session = await getValidSession(token);

    // Lựa chọn logic:
    // Phương án A (Như code cũ của bạn): Token lỗi/hết hạn thì coi như khách và đi tiếp
    if (!session) {
      return next();
    }

    // Phương án B (Khuyên dùng): Đã gửi token thì token PHẢI đúng. Nếu sai/hết hạn -> Trả về 401
    // Để dùng phương án B, bạn hãy uncomment dòng dưới đây:
    // if (!session) {
    //   return res.status(401).json({ status: 'fail', message: 'Invalid or expired session token' });
    // }

    req.user = {
      id: session.userId,
      username: session.username,
      displayName: session.displayName,
      email: session.email,
      avatar: session.avatar,
      role: session.role,
    };
    req.session = session;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware: Kiểm tra phân quyền theo vai trò (Role-based)
 */
export function requireRole(...roles) {
  const allowed = roles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: 'fail', message: 'Authentication required' });
    }

    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ status: 'fail', message: 'Insufficient permissions' });
    }

    next();
  };
}