require('dotenv').config({silent : false});
const fs = require('fs');

const I = require(`${__dirname}/index.js`);

console.log(I);

I.main({
        file : process.env.TEST_FILE,
        STORAGE_KEY :  process.env.STORAGE_KEY,
        OBJECT_STORAGE_ENDPOINT : process.env.OBJECT_STORAGE_ENDPOINT,
        OBJECT_INSTANCE_ID : process.env.OBJECT_INSTANCE_ID,
        processName : 'Barcelona',
        divisionLevel : "0",
        BUCKETNAME : process.env.BUCKETNAME,
        INVOCATION_FUNCTION_URL : process.env.INVOCATION_FUNCTION_URL,
        REQUIRED_PARAMS : process.env.REQUIRED_PARAMS
    })
;