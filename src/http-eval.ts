import express, { Request, Response, NextFunction } from "express";
import {
  HttpEvalError,
  errorMiddleware,
  notFoundMiddleware,
  asyncErrorHandler,
} from "./errors.ts";
import { stat } from "node:fs/promises";

const context = {};

function evalInContext(js: string) {
  return Object.getPrototypeOf(function () {})
    .constructor(js)
    .call(context);
}

async function evalAsyncInContext(js: string) {
  return await Object.getPrototypeOf(async function () {})
    .constructor(js)
    .call(context);
}

export const app = express();

app.use(express.json());

let checkedPath = false;

const ignoreInsecureSocketPermission =
  JSON.parse(process.env.IGNORE_INSECURE_SOCKET_PERMISSION || "false") != false;

export async function checkPathMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (checkedPath || ignoreInsecureSocketPermission) {
    next();
    return;
  }

  // This is a basic test for a potential security configuration footgun.
  // **This is by no means a perfect protection against misconfiguration!**

  // If the user has an extremely permissive umask (like 0o0000), then the
  // node http module will open a world-writable unix domain socket, and
  // thus we will accept and execute arbitrary JS from any local user who
  // has write access to the file system! That would provide a path to local
  // privilege escalation.

  // So let's do a basic check for a bad umask.
  // We only do this once (we don't attempt to detect if the user chmods the
  // file after startup; this is just checking for accidental
  // misconfiguration).

  const path = req.socket.server.address();

  if (typeof path != "string") {
    throw new Error(
      `eval server path ${JSON.stringify(path)} does not appear to be a Unix domain socket.`,
    );
  }

  const stats = await stat(path);
  const worldWritable = stats.mode & 0o002;
  if (worldWritable) {
    throw new Error(
      `eval server path ${path} is world-writable! Set umask to at least 0002 before running.`,
    );
  }

  checkedPath = true;

  next();
}

app.use(asyncErrorHandler(checkPathMiddleware));

app.post(
  "/run",
  asyncErrorHandler(async (req: Request, res: Response) => {
    if (!req.body.code) {
      throw new HttpEvalError("No code specified in request body", 400);
    }

    const runAsync = JSON.parse((req.query.async as string) || "false");

    let result: object;
    try {
      if (runAsync) {
        result = await evalAsyncInContext(req.body.code);
      } else {
        result = evalInContext(req.body.code);
      }
    } catch (e) {
      throw new HttpEvalError("Error in eval", 400, { cause: e });
    }

    res.json({ result: result });
  }),
);

app.use(errorMiddleware);

app.use(notFoundMiddleware);
