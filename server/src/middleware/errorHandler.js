function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Something went wrong';

  if (!err.isOperational) {
    console.error(err); // log unexpected errors for debugging
  }

  res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;