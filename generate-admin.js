// generate-admin.js
// 사용법: node generate-admin.js <비밀번호>
const crypto = require('crypto');
const pw = process.argv[2];
if (!pw) {
  console.error('사용법: node generate-admin.js <비밀번호>');
  process.exit(1);
}
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.createHash('sha256').update(`${salt}|${pw}`).digest('hex');
console.log('ADMIN_ID=medela1280');
console.log('ADMIN_SALT=' + salt);
console.log('ADMIN_HASH=' + hash);
