// The app must be connected to the isolated Metro runtime before any auth input.
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(RUNTIME_URL)) {
  throw new Error('Auth E2E requires an isolated loopback runtime');
}
var runtimes = json(http.get(RUNTIME_URL + '/json/list').body);
if (
  !runtimes.some(function (runtime) {
    return String(runtime.title).indexOf('com.heidisoft.iconicedu') !== -1;
  })
) {
  throw new Error('The app has not loaded the isolated runtime; refusing auth input');
}
