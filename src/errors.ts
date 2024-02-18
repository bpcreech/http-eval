// Helpers related to improving error handling in express.

/** Extend Error with an HTTP status code. */
export class HttpEvalError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    cause?: object,
  ) {
    super(message, cause);
    this.name = "HttpEvalError";
  }
}

/**
 * An express middleware which correctly propagates exceptions thrown from
 * async request routers.
 *
 * From https://stackoverflow.com/questions/51391080/handling-errors-in-express-async-middleware
 */
export function asyncErrorHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Convert an error to a JSON-serializable object, recursively preserving the
 * cause.
 */
function errorToObject(err: Error) {
  if (err.cause) {
    return { error: err.stack, cause: errorToObject(err.cause) };
  } else {
    return { error: err.stack };
  }
}

/**
 * Render thrown errors as JSON responses.
 */
export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpEvalError) {
    res.status(err.statusCode);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(errorToObject(err)));
  } else if (err instanceof Error) {
    res.status(500);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(errorToObject(err)));
  } else {
    res.status(500);
    res.send(JSON.stringify({ error: "Unknown error" }));
  }
}

export function notFoundMiddleware(
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  res.status(404).send({ error: `Cannot ${req.method} ${req.path}` });
}
