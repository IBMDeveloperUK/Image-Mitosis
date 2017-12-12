console.time('program');
// require('dotenv').config();
const spawn = require('child_process').spawn;
const fetch = require('node-fetch');
const Jimp = require("jimp");
const uuid = require('uuid/v4');
const AWS = require('aws-sdk');

const S3 = new AWS.S3();

function checkParameters(params){

    if(!params.file){

    }

}

function main(params){
    
    console.log("File passed:", params.file);

    AWS.Credentials.accessKeyId = params.AWS_ACCESS_KEY_ID;
    AWS.Credentials.secretAccessKey = params.AWS_SECRET_ACCESS_KEY;

    if(!params.file){
        return {
            "status" : "err",
            "message" : 'No file passed for processing. Please run this program with an absolute or relative file path passed as the first argument.'
        }
    }

    fetch(params.file)
        .then(res => {
            if(res.ok){
                return res.buffer();
            } else {
                throw res;
            }
        })
        .then(image => {

            console.log(image);

            Jimp.read(image)
                .then(image => {
                    console.log(image);
                    
                    const widerThanIsTall = image.bitmap.width >= image.bitmap.height;
                    
                    console.log('Does it have equal dimensions / is it wider than it is tall?', widerThanIsTall);
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

                    // https://s3.eu-west-2.amazonaws.com/sean-tracey-london-mitosis/test-upload.jpg

                    const first = new Promise( (resolve, reject) => {
                        
                        firstHalf.getBuffer('image/jpeg', (err, image) => {
                            console.log(err, image);

                            if(err){
                                reject(err);
                            } else {

                                S3.putObject({
                                        Bucket : params.S3Bucket,
                                        Key : `${params.processName}/${params.divisionLevel}/a.jpg`,
                                        Body : image
                                    }, (err, data) => {
                                        if(err){
                                            reject(err);
                                        } else {
                                            resolve({
                                                image : secondHalf
                                            });
                                        }
                                    })
                                ;

                            }

                        });

                    });
                    
                    const second = new Promise( (resolve, reject) => {
                        
                        secondHalf.getBuffer('image/jpeg', (err, image) => {
                            console.log(err, image);

                            if(err){
                                reject(err);
                            } else {

                                S3.putObject({
                                        Bucket : params.S3Bucket,
                                        Key : `${params.processName}/${params.divisionLevel}/b.jpg`,
                                        Body : image
                                    }, (err, data) => {
                                        if(err){
                                            reject(err);
                                        } else {
                                            resolve({
                                                image : secondHalf
                                            });
                                        }
                                    })
                                ;

                            }
                            
                        });

                    });
                    
                    P.push(first);
                    P.push(second);
                    
                    return Promise.all(P);
            
                })
                .then(halves => {
                    console.timeEnd('program');
                })
                .catch(err => {
                    console.log('IMAGE READ ERROR:', err);
                    console.timeEnd('program');
                })    
            ;

        })
        .catch(err => {
            console.log(err);
        })

    
}

module.exports = main;