# http-eval

Runs a simple http server on a Unix domain socket, which evals POSTed content
inside NodeJS.

This is intended for use as a subprocess "sidecar" to execute JavaScript from
non-JavaScript programs.

**Table of Contents**

- [Example](#example)
- [License](#license)
- [Security Stance](#security-stance)
- [Usage instructions](#usage-instructions)
- [More examples](#more-examples)

## Example

```console
$ npx http-eval --udsPath /tmp/foo.sock
```

and then:

```console
$ curl \
	--silent \
	--unix-socket /tmp/foo.sock \
	'http://bogus/run' \
	-X POST \
	-H 'Content-Type: application/json' \
	-d '{ "code": "return 6*7;"}' \
	| jq .result
42
```

## License

`http-eval` is distributed under the terms of the
[MIT](https://spdx.org/licenses/MIT.html) license.

## Security stance

A server which `eval`s arbitrary JavaScript obviously raises security concerns!
If constructed incorrectly, this would essentially be a vector for Remote Code
Execution (RCE) attack.

`http-eval` _attempts to_ guarantee that only the current local Unix user, and
(depending on the `umask`) folks in its Unix group, can send JavaScript to the
server.

**Note that, as stated in the `LICENSE` file, `http-eval` has no warranty of any
kind guaranteeing the above security stance. Use at your own risk.** Please
report any discovered faults using Github issues!

To do this, `http-eval` only listens on a Unix domain socket. As constructed, it
refuses to bind to a TCP/IP interface at all.

Unix domain sockets are ordinarily located in the Unix filesystem, and access is
controlled by ordinary filesystem permissions. Thus, _only programs which can
write to local files can send JavaScript code to the server_.

Now, there may be different trust boundaries within a machine and its
filesystem! Usually, we don't want one local (non-`root`) Unix user to have
access to run arbitrary commands as another local Unix user (typically we'd call
that a privilege escalation vulnerability). To mitigate the risk of such a
misconfiguration, by default `http-eval` validates the file permissions,
ensuring that the UDS does _not_ have world-write access. (However, group-write
is still allowed.) `http-eval` effectively mandates a `umask` of at least
`0002`.

This file permission check is simply a best-effort attempt to detect a
configuration footgun. This does not provide any security guarantee against
misconfiguration.

To intentionally disable the file permission check, set the option
`--ignoreInsecureSocketPermission`. This could plausibly be useful in situations
where you are using other guarantees (e.g., directory permissions, or chroot) to
protect write access to the UDS, and/or you actually _intend to_ enable local
privilege escalation via `http-eval`. Obviously, _disable this check at your own
risk_.

## Usage instructions

- Requests must:
  - contain a JSON body (`Content-Type: application/json`)
    - ... with an object containing the key `code` which contains the code to
      execute.
  - accept JSON in UTF-8 (`Accept-Encoding: application/json`,
    `Accept-Charset: UTF-8`).
- Responses contain UTF-8 JSON with:
  - the result in the object key `result`, or
  - any exception in the object key `error`.
- Code is evaluated as a function body within an ECMAScript module with a
  consistent `this` context
  - ... and thus must `return` anything it wants to send back to the client.
    - ... and any returned values must be `JSON.stringify`able.
  - ... and thus can use
    [dynamic `await import(...)`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import)
    **but not `require`** (and _import_ is generally best used in _async_ mode;
    see below).
  - ... and thus may store values on `this` between calls.
- Code can be run within an `async` function (and thus use `await`) using the
  `async=true` query parameter
  - ... and as noted above, this is required for use of `await import(...)`.

## More examples

### Basic sync call

```console
$ curl \
	--silent \
	--unix-socket /tmp/foo.sock \
	'http://bogus/run' \
	-X POST \
	-H 'Content-Type: application/json' \
	-d '{ "code": "return 6*7;"}' \
	| jq .
{
  "result": 42
}
```

### Basic error

```console
$ curl \
	--silent \
	--unix-socket /tmp/foo.sock \
	'http://bogus/run' \
	-X POST \
	-H 'Content-Type: application/json' \
	-d '{ "code": "bad code;"}' \
	| jq .
{
  "error": "HttpEvalError: Error in eval\n [...]",
  "cause": {
    "error": "SyntaxError: Unexpected identifier 'code'\n    at Function (<anonymous>)\n    at [...]"
  }
}
```

### Storing and retrieving values on `this`

```console
$ curl \
	--silent \
	--unix-socket /tmp/foo.sock \
	'http://bogus/run' \
	-X POST \
	-H 'Content-Type: application/json' \
	-d '{ "code": "this.foo = 6*7;"}' \
	| jq .
{}

$ curl \
	--silent \
	--unix-socket /tmp/foo.sock \
	'http://bogus/run' \
	-X POST \
	-H 'Content-Type: application/json' \
	-d '{ "code": "return this.foo;"}' \
	| jq .
{
  "result": 42
}
```

### Basic async call

```console
$ curl \
	--silent \
	--unix-socket /tmp/foo.sock \
	'http://bogus/run?async=true' \
	-X POST \
	-H 'Content-Type: application/json' \
	-d '{ "code": "await new Promise(resolve => setTimeout(resolve, 2000));"}' \
	| jq .
{}
```

### Async call with a dynamic import

```console
$ curl \
	--silent \
	--unix-socket /tmp/foo.sock \
	'http://bogus/run?async=true' \
	-X POST \
	-H 'Content-Type: application/json' \
	-d '{ "code": "let os = await import(\"os\"); return os.cpus();"}' \
	| jq .
{
  "result": [
    {
      "model": "DMC(R) DeLorean(R) DMC-12 @ 1.21 GW",
      [...]
    },
    [...]
  ]
}
```
