const bcrypt = require('bcrypt');
const query = require('./db');

const main = async () => {
  let accounts = await query(`SELECT * FROM accounts`, []);

  for (let account of accounts) {
    const decodedStr = Buffer.from(account.password, 'base64').toString(
      'utf-8',
    );

    var hashed_password = await bcrypt.hash(decodedStr, 10);

    console.log('帳號: ', account.account);
    console.log('原始密碼: ', account.password);
    console.log('解碼後: ', decodedStr);
    console.log('雜湊後: ', hashed_password);
    console.log('--------------------------------');

    await query(`UPDATE accounts SET password = ? WHERE account = ?`, [
      hashed_password,
      account.account,
    ]);
  }
};

main();
