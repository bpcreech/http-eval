import { app, options } from "./http-eval.ts";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";

const argv = yargs(hideBin(process.argv))
  .option("udsPath", {
    alias: "P",
    type: "string",
    description: "Unix domain socket path",
  })
  .option("ignoreInsecureSocketPermission", {
    type: "boolean",
    description: "Ignore insecure Unix domain socket file ACLs",
  })
  .demand("udsPath")
  .check(function (argv) {
    if (existsSync(argv.udsPath)) {
      throw new Error(
        `Listen path ${argv.udsPath} already exists. You must remove it first.`,
      );
    }
    return true;
  })
  .parse();

options.ignoreInsecureSocketPermission = argv.ignoreInsecureSocketPermission;

const server = app.listen(argv.udsPath);

process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());
