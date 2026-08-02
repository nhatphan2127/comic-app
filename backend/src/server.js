import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import comicRoutes from './routes/comicRoutes.js';
import interactionRoutes from './routes/interactionRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import moderatorRoutes from './routes/moderatorRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import errorHandler from './middlewares/errorMiddleware.js';
import chaptersRoutes from './routes/chaptersRoutes.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/storage', express.static('storage'));

app.get('/', (req, res) => {
  res.json({ status: 'success', data: { message: 'Comic platform API is running' } });
});

app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/comics', comicRoutes);
app.use('/comics', interactionRoutes);
app.use('/comments', commentRoutes);
app.use('/notifications', notificationRoutes);
app.use('/admin', adminRoutes);
app.use('/moderator', moderatorRoutes);
app.use('/upload', uploadRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/comics', comicRoutes);
app.use('/api/comics', interactionRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/moderator', moderatorRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/chapters', chaptersRoutes);

app.use(errorHandler);

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
