import { app } from "./http-eval.ts";

async function getUdsPath() {
  if (!process.env.HTTP_EVAL_UDS_PATH) {
    throw new Error("You must define the variable HTTP_EVAL_UDS_PATH");
  }
  return process.env.HTTP_EVAL_UDS_PATH!;
}

app.listen(await getUdsPath());
