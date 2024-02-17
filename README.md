# http-eval

Runs a simple http server on a Unix domain socket, which evals POSTed content
inside NodeJS.

## Security stance

A server which `eval`s arbitrary JavasSript is obviously a bit of a security
concern! If constructed incorrectly, this would essentially be a vector for
Remote Code Execution (RCE) attack.

`http-eval` _attempts to_ guarantee that only the current local Unix user, and
folks in its Unix group, can send JavaScript to the server.

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
that a privilege escalation attack). To ensure that, by default `http-eval`
validates the file permissions, ensuring that the UDS does _not_ have
world-write access. (However, group-write is still allowed.) `http-eval`
effectively mandates a `umask` of at least `0002`.

This file permission check is simply a best-effort attempt to detect a
configuration footgun. This does not provide any security guarantee against
misconfiguration.

To intentionally disable the file permission check, set the option
`ignoreInsecureSocketPermission=true`. This could be plausibly useful in
situations where you are using other guarantees (e.g., directory permissions, or
chroot) to protect write access to the UDS, and/or you actually _intend to_
enable local privilege escalation via `http-eval`. Obviously, _disable this
check at your own risk_.
