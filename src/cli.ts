import { app } from "./http-eval.ts";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";

async function getUdsPath() {
  if (!process.env.HTTP_EVAL_UDS_PATH) {
    throw new Error("You must define the variable HTTP_EVAL_UDS_PATH");
  }

  const path = process.env.HTTP_EVAL_UDS_PATH!;

  if (existsSync(path)) {
    throw new Error(
      `Listen path ${path} already exists. You must remove it first.`,
    );
  }

  return path;
}

const server = app.listen(await getUdsPath());

process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());
