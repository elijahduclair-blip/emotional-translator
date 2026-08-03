export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  if (process.env.NODE_ENV === 'production') {
    console.error('Request error:', {
      method: req.method,
      path: req.path,
      status,
      code: err.code || null,
      message
    });
  } else {
    console.error('Error:', err);
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}
