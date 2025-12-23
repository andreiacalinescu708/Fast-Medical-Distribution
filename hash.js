const bcrypt = require("bcrypt");

const password = "admin123";
const hash = bcrypt.hashSync(password, 10);

console.log("HASH:", hash);
