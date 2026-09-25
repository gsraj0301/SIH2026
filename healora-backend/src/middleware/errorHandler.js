const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}`, err.message);

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: err.expose || status < 500 ? err.message : 'Internal server error',
  });
};

export default errorHandler;