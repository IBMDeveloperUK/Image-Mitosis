console.time('program');

const fs = require('fs');
const spawn = require('child_process').spawn;
const argv = require('yargs').argv
const Jimp = require("jimp");
const uuid = require('uuid/v4');

console.log("File passed:", argv.file);

if(!argv.file){
    console.log('No file passed for processing. Please run this program with an absolute or relative file path passed as the first argument.\nExiting.');
    process.exit();
}

Jimp.read(fs.readFileSync(argv.file))
    .then(image => {
        console.log(image);
        
        const widerThanIsTall = image.bitmap.width >= image.bitmap.height;
        
        console.log('It is wider than it is tall?', widerThanIsTall);
        const cropDimensions = {
            width : widerThanIsTall ? image.bitmap.width / 2 : image.bitmap.width,
            height : widerThanIsTall ? image.bitmap.height : image.bitmap.height / 2
        };

        const firstHalf = image;
        const secondHalf = image.clone();
    
        firstHalf.crop(0, 0, cropDimensions.width, cropDimensions.height);
        secondHalf.crop(widerThanIsTall ? cropDimensions.width : 0, widerThanIsTall ? 0 : cropDimensions.height, cropDimensions.width, cropDimensions.height);

        console.log(firstHalf, secondHalf);

        const P = [];

        const first = new Promise( (resolve, reject) => {
            const outputPath = `/tmp/${uuid()}.jpg`;            
            firstHalf.write(outputPath, function(err){
                if(err){
                    reject(err);
                } else {
                    resolve({
                        image : firstHalf,
                        filePath : outputPath
                    });
                }
            });
        });

        const second = new Promise( (resolve, reject) => {
            const outputPath = `/tmp/${uuid()}.jpg`;
            secondHalf.write(outputPath, function(err){
                if(err){
                    reject(err);
                } else {
                    resolve({
                        image : secondHalf,
                        filePath : outputPath
                    });
                }
            });
        });
        
        P.push(first);
        P.push(second);
        
        return Promise.all(P);

    })
    .then(halves => {

        if(halves[0].image.bitmap.width > 50 || halves[0].image.bitmap.height > 50){
            console.log(`Crop complete... but there's more work to be done!`);
            
            halves.forEach(half => {
                const pr = spawn('node', [`${__dirname}/index.js`, '--file', half.filePath]);

                pr.stdout.on('data', (data) => {
                    console.log(`stdout: ${data}`);
                });

                pr.stderr.on('data', (data) => {
                    console.log(`stderr: ${data}`);
                });

                pr.on('close', (code) => {
                    console.log(`child process exited with code ${code}`);
                });

            });

        }

        console.timeEnd('program');
    })
    .catch(err => {
        console.log('IMAGE READ ERROR:', err);
        console.timeEnd('program');
    })    
;