const bcrypt = require('bcrypt');
const { query } = require('./database');

const main = async () => {
  let accounts = await query(`SELECT * FROM accounts`, []);

  for (let account of accounts) {
    const decodedStr = Buffer.from(account.password, 'base64').toString(
      'utf-8',
    );

    var hashedPassword = await bcrypt.hash(decodedStr, 10);

    console.log('帳號: ', account.account);
    console.log('原始密碼: ', account.password);
    console.log('解碼後: ', decodedStr);
    console.log('雜湊後: ', hashedPassword);
    console.log('--------------------------------');

    await query(`UPDATE accounts SET password = ? WHERE account = ?`, [
      hashedPassword,
      account.account,
    ]);
  }
};

main();
