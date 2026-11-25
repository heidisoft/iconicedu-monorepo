// Only synthetic accounts in the runner's local mail sink are supported.
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(MAIL_URL)) {
  throw new Error('OTP polling requires a loopback mail sink');
}
if (!/^maestro-auth-[a-z0-9-]+@example\.test$/.test(TEST_EMAIL)) {
  throw new Error('OTP polling requires the disposable test mailbox');
}
var mailbox = encodeURIComponent(TEST_EMAIL.split('@')[0]);
var response = http.get(MAIL_URL + '/api/v1/mailbox/' + mailbox);
var mailpit = response.status !== 200;
var messages = mailpit
  ? json(
      http.get(
        MAIL_URL + '/api/v1/search?query=' + encodeURIComponent('to:' + TEST_EMAIL),
      ).body,
    ).messages.map(function (item) {
      return { id: item.ID, date: item.Created };
    })
  : json(response.body);
messages.sort(function (a, b) {
  return String(b.date).localeCompare(String(a.date));
});
var message = messages.filter(function (item) {
  return item.id !== output.lastMailId;
})[0];
if (!message) throw new Error('Waiting for the new local sign-in email');
var detail = json(
  http.get(
    MAIL_URL +
      (mailpit
        ? '/api/v1/message/' + message.id
        : '/api/v1/mailbox/' + mailbox + '/' + message.id),
  ).body,
);
var match = String(mailpit ? detail.Text : detail.body.text || '').match(/\b(\d{6})\b/);
if (!match) throw new Error('Local sign-in email has no six-digit code');
output.otp = match[1];
output.invalidOtp = ('000000' + ((Number(match[1]) + 1) % 1000000)).slice(-6);
output.lastMailId = message.id;
