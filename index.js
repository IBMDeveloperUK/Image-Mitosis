console.time('program');
const spawn = require('child_process').spawn;
const fetch = require('node-fetch');
const Jimp = require("jimp");
const uuid = require('uuid/v4');
const AWS = require('ibm-cos-sdk');

function checkParameters(params){

    if(!params.file){

    }

}

function main(params){
    
    console.log(params);

    const S3 = new AWS.S3({
        apiKeyId: params.STORAGE_KEY,
        endpoint: params.OBJECT_STORAGE_ENDPOINT,
        ibmAuthEndpoint: "https://iam.ng.bluemix.net/oidc/token",
        serviceInstanceId: params.OBJECT_INSTANCE_ID
    });

    console.log(S3.endpoint.hostname);

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
            
                    const P = [firstHalf, secondHalf].map( (halve, idx) => {

                        return new Promise( (resolve, reject) => {
                            
                            halve.getBuffer('image/jpeg', (err, image) => {
                                console.log(err, image);
    
                                if(err){
                                    reject(err);
                                } else {
                                    
                                    const bucketPath = `${params.processName}/${params.divisionLevel}/${idx}.jpg`;

                                    S3.putObject({
                                            Bucket : params.bucketName,
                                            Key : bucketPath,
                                            Body : image,
                                            ACL:'public-read'
                                        }, (err, data) => {
                                            if(err){
                                                reject(err);
                                            } else {
                                                resolve({
                                                    image : secondHalf,
                                                    publicPath : `https://${params.OBJECT_STORAGE_ENDPOINT}/${params.bucketName}/${params.processName}/${params.divisionLevel}/${idx}.jpg`
                                                });
                                            }
                                        })
                                    ;
    
                                }
    
                            });
    
                        });

                    });
                    
                    return Promise.all(P);
            
                })
                .then(halves => {
                    // Further invocations
                    halves.forEach(half => {
                        console.log(half.publicPath);
                        const invocationURL = `${params.functionURL}?divisionLevel=${Number(params.divisionLevel) + 1}&processName=${params.processName}&file=${half.publicPath}`;
                        console.log(invocationURL);
                        return;
                        fetch(invocationURL)
                            .then(res => {
                                if(!res.ok){
                                    throw res
                                }
                            }) 
                            .catch(err => {
                                console.log(err);
                            })
                        ;

                    });

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