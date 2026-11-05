
import {
    httpRequestsTotal, httpRequestDuration, httpErrorsTotal,
    httpActiveRequests, httpRequestSize, httpResponseSize,
} from '../monitoring/metrics.js';

export const metricsMiddleware = (req, res, next) => {
    const endTimer = httpRequestDuration.startTimer();

    httpActiveRequests.inc();

    // Incoming request size
    const requestLength = Number(req.headers['content-length'] || 0);
    httpRequestSize.observe(requestLength);

    res.on('finish', () => {
        const route =
            req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;

        const labels = { method: req.method, route, status_code: String(res.statusCode) };

        // Count requests
        httpRequestsTotal.inc(labels);

        // Record duration
        endTimer(labels);

        // Count HTTP errors
        if (res.statusCode >= 400) {
            httpErrorsTotal.inc(labels);
        }

        // Outgoing response size
        const responseLength = Number(res.getHeader('content-length') || 0);
        httpResponseSize.observe(responseLength);

        httpActiveRequests.dec();
    });

    next();
};
