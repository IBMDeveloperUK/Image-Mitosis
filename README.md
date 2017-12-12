# Image Mitosis
An experiment in measuring the efficiency and performance of various serverless cloud platforms (starting with IBM Cloud)

## Purpose

This is the code for a serverless function that accepts the URL to an publically accessible image file, requests it, splits it into two equal parts along its longest axis (or vertically, if each axis is equal), writes the two halves to an object storage bucket, and then triggers two more instances of itself with the locations of the newly created images it just uploaded.

This will repeat until the output images are 50x50 pixels, at which point the process halts.

## Installation and Running (locally)
1. Clone this repo
2. Enter the cloned directory
3. Run `npm i` to install dependencies
4. Create a `.env` file and populate with the required environment parameters (detailed below)
5. Run `node invoke.js` to run the program locally

## Environment variables and other prerequisites

The following are environment variables required to successfully run this program.

**STORAGE_KEY**
- An API key for an IBM Cloud Object Storage instance

**OBJECT_STORAGE_ENDPOINT**
- The endpoint for the IBM Cloud Object Storage instance you wish to write files to.

**OBJECT_INSTANCE_ID**
- The instance ID for the IBM Cloud Object Storage instance. 

**INVOCATION_FUNCTION_URL**
- The public URL to invoke the cloud function at the successful conclusion of this 
program (This should be the URL of this function when uploaded to the Openwhisk/IBM Cloud Function platform.)

**BUCKETENDPOINT**
- The hostname of the IBM Cloud Storage bucket

**BUCKETNAME**
- The name of the bucket you wish to write files to.

**TEST_FILE**
- A publically accessible URL to an image file that you wish to divide.

## To do...

- Add logging of events processes to external database for later analysis
- Use serverless framework for easy cross-platform deployment of function for testing
- Create naming convention to enable piecing together of smaller images to recreate the whole
- Document the foils and foibles of implementing this across the different cloud platforms.
- Document the mapping and acquisition of IBM Cloud Object Storage variables across to AWS-SDK variables.
- Document deployment to the various cloud platforms (but predominently IBM Cloud)