console.time('program');
const fs = require('fs');
const spawn = require('child_process').spawn;

const fetch = require('node-fetch');
const sharp = require("sharp");
const uuid = require('uuid/v4');
const AWS = require('ibm-cos-sdk');
const metrics = require('openwhisk-metrics');

function checkParameters(params) {

    const requiredParams = !params.REQUIRED_PARAMS ? undefined : params.REQUIRED_PARAMS.split(',');

    if (requiredParams === undefined) {
        return {
            ok: false,
            message: 'The REQUIRED_PARAMS property of the params object is missing'
        };
    }

    const missingParams = [];

    requiredParams.forEach(requiredParameter => {

        if (params[requiredParameter] === undefined) {
            missingParams.push(requiredParameter);
        }

    });

    if (missingParams.length > 0) {
        return {
            ok: false,
            message: `The required parameters '${missingParams.join("', '")}' are missing from this invokation.`
        }
    }

    return {
        ok: true,
        message: ''
    };

}

function main(params) {

    console.log(params);
    console.log('MEM:', process.memoryUsage().heapUsed / 1000000, 'mb');

    const TMP_FOLDER = params.TMP_FOLDER || '/tmp';

    const parametersAreValid = checkParameters(params);

    if (!parametersAreValid.ok) {
        // throw 'Required parameters are not set';
        return {
            status: 'err',
            message: parametersAreValid.message
        }
    }

    const S3 = new AWS.S3({
        apiKeyId: params.STORAGE_KEY,
        endpoint: params.OBJECT_STORAGE_ENDPOINT,
        ibmAuthEndpoint: "https://iam.ng.bluemix.net/oidc/token",
        serviceInstanceId: params.OBJECT_INSTANCE_ID
    });

    console.log(S3.endpoint.hostname);

    if (!params.file) {
        return {
            status: "err",
            message: 'No file passed for processing. Please run this program with an absolute or relative file path passed as the first argument.'
        }
    }

    return fetch(params.file)
        .then(res => {
            if (res.ok) {
                return res.buffer();
            } else {
                throw res;
            }
        })
        .then(imageBuffer => {

            console.log(imageBuffer);
            console.log('MEM:', process.memoryUsage().heapUsed / 1000000, 'mb');
            const imageObject = sharp(imageBuffer);

            return imageObject
                .metadata()
                .then(metadata => {
                    return {
                        info: metadata,
                        images: [imageObject, imageObject.clone()]
                    }
                });

        })
        .then(data => {

            console.log(data);
            console.log('MEM:', process.memoryUsage().heapUsed / 1000000, 'mb');

            const widerThanIsTall = data.info.width >= data.info.height;

            const cropDimensions = {
                width: widerThanIsTall ? data.info.width / 2 | 0 : data.info.width,
                height: widerThanIsTall ? data.info.height : data.info.height / 2 | 0
            };

            const crops = data.images.map((image, idx) => {

                const dimensions = {
                    left: idx === 0 ? 0 : widerThanIsTall ? cropDimensions.width : 0,
                    top: idx === 0 ? 0 : widerThanIsTall ? 0 : cropDimensions.height,
                    width: cropDimensions.width,
                    height: cropDimensions.height
                };
                console.log('MEM:', process.memoryUsage().heapUsed / 1000000, 'mb');
                return image
                    .extract(dimensions)
                    .jpeg({
                        force: true
                    })
                    .toBuffer()
                    .then(buff => {
                        return {
                            buffer: buff,
                            info: {
                                width: cropDimensions.width,
                                height: cropDimensions.height
                            }
                        };
                    });
            });

            return Promise.all(crops);

        })
        .then(crops => {
            console.log(crops);
            console.log('MEM:', process.memoryUsage().heapUsed / 1000000, 'mb');
            const uploads = crops.map((crop, idx) => {

                return new Promise((resolve, reject) => {

                    const bucketPath = `${params.processName}/${params.divisionLevel}/${idx}-${uuid()}.jpg`;

                    S3.putObject({
                        Bucket: params.BUCKETNAME,
                        Key: bucketPath,
                        Body: crop.buffer,
                        ACL: 'public-read'
                    }, (err, data) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve({
                                image: crop,
                                publicPath: `https://${params.OBJECT_STORAGE_ENDPOINT}/${params.BUCKETNAME}/${bucketPath}`
                            });
                        }
                    });

                });

            })

            return Promise.all(uploads);

        })
        .then(halves => {
            const nextJobs = [];

            // Further invocations
            halves.forEach(half => {

                console.log(half);

                if (half.image.info.width > Number(params.targetSize) || half.image.info.height > Number(params.targetSize)) {
                    const invocationURL = `${params.INVOCATION_FUNCTION_URL}?divisionLevel=${Number(params.divisionLevel) + 1}&processName=${params.processName}&file=${half.publicPath}`;
                    fetch(invocationURL);
                    nextJobs.push(invocationURL);
                }

            });

            console.log('MEM:', process.memoryUsage().heapUsed / 1000000, 'mb');
            console.timeEnd('program');
            return {
                status: "ok",
                message: nextJobs.length > 0 ? 'Divisions successfully. Subsequent divisions triggered' : "Divisions successfully. No further divisions to perform.",
                data: nextJobs
            };
        })
        .catch(err => {
            console.log(err)
            return {
                status: "err",
                message: err
            };
        });

}

exports.main = metrics(main);