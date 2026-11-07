
import {
    httpRequestsTotal, httpRequestDuration, httpErrorsTotal,
    httpActiveRequests, httpRequestSize, httpResponseSize,
} from '../monitoring/metrics.js';

export const metricsMiddleware = (req, res, next) => {
    if (req.path === '/metrics') return next();

    const endTimer = httpRequestDuration.startTimer();

    httpActiveRequests.inc();

    // Incoming request size
    const requestLength = Number(req.headers['content-length'] || 0);
    httpRequestSize.observe(requestLength);

    let completed = false;
    const finishRequest = (statusCode, responseLength = 0) => {
        if (completed) return;
        completed = true;

        const route =
            req.route?.path ? `${req.baseUrl}${req.route.path}` : 'unmatched';

        const labels = { method: req.method, route, status_code: String(statusCode) };

        // Count requests
        httpRequestsTotal.inc(labels);

        // Record duration
        endTimer(labels);

        // Count HTTP errors
        if (statusCode >= 400) {
            httpErrorsTotal.inc(labels);
        }

        // Outgoing response size
        httpResponseSize.observe(responseLength);

        httpActiveRequests.dec();
    };

    res.once('finish', () => {
        finishRequest(
            res.statusCode,
            Number(res.getHeader('content-length') || 0),
        );
    });

    res.once('close', () => {
        if (!res.writableFinished) finishRequest(499);
    });

    next();
};
