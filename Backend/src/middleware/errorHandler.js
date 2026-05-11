/**
 * Centralized Express error handler.
 * Any controller that calls next(err) lands here.
 */
function errorHandler(err, req, res, _next) {
    console.error('[Global Error Handler]', err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Internal server error.' });
}

module.exports = { errorHandler };
