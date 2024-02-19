import { app } from "../src/http-eval.ts";
import supertest, { Response, agent } from "supertest";
import { describe, it } from "node:test";
import { expect } from "expect";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "path";
import { tmpdir } from "os";

async function withDir(fn: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "httpev-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true });
  }
}

/**
 * A test helper which binds the supertest agent to a Unix domain socket.
 *
 * Since our server evals arbitrary JavaScript, it's unsafe to bind to even
 * a localhost-only TCP/IP port (as even that would expose a local privilege
 * escalation vulnerability).
 */
async function withAgent(fn: (agent: unknown) => Promise<void>) {
  await withDir(async (dir: string) => {
    const path = `${dir}/http.sock`;
    const server = app.listen(path);
    try {
      const agnt = agent("http+unix://" + path.replaceAll("/", "%2F"));
      await fn(agnt);
    } finally {
      server.close();
    }
  });
}

describe("bad requests", () => {
  it("cannot run on tcp", async () => {
    // By default, supertest attempts to bind the server to a local ephemeral
    // TCP/IP port.
    // This would be bad in this case because we're running arbitrary JS
    // evals. Verify this configuration is denied:
    await supertest(app)
      .post("/run")
      .send({ code: "return 6*7;" })
      .set("Accept-Encoding", "application/json")
      .expect("Content-Type", /json/)
      .expect(500)
      .then((res: Response) => {
        expect(res.body.error).toMatch(
          new RegExp("does not appear to be a Unix domain socket"),
        );
      });
  });

  it("wrong url is 404", async () => {
    withAgent(async (agent: unknown) => {
      return agent
        .get("/runt")
        .set("Accept-Encoding", "application/json")
        .expect("Content-Type", /json/)
        .expect(404)
        .then((res: Response) => {
          expect(res.body.error).toBe("Cannot GET /runt");
        });
    });
  });

  it("GET is 404", async () => {
    withAgent(async (agent: unknown) => {
      return agent
        .get("/run")
        .set("Accept-Encoding", "application/json")
        .expect("Content-Type", /json/)
        .expect(404)
        .then((res: Response) => {
          expect(res.body.error).toBe("Cannot GET /run");
        });
    });
  });

  it("no code", async () => {
    withAgent(async (agent: unknown) => {
      return agent
        .post("/run")
        .send({})
        .set("Accept-Encoding", "application/json")
        .expect("Content-Type", /json/)
        .expect(400)
        .then((res: Response) => {
          expect(res.body.error).toMatch(
            new RegExp("^HttpEvalError: No code specified in request body"),
          );
        });
    });
  });
});

describe("sync requests", () => {
  it("basic request", async () => {
    withAgent(async (agent: unknown) => {
      return agent
        .post("/run")
        .send({ code: "return 6*7;" })
        .set("Accept-Encoding", "application/json")
        .expect("Content-Type", /json/)
        .expect(200)
        .then((res: Response) => {
          expect(res.body.result).toBe(42);
        });
    });
  });

  it("code generating an exception", async () => {
    withAgent(async (agent: unknown) => {
      return agent
        .post("/run")
        .send({ code: "return foo(42);" })
        .set("Accept-Encoding", "application/json")
        .expect("Content-Type", /json/)
        .expect(400)
        .then((res: Response) => {
          expect(res.body.error).toMatch(
            new RegExp("^HttpEvalError: Error in eval"),
          );
          expect(res.body.cause.error).toMatch(
            new RegExp("^ReferenceError: foo is not defined"),
          );
        });
    });
  });

  it("request with state", async () => {
    withAgent(async (agent: unknown) => {
      await agent
        .post("/run")
        .send({ code: "this.x = 42;" })
        .set("Accept-Encoding", "application/json")
        .expect("Content-Type", /json/)
        .expect(200)
        .then((res: Response) => {
          expect(res.body.result).toBe(undefined);
        });
      return agent
        .post("/run")
        .send({ code: "return this.x;" })
        .set("Accept-Encoding", "application/json")
        .expect("Content-Type", /json/)
        .expect(200)
        .then((res: Response) => {
          expect(res.body.result).toBe(42);
        });
    });
  });
});

describe("async requests", () => {
  it("basic request", async () => {
    withAgent(async (agent: unknown) => {
      return agent
        .post("/run")
        .query({ async: "true" })
        .send({ code: "return 6*7;" })
        .set("Accept-Encoding", "application/json")
        .expect("Content-Type", /json/)
        .expect(200)
        .then((res: Response) => {
          expect(res.body.result).toBe(42);
        });
    });
  });

  it("code generating an exception", async () => {
    withAgent(async (agent: unknown) => {
      return agent
        .post("/run")
        .query({ async: "true" })
        .send({ code: "return foo(42);" })
        .set("Accept-Encoding", "application/json")
        .expect("Content-Type", /json/)
        .expect(400)
        .then((res: Response) => {
          expect(res.body.error).toMatch(
            new RegExp("^HttpEvalError: Error in eval"),
          );
          expect(res.body.cause.error).toMatch(
            new RegExp("^ReferenceError: foo is not defined"),
          );
        });
    });
  });

  it("request with state", async () => {
    withAgent(async (agent: unknown) => {
      await agent
        .post("/run")
        .query({ async: "true" })
        .send({ code: "this.x = 42;" })
        .set("Accept-Encoding", "application/json")
        .expect("Content-Type", /json/)
        .expect(200)
        .then((res: Response) => {
          expect(res.body.result).toBe(undefined);
        });
      return agent
        .post("/run")
        .query({ async: "true" })
        .send({ code: "return this.x;" })
        .set("Accept-Encoding", "application/json")
        .expect("Content-Type", /json/)
        .expect(200)
        .then((res: Response) => {
          expect(res.body.result).toBe(42);
        });
    });
  });

  it("async import", async () => {
    withAgent(async (agent: unknown) => {
      return agent
        .post("/run")
        .query({ async: "true" })
        .send({
          code: `
let os = await import("os");
return os.cpus();
`,
        })
        .set("Accept-Encoding", "application/json")
        .expect("Content-Type", /json/)
        .expect(200)
        .then((res: Response) => {
          expect(res.body.result.length).toBeGreaterThan(0);
        });
    });
  });

  it("async concurrency", async () => {
    withAgent(async (agent: unknown) => {
      const startTime = process.hrtime();
      const promises: Promise<void>[] = [];
      for (let i = 0; i < 10; ++i) {
        const fn = async () => {
          return agent
            .post("/run")
            .query({ async: "true" })
            .send({
              code: `
await new Promise(r => setTimeout(r, 2000));
return 42;
`,
            })
            .set("Accept-Encoding", "application/json")
            .expect("Content-Type", /json/)
            .expect(200)
            .then((res: Response) => {
              expect(res.body.result).toBe(42);
            });
        };
        promises.push(fn());
      }
      await Promise.all(promises);
      // We just ran 10 evaluations of something that sleeps 2 seconds, for
      // a total of 20 seconds spent sleeping.
      // However, because we ran concurrently, it should have taken just a
      // little over 2 seconds (and not, e.g., locked up the server on each
      // request):
      const timeTaken = process.hrtime(startTime);
      expect(timeTaken[0]).toBeLessThan(3);
    });
  });
});
