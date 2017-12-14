console.time('program');
const spawn = require('child_process').spawn;
const fetch = require('node-fetch');
const Jimp = require("jimp");
const uuid = require('uuid/v4');
const AWS = require('ibm-cos-sdk');

function checkParameters(params){

    const requiredParams = !params.REQUIRED_PARAMS ? undefined : params.REQUIRED_PARAMS.split(',');

    if(requiredParams === undefined){
        return {
            ok : false,
            message : 'The REQUIRED_PARAMS property of the params object is missing'
        };
    }

    const missingParams = [];

    requiredParams.forEach(requiredParameter => {

        if(params[requiredParameter] === undefined){
            missingParams.push(requiredParameter);
        }

    });

    if(missingParams.length > 0){
        return {
            ok : false,
            message : `The required parameters '${missingParams.join("', '")}' are missing from this invokation.`
        }
    }

    return {
        ok : true,
        message : ''
    };

}

function main(params){
    
    console.log(params);
    
    // return params.REQUIRED_PARAMS;

    const parametersAreValid = checkParameters(params);

    if(!parametersAreValid.ok){
        // throw 'Required parameters are not set';
        return {
            status : 'err',
            message : parametersAreValid.message
        }
    }
    
    const S3 = new AWS.S3({
        apiKeyId: params.STORAGE_KEY,
        endpoint: params.OBJECT_STORAGE_ENDPOINT,
        ibmAuthEndpoint: "https://iam.ng.bluemix.net/oidc/token",
        serviceInstanceId: params.OBJECT_INSTANCE_ID
    });

    console.log(S3.endpoint.hostname);

    if(!params.file){
        return {
            status : "err",
            message : 'No file passed for processing. Please run this program with an absolute or relative file path passed as the first argument.'
        }
    }
    
    return fetch(params.file)
        .then(res => {
            if(res.ok){
                return res.buffer();
            } else {
                throw res;
            }
        })
        .then(image => {

            console.log(image);

            return Jimp.read(image)
                .then(image => {
                    console.log(image);
                    
                    const widerThanIsTall = image.bitmap.width >= image.bitmap.height;
                    
                    console.log('MEM:', process.memoryUsage());

                    console.log('Does it have equal dimensions / is it wider than it is tall?', widerThanIsTall);
                    const cropDimensions = {
                        width : widerThanIsTall ? image.bitmap.width / 2 : image.bitmap.width,
                        height : widerThanIsTall ? image.bitmap.height : image.bitmap.height / 2
                    };
            
                    const firstHalf = image;
                    const secondHalf = image.clone();

                    firstHalf.crop(0, 0, cropDimensions.width, cropDimensions.height);
                    secondHalf.crop(widerThanIsTall ? cropDimensions.width : 0, widerThanIsTall ? 0 : cropDimensions.height, cropDimensions.width, cropDimensions.height);

                    console.log('MEM:', process.memoryUsage());
                    
                    console.log(firstHalf, secondHalf);
            
                    const P = [firstHalf, secondHalf].map( (halve, idx) => {

                        console.log('MEM:', process.memoryUsage());

                        return new Promise( (resolve, reject) => {
                            
                            halve.getBuffer('image/jpeg', (err, image) => {
                                console.log(err, image);
                                
                                if(err){
                                    reject(err);
                                } else {
                                    
                                    const bucketPath = `${params.processName}/${params.divisionLevel}/${idx}.jpg`;
                                    console.log('MEM:', process.memoryUsage());
                    
                                    S3.putObject({
                                            Bucket : params.BUCKETNAME,
                                            Key : bucketPath,
                                            Body : image,
                                            ACL:'public-read'
                                        }, (err, data) => {
                                            if(err){
                                                reject(err);
                                            } else {
                                                resolve({
                                                    image : secondHalf,
                                                    publicPath : `https://${params.OBJECT_STORAGE_ENDPOINT}/${params.BUCKETNAME}/${params.processName}/${params.divisionLevel}/${idx}.jpg`
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

                    const nextJobs = [];

                    // Further invocations
                    halves.forEach(half => {
                        console.log(half.publicPath);
                        const invocationURL = `${params.INVOCATION_FUNCTION_URL}?divisionLevel=${Number(params.divisionLevel) + 1}&processName=${params.processName}&file=${half.publicPath}`;
                        console.log(invocationURL);
                        nextJobs.push(invocationURL);
                    });

                    console.timeEnd('program');
                    return {complete : nextJobs};
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
    ;
}

exports.main = main;