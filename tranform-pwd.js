const bcrypt = require('bcrypt');
const query = require('./db');

const main = async () => {
  let accounts = await query(`SELECT * FROM accounts`, []);

  for (let account of accounts) {
    const decodedStr = Buffer.from(account.password, 'base64').toString(
      'utf-8',
    );
    var hashed_password = await bcrypt.hash(decodedStr, 10);

    await query(`UPDATE accounts SET password = ? WHERE account = ?`, [
      hashed_password,
      account.account,
    ]);
  }
};

main();
